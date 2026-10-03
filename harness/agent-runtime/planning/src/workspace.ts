import { isDeepStrictEqual } from 'node:util';
import type {
  ContractValidator,
  PlanDocument,
  VerificationResult,
  SubgoalRequest,
  SuccessContract,
} from '@edh/contracts';
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
  nextWrite(
    taskId: string,
    owner: { agentId: string; assignmentId: string },
    finalGoal: { id: string; description: string; successContract: SuccessContract },
  ): { plan: PlanDocument; expectedVersion: number } {
    const current = this.read(taskId);
    if (
      current &&
      (current.owner_agent_id !== owner.agentId ||
        current.owner_assignment_id !== owner.assignmentId)
    )
      throw new Error('Plan requires decision owner.');
    const expectedVersion = current?.version ?? 0;
    const plan: PlanDocument = current
      ? structuredClone(current)
      : {
          schema_version: 'physical.plan.v1',
          task_id: taskId,
          owner_agent_id: owner.agentId,
          owner_assignment_id: owner.assignmentId,
          version: 1,
          items: [
            {
              goal_id: finalGoal.id,
              description: finalGoal.description,
              status: 'planned',
              dependencies: [],
              success_contract: structuredClone(finalGoal.successContract),
            },
          ],
        };
    plan.version = expectedVersion + 1;
    this.validator.parse('PlanDocument', plan);
    return { plan, expectedVersion };
  }
  update(
    plan: PlanDocument,
    expectedVersion: number,
    owner: { agentId: string; assignmentId: string },
    verdicts: readonly Pick<
      VerificationResult,
      'verdict_id' | 'task_scope' | 'status' | 'goal_contract_id' | 'goal_contract_version'
    >[],
    requests: readonly SubgoalRequest[] = [],
  ): void {
    this.validator.parse('PlanDocument', plan);
    if (plan.owner_agent_id !== owner.agentId || plan.owner_assignment_id !== owner.assignmentId)
      throw new Error('Plan requires decision owner.');
    if (plan.version !== expectedVersion + 1) throw new Error('Plan version must increase by one.');
    if (plan.items.length > 64) throw new Error('Plan exceeds 64 goals.');
    for (const request of requests) {
      if (request.task_id !== plan.task_id) continue;
      const item = plan.items.find((candidate) => candidate.goal_id === request.goal_id);
      if (!item || !isDeepStrictEqual(item.success_contract, request.success_contract))
        throw new Error('Executed goals and their success criteria must remain in plan history.');
    }
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
      if (item.status === 'done') {
        const latest = verdicts.findLast(
          (v) => v.task_scope.task_id === plan.task_id && v.task_scope.goal_id === item.goal_id,
        );
        const request = requests.findLast(
          (r) => r.task_id === plan.task_id && r.goal_id === item.goal_id,
        );
        if (
          !latest ||
          latest.verdict_id !== item.last_verdict_ref ||
          latest.status !== 'passed' ||
          latest.goal_contract_id !== item.success_contract.id ||
          latest.goal_contract_version !== item.success_contract.version ||
          (request && latest.task_scope.attempt_id !== request.attempt_id)
        )
          throw new Error('Completed plan item requires latest accepted goal verdict.');
      }
    }
    this.store.put(`plan:${plan.task_id}`, plan, expectedVersion);
  }
}
