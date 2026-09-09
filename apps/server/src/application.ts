import { randomUUID } from 'node:crypto';
import type { Context } from '@deepseek-ai/cordis';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import {
  ContractValidator,
  LifecycleValidator,
  type InvocationBrief,
  type SubgoalRequest,
  type SuccessCheck,
  type VerificationResult,
  type CheckResult,
  type EvidenceRef,
  type PlanDocument,
} from '@edh/contracts';
import {
  TeamSessions,
  AssignmentReports,
  type ReportInput,
  type Assignment,
} from '@edh/communication';
import type { LoadedTeam } from '@edh/teams';
import { LocalStore, SessionAudits } from '@edh/storage';
import { AssignmentFiles } from '@edh/files';
import { TaskPlans } from '@edh/planning';
import { SkillLibrary } from '@edh/memory';
import type { EmbodiedBackend, BackendUpdate, SensorSample } from '@edh/execution';
import { TaskGoals, type GoalBinding, type RunState } from '@edh/tasks';
export type { GoalBinding } from '@edh/tasks';

export { CORE_TOOLS } from '@edh/tools';
import {
  CORE_TOOL_PARAMETERS,
  assertObjectJsonSchema,
  validateJsonSchemaValue,
  ToolArgsError,
  assertCoreInputLimits,
} from '@edh/tools';
export const terminal = (state: RunState['state']) =>
  ['succeeded', 'failed', 'cancelled', 'interrupted', 'unknown'].includes(state);
