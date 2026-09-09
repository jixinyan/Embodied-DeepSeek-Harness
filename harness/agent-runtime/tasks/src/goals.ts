import { isDeepStrictEqual } from 'node:util';
import type {
  ContractValidator,
  PlanDocument,
  SubgoalRequest,
  SuccessCheck,
  SuccessContract,
  VerificationResult,
} from '@edh/contracts';

export interface GoalBinding {
  id: string;
  configuration: string;
  successContract: SuccessContract;
  entities: Record<string, string>;
  capabilities: string[];
  taskSemantics: string[];
  budget: { max_control_steps: number; max_wall_time_s: number };
}
const checks = (contract: SuccessContract) => ('all' in contract ? contract.all : contract.any);
/** Authorizes Planner-authored goals against deployment-bound checks, not hidden world state. */
export class TaskGoals {
  private readonly goals = new Map<string, GoalBinding>();
  private readonly checks = new Map<string, SuccessCheck>();
  private readonly root: GoalBinding;
  readonly subgoalSource: Readonly<SuccessContract['source']>;
  constructor(
    private readonly validator: ContractValidator,
    root: GoalBinding,
    allowedChecks: readonly SuccessCheck[] = [],
    predefined: readonly GoalBinding[] = [],
  ) {
    this.root = structuredClone(root);
    this.subgoalSource = Object.freeze({ kind: 'user', reference: `planner-subgoals:${root.id}` });
    for (const goal of [root, ...predefined]) {
      validator.parse('SuccessContract', goal.successContract);
      if (this.goals.has(goal.id)) throw new Error('Duplicate goal binding.');
      this.goals.set(goal.id, structuredClone(goal));
    }
    for (const check of allowedChecks) {
      validator.parse('SuccessCheck', check);
      if (this.checks.has(check.check_id)) throw new Error('Duplicate subgoal check binding.');
      this.checks.set(check.check_id, structuredClone(check));
    }
  }
  get(id: string): GoalBinding {
    const goal = this.goals.get(id);
    if (!goal) throw new Error(`Goal has not been admitted: ${id}`);
    return structuredClone(goal);
  }
  catalog() {
    return {
      finalGoalId: this.root.id,
      goals: [...this.goals.values()].map((g) => structuredClone(g)),
      allowedSubgoalChecks: [...this.checks.values()].map((c) => structuredClone(c)),
      subgoalSource: structuredClone(this.subgoalSource),
    };
  }
  prepare(plan: PlanDocument): GoalBinding[] {
    if (plan.items.length > 64) throw new Error('Plan exceeds 64 goals.');
    const root = plan.items.find((item) => item.goal_id === this.root.id);
    if (!root || root.status === 'abandoned')
      throw new Error('Plan must retain the required final task goal.');
    return plan.items.map((item) => {
      this.validator.parse('SuccessContract', item.success_contract);
      const existing = this.goals.get(item.goal_id);
      if (existing) {
        if (!isDeepStrictEqual(existing.successContract, item.success_contract))
          throw new Error('Admitted goal criteria are immutable; use a new goal identity.');
        return structuredClone(existing);
      }
      if (!isDeepStrictEqual(item.success_contract.source, this.subgoalSource))
        throw new Error('Planner subgoal must use the advertised source attribution.');
      for (const check of checks(item.success_contract)) {
        if (!isDeepStrictEqual(check, this.checks.get(check.check_id)))
          throw new Error(`Unregistered or changed subgoal check: ${check.check_id}`);
      }
      return {
        ...structuredClone(this.root),
        id: item.goal_id,
        successContract: structuredClone(item.success_contract),
        taskSemantics: [...this.root.taskSemantics, item.description],
      };
    });
  }
  /** Commit only after the versioned plan write succeeds. */
  admit(goals: readonly GoalBinding[]): void {
    for (const goal of goals) this.goals.set(goal.id, structuredClone(goal));
  }
  ready(
    plan: PlanDocument,
    id: string,
    verdicts: readonly VerificationResult[],
    requests: readonly SubgoalRequest[],
  ): GoalBinding {
    const item = plan.items.find((candidate) => candidate.goal_id === id);
    if (!item || item.status === 'abandoned')
      throw new Error('Goal is absent or abandoned in the current plan.');
    for (const dependency of item.dependencies) {
      const row = plan.items.find((candidate) => candidate.goal_id === dependency);
      const verdict = verdicts.findLast(
        (v) => v.task_scope.task_id === plan.task_id && v.task_scope.goal_id === dependency,
      );
      const request = requests.findLast(
        (r) => r.task_id === plan.task_id && r.goal_id === dependency,
      );
      if (
        row?.status !== 'done' ||
        verdict?.status !== 'passed' ||
        row.last_verdict_ref !== verdict.verdict_id ||
        verdict.goal_contract_id !== row.success_contract.id ||
        verdict.goal_contract_version !== row.success_contract.version ||
        !request ||
        request.attempt_id !== verdict.task_scope.attempt_id
      )
        throw new Error(`Goal dependency lacks current formal success: ${dependency}`);
    }
    return this.get(id);
  }
}
