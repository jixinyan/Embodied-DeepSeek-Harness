import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { randomUUID } from 'node:crypto';
import type { Context } from '@deepseek-ai/cordis';
import type { AgentHandle, AssistantStreamFrame } from '@deepseek-ai/dsh-agent';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import { createDshSession } from '@edh/agents';
import type { ContractValidator, InvocationBrief } from '@edh/contracts';
import type { LoadedTeam } from '@edh/teams';

export interface Assignment {
  id: string;
  member: string;
  sessionId: string;
  brief: InvocationBrief;
}
export interface SessionHooks {
  tools(assignment: Assignment): readonly ToolDefinition[];
  context?(assignment: Assignment): Record<string, unknown>;
  event(type: string, detail: Record<string, unknown>): void;
  audit(assignmentId: string, events: unknown): void;
  stream?(assignmentId: string, frame: AssistantStreamFrame): void;
}
/** Delegation creates a neutral-host DSH session; delivery uses the original inbox. */
export class TeamSessions {
  private readonly live = new Map<
    string,
    {
      assignment: Assignment;
      handle: AgentHandle;
      timer: ReturnType<typeof setTimeout> | null;
      retiring: boolean;
    }
  >();
  private readonly assignments = new Map<string, Assignment>();
  private readonly retirements = new Map<string, Promise<void>>();
  private readonly completions = new Map<string, Promise<void>>();
  private closed = false;
  private closePromise: Promise<void> | undefined;
  private readonly pendingCreation = new Set<Promise<Assignment>>();
  private readonly lateCleanupErrors: unknown[] = [];
  private readonly creating = new Set<string>();
  constructor(
    private readonly host: Context,
    readonly team: LoadedTeam,
    private readonly validator: ContractValidator,
    private readonly hooks: SessionHooks,
    private readonly model: (id: string) => { provider: string; model: string },
    private readonly lifetimeMs = 120_000,
  ) {}
  create(member: string, brief: InvocationBrief): Promise<Assignment> {
    const pending = this.createAssignment(member, brief);
    this.pendingCreation.add(pending);
    void pending.then(
      () => this.pendingCreation.delete(pending),
      () => this.pendingCreation.delete(pending),
    );
    return pending;
  }
  private async createAssignment(member: string, brief: InvocationBrief): Promise<Assignment> {
    if (this.closed || this.live.size + this.creating.size >= 64)
      throw new Error('Assignment admission closed or limit reached.');
    this.validator.parse('InvocationBrief', brief);
    const role = this.team.members[member];
    if (!role || brief.team_run_id !== this.team.teamRunId)
      throw new Error('Unknown member or foreign team.');
    if (this.assignments.has(brief.assignment_id) || this.creating.has(brief.assignment_id))
      throw new Error('Assignment already exists.');
    if (brief.tools_and_limits.allowed_tools.some((name) => !role.definition.tools.includes(name)))
      throw new Error('Brief exceeds role tool authority.');
    const assignment = structuredClone({
      id: brief.assignment_id,
      member,
      sessionId: randomUUID(),
      brief,
    });
    this.creating.add(assignment.id);
    try {
      const binding = this.model(role.model);
      const handle = await createDshSession(this.host, {
        sessionId: assignment.sessionId,
        ...binding,
        instructions: `${role.instructions}\n\nTools use double underscores in place of dots. Source: ${this.team.sourceDigest}.\nEvery message is explicit context. Never infer another role's hidden conversation.\nUse agent__report to return assignment work to your fixed caller. Start expectedVersion at 0; use the returned version for later reports. Use insufficient_context with specific requestedContext and result=null when blocked. A completed/failed/cancelled report is final for this assignment. Custom output_schema constrains completed report.result. Use team__query to inspect your own or a directly delegated assignment's report. Use team__ack_report with the exact assignmentId and reportId after assessing a received report. State accepted or rejected and give a concise summary; this acknowledgement is immutable and does not verify physical success. Delivery settlement is session quiescence, not this acknowledgement. Never treat an analysis report as formal physical success.`,
        tools: this.hooks.tools(assignment),
        todo: brief.tools_and_limits.allowed_tools.includes('todo_write'),
        ...(this.host.get('compaction')
          ? {
              runtimeContext: () =>
                JSON.stringify({
                  kind: 'authoritative_assignment_state',
                  instruction:
                    'This is scoped host state, not a new command or permission. Historical summaries are fallible. Use tools to retrieve current evidence and plans; a stopped execution is not a passed verdict.',
                  assignmentId: assignment.id,
                  member: assignment.member,
                  objective: assignment.brief.objective,
                  taskScope: assignment.brief.task_scope,
                  successContract: assignment.brief.success_contract,
                  toolsAndLimits: assignment.brief.tools_and_limits,
                  expectedOutput: assignment.brief.expected_output,
                  current: this.hooks.context?.(structuredClone(assignment)) ?? {},
                }),
            }
          : {}),
      });
      if (this.closed) {
        try {
          await handle.dispose();
        } catch (error) {
          this.lateCleanupErrors.push(error);
        }
        throw new Error('Team closed during creation.');
      }
      const entry = {
        assignment,
        handle,
        timer: null as ReturnType<typeof setTimeout> | null,
        retiring: false,
      };
      this.assignments.set(assignment.id, assignment);
      this.live.set(assignment.id, entry);
      handle.agent.ctx.on('agent/status', ({ status }) => {
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = null;
        if (status === 'running' && !entry.retiring) {
          entry.timer = setTimeout(() => {
            handle.agent.cancel({ kind: 'user' });
            this.hooks.event('agent.deadline', { assignmentId: assignment.id, member });
          }, this.lifetimeMs);
          entry.timer.unref();
        }
        this.hooks.event('agent.status', { assignmentId: assignment.id, member, status });
      });
      let turn = 0;
      handle.agent.ctx.on('agent/assistant-stream', ({ frame }) =>
        this.hooks.stream?.(assignment.id, frame),
      );
      handle.agent.ctx.on('session/event', (_session, event) => {
        if (event.type === 'turn/start') turn = event.data.turn;
        const identity = {
          assignmentId: assignment.id,
          member,
          sessionId: assignment.sessionId,
          sessionSequence: event.seq,
          turn,
        };
        if (
          event.type === 'edh/visual-history' ||
          event.type === 'compaction/start' ||
          event.type === 'compaction/end' ||
          event.type === 'compaction/summary' ||
          event.type === 'compaction/prune'
        )
          this.hooks.event('agent.context', { ...identity, type: event.type, data: event.data });
        if (event.type === 'request/context')
          this.hooks.event('agent.context-capacity', { ...identity, context: event.data });
        if (event.type === 'todo/write')
          this.hooks.event('agent.todos', { ...identity, todos: event.data.todos });
        if (event.type === 'assistant/message')
          this.hooks.event('agent.output', {
            ...identity,
            step: event.data.step,
            message: event.data.message,
            usage: event.data.usage ?? null,
            interrupted: event.data.interrupted ?? false,
          });
        if (event.type === 'turn/end')
          this.hooks.event('agent.turn-ended', { ...identity, reason: event.data.reason });
        if (event.type === 'step/start')
          this.hooks.event('agent.step-started', { ...identity, step: event.data.step });
        if (event.type === 'tool/call')
          this.hooks.event('dsh.tool-call', { ...identity, data: event.data });
        if (event.type === 'tool/result' && event.surfaceOp === 'append')
          this.hooks.event('dsh.tool-result', { ...identity, data: event.data });
      });
      this.hooks.event('agent.created', {
        assignment,
        model: role.model,
        tools: brief.tools_and_limits.allowed_tools,
      });
      return structuredClone(assignment);
    } finally {
      this.creating.delete(assignment.id);
    }
  }
  async deliver(
    assignmentId: string,
    payload: unknown,
    sender: string,
    images: readonly ImageAttachmentRef[] = [],
  ): Promise<void> {
    if (this.closed) throw new Error('Team is closed.');
    const entry = this.live.get(assignmentId);
    if (!entry || !this.acceptsMessages(assignmentId))
      throw new Error('Destination assignment is unknown, finishing or retired.');
    const attachments = structuredClone(images);
    if (attachments.length > 16) throw new Error('Message exceeds the image reference bound.');
    const before = entry.handle.agent.session.snapshotEvents().length;
    const messageId = randomUUID();
    this.hooks.event('message.delivered', {
      messageId,
      sender,
      recipient: assignmentId,
      payload,
      images: attachments,
    });
    entry.handle.agent.followup(
      createUserMessage({
        source: { kind: 'plugin', plugin: 'edh-team', form: 'relay' },
        content: [
          { type: 'text', text: JSON.stringify({ messageId, sender, payload }) },
          ...attachments.map((attachment) => ({ type: 'image' as const, attachment })),
        ],
      }),
    );
    await entry.handle.agent.whenIdle();
    const events = entry.handle.agent.session.snapshotEvents();
    this.hooks.audit(assignmentId, events);
    const meter = this.host.get('tokenMeter');
    if (meter) {
      const measurement = meter.measure(entry.handle.agent.session);
      this.hooks.event('agent.context-usage', {
        assignmentId,
        estimatedTokens: measurement.totalTokens,
        surfaceTokens: measurement.surfaceTokens,
        surfaceNodes: measurement.nodes.length,
        contextWindow: entry.handle.agent.session.requestContext()?.contextWindow ?? null,
      });
    }
    for (const event of events.slice(before)) {
      if (event.type === 'turn/end' && event.data.reason.kind === 'error')
        throw new Error(event.data.reason.error.message);
    }
  }
  get(id: string): Assignment {
    const assignment = this.assignments.get(id);
    if (!assignment) throw new Error('Unknown assignment.');
    return structuredClone(assignment);
  }
  isLive(id: string): boolean {
    const entry = this.live.get(id);
    return !this.closed && Boolean(entry && !entry.retiring);
  }
  acceptsMessages(id: string): boolean {
    return this.isLive(id) && !this.completions.has(id);
  }
  /** Close new work, then let the current native turn retain its receipt and final output. */
  finish(id: string, reason: string): Promise<void> {
    const existing = this.completions.get(id) ?? this.retirements.get(id);
    if (existing) return existing;
    const entry = this.live.get(id);
    if (!entry) return Promise.reject(new Error('Unknown assignment.'));
    const completion = Promise.resolve().then(async () => {
      try {
        await entry.handle.agent.whenIdle();
      } finally {
        await this.retire(id, reason);
      }
    });
    this.completions.set(id, completion);
    return completion;
  }
  retire(id: string, reason: string): Promise<void> {
    const existing = this.retirements.get(id);
    if (existing) return existing;
    const entry = this.live.get(id);
    if (!entry) return Promise.reject(new Error('Unknown assignment.'));
    // Close admission and request native cancellation synchronously, before waiting for cleanup.
    entry.retiring = true;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    const errors: unknown[] = [];
    const completion = Promise.resolve().then(async () => {
      try {
        await entry.handle.agent.whenIdle();
        this.hooks.audit(id, entry.handle.agent.session.snapshotEvents());
      } catch (error) {
        errors.push(error);
      }
      try {
        await entry.handle.dispose();
      } catch (error) {
        errors.push(error);
      }
      this.live.delete(id);
      try {
        this.hooks.event('agent.retired', {
          assignmentId: id,
          member: entry.assignment.member,
          reason,
          cleanupFailed: errors.length > 0,
        });
      } catch (error) {
        errors.push(error);
      }
      if (errors.length)
        throw new AggregateError(errors, 'Assignment retirement failed after cleanup attempts.');
    });
    this.retirements.set(id, completion);
    try {
      entry.handle.agent.cancel({ kind: 'user' });
    } catch (error) {
      errors.push(error);
    }
    return completion;
  }
  cancelAll(): void {
    for (const entry of this.live.values()) entry.handle.agent.cancel({ kind: 'user' });
  }
  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closed = true;
    this.closePromise = Promise.resolve().then(async () => {
      const errors: unknown[] = [];
      for (const id of this.live.keys())
        void this.retire(id, 'team-shutdown').catch(() => undefined);
      // Cancel live work immediately while late creations drain and dispose themselves.
      const [retired] = await Promise.all([
        Promise.allSettled([
          ...new Set([...this.retirements.values(), ...this.completions.values()]),
        ]),
        Promise.allSettled([...this.pendingCreation]),
      ]);
      for (const result of retired)
        if (result.status === 'rejected')
          errors.push(
            ...(result.reason instanceof AggregateError ? result.reason.errors : [result.reason]),
          );
      this.live.clear();
      errors.push(...this.lateCleanupErrors);
      if (errors.length)
        throw new AggregateError(
          [...new Set(errors)],
          'Team shutdown failed; all sessions were disposed or attempted.',
        );
    });
    return this.closePromise;
  }
}
