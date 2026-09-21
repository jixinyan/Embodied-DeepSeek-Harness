import { isDeepStrictEqual } from 'node:util';
import type {
  ContractValidator,
  PlanDocument,
  SubgoalRequest,
  SuccessCheck,
  SuccessContract,
  VerificationResult,
} from '@edh/contracts';
import { parseGoalBinding, type GoalBinding } from './goal-binding.js';

export type { GoalBinding } from './goal-binding.js';
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
    if (predefined.length >= 64)
      throw new Error('Task exceeds 64 admitted goals, including retained history.');
    this.root = parseGoalBinding(root, validator);
    this.subgoalSource = Object.freeze({
      kind: 'user',
      reference: `planner-subgoals:${this.root.id}`,
    });
    for (const goal of [root, ...predefined]) {
      const binding = parseGoalBinding(goal, validator);
      if (this.goals.has(binding.id)) throw new Error('Duplicate goal binding.');
      this.goals.set(binding.id, binding);
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
    this.validator.parse('PlanDocument', plan);
    if (new Set([...this.goals.keys(), ...plan.items.map((item) => item.goal_id)]).size > 64)
      throw new Error('Task exceeds 64 admitted goals, including retained history.');
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
      return parseGoalBinding(
        {
          ...this.root,
          id: item.goal_id,
          successContract: item.success_contract,
          taskSemantics: [...this.root.taskSemantics, item.description],
        },
        this.validator,
      );
    });
  }
  /** Commit only after the versioned plan write succeeds. */
  admit(goals: readonly GoalBinding[]): void {
    const admitted = goals.map((goal) => parseGoalBinding(goal, this.validator));
    if (new Set(admitted.map((goal) => goal.id)).size !== admitted.length)
      throw new Error('Duplicate goal binding.');
    if (new Set([...this.goals.keys(), ...admitted.map((goal) => goal.id)]).size > 64)
      throw new Error('Task exceeds 64 admitted goals, including retained history.');
    for (const goal of admitted) {
      const existing = this.goals.get(goal.id);
      if (existing && !isDeepStrictEqual(existing, goal))
        throw new Error('Admitted goal bindings are immutable; use a new goal identity.');
    }
    for (const goal of admitted) this.goals.set(goal.id, goal);
  }
  ready(
    plan: PlanDocument,
    id: string,
    verdicts: readonly Pick<
      VerificationResult,
      'verdict_id' | 'task_scope' | 'status' | 'goal_contract_id' | 'goal_contract_version'
    >[],
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
