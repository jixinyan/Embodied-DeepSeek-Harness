import type { ContractValidator, PlanDocument, VerificationResult } from '@edh/contracts';
import type { LocalStore } from '@edh/storage';
/** Owner-bound planning; a claimed done item must reference an accepted formal verdict. */
export class TaskPlans {
  constructor(
    private readonly store: LocalStore,
    private readonly validator: ContractValidator,
  ) {}
  read(taskId: string): PlanDocument | undefined {
    return this.store.get<PlanDocument>(`plan:${taskId}`)?.value;
  }
  update(
    plan: PlanDocument,
    expectedVersion: number,
    owner: { agentId: string; assignmentId: string },
    verdicts: readonly VerificationResult[],
  ): void {
    this.validator.parse('PlanDocument', plan);
    if (plan.owner_agent_id !== owner.agentId || plan.owner_assignment_id !== owner.assignmentId)
      throw new Error('Plan requires decision owner.');
    if (plan.version !== expectedVersion + 1) throw new Error('Plan version must increase by one.');
    const ids = new Set(plan.items.map((item) => item.goal_id));
    if (ids.size !== plan.items.length) throw new Error('Duplicate plan goal.');
    const visited = new Set<string>();
    const stack = new Set<string>();
    const visit = (id: string) => {
      if (stack.has(id)) throw new Error('Plan dependency cycle.');
      if (visited.has(id)) return;
      stack.add(id);
      const item = plan.items.find((i) => i.goal_id === id)!;
      for (const dep of item.dependencies) {
        if (!ids.has(dep)) throw new Error('Unknown plan dependency.');
        visit(dep);
      }
      stack.delete(id);
      visited.add(id);
    };
    for (const item of plan.items) {
      visit(item.goal_id);
      if (
        item.status === 'done' &&
        !verdicts.some(
          (v) =>
            v.verdict_id === item.last_verdict_ref &&
            v.status === 'passed' &&
            v.task_scope.task_id === plan.task_id &&
            v.task_scope.goal_id === item.goal_id &&
            v.goal_contract_id === item.success_contract.id &&
            v.goal_contract_version === item.success_contract.version,
        )
      )
        throw new Error('Completed plan item requires accepted goal verdict.');
    }
    this.store.put(`plan:${plan.task_id}`, plan, expectedVersion);
  }
}
