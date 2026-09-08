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
  event(type: string, detail: Record<string, unknown>): void;
  audit(assignmentId: string, events: unknown): void;
  stream?(assignmentId: string, frame: AssistantStreamFrame): void;
}
/** Delegation creates a neutral-host DSH session; delivery uses the original inbox. */
export class TeamSessions {
  private readonly live = new Map<
    string,
    { assignment: Assignment; handle: AgentHandle; timer: ReturnType<typeof setTimeout> | null }
  >();
  private closed = false;
  constructor(
    private readonly host: Context,
    readonly team: LoadedTeam,
    private readonly validator: ContractValidator,
    private readonly hooks: SessionHooks,
    private readonly model: (id: string) => { provider: string; model: string },
    private readonly lifetimeMs = 120_000,
  ) {}
  async create(member: string, brief: InvocationBrief): Promise<Assignment> {
    if (this.closed || this.live.size >= 64)
      throw new Error('Assignment admission closed or limit reached.');
    this.validator.parse('InvocationBrief', brief);
    const role = this.team.members[member];
    if (!role || brief.team_run_id !== this.team.teamRunId)
      throw new Error('Unknown member or foreign team.');
    if (this.live.has(brief.assignment_id)) throw new Error('Assignment already exists.');
    if (brief.tools_and_limits.allowed_tools.some((name) => !role.definition.tools.includes(name)))
      throw new Error('Brief exceeds role tool authority.');
    const assignment = structuredClone({
      id: brief.assignment_id,
      member,
      sessionId: randomUUID(),
      brief,
    });
    const binding = this.model(role.model);
    const handle = await createDshSession(this.host, {
      sessionId: assignment.sessionId,
      ...binding,
      instructions: `${role.instructions}\n\nTools use double underscores in place of dots. Source: ${this.team.sourceDigest}.\nEvery message is explicit context. Never infer another role's hidden conversation.`,
      tools: this.hooks.tools(assignment),
      todo: brief.tools_and_limits.allowed_tools.includes('todo_write'),
    });
    if (this.closed) {
      await handle.dispose();
      throw new Error('Team closed during creation.');
    }
    const entry = { assignment, handle, timer: null as ReturnType<typeof setTimeout> | null };
    this.live.set(assignment.id, entry);
    handle.agent.ctx.on('agent/status', ({ status }) => {
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = null;
      if (status === 'running') {
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
      if (event.type === 'tool/result')
        this.hooks.event('dsh.tool-result', { ...identity, data: event.data });
    });
    this.hooks.event('agent.created', {
      assignment,
      model: role.model,
      tools: brief.tools_and_limits.allowed_tools,
    });
    return structuredClone(assignment);
  }
  async deliver(assignmentId: string, payload: unknown, sender: string): Promise<void> {
    if (this.closed) throw new Error('Team is closed.');
    const entry = this.live.get(assignmentId);
    if (!entry) throw new Error('Unknown destination assignment.');
    const before = entry.handle.agent.session.snapshotEvents().length;
    const messageId = randomUUID();
    this.hooks.event('message.delivered', { messageId, sender, recipient: assignmentId, payload });
    entry.handle.agent.followup(
      createUserMessage({
        source: { kind: 'plugin', plugin: 'edh-team', form: 'relay' },
        content: [{ type: 'text', text: JSON.stringify({ messageId, sender, payload }) }],
      }),
    );
    await entry.handle.agent.whenIdle();
    const events = entry.handle.agent.session.snapshotEvents();
    this.hooks.audit(assignmentId, events);
    for (const event of events.slice(before)) {
      if (event.type === 'turn/end' && event.data.reason.kind === 'error')
        throw new Error(event.data.reason.error.message);
    }
  }
  get(id: string): Assignment {
    const entry = this.live.get(id);
    if (!entry) throw new Error('Unknown assignment.');
    return structuredClone(entry.assignment);
  }
  cancelAll(): void {
    for (const entry of this.live.values()) entry.handle.agent.cancel({ kind: 'user' });
  }
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.cancelAll();
    await Promise.all(
      [...this.live.values()].map(async (entry) => {
        if (entry.timer) clearTimeout(entry.timer);
        await entry.handle.agent.whenIdle();
        this.hooks.audit(entry.assignment.id, entry.handle.agent.session.snapshotEvents());
        await entry.handle.dispose();
      }),
    );
    this.live.clear();
  }
}