interface CheckedBoundary {
  requestId: string;
  executionId: string;
  boundaryId: string;
  facts: CheckResult[];
  sample: SensorSample;
}
interface RecoveryObservation {
  id: string;
  goal: GoalBinding;
  context: Record<string, unknown>;
  trace: { sequence: number; type: string; detail: Record<string, unknown> }[];
  cursor: number;
  delivery: Promise<void>;
  timer?: ReturnType<typeof setTimeout>;
  evolverId?: string;
  result?: VerificationResult;
  error?: string;
}
export interface ApplicationOptions {
  goal: GoalBinding;
  allowedSubgoalChecks?: readonly SuccessCheck[];
  predefinedGoals?: readonly GoalBinding[];
  /** Trusted deployment-owned additions, registered directly in the role's DSH scope. */
  additionalTools?: Readonly<Record<string, (assignment: Assignment) => ToolDefinition>>;
  host: Context;
  team: LoadedTeam;
  validator: ContractValidator;
  store: LocalStore;
  backend: EmbodiedBackend;
  instruction: string;
  scenario: string;
  model: (id: string) => { provider: string; model: string };
  onChange?: (state: RunState) => void;
  assignmentLifetimeMs?: number;
}
/** EDH task coordination and native tool bodies. Agent turns and dispatch remain DSH-owned. */
export class UpperRun {
  readonly state: RunState;
  readonly sessions: TeamSessions;
  private readonly gates: LifecycleValidator;
  private readonly plans: TaskPlans;
  private readonly files: AssignmentFiles;
  private readonly reports: AssignmentReports;
  private readonly skills: SkillLibrary;
  private readonly evidence = new Map<string, SensorSample>();
  private readonly grants = new Map<string, Set<string>>();
  private readonly checks = new Map<string, CheckedBoundary>();
  private readonly pending = new Set<Promise<void>>();
  private readonly formalBoundaries = new Set<string>();
  private monitorBusy = false;
  private latestMonitor: BackendUpdate | undefined;
  private version = 0;
  private closed = false;
  private unsubscribe: () => void;
  private readonly goals: TaskGoals;
  private goal: GoalBinding;
  private attemptSequence = 1;
  private readonly recoveries = new Map<string, RecoveryObservation>();
  constructor(private readonly options: ApplicationOptions) {
    this.goals = new TaskGoals(
      options.validator,
      options.goal,
      options.allowedSubgoalChecks,
      options.predefinedGoals,
    );
    this.goal = this.goals.get(options.goal.id);
    const team = { ...options.team, teamRunId: randomUUID() };
    this.state = {
      id: randomUUID(),
      instruction: options.instruction,
      scenario: options.scenario,
      source: options.backend.source,
      state: 'running',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      teamDigest: team.sourceDigest,
      teamId: team.definition.team_id,
      decisionAssignmentId: '',
      attempt: 1,
      activeGoalId: this.goal.id,
      finalGoalId: options.goal.id,
      activeRecoveryId: null,
      recoveryId: null,
      retryChanges: [],
      assignments: {},
      events: [],
      executions: [],
      requests: [],
      verdicts: [],
      latestSensor: null,
      agentSeen: {},
      skillIds: [],
      error: null,
    };
    this.gates = new LifecycleValidator(options.validator);
    this.plans = new TaskPlans(options.store, options.validator);
    this.files = new AssignmentFiles(options.store);
    this.reports = new AssignmentReports(options.store, options.validator);
    this.skills = new SkillLibrary(options.store, options.validator);
    const audits = new SessionAudits(options.store);
    this.sessions = new TeamSessions(
      options.host,
      team,
      options.validator,
      {
        tools: (a) => this.tools(a),
        stream: (id, frame) => {
          const streams = (this.state.agentStreams ??= {});
          if (frame.type === 'start')
            streams[id] = {
              attemptId: frame.attemptId,
              revision: frame.revision,
              text: '',
              reasoning: '',
              status: 'streaming',
            };
          const stream = streams[id];
          if (!stream || stream.attemptId !== frame.attemptId) return;
          stream.revision = frame.revision;
          if (frame.type === 'chunk') {
            if (frame.chunk.type === 'text-delta')
              stream.text = (stream.text + frame.chunk.text).slice(-16000);
            if (frame.chunk.type === 'reasoning-delta')
              stream.reasoning = (stream.reasoning + frame.chunk.text).slice(-16000);
          }
          if (frame.type === 'end') stream.status = frame.outcome.kind;
          this.options.onChange?.(this.snapshot());
        },
        event: (type, detail) => {
          if (type === 'agent.created') {
            const a = detail.assignment as Assignment;
            this.state.assignments[a.id] = {
              ...a,
              status: 'idle',
              model: String(detail.model),
              tools: detail.tools as string[],
            };
          }
          if (type === 'agent.status') {
            const a = this.state.assignments[String(detail.assignmentId)];
            if (a) a.status = String(detail.status);
          }
          const row = this.state.assignments[String(detail.assignmentId)];
          if (row && type === 'agent.todos') {
            row.todos = structuredClone(detail.todos) as NonNullable<typeof row.todos>;
            row.todoSequence = Number(detail.sessionSequence);
            row.todoTurn = Number(detail.turn);
          }
          if (row && type === 'agent.step-started') {
            row.turn = Number(detail.turn);
            row.step = Number(detail.step);
          }
          this.event(type, detail);
          if (type === 'agent.deadline' && !terminal(this.state.state)) {
            const recovery = this.recoveryForAssignment(String(detail.assignmentId));
            if (recovery) this.learningFailure(recovery, new Error('Evolver deadline exceeded.'));
            else this.spawn(this.fail(new Error('Assignment deadline exceeded.')));
          }
        },
        audit: (id, events) => {
          audits.append(this.state.id, id, events);
        },
      },
      options.model,
      options.assignmentLifetimeMs,
    );
    this.unsubscribe = options.backend.subscribe((update) => {
      try {
        this.backendUpdate(update);
      } catch (error) {
        this.spawn(this.fail(error));
      }
    });
  }
  snapshot(): RunState {
    return structuredClone(this.state);
  }
  private event(type: string, detail: Record<string, unknown>): void {
    if (this.closed) return;
    if (this.state.events.length >= 4000) throw new Error('Run event budget exceeded.');
    this.state.updatedAt = new Date().toISOString();
    this.state.events.push({
      sequence: this.state.events.length + 1,
      at: this.state.updatedAt,
      type,
      detail: structuredClone(detail),
    });
    const latest = this.state.events.at(-1)!;
    this.options.store.put(`event:${this.state.id}:${latest.sequence}`, latest, 0);
    const { events, ...projection } = this.state;
    this.version = this.options.store.put(
      `run:${this.state.id}`,
      { ...projection, events: [], eventCount: events.length },
      this.version,
    );
    this.options.onChange?.(this.snapshot());
    const ownerEvent =
      (type.startsWith('tool.') || type === 'agent.output' || type === 'agent.todos') &&
      detail.assignmentId === this.state.decisionAssignmentId;
    const recovery = this.activeRecovery();
    if (
      recovery &&
      !recovery.result &&
      !terminal(this.state.state) &&
      (ownerEvent ||
        [
          'plan.updated',
          'goal.selected',
          'execution.requested',
          'execution.updated',
          'verification.completed',
          'retry.accepted',
        ].includes(type))
    ) {
      recovery.trace.push({ sequence: latest.sequence, type, detail: structuredClone(detail) });
      this.persistRecovery(recovery);
      if (!recovery.timer)
        recovery.timer = setTimeout(() => {
          delete recovery.timer;
          this.learn(recovery, this.flushRecovery(recovery));
        }, 150);
    }
  }
  private activeRecovery(): RecoveryObservation | undefined {
    return this.state.activeRecoveryId
      ? this.recoveries.get(this.state.activeRecoveryId)
      : undefined;
  }
  private recoveryForAssignment(id: string): RecoveryObservation | undefined {
    return [...this.recoveries.values()].find((r) => r.evolverId === id);
  }
  private persistRecovery(recovery: RecoveryObservation): void {
    const key = `recovery:${recovery.id}`;
    this.options.store.put(
      key,
      {
        context: recovery.context,
        events: recovery.trace,
        result: recovery.result ?? null,
        error: recovery.error ?? null,
      },
      this.options.store.get(key)?.version ?? 0,
    );
  }
  private learningFailure(recovery: RecoveryObservation, error: unknown): void {
    if (recovery.error) return;
    recovery.error = error instanceof Error ? error.message : String(error);
    this.persistRecovery(recovery);
    this.event('recovery.failed', { recoveryId: recovery.id, error: recovery.error });
  }
  private learn(recovery: RecoveryObservation, work: Promise<void>): void {
    const tracked = work
      .catch((error) => this.learningFailure(recovery, error))
      .finally(() => this.pending.delete(tracked));
    this.pending.add(tracked);
  }
  private currentRequest(): SubgoalRequest | undefined {
    return this.state.requests.findLast((r) => r.goal_id === this.goal.id);
  }
  private currentVerdict(): VerificationResult | undefined {
    return this.state.verdicts.findLast((v) => v.task_scope.goal_id === this.goal.id);
  }
  private stoppedAndVerified(): void {
    const execution = this.options.backend.query();
    if (!execution) return;
    if (execution.state !== 'ended' || !execution.device_confirmed)
      throw new Error('Goal selection requires confirmed ended execution.');
    if (
      !this.state.verdicts.some(
        (v) =>
          v.execution_id === execution.execution_id &&
          v.boundary_event_id === execution.boundary_event_id,
      )
    )
      throw new Error('Goal selection must wait for formal verification.');
  }
  private readyGoal(id: string): GoalBinding {
    const plan = this.plans.read(this.state.id);
    if (!plan) throw new Error('Write a task plan before selecting or executing a goal.');
    return this.goals.ready(plan, id, this.state.verdicts, this.state.requests);
  }

