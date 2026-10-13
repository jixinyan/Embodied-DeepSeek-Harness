import type {
  InvocationBrief,
  PlanDocument,
  SuccessCheck,
  SuccessContract,
  VerificationResult,
} from '@edh/contracts';

interface FixtureInput {
  kind: string;
  brief?: InvocationBrief;
  result?: VerificationResult;
  execution?: { state: string };
  finalGoalId?: string;
}
/** Scripted model choices for acceptance only. DSH still runs the model/tool loop. */
export function multiGoalChoice(
  payload: FixtureInput,
  step: number,
  previous: Record<string, unknown>,
): { tool: string; input: Record<string, unknown> } | null | undefined {
  if (payload.kind !== 'initial' && payload.kind !== 'verdict') return undefined;
  if (payload.brief?.task_scope.goal_id !== 'store-cup' && payload.finalGoalId !== 'store-cup')
    return undefined;
  let choice: { tool: string; input: Record<string, unknown> } | null = null;
  const call = (tool: string, input: Record<string, unknown> = {}) => {
    choice = { tool, input };
  };
  const changes = ['Open the cabinet as a separately verified prerequisite, then retry placement.'];
  const summary =
    'Placement stopped with the cup still outside. Access is a hypothesis to test, not an established failure cause.';
  if (payload.kind === 'initial') {
    if (step === 0) call('planning.read');
    if (step === 1) {
      const checks = previous.allowedSubgoalChecks as SuccessCheck[];
      const plan: PlanDocument = {
        schema_version: 'physical.plan.v1',
        task_id: String(previous.taskId),
        version: 1,
        owner_agent_id: String(previous.ownerAgentId),
        owner_assignment_id: String(previous.ownerAssignmentId),
        items: [
          {
            goal_id: 'place-cup',
            description: 'Place the cup inside the cabinet.',
            status: 'active',
            dependencies: [],
            success_contract: {
              id: 'placement',
              version: '1',
              source: previous.subgoalSource as SuccessContract['source'],
              all: [checks.find((c) => c.check_id === 'cup-inside')!],
            },
          },
          {
            goal_id: 'store-cup',
            description: 'Leave the cup stored with the cabinet closed.',
            status: 'planned',
            dependencies: ['place-cup'],
            success_contract: payload.brief!.success_contract,
          },
        ],
      };
      call('planning.update', { plan, expectedVersion: 0 });
    }
    if (step === 2) call('tasks.select_goal', { goalId: 'place-cup' });
    if (step === 3) call('execution.start', { instruction: 'Place the cup inside the cabinet.' });
  } else if (payload.result?.status === 'failed' && payload.execution?.state === 'ended') {
    if (step === 0)
      call('tasks.replan', {
        reason: 'Placement failed; test cabinet access.',
        changes,
        attemptSummary: summary,
      });
    if (step === 1) call('planning.read');
    if (step === 2) {
      const plan = structuredClone(previous.plan) as PlanDocument;
      const checks = previous.allowedSubgoalChecks as SuccessCheck[];
      plan.items.unshift({
        goal_id: 'open-cabinet',
        description: 'Open the cabinet for access.',
        status: 'active',
        dependencies: [],
        success_contract: {
          id: 'access',
          version: '1',
          source: previous.subgoalSource as SuccessContract['source'],
          all: [checks.find((c) => c.check_id === 'cabinet-open')!],
        },
      });
      const placement = plan.items.find((item) => item.goal_id === 'place-cup')!;
      placement.dependencies = ['open-cabinet'];
      placement.status = 'waiting';
      call('planning.update', {
        plan: { ...plan, version: plan.version + 1 },
        expectedVersion: plan.version,
      });
    }
    if (step === 3) call('tasks.select_goal', { goalId: 'open-cabinet' });
    if (step === 4) call('execution.start', { instruction: 'Open the cabinet.' });
  } else if (payload.result?.status === 'passed') {
    const goal = payload.result.task_scope.goal_id;
    if (step === 0) call('planning.read');
    if (step === 1) {
      const plan = previous.plan as PlanDocument;
      call('planning.update', {
        plan: {
          ...plan,
          version: plan.version + 1,
          items: plan.items.map((item) =>
            item.goal_id === goal
              ? { ...item, status: 'done', last_verdict_ref: payload.result!.verdict_id }
              : item,
          ),
        },
        expectedVersion: plan.version,
      });
    }
    if (goal === 'open-cabinet') {
      if (step === 2) call('tasks.select_goal', { goalId: 'place-cup' });
      if (step === 3) call('tasks.retry', { changes, attemptSummary: summary });
      if (step === 4)
        call('execution.start', { instruction: 'Place the cup inside the now-open cabinet.' });
    } else if (goal === 'place-cup') {
      if (step === 2) call('tasks.select_goal', { goalId: 'store-cup' });
      if (step === 3)
        call('execution.start', { instruction: 'Close the cabinet with the cup inside.' });
    } else if (goal === 'store-cup' && step === 2) call('tasks.finish');
  } else if (payload.result?.status === 'unknown' && step === 0) {
    call('tasks.abandon', {
      status: 'unknown',
      reason: 'The multi-goal fixture could not establish the requested conditions.',
    });
  }
  // null marks a handled, completed scripted turn; undefined delegates to the base fixture.
  return choice;
}
