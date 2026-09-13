import { randomUUID } from 'node:crypto';
import type { GoalBinding } from './application.js';
import type { ContractValidator, SubgoalRequest, ExecutionStatus } from '@edh/contracts';
import { LifecycleValidator } from '@edh/contracts';
import type {
  EmbodiedBackend,
  SensorSample,
  BackendUpdate,
  BackendResumeOptions,
} from '@edh/execution';

export type FixtureScenario =
  | 'retry-success'
  | 'first-pass'
  | 'unknown'
  | 'backend-error'
  | 'multi-goal-recovery';
/** CPU test fixture, not a simulator, robot controller or learned policy. */
export class FixtureBackend implements EmbodiedBackend {
  readonly source = 'test_fixture' as const;
  private request?: SubgoalRequest;
  private status?: ExecutionStatus;
  private timer?: ReturnType<typeof setInterval>;
  private readonly listeners = new Set<(update: BackendUpdate) => void>();
  private sequence = 0;
  private attempt = 0;
  private inside = false;
  private cabinetOpen = false;
  private view = 'center';
  private readonly gates: LifecycleValidator;
  constructor(
    private readonly validator: ContractValidator,
    private readonly scenario: FixtureScenario,
    private readonly tickMs = 650,
  ) {
    this.gates = new LifecycleValidator(validator);
  }
  async start(request: SubgoalRequest): Promise<ExecutionStatus> {
    this.validator.parse('SubgoalRequest', request);
    if (this.request?.idempotency_key === request.idempotency_key) {
      if (JSON.stringify(request) !== JSON.stringify(this.request))
        throw new Error('Idempotency conflict.');
      return this.query()!;
    }
    if (this.status && this.status.state !== 'ended')
      throw new Error('Execution resource is busy.');
    this.request = structuredClone(request);
    this.attempt++;
    if (this.scenario !== 'multi-goal-recovery') this.inside = false;
    this.status = {
      schema_version: 'physical.execution.v1',
      execution_id: randomUUID(),
      task_scope: {
        task_id: request.task_id,
        goal_id: request.goal_id,
        attempt_id: request.attempt_id,
        ...(request.recovery_id ? { recovery_id: request.recovery_id } : {}),
      },
      state: 'accepted',
      state_version: 1,
      control_steps: 0,
      policy_calls: 0,
      elapsed_wall_time_s: 0,
      device_confirmed: false,
      observation_refs: [],
      clock_id: 'fixture-clock',
      recorded_at: new Date().toISOString(),
    };
    this.validator.parse('ExecutionStatus', this.status);
    this.transition('running');
    this.schedule();
    return this.query()!;
  }
  query(): ExecutionStatus | undefined {
    return this.status ? structuredClone(this.status) : undefined;
  }
  private transition(
    state: ExecutionStatus['state'],
    reason?: ExecutionStatus['stop_reason'],
    step = false,
  ): void {
    if (!this.status || !this.request) throw new Error('No execution.');
    const old = this.status;
    const { boundary_event_id: _event, boundary_at: _at, stop_reason: _reason, ...base } = old;
    const now = new Date().toISOString();
    const next: ExecutionStatus = {
      ...base,
      state,
      state_version: old.state_version + 1,
      control_steps: old.control_steps + Number(step),
      policy_calls: old.policy_calls + Number(step),
      elapsed_wall_time_s: old.elapsed_wall_time_s + (step ? this.tickMs / 1000 : 0),
      recorded_at: now,
      device_confirmed: state === 'paused' || state === 'ended',
      ...(reason ? { stop_reason: reason, boundary_event_id: randomUUID(), boundary_at: now } : {}),
    };
    const errors = this.gates.execution(this.request, old, next, this.request.decision_owner_id);
    if (errors.length) throw new Error(errors.join(', '));
    this.status = next;
    const sample = this.capture();
    this.status.observation_refs = [sample.evidence.id];
    for (const listener of this.listeners) listener({ status: this.query()!, sample });
  }
  private schedule(): void {
    this.clearTimer();
    this.timer = setInterval(() => {
      if (this.status?.state !== 'running' || !this.request) return;
      const next = this.status.control_steps + 1;
      if (this.scenario === 'backend-error' && next === 2) {
        this.clearTimer();
        this.transition('ended', 'backend_error', true);
        return;
      }
      if (
        next >= this.request.budget.max_control_steps ||
        this.status.elapsed_wall_time_s + this.tickMs / 1000 >= this.request.budget.max_wall_time_s
      ) {
        if (this.scenario === 'multi-goal-recovery') {
          if (this.request.goal_id === 'open-cabinet') this.cabinetOpen = true;
          if (this.request.goal_id === 'place-cup') this.inside = this.cabinetOpen;
          if (this.request.goal_id === 'store-cup') this.cabinetOpen = false;
        } else
          this.inside =
            this.scenario === 'first-pass' ||
            (this.scenario === 'retry-success' && this.attempt > 1);
        this.clearTimer();
        this.transition('ended', 'budget_exhausted', true);
      } else this.transition('running', undefined, true);
    }, this.tickMs);
  }
  private clearTimer(): void {
    if (this.timer) clearInterval(this.timer);
  }
  capture(): SensorSample {
    const now = new Date().toISOString();
    const scope = this.status?.task_scope ?? { task_id: 'fixture-preview' };
    return {
      evidence: {
        id: randomUUID(),
        kind: 'image',
        source: 'cpu-cup-fixture',
        created_at: now,
        visibility: 'agent',
        task_scope: scope,
        observed_at: now,
        clock_id: 'fixture-clock',
      },
      sequence: ++this.sequence,
      source: 'test_fixture',
      description: `Synthetic ${this.view} view. Cup ${this.inside ? 'inside cabinet' : 'on counter'}. Cabinet ${this.cabinetOpen ? 'open' : 'closed'}.`,
      visualization: {
        view: this.view,
        cupInside: this.inside,
        cabinetOpen: this.cabinetOpen,
        step: this.status?.control_steps ?? 0,
        attempt: this.attempt,
      },
    };
  }
  async turnView(direction: 'left' | 'center' | 'right'): Promise<SensorSample> {
    if (this.status && ['running', 'pausing'].includes(this.status.state))
      throw new Error('Active observation conflicts with execution resources.');
    this.view = direction;
    return this.capture();
  }
  async pause(): Promise<void> {
    if (this.status?.state !== 'running') return;
    this.clearTimer();
    this.transition('pausing');
    this.transition('paused', 'verifier_pause');
  }
  async resume(ownerId: string, options?: BackendResumeOptions): Promise<void> {
    options?.signal?.throwIfAborted();
    if (
      options &&
      (options.executionId !== this.status?.execution_id ||
        options.boundaryId !== this.status?.boundary_event_id ||
        options.stateVersion !== this.status?.state_version)
    )
      throw new Error('Resume command targets a stale execution boundary.');
    if (this.status?.state !== 'paused' || this.request?.decision_owner_id !== ownerId)
      throw new Error('Resume requires paused execution and decision owner.');
    this.transition('running');
    this.schedule();
  }
  async stop(): Promise<void> {
    this.clearTimer();
    if (this.status && this.status.state !== 'ended') this.transition('ended', 'user_stop');
  }
  check(checkIds: readonly string[]) {
    if (!this.status || !['paused', 'ended'].includes(this.status.state))
      throw new Error('Formal checks require a stopped boundary.');
    const sample = this.capture();
    return {
      sample,
      facts: checkIds.map((check_id) => ({
        check_id,
        value:
          this.scenario === 'multi-goal-recovery'
            ? check_id === 'cup-inside'
              ? this.inside
              : check_id === 'cabinet-open'
                ? this.cabinetOpen
                : check_id === 'cabinet-closed'
                  ? !this.cabinetOpen
                  : null
            : check_id === 'cup-inside' &&
                this.scenario !== 'unknown' &&
                this.scenario !== 'backend-error'
              ? this.inside
              : null,
        evidence_refs: [sample.evidence.id],
        reason: 'Only the requested fixture predicate is exposed; no hidden scene state.',
      })),
    };
  }
  subscribe(listener: (update: BackendUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  async close(): Promise<void> {
    this.clearTimer();
    this.listeners.clear();
  }
}

export const FIXTURE_GOAL: GoalBinding = {
  id: 'place-cup',
  configuration: 'cpu-cup-fixture-v1',
  successContract: {
    id: 'cup-placement',
    version: '1',
    source: { kind: 'benchmark' as const, reference: 'cpu-cup-fixture-v1' },
    all: [{ check_id: 'cup-inside', check: 'inside', args: ['cup', 'cabinet'] }],
  },
  entities: { object: 'cup', container: 'cabinet' },
  capabilities: ['language-subgoal'],
  taskSemantics: ['cup', 'object placement', 'container access'],
  budget: { max_control_steps: 5, max_wall_time_s: 30 },
};

export const FIXTURE_SUBGOAL_CHECKS = [
  { check_id: 'cup-inside', check: 'inside', args: ['cup', 'cabinet'] },
  { check_id: 'cabinet-open', check: 'open', args: ['cabinet'] },
  { check_id: 'cabinet-closed', check: 'closed', args: ['cabinet'] },
];
export const MULTI_GOAL_FIXTURE: GoalBinding = {
  ...FIXTURE_GOAL,
  id: 'store-cup',
  configuration: 'cpu-multi-goal-fixture-v1',
  successContract: {
    id: 'cup-storage',
    version: '1',
    source: { kind: 'benchmark', reference: 'cpu-multi-goal-fixture-v1' },
    all: [FIXTURE_SUBGOAL_CHECKS[0]!, FIXTURE_SUBGOAL_CHECKS[2]!],
  },
};
