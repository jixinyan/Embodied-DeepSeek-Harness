import { randomUUID } from 'node:crypto';
import type { Context } from '@deepseek-ai/cordis';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import {
  ContractValidator,
  LifecycleValidator,
  type InvocationBrief,
  type SubgoalRequest,
  type SuccessContract,
  type VerificationResult,
  type CheckResult,
  type EvidenceRef,
  type PlanDocument,
} from '@edh/contracts';
import { TeamSessions, type Assignment } from '@edh/communication';
import type { LoadedTeam } from '@edh/teams';
import { LocalStore } from '@edh/storage';
import { AssignmentFiles } from '@edh/files';
import { TaskPlans } from '@edh/planning';
import { SkillLibrary } from '@edh/memory';
import type { EmbodiedBackend, BackendUpdate, SensorSample } from '@edh/execution';
import type { RunState } from '@edh/tasks';

export { CORE_TOOLS } from '@edh/tools';
import { CORE_TOOL_PARAMETERS } from '@edh/tools';
export const terminal = (state: RunState['state']) =>
  ['succeeded', 'failed', 'cancelled', 'interrupted', 'unknown'].includes(state);
interface CheckedBoundary {
  requestId: string;
  executionId: string;
  boundaryId: string;
  facts: CheckResult[];
  sample: SensorSample;
}
export interface GoalBinding {
  id: string;
  configuration: string;
  successContract: SuccessContract;
  entities: Record<string, string>;
  capabilities: string[];
  taskSemantics: string[];
  budget: { max_control_steps: number; max_wall_time_s: number };
}
export interface ApplicationOptions {
  goal: GoalBinding;
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
  private evolverId: string | undefined;
  private recoveryContext: Record<string, unknown> | undefined;
  private recoveryTrace: { sequence: number; type: string; detail: Record<string, unknown> }[] = [];
  private recoveryCursor = 0;
  private recoveryDelivery: Promise<void> = Promise.resolve();
  private recoveryTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly contract: SuccessContract;
  constructor(private readonly options: ApplicationOptions) {
    this.contract = structuredClone(
      options.validator.parse('SuccessContract', options.goal.successContract),
    );
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
    this.skills = new SkillLibrary(options.store, options.validator);
    this.sessions = new TeamSessions(
      options.host,
      team,
      options.validator,
      {
        tools: (a) => this.tools(a),
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
          this.event(type, detail);
          if (type === 'agent.deadline' && !terminal(this.state.state))
            this.spawn(this.fail(new Error('Assignment deadline exceeded.')));
        },
        audit: (id, events) => {
          const key = `session-audit:${this.state.id}:${id}`;
          options.store.put(key, events, options.store.get(key)?.version ?? 0);
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
    this.version = this.options.store.put(`run:${this.state.id}`, this.state, this.version);
    this.options.onChange?.(this.snapshot());
    const ownerEvent =
      type.startsWith('tool.') && detail.assignmentId === this.state.decisionAssignmentId;
    if (
      this.recoveryContext &&
      !terminal(this.state.state) &&
      (ownerEvent ||
        [
          'plan.updated',
          'execution.requested',
          'execution.updated',
          'verification.completed',
          'retry.accepted',
        ].includes(type))
    ) {
      this.recoveryTrace.push({
        sequence: this.state.events.length,
        type,
        detail: structuredClone(detail),
      });
      const key = `recovery:${this.state.recoveryId}`;
      this.options.store.put(
        key,
        { context: this.recoveryContext, events: this.recoveryTrace },
        this.options.store.get(key)?.version ?? 0,
      );
      if (!this.recoveryTimer)
        this.recoveryTimer = setTimeout(() => {
          this.recoveryTimer = undefined;
          this.spawn(this.flushRecovery());
        }, 150);
    }
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
        goal_id: this.options.goal.id,
        attempt_id: `attempt-${this.state.attempt}`,
        ...(this.state.recoveryId ? { recovery_id: this.state.recoveryId } : {}),
      },
      expected_output: { schema: 'edh.role-report.v1', recipient: caller?.id ?? 'user' },
      entities: structuredClone(this.options.goal.entities),
      success_contract: structuredClone(this.contract),
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
        budget: structuredClone(this.options.goal.budget),
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
    return a.brief.tools_and_limits.allowed_tools.map((logical) => {
      const extra = this.options.additionalTools?.[logical];
      if (extra) {
        if (CORE_TOOL_PARAMETERS[logical])
          throw new Error('Additional tools cannot replace core authority checks.');
        const native = extra(structuredClone(a));
        if (native.name !== logical.replaceAll('.', '__'))
          throw new Error('Native tool name must match its logical binding.');
        return native;
      }
      const properties = CORE_TOOL_PARAMETERS[logical];
      if (!properties) throw new Error(`Tool is not implemented: ${logical}`);
      return {
        name: logical.replaceAll('.', '__'),
        description: `${logical}. Operates only within this assignment and task.`,
        parameters: {
          type: 'object',
          properties,
          required: Object.keys(properties),
          additionalProperties: false,
        },
        output: {
          schema: { type: 'object', additionalProperties: true },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        timeoutMs: 10_000,
        execute: async (args, exec) => {
          exec.signal.throwIfAborted();
          const recoveryWrite =
            this.state.state === 'succeeded' &&
            a.id === this.evolverId &&
            (logical.startsWith('files.') ||
              logical.startsWith('skills.') ||
              logical === 'evidence.read');
          if (this.closed || (terminal(this.state.state) && !recoveryWrite))
            throw new Error('Run is no longer writable.');
          this.event('tool.started', {
            assignmentId: a.id,
            tool: logical,
            callId: exec.callId,
            args,
          });
          try {
            const value = await this.invoke(
              a,
              logical,
              args as Record<string, unknown>,
              exec.signal,
            );
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
      case 'planning.read':
        return {
          plan: this.plans.read(this.state.id) ?? null,
          taskId: this.state.id,
          ownerAgentId: this.sessions.get(this.state.decisionAssignmentId).sessionId,
          ownerAssignmentId: this.state.decisionAssignmentId,
          successContract: this.contract,
        };
      case 'planning.update': {
        this.owner(a);
        const plan = this.options.validator.parse('PlanDocument', args.plan);
        if (plan.task_id !== this.state.id) throw new Error('Foreign plan.');
        this.plans.update(
          plan,
          Number(args.expectedVersion),
          { agentId: a.sessionId, assignmentId: a.id },
          this.state.verdicts,
        );
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
        if (this.state.requests.some((r) => r.attempt_id === `attempt-${this.state.attempt}`))
          throw new Error('Attempt already started; query its status instead of resubmitting.');
        const request: SubgoalRequest = {
          schema_version: 'physical.subgoal.v1',
          task_id: this.state.id,
          team_run_id: this.sessions.team.teamRunId,
          goal_id: this.options.goal.id,
          attempt_id: `attempt-${this.state.attempt}`,
          instruction: s('instruction'),
          entities: structuredClone(this.options.goal.entities),
          required_capabilities: [...this.options.goal.capabilities],
          success_contract: structuredClone(this.contract),
          budget: structuredClone(this.options.goal.budget),
          context_refs: [...(this.grants.get(a.id) ?? [])],
          decision_owner_id: a.sessionId,
          owner_assignment_id: a.id,
          idempotency_key: randomUUID(),
          ...(this.state.recoveryId ? { recovery_id: this.state.recoveryId } : {}),
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
      case 'tasks.replan': {
        this.owner(a);
        const verdict = this.state.verdicts.at(-1);
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
        const verdict = this.state.verdicts.at(-1);
        if (
          !verdict ||
          verdict.status !== 'failed' ||
          verdict.task_scope.attempt_id !== `attempt-${this.state.attempt}`
        )
          throw new Error('Retry requires a current formal failed verdict.');
        if (this.state.attempt >= 3) throw new Error('Retry budget exhausted.');
        const changes = args.changes as string[];
        if (!changes.length) throw new Error('Retry requires explicit changes.');
        if (this.options.backend.query()?.state !== 'ended')
          throw new Error('Retry requires a confirmed ended attempt.');
        await this.beginRecovery(a, changes, s('attemptSummary'), 'retry');
        this.state.retryChanges = [...changes];
        this.state.attempt++;
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
          ('all' in this.contract ? this.contract.all : this.contract.any).map((c) => c.check_id),
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
          goal_contract_id: this.contract.id,
          goal_contract_version: this.contract.version,
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
        const lead = this.sessions.get(this.state.decisionAssignmentId);
        this.grants.get(lead.id)!.add(checked.sample.evidence.id);
        this.spawn(
          this.sessions.deliver(
            lead.id,
            { kind: 'verdict', result, execution, brief: lead.brief },
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
        this.state.state = 'succeeded';
        this.event('run.succeeded', { verdictId: result.verdict_id });
        if (this.evolverId) {
          this.grants.get(this.evolverId)!.add(result.evidence_refs[0]!);
          const evolverId = this.evolverId;
          this.spawn(
            (async () => {
              await this.flushRecovery();
              await this.sessions.deliver(
                evolverId,
                {
                  kind: 'recovery-success',
                  result,
                  changes: this.state.retryChanges,
                  brief: this.sessions.get(evolverId).brief,
                },
                a.id,
              );
            })(),
          );
        }
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
        if (a.id !== this.evolverId || !this.state.recoveryId || this.state.state !== 'succeeded')
          throw new Error('Only the recovery Evolver may publish after original-goal success.');
        const verdict = this.state.verdicts.at(-1)!;
        if (verdict.status !== 'passed' || verdict.task_scope.recovery_id !== this.state.recoveryId)
          throw new Error('Recovery provenance mismatch.');
        const skillId = this.state.recoveryId;
        const bundle = this.skills.save(
          {
            schema_version: 'physical.skill_metadata.v1',
            skill_id: skillId,
            version: '1',
            task_semantics: [...this.options.goal.taskSemantics],
            required_capabilities: [...this.options.goal.capabilities],
            source_configurations: [this.options.goal.configuration],
            evidence_refs: [
              ...new Set([
                ...((this.recoveryContext?.failedVerdict as VerificationResult | undefined)
                  ?.evidence_refs ?? []),
                ...verdict.evidence_refs,
              ]),
            ],
            recovery_id: this.state.recoveryId,
            verdict_ref: verdict.verdict_id,
            origin: this.state.source,
            limitations: [
              'Observed in the CPU fixture only; no cross-embodiment transfer has been validated.',
            ],
            validation_status:
              this.state.source === 'test_fixture' ? 'test_fixture' : 'source_validated',
            validated_configurations:
              this.state.source === 'test_fixture' ? [] : [this.options.goal.configuration],
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
    const failed = this.state.verdicts.at(-1);
    const request = this.state.requests.at(-1);
    if (
      !failed ||
      failed.status !== 'failed' ||
      failed.task_scope.attempt_id !== `attempt-${this.state.attempt}` ||
      !request
    )
      throw new Error('Recovery requires the current formal failed subgoal.');
    this.state.recoveryId ??= randomUUID();
    this.state.retryChanges = [...changes];
    if (this.recoveryContext) return;
    this.recoveryContext = {
      decision,
      attemptSummary,
      failedRequest: request,
      failedExecution: this.options.backend.query(),
      failedVerdict: failed,
      changes,
      ownerAssignmentId: a.id,
      originalGoalId: this.options.goal.id,
    };
    this.event('recovery.opened', {
      recoveryId: this.state.recoveryId,
      context: this.recoveryContext,
    });
    this.options.store.put(
      `recovery:${this.state.recoveryId}`,
      { context: this.recoveryContext, events: [] },
      0,
    );
    const role = this.sessions.team.definition.bindings.recovery_evolver;
    if (role && this.sessions.team.definition.learning_enabled !== false) {
      const refs = [...(this.grants.get(a.id) ?? [])];
      const e = await this.assignment(
        role,
        'Record the recovery from this planner decision through original-subgoal success. Derive planning and verification knowledge.',
        a,
        JSON.stringify(this.recoveryContext),
        refs,
      );
      this.evolverId = e.id;
      this.recoveryDelivery = this.sessions.deliver(
        e.id,
        { kind: 'recovery-start', brief: e.brief, context: this.recoveryContext },
        a.id,
      );
      this.spawn(this.recoveryDelivery);
    }
  }
  private flushRecovery(): Promise<void> {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
    if (!this.evolverId || this.recoveryCursor >= this.recoveryTrace.length)
      return this.recoveryDelivery;
    const events = this.recoveryTrace.slice(this.recoveryCursor);
    this.recoveryCursor = this.recoveryTrace.length;
    const target = this.evolverId;
    this.recoveryDelivery = this.recoveryDelivery.then(() =>
      this.sessions.deliver(
        target,
        { kind: 'recovery-progress', recoveryId: this.state.recoveryId, events },
        this.state.decisionAssignmentId,
      ),
    );
    return this.recoveryDelivery;
  }
  private backendUpdate(update: BackendUpdate): void {
    if (this.closed) return;
    this.options.validator.parse('ExecutionStatus', update.status);
    this.options.validator.parse('EvidenceRef', update.sample.evidence);
    const request = this.state.requests.at(-1);
    if (!request) throw new Error('Unsolicited backend execution.');
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
        if (this.options.backend.query()?.state !== 'running') break;
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
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
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