  private spawn(work: Promise<void>): void {
    const tracked = work
      .catch((error) => this.fail(error))
      .finally(() => this.pending.delete(tracked));
    this.pending.add(tracked);
  }
  private async fail(error: unknown): Promise<void> {
    if (terminal(this.state.state)) {
      if (this.state.state === 'succeeded') {
        this.state.error = error instanceof Error ? error.message : String(error);
        this.event('recovery.failed', { error: this.state.error, goalStatus: 'succeeded' });
      }
      return;
    }
    this.state.state = 'failed';
    this.state.error = error instanceof Error ? error.message : String(error);
    this.event('run.failed', { error: this.state.error });
    this.sessions.cancelAll();
    await this.options.backend.stop();
  }
  private owner(a: Assignment): void {
    if (a.id !== this.state.decisionAssignmentId)
      throw new Error('Only the decision owner may change the task or motion plan.');
  }
  private verifier(a: Assignment): void {
    if (a.member !== this.sessions.team.definition.bindings.final_verifier)
      throw new Error('Only the designated verifier may perform formal checks.');
    if (
      a.brief.task_scope.goal_id !== this.goal.id ||
      a.brief.task_scope.attempt_id !== `attempt-${this.state.attempt}`
    )
      throw new Error('Verifier belongs to a stale goal or attempt.');
  }
  private permit(a: Assignment, ids: readonly string[]): SensorSample[] {
    return ids.map((id) => {
      if (!this.grants.get(a.id)?.has(id))
        throw new Error('Evidence is not in assignment context.');
      const sample = this.evidence.get(id);
      if (!sample || sample.evidence.visibility !== 'agent')
        throw new Error('Evidence is not agent-visible.');
      return sample;
    });
  }
  private observe(a: Assignment, sample: SensorSample): SensorSample {
    this.evidence.set(sample.evidence.id, structuredClone(sample));
    const grant = this.grants.get(a.id) ?? new Set<string>();
    grant.add(sample.evidence.id);
    this.grants.set(a.id, grant);
    this.state.agentSeen[a.id] = structuredClone(sample);
    this.state.latestSensor = structuredClone(sample);
    this.event('observation.consumed', {
      assignmentId: a.id,
      evidence: sample.evidence,
      sequence: sample.sequence,
    });
    return sample;
  }
  private brief(
    member: string,
    objective: string,
    caller?: Assignment,
    context = '',
    refs: string[] = [],
  ): InvocationBrief {
    const role = this.sessions.team.members[member];
    if (!role) throw new Error('Unknown team member.');
    const samples = caller ? this.permit(caller, refs) : [];
    return {
      schema_version: 'physical.invocation.v1',
      assignment_id: randomUUID(),
      caller_agent_id: caller?.sessionId ?? 'user',
      caller_assignment_id: caller?.id ?? 'user',
      team_run_id: this.sessions.team.teamRunId,
      objective,
      task_scope: {
        task_id: this.state.id,
        goal_id: this.goal.id,
        attempt_id: `attempt-${this.state.attempt}`,
        ...(this.state.activeRecoveryId ? { recovery_id: this.state.activeRecoveryId } : {}),
      },
      expected_output: {
        schema: role.outputSchema?.reference ?? 'builtin:AgentReport.v1',
        recipient: caller?.id ?? 'user',
      },
      entities: structuredClone(this.goal.entities),
      success_contract: structuredClone(this.goal.successContract),
      known_facts: samples.map((s) => ({
        statement: s.description,
        observed_at: s.evidence.observed_at,
        evidence_refs: [s.evidence.id],
      })),
      history_summary: context,
      changes: [...this.state.retryChanges],
      evidence_refs: refs,
      tools_and_limits: {
        allowed_tools: [...role.definition.tools],
        allowed_actions: [],
        budget: structuredClone(this.goal.budget),
      },
    };
  }
  private async assignment(
    member: string,
    objective: string,
    caller?: Assignment,
    context = '',
    refs: string[] = [],
  ): Promise<Assignment> {
    const brief = this.brief(member, objective, caller, context, refs);
    const a = await this.sessions.create(member, brief);
    this.grants.set(a.id, new Set(refs));
    return a;
  }
  async start(): Promise<void> {
    this.event('run.created', {
      source: this.state.source,
      scenario: this.state.scenario,
      teamDigest: this.state.teamDigest,
    });
    try {
      const a = await this.assignment(
        this.sessions.team.definition.entrypoint,
        this.state.instruction,
      );
      if (a.member !== this.sessions.team.definition.bindings.decision_owner)
        throw new Error('This application requires the entrypoint to be the decision owner.');
      this.state.decisionAssignmentId = a.id;
      this.spawn(this.sessions.deliver(a.id, { kind: 'initial', brief: a.brief }, 'user'));
    } catch (error) {
      await this.fail(error);
      throw error;
    }
  }
  private tools(a: Assignment): ToolDefinition[] {
    return a.brief.tools_and_limits.allowed_tools
      .filter((logical) => logical !== 'todo_write')
      .map((logical) => {
        const extra = this.options.additionalTools?.[logical];
        let native: ToolDefinition;
        if (extra) {
          if (CORE_TOOL_PARAMETERS[logical])
            throw new Error('Additional tools cannot replace core authority checks.');
          native = extra(structuredClone(a));
          if (native.name !== logical.replaceAll('.', '__'))
            throw new Error('Native tool name must match its logical binding.');
        } else {
          const properties = CORE_TOOL_PARAMETERS[logical];
          if (!properties) throw new Error(`Tool is not implemented: ${logical}`);
          native = {
            name: logical.replaceAll('.', '__'),
            description: `${logical}. Operates only within this assignment and task.`,
            parameters: {
              type: 'object',
              properties:
                logical === 'agent.report'
                  ? {
                      ...properties,
                      result: {
                        oneOf: [
                          this.sessions.team.members[a.member]!.outputSchema?.schema ?? {
                            type: 'object',
                            additionalProperties: true,
                          },
                          { type: 'null' },
                        ],
                      },
                    }
                  : properties,
              required: Object.keys(properties),
              additionalProperties: false,
            },
            output: {
              schema: { type: 'object', additionalProperties: true },
              render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
            },
            execute: async (args, exec) => {
              // Raw ToolDefinition owns input validation; use DSH's existing validator,
              // just as defineTool does, before any EDH side effects.
              const parameters = native.parameters;
              assertObjectJsonSchema(parameters);
              const violations = validateJsonSchemaValue(parameters, args, 'arguments');
              if (violations.length) throw new ToolArgsError(violations);
              assertCoreInputLimits(args as Record<string, unknown>);
              return this.invoke(a, logical, args as Record<string, unknown>, exec.signal);
            },
          };
        }
        // DSH still owns registration, schema checks, timeout and dispatch. This
        // application guard only enforces EDH run lifetime and records domain activity.
        return {
          ...native,
          timeoutMs: native.timeoutMs ?? 10_000,
          execute: async (args, exec) => {
            exec.signal.throwIfAborted();
            const recoveryWrite =
              this.state.state === 'succeeded' &&
              Boolean(this.recoveryForAssignment(a.id)?.result) &&
              (logical.startsWith('files.') ||
                logical.startsWith('skills.') ||
                logical === 'evidence.read' ||
                logical === 'agent.report');
            const receiptAccess =
              this.state.state === 'succeeded' &&
              ['team.query', 'team.ack_report'].includes(logical);
            if (this.closed || (terminal(this.state.state) && !recoveryWrite && !receiptAccess))
              throw new Error('Run is no longer writable.');
            const priorReport = this.reports.read(a.id);
            if (
              logical !== 'agent.report' &&
              logical !== 'team.query' &&
              logical !== 'team.ack_report' &&
              priorReport &&
              priorReport.report.status !== 'insufficient_context'
            )
              throw new Error(
                'Assignment has finished; delegate a fresh assignment for more work.',
              );
            this.event('tool.started', {
              assignmentId: a.id,
              tool: logical,
              callId: exec.callId,
              args,
            });
            try {
              const value = await native.execute(args, exec);
              exec.signal.throwIfAborted();
              this.event('tool.completed', {
                assignmentId: a.id,
                tool: logical,
                callId: exec.callId,
                result: value,
              });
              return value;
            } catch (error) {
              this.event('tool.failed', {
                assignmentId: a.id,
                tool: logical,
                callId: exec.callId,
                error: error instanceof Error ? error.message : String(error),
              });
              throw error;
            }
          },
        };
      });
  }
  private async invoke(
    a: Assignment,
    tool: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<object> {
    const s = (key: string) => String(args[key]);
    switch (tool) {
      case 'team.query': {
        const target = this.sessions.get(s('assignmentId'));
        if (target.id !== a.id && target.brief.expected_output.recipient !== a.id)
          throw new Error('Only the assignment or its direct caller may query its report.');
        return {
          assignmentId: target.id,
          member: target.member,
          agentStatus: this.state.assignments[target.id]!.status,
          ...this.reports.status(target.id),
        };
      }
      case 'team.ack_report': {
        const receipt = this.reports.acknowledge(s('assignmentId'), s('reportId'), a.id, {
          disposition: s('disposition') as 'accepted' | 'rejected',
          summary: s('summary'),
        });
        if (!receipt.replay)
          this.event('agent.report-acknowledged', {
            assignmentId: a.id,
            reportAssignmentId: s('assignmentId'),
            reportId: s('reportId'),
            acknowledgement: receipt.acknowledgement,
          });
        return receipt;
      }
      case 'agent.report': {
        const input = args as unknown as ReportInput;
        if (
          a.id !== this.state.decisionAssignmentId &&
          !this.recoveryForAssignment(a.id) &&
          a.brief.task_scope.attempt_id !== `attempt-${this.state.attempt}`
        )
          throw new Error('Report belongs to a stale attempt.');
        if (a.id === this.state.decisionAssignmentId && input.status !== 'insufficient_context')
          throw new Error(
            'Decision owner finishes the task through tasks.finish or tasks.abandon, not a role report.',
          );
        const samples = this.permit(a, input.evidenceRefs);
        const recipient = a.brief.expected_output.recipient;
        if (recipient !== 'user') this.sessions.get(recipient);
        const { record, replay } = this.reports.submit(
          a,
          input,
          this.sessions.team.members[a.member]!.outputSchema?.schema,
        );
        if (!replay) {
          this.state.assignments[a.id]!.report = structuredClone(record.report);
          this.state.assignments[a.id]!.reportVersion = record.version;
          this.event('agent.report', {
            assignmentId: a.id,
            reportId: record.id,
            version: record.version,
            recipient,
            report: record.report,
          });
          this.reports.markDelivery(record.id, {
            state: recipient === 'user' ? 'recorded' : 'queued',
          });
          if (recipient !== 'user') {
            for (const sample of samples) this.grants.get(recipient)!.add(sample.evidence.id);
            const delivery = this.sessions
              .deliver(
                recipient,
                {
                  kind: 'agent-report',
                  reportId: record.id,
                  version: record.version,
                  report: record.report,
                  evidence: samples,
                },
                a.id,
              )
              .then(
                () => {
                  this.reports.markDelivery(record.id, { state: 'settled' });
                  this.event('agent.report-delivery', {
                    reportId: record.id,
                    recipient,
                    state: 'settled',
                  });
                },
                (error: unknown) => {
                  const message = error instanceof Error ? error.message : String(error);
                  this.reports.markDelivery(record.id, { state: 'failed', error: message });
                  this.event('agent.report-delivery', {
                    reportId: record.id,
                    recipient,
                    state: 'failed',
                    error: message,
                  });
                  throw error;
                },
              );
            this.spawn(delivery);
          }
        }
        return {
          accepted: true,
          reportId: record.id,
          version: record.version,
          replay,
          recipient,
          delivery: this.reports.delivery(record.id)?.state ?? 'unconfirmed',
        };
      }
      case 'planning.read':
        return {
          plan: this.plans.read(this.state.id) ?? null,
          taskId: this.state.id,
          ownerAgentId: this.sessions.get(this.state.decisionAssignmentId).sessionId,
          ownerAssignmentId: this.state.decisionAssignmentId,
          successContract: structuredClone(this.goal.successContract),
          activeGoalId: this.goal.id,
          attemptId: `attempt-${this.state.attempt}`,
          ...this.goals.catalog(),
        };
      case 'planning.update': {
        this.owner(a);
        const plan = this.options.validator.parse('PlanDocument', args.plan);
        if (plan.task_id !== this.state.id) throw new Error('Foreign plan.');
        const admitted = this.goals.prepare(plan);
        this.plans.update(
          plan,
          Number(args.expectedVersion),
          { agentId: a.sessionId, assignmentId: a.id },
          this.state.verdicts,
          this.state.requests,
        );
        this.goals.admit(admitted);
        this.event('plan.updated', { plan });
        return { plan };
      }
      case 'files.read':
        return this.files.read(a.id, s('path'));
      case 'files.write':
        return this.files.write(a.id, s('path'), s('content'), Number(args.expectedVersion));
      case 'files.search':
        return { files: this.files.search(a.id, s('query')) };
      case 'team.delegate': {
        const target = await this.assignment(
          s('member'),
          s('objective'),
          a,
          s('context'),
          args.evidenceRefs as string[],
        );
        signal.throwIfAborted();
        this.spawn(
          this.sessions.deliver(target.id, { kind: 'delegated', brief: target.brief }, a.id),
        );
        return { assignmentId: target.id, accepted: true };
      }
      case 'team.send':
      case 'context.request':
      case 'context.respond': {
        const target = this.sessions.get(s('assignmentId'));
        const targetReport = this.reports.read(target.id);
        if (targetReport && targetReport.report.status !== 'insufficient_context')
          throw new Error('Recipient assignment has finished. Delegate a fresh assignment.');
        const refs = args.evidenceRefs as string[];
        const samples = this.permit(a, refs);
        if (target.id === a.id) throw new Error('Self messaging is not a delegation.');
        if (this.state.events.filter((e) => e.type === 'message.delivered').length >= 256)
          throw new Error('Message budget exceeded.');
        for (const ref of refs) this.grants.get(target.id)!.add(ref);
        this.spawn(
          this.sessions.deliver(
            target.id,
            { kind: tool, message: s('message'), evidence: samples },
            a.id,
          ),
        );
        return { accepted: true, recipient: target.id };
      }
      case 'perception.capture':
        return this.observe(a, this.options.backend.capture());
      case 'observation.turn_view':
        this.owner(a);
        return this.observe(
          a,
          await this.options.backend.turnView(s('direction') as 'left' | 'center' | 'right'),
        );
      case 'execution.query':
        return { execution: this.options.backend.query() ?? null };
      case 'execution.start': {
        this.owner(a);
        this.readyGoal(this.goal.id);
        this.stoppedAndVerified();
        if (this.state.requests.some((r) => r.attempt_id === `attempt-${this.state.attempt}`))
          throw new Error('Attempt already started; query its status instead of resubmitting.');
        const request: SubgoalRequest = {
          schema_version: 'physical.subgoal.v1',
          task_id: this.state.id,
          team_run_id: this.sessions.team.teamRunId,
          goal_id: this.goal.id,
          attempt_id: `attempt-${this.state.attempt}`,
          instruction: s('instruction'),
          entities: structuredClone(this.goal.entities),
          required_capabilities: [...this.goal.capabilities],
          success_contract: structuredClone(this.goal.successContract),
          budget: structuredClone(this.goal.budget),
          context_refs: [...(this.grants.get(a.id) ?? [])],
          decision_owner_id: a.sessionId,
          owner_assignment_id: a.id,
          idempotency_key: randomUUID(),
          ...(this.state.activeRecoveryId ? { recovery_id: this.state.activeRecoveryId } : {}),
        };
        this.options.validator.parse('SubgoalRequest', request);
        this.state.requests.push(request);
        this.state.state = 'running';
        this.event('execution.requested', { request });
        return { execution: await this.options.backend.start(request) };
      }
      case 'execution.pause':
        this.verifier(a);
        await this.options.backend.pause();
        return { execution: this.options.backend.query() ?? null };
      case 'execution.resume':
        this.owner(a);
        await this.options.backend.resume(a.sessionId);
        this.state.state = 'running';
        return { execution: this.options.backend.query()! };
      case 'tasks.select_goal': {
        this.owner(a);
        this.stoppedAndVerified();
        const next = this.readyGoal(s('goalId'));
        const failed = this.currentVerdict();
        if (next.id !== this.goal.id && failed?.status === 'failed' && !this.activeRecovery())
          throw new Error('Replan the failed subgoal before switching to a repair goal.');
        if (next.id !== this.goal.id) {
          this.goal = next;
          this.state.activeGoalId = next.id;
          const prior = this.currentRequest();
          this.state.attempt = prior
            ? Number(prior.attempt_id.slice('attempt-'.length))
            : ++this.attemptSequence;
          this.state.retryChanges = [];
          this.latestMonitor = undefined;
          this.event('goal.selected', {
            goalId: next.id,
            attemptId: `attempt-${this.state.attempt}`,
          });
        }
        return {
          goal: structuredClone(this.goal),
          attemptId: `attempt-${this.state.attempt}`,
          retryRequired: this.currentRequest()?.attempt_id === `attempt-${this.state.attempt}`,
        };
      }
      case 'tasks.replan': {
        this.owner(a);
        const verdict = this.currentVerdict();
        if (
          verdict?.status === 'failed' &&
          verdict.task_scope.attempt_id === `attempt-${this.state.attempt}`
        ) {
          await this.beginRecovery(a, args.changes as string[], s('attemptSummary'), 'replan');
        }
        this.event('task.replan-requested', { reason: s('reason'), changes: args.changes });
        return {
          plan: this.plans.read(this.state.id) ?? null,
          recoveryId: this.state.recoveryId,
          instruction: 'Update the plan explicitly. A new attempt requires tasks.retry.',
        };
      }
      case 'tasks.retry': {
        this.owner(a);
        const verdict = this.currentVerdict();
        if (
          !verdict ||
          verdict.status !== 'failed' ||
          verdict.task_scope.attempt_id !== `attempt-${this.state.attempt}`
        )
          throw new Error('Retry requires a current formal failed verdict.');
        if (this.state.requests.filter((r) => r.goal_id === this.goal.id).length >= 3)
          throw new Error('Retry budget exhausted for this goal.');
        const changes = args.changes as string[];
        if (!changes.length) throw new Error('Retry requires explicit changes.');
        this.stoppedAndVerified();
        await this.beginRecovery(a, changes, s('attemptSummary'), 'retry');
        this.state.retryChanges = [...changes];
        this.state.attempt = ++this.attemptSequence;
        this.event('retry.accepted', {
          ownerAssignmentId: a.id,
          failedVerdict: verdict,
          recoveryId: this.state.recoveryId,
          changes,
        });
        return { attempt: this.state.attempt, recoveryId: this.state.recoveryId };
      }
      case 'verification.check': {
        this.verifier(a);
        const execution = this.options.backend.query();
        const context = this.checks.get(a.id);
        if (
          !context ||
          execution?.execution_id !== context.executionId ||
          execution.boundary_event_id !== context.boundaryId
        )
          throw new Error('Stale or absent formal verification assignment.');
        const checked = this.options.backend.check(
          ('all' in a.brief.success_contract
            ? a.brief.success_contract.all
            : a.brief.success_contract.any
          ).map((c) => c.check_id),
        );
        this.observe(a, checked.sample);
        context.facts = checked.facts;
        context.sample = checked.sample;
        this.event('verification.checked', {
          assignmentId: a.id,
          facts: checked.facts,
          evidence: checked.sample.evidence,
        });
        return { facts: checked.facts, boundaryId: context.boundaryId };
      }
      case 'verification.submit': {
        this.verifier(a);
        const checked = this.checks.get(a.id);
        const execution = this.options.backend.query();
        const request = this.state.requests.at(-1);
        if (!checked || !execution || !request || !checked.facts.length)
          throw new Error('Formal checks must precede submission.');
        const result: VerificationResult = {
          schema_version: 'physical.verification.v1',
          verdict_id: randomUUID(),
          verification_request_id: checked.requestId,
          execution_id: checked.executionId,
          verifier_id: a.sessionId,
          verifier_assignment_id: a.id,
          task_scope: structuredClone(execution.task_scope),
          status: s('status') as 'passed' | 'failed' | 'unknown',
          goal_contract_id: request.success_contract.id,
          goal_contract_version: request.success_contract.version,
          boundary_event_id: checked.boundaryId,
          checks: structuredClone(checked.facts),
          evidence_refs: [checked.sample.evidence.id],
          explanation: s('explanation'),
          observed_at: new Date().toISOString(),
          clock_id: execution.clock_id,
        };
        const errors = this.gates.verdict(result, {
          request,
          execution,
          verifierId: a.sessionId,
          verifierAssignmentId: a.id,
          verificationRequestId: checked.requestId,
          evidence: [checked.sample.evidence],
          checkFacts: checked.facts,
        });
        if (errors.length) throw new Error(errors.join(', '));
        if (this.state.verdicts.some((v) => v.verification_request_id === checked.requestId))
          throw new Error('Verification request already settled.');
        this.state.verdicts.push(result);
        this.event('verification.completed', { result });
        this.resolveRecovery(result);
        const lead = this.sessions.get(this.state.decisionAssignmentId);
        this.grants.get(lead.id)!.add(checked.sample.evidence.id);
        this.spawn(
          this.sessions.deliver(
            lead.id,
            {
              kind: 'verdict',
              result,
              execution,
              brief: this.brief(lead.member, this.state.instruction),
              finalGoalId: this.options.goal.id,
            },
            a.id,
          ),
        );
        return { result };
      }
      case 'tasks.abandon': {
        this.owner(a);
        this.state.state = s('status') as 'failed' | 'unknown';
        this.state.error = s('reason');
        this.event('run.abandoned', { reason: this.state.error, status: this.state.state });
        await this.options.backend.stop();
        return { state: this.state.state };
      }
      case 'tasks.finish': {
        this.owner(a);
        const result = this.state.verdicts.at(-1);
        if (
          !result ||
          result.status !== 'passed' ||
          result.task_scope.attempt_id !== `attempt-${this.state.attempt}` ||
          result.task_scope.goal_id !== this.options.goal.id
        )
          throw new Error('Finish requires original-goal current-attempt formal success.');
        const execution = this.options.backend.query();
        if (
          !execution ||
          !['paused', 'ended'].includes(execution.state) ||
          !execution.device_confirmed ||
          result.execution_id !== execution.execution_id ||
          result.boundary_event_id !== execution.boundary_event_id
        )
          throw new Error('Finish requires the latest confirmed stopped boundary.');
        const plan = this.plans.read(this.state.id);
        if (
          !plan ||
          plan.items.some((item) => item.status !== 'done' && item.status !== 'abandoned')
        )
          throw new Error(
            'Finish requires a completed plan; explicitly abandon unused optional goals.',
          );
        this.state.state = 'succeeded';
        this.event('run.succeeded', { verdictId: result.verdict_id });
        return { state: this.state.state };
      }
      case 'skills.search':
        return { skills: this.skills.search(s('query'), this.state.source === 'test_fixture') };
      case 'skills.load': {
        const bundle = this.skills.load(s('skillId'));
        if (bundle.metadata.origin === 'test_fixture' && this.state.source !== 'test_fixture')
          throw new Error('Fixture skills are excluded from real runs.');
        return bundle;
      }
      case 'skills.save': {
        const recovery = this.recoveryForAssignment(a.id);
        if (!recovery?.result)
          throw new Error('Only the recovery Evolver may publish after original-goal success.');
        const verdict = recovery.result;
        const skillId = recovery.id;
        const bundle = this.skills.save(
          {
            schema_version: 'physical.skill_metadata.v1',
            skill_id: skillId,
            version: '1',
            task_semantics: [...recovery.goal.taskSemantics],
            required_capabilities: [...recovery.goal.capabilities],
            source_configurations: [recovery.goal.configuration],
            evidence_refs: [
              ...new Set([
                ...((recovery.context.failedVerdict as VerificationResult | undefined)
                  ?.evidence_refs ?? []),
                ...verdict.evidence_refs,
              ]),
            ],
            recovery_id: recovery.id,
            verdict_ref: verdict.verdict_id,
            origin: this.state.source,
            limitations: [
              'Observed in the CPU fixture only; no cross-embodiment transfer has been validated.',
            ],
            validation_status:
              this.state.source === 'test_fixture' ? 'test_fixture' : 'source_validated',
            validated_configurations:
              this.state.source === 'test_fixture' ? [] : [recovery.goal.configuration],
          },
          s('markdown'),
        );
        if (!this.state.skillIds.includes(skillId)) this.state.skillIds.push(skillId);
        this.event('skill.saved', { metadata: bundle.metadata });
        return bundle;
      }
      case 'evidence.read':
        return this.permit(a, [s('evidenceId')])[0]!;
      default:
        throw new Error('Unknown native tool binding.');
    }
  }
  private async beginRecovery(
    a: Assignment,
    changes: string[],
    attemptSummary: string,
    decision: 'replan' | 'retry',
  ): Promise<void> {
    this.owner(a);
    if (!changes.length || !attemptSummary.trim())
      throw new Error('Recovery requires a planner-supplied attempt summary and proposed changes.');
    const failed = this.currentVerdict();
    const request = this.currentRequest();
    if (
      !failed ||
      failed.status !== 'failed' ||
      failed.task_scope.attempt_id !== `attempt-${this.state.attempt}` ||
      !request
    )
      throw new Error('Recovery requires the current formal failed subgoal.');
    this.state.retryChanges = [...changes];
    if (this.activeRecovery()) return;
    const recovery: RecoveryObservation = {
      id: randomUUID(),
      goal: structuredClone(this.goal),
      trace: [],
      cursor: 0,
      delivery: Promise.resolve(),
      context: {
        decision,
        attemptSummary,
        failedRequest: request,
        failedExecution: this.state.executions.find((e) => e.execution_id === failed.execution_id),
        failedVerdict: failed,
        changes,
        ownerAssignmentId: a.id,
        originalGoalId: this.goal.id,
      },
    };
    this.recoveries.set(recovery.id, recovery);
    this.state.recoveryId = recovery.id;
    this.state.activeRecoveryId = recovery.id;
    this.persistRecovery(recovery);
    this.event('recovery.opened', { recoveryId: recovery.id, context: recovery.context });
    const role = this.sessions.team.definition.bindings.recovery_evolver;
    if (role && this.sessions.team.definition.learning_enabled !== false) {
      // Capture the complete brief before any asynchronous creation; learning must not gate motion.
      const refs = [...(this.grants.get(a.id) ?? [])];
      const brief = this.brief(
        role,
        'Record the recovery through original-subgoal success. Derive planning and verification knowledge.',
        a,
        JSON.stringify(recovery.context),
        refs,
      );
      recovery.delivery = (async () => {
        const e = await this.sessions.create(role, brief);
        recovery.evolverId = e.id;
        this.grants.set(e.id, new Set(refs));
        await this.sessions.deliver(
          e.id,
          { kind: 'recovery-start', brief: e.brief, context: recovery.context },
          a.id,
        );
      })();
      this.learn(recovery, recovery.delivery);
    }
  }
  private flushRecovery(recovery: RecoveryObservation): Promise<void> {
    if (recovery.timer) {
      clearTimeout(recovery.timer);
      delete recovery.timer;
    }
    if (recovery.cursor >= recovery.trace.length || recovery.error) return recovery.delivery;
    const events = recovery.trace.slice(recovery.cursor);
    recovery.cursor = recovery.trace.length;
    recovery.delivery = recovery.delivery.then(async () => {
      if (recovery.evolverId)
        await this.sessions.deliver(
          recovery.evolverId,
          { kind: 'recovery-progress', recoveryId: recovery.id, events },
          this.state.decisionAssignmentId,
        );
    });
    return recovery.delivery;
  }
  private resolveRecovery(result: VerificationResult): void {
    const recovery = this.activeRecovery();
    if (
      !recovery ||
      result.status !== 'passed' ||
      result.task_scope.goal_id !== recovery.goal.id ||
      result.task_scope.recovery_id !== recovery.id ||
      result.goal_contract_id !== recovery.goal.successContract.id ||
      result.goal_contract_version !== recovery.goal.successContract.version
    )
      return;
    recovery.result = structuredClone(result);
    this.state.activeRecoveryId = null;
    this.persistRecovery(recovery);
    this.event('recovery.resolved', {
      recoveryId: recovery.id,
      goalId: recovery.goal.id,
      verdictId: result.verdict_id,
    });
    const changes = [...this.state.retryChanges];
    this.learn(
      recovery,
      (async () => {
        await this.flushRecovery(recovery);
        if (!recovery.evolverId || recovery.error) return;
        for (const ref of result.evidence_refs) this.grants.get(recovery.evolverId)!.add(ref);
        await this.sessions.deliver(
          recovery.evolverId,
          {
            kind: 'recovery-success',
            result,
            changes,
            brief: this.sessions.get(recovery.evolverId).brief,
          },
          this.state.decisionAssignmentId,
        );
      })(),
    );
  }
  private backendUpdate(update: BackendUpdate): void {
    if (this.closed) return;
    this.options.validator.parse('ExecutionStatus', update.status);
    this.options.validator.parse('EvidenceRef', update.sample.evidence);
    const request = this.state.requests.at(-1);
    if (!request) throw new Error('Unsolicited backend execution.');
    if (
      update.status.task_scope.task_id !== request.task_id ||
      update.status.task_scope.goal_id !== request.goal_id ||
      update.status.task_scope.attempt_id !== request.attempt_id ||
      update.status.task_scope.recovery_id !== request.recovery_id
    )
      throw new Error('Backend update does not match the admitted current request.');
    const previous = this.state.executions.find(
      (e) => e.execution_id === update.status.execution_id,
    );
    if (previous) {
      const errors = this.gates.execution(
        request,
        previous,
        update.status,
        request.decision_owner_id,
      );
      if (errors.length) throw new Error(errors.join(', '));
    }
    const index = this.state.executions.findIndex(
      (e) => e.execution_id === update.status.execution_id,
    );
    if (index < 0) this.state.executions.push(update.status);
    else this.state.executions[index] = update.status;
    this.state.latestSensor = update.sample;
    this.evidence.set(update.sample.evidence.id, update.sample);
    this.event('execution.updated', {
      execution: update.status,
      sensorSequence: update.sample.sequence,
    });
    if (terminal(this.state.state)) return;
    if (this.gates.requiresVerification(update.status)) {
      if (update.status.state === 'paused') this.state.state = 'paused';
      else this.state.state = 'verifying';
      const boundary = update.status.boundary_event_id!;
      if (!this.formalBoundaries.has(boundary)) {
        this.formalBoundaries.add(boundary);
        this.spawn(this.formal(update));
      }
    } else if (update.status.state === 'running' && update.status.control_steps > 0) {
      this.latestMonitor = update;
      if (!this.monitorBusy) this.spawn(this.monitor());
    }
  }
  private async monitor(): Promise<void> {
    this.monitorBusy = true;
    try {
      while (this.latestMonitor && !terminal(this.state.state)) {
        const update = this.latestMonitor;
        this.latestMonitor = undefined;
        const current = this.options.backend.query();
        if (current?.state !== 'running') break;
        if (current.execution_id !== update.status.execution_id) continue;
        const a = await this.assignment(
          this.sessions.team.definition.bindings.final_verifier,
          'Monitor the explicit current frame; pause if needed. Formal success is a separate round.',
        );
        this.observe(a, update.sample);
        await this.sessions.deliver(
          a.id,
          { kind: 'monitor', brief: a.brief, sample: update.sample },
          'execution-monitor',
        );
      }
    } finally {
      this.monitorBusy = false;
    }
  }
  private async formal(update: BackendUpdate): Promise<void> {
    const a = await this.assignment(
      this.sessions.team.definition.bindings.final_verifier,
      'Perform mandatory formal verification at this stopped execution boundary.',
    );
    this.checks.set(a.id, {
      requestId: randomUUID(),
      executionId: update.status.execution_id,
      boundaryId: update.status.boundary_event_id!,
      facts: [],
      sample: update.sample,
    });
    this.event('verification.requested', {
      assignmentId: a.id,
      executionId: update.status.execution_id,
      boundaryId: update.status.boundary_event_id,
      reason: update.status.stop_reason,
    });
    await this.sessions.deliver(
      a.id,
      { kind: 'formal-verification', brief: a.brief, execution: update.status },
      'execution-boundary',
    );
    if (
      !terminal(this.state.state) &&
      !this.state.verdicts.some((v) => v.verifier_assignment_id === a.id)
    )
      throw new Error('Verifier did not produce a formal result.');
  }
  async pause(): Promise<void> {
    if (terminal(this.state.state)) throw new Error('Run has ended.');
    await this.options.backend.pause();
  }
  async requestResume(): Promise<void> {
    if (terminal(this.state.state) || this.options.backend.query()?.state !== 'paused')
      throw new Error('No paused execution.');
    this.spawn(
      this.sessions.deliver(
        this.state.decisionAssignmentId,
        {
          kind: 'resume-request',
          instruction:
            'The user requests continuation. Inspect state and decide whether to resume.',
        },
        'user',
      ),
    );
  }
  async stop(): Promise<void> {
    if (terminal(this.state.state)) return;
    this.state.state = 'cancelled';
    this.event('run.cancelled', { source: 'user' });
    this.sessions.cancelAll();
    await this.options.backend.stop();
  }
  async settle(): Promise<void> {
    while (this.pending.size) await Promise.all([...this.pending]);
  }
  async close(): Promise<void> {
    if (this.closed) return;
    if (!terminal(this.state.state)) await this.stop();
    for (const recovery of this.recoveries.values())
      if (recovery.timer) clearTimeout(recovery.timer);
    this.unsubscribe();
    await this.options.backend.close();
    await this.sessions.close();
    await this.settle();
    this.closed = true;
  }
  plan(): PlanDocument | undefined {
    return this.plans.read(this.state.id);
  }
}
