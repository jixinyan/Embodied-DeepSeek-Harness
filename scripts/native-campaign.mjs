import assert from 'node:assert/strict';
import { z } from 'zod';

const identity = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/);
const nativeTaskIdentity = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/);
export const nativeCampaignSchema = z
  .object({
    version: z.literal(1),
    cases: z
      .array(
        z
          .object({
            id: identity,
            profileId: identity,
            tasks: z
              .array(
                z
                  .object({
                    taskId: nativeTaskIdentity,
                    minimumControls: z.number().int().min(0).default(1),
                    maximumControls: z.number().int().min(0).optional(),
                    minimumGoals: z.number().int().min(1).max(64).default(1),
                    requireRecovery: z.boolean().default(false),
                    requiredTools: z.array(z.string().min(1)).default([]),
                  })
                  .strict()
                  .refine(
                    (task) =>
                      task.maximumControls === undefined ||
                      task.maximumControls >= task.minimumControls,
                    'Maximum controls must include the required minimum.',
                  ),
              )
              .min(1),
            timeoutMs: z.number().int().min(1).max(86_400_000).default(3_600_000),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .refine(
    (value) => new Set(value.cases.map((item) => item.id)).size === value.cases.length,
    'Campaign case identities must be unique.',
  );

export function auditNativeCampaignTask(run, events, expectation) {
  assert.equal(run.source, 'simulation');
  assert.equal(run.scenario, expectation.taskId);
  assert.equal(run.state, 'succeeded');
  assert.equal(events.length, run.eventCount);
  for (const [index, event] of events.entries()) assert.equal(event.sequence, index + 1);
  assert(!events.some((event) => event.type === 'tool.failed'));
  assert(run.plan);
  assert.equal(run.plan.task_id, run.id);
  assert(run.plan.items.every((item) => item.status === 'done' || item.status === 'abandoned'));
  const completedGoals = run.plan.items.filter((item) => item.status === 'done');
  assert(completedGoals.length >= expectation.minimumGoals);
  const final = completedGoals.find((item) => item.goal_id === run.finalGoalId);
  assert(final);
  const requests = new Map(run.requests.map((request) => [request.attempt_id, request]));
  assert.equal(requests.size, run.requests.length);
  const assignments = Object.values(run.assignments);
  assert(assignments.length >= 2 && assignments.every((item) => item.status === 'retired'));
  assert.equal(new Set(assignments.map((item) => item.sessionId)).size, assignments.length);
  const decisionOwner = run.assignments[run.decisionAssignmentId];
  assert(decisionOwner);
  assert.equal(run.plan.owner_assignment_id, decisionOwner.id);
  assert.equal(run.plan.owner_agent_id, decisionOwner.sessionId);
  assert.equal(
    new Set(run.executions.map((item) => item.execution_id)).size,
    run.executions.length,
  );
  const controls = run.executions.reduce((count, execution) => count + execution.control_steps, 0);
  const policyCalls = run.executions.reduce(
    (count, execution) => count + execution.policy_calls,
    0,
  );
  const rawSimSteps = run.executions.reduce(
    (count, execution) => count + execution.raw_sim_steps,
    0,
  );
  assert(controls >= expectation.minimumControls);
  if (expectation.maximumControls !== undefined) assert(controls <= expectation.maximumControls);
  if (expectation.maximumControls === 0) {
    assert.equal(policyCalls, 0);
    assert.equal(rawSimSteps, 0);
  }

  for (const verdict of run.verdicts) {
    const request = requests.get(verdict.task_scope.attempt_id);
    const execution = run.executions.find((item) => item.execution_id === verdict.execution_id);
    const verifier = run.assignments[verdict.verifier_assignment_id];
    assert(request && execution && verifier);
    assert.notEqual(verifier.id, decisionOwner.id);
    assert.equal(verifier.sessionId, verdict.verifier_id);
    assert.equal(request.owner_assignment_id, decisionOwner.id);
    assert.equal(request.decision_owner_id, decisionOwner.sessionId);
    assert.equal(request.task_id, run.id);
    assert.equal(request.goal_id, verdict.task_scope.goal_id);
    assert.equal(verdict.goal_contract_id, request.success_contract.id);
    assert.equal(verdict.goal_contract_version, request.success_contract.version);
    assert.equal(execution.state, 'ended');
    assert.equal(execution.device_confirmed, true);
    assert(
      ['policy_stop', 'planner_stop', 'episode_terminated', 'budget_exhausted'].includes(
        execution.stop_reason,
      ),
    );
    assert.equal(execution.boundary_event_id, verdict.boundary_event_id);
    assert.deepEqual(verdict.task_scope, execution.task_scope);
    assert.equal(verdict.task_scope.task_id, run.id);
    const boundary = events.find(
      (event) =>
        event.type === 'execution.updated' &&
        event.detail.execution.state === 'ended' &&
        event.detail.execution.boundary_event_id === verdict.boundary_event_id,
    );
    const completed = events.find(
      (event) =>
        event.type === 'verification.completed' &&
        event.detail.result.verdict_id === verdict.verdict_id,
    );
    assert(boundary && completed && boundary.sequence < completed.sequence);
  }
  assert.equal(
    new Set(run.verdicts.map((item) => item.verifier_assignment_id)).size,
    run.verdicts.length,
  );
  for (const item of completedGoals) {
    const verdict = run.verdicts.findLast(
      (candidate) => candidate.task_scope.goal_id === item.goal_id,
    );
    const request = verdict && requests.get(verdict.task_scope.attempt_id);
    assert(verdict && request);
    assert.equal(verdict.status, 'passed');
    assert.equal(item.last_verdict_ref, verdict.verdict_id);
    assert.deepEqual(request.success_contract, item.success_contract);
    for (const dependency of item.dependencies) {
      const row = completedGoals.find((candidate) => candidate.goal_id === dependency);
      const previous = run.verdicts.findLast(
        (candidate) => candidate.task_scope.goal_id === dependency,
      );
      assert(row && previous && previous.status === 'passed');
      assert.equal(row.last_verdict_ref, previous.verdict_id);
      const admitted = events.find(
        (event) =>
          event.type === 'execution.requested' &&
          event.detail.request.idempotency_key === request.idempotency_key,
      );
      const completed = events.find(
        (event) =>
          event.type === 'verification.completed' &&
          event.detail.result.verdict_id === previous.verdict_id,
      );
      const committed = events.find(
        (event) =>
          event.type === 'plan.updated' &&
          event.sequence > completed?.sequence &&
          event.detail.plan.items.some(
            (candidate) =>
              candidate.goal_id === dependency &&
              candidate.status === 'done' &&
              candidate.last_verdict_ref === previous.verdict_id,
          ),
      );
      assert(
        admitted &&
          completed &&
          committed &&
          completed.sequence < committed.sequence &&
          committed.sequence < admitted.sequence,
      );
    }
  }
  const tools = new Set(
    events.filter((event) => event.type === 'tool.completed').map((event) => event.detail.tool),
  );
  assert(tools.has('tasks.finish'));
  for (const tool of expectation.requiredTools)
    assert(tools.has(tool), `Required tool was not completed: ${tool}`);
  const recovery = events.filter((event) => event.type === 'retry.accepted');
  if (expectation.requireRecovery) assert(recovery.length > 0);
  for (const event of recovery) {
    assert.equal(event.detail.ownerAssignmentId, run.decisionAssignmentId);
    const failed = run.verdicts.find(
      (verdict) => verdict.verdict_id === event.detail.failedVerdict.verdict_id,
    );
    assert(failed && failed.status === 'failed');
    assert.equal(failed.task_scope.task_id, run.id);
    assert.deepEqual(failed.task_scope, event.detail.failedVerdict.task_scope);
    assert(event.detail.changes.length > 0);
    const acceptedFailure = events.find(
      (candidate) =>
        candidate.type === 'verification.completed' &&
        candidate.detail.result.verdict_id === failed.verdict_id,
    );
    const resumed = events.find(
      (candidate) =>
        candidate.type === 'execution.requested' &&
        candidate.detail.request.recovery_id === event.detail.recoveryId &&
        candidate.detail.request.goal_id === failed.task_scope.goal_id,
    );
    assert(
      acceptedFailure &&
        resumed &&
        acceptedFailure.sequence < event.sequence &&
        event.sequence < resumed.sequence,
    );
  }
  return {
    runId: run.id,
    scenario: run.scenario,
    events: events.length,
    controls,
    policyCalls,
    rawSimSteps,
    goals: completedGoals.length,
    recoveryRequests: recovery.length,
    formalVerdicts: run.verdicts.length,
    independentAssignments: assignments.length,
    scope:
      'Actual terminal HTTP task history and authority checks; original simulator/policy/video source audit remains required.',
  };
}
