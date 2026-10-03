import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ContractValidator } from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { TaskPlans } from '@edh/planning';
import { AssignmentHistory, RunHistory, TaskGoals, VerdictHistory } from '@edh/tasks';
import { SessionTaskCatalogs } from '../apps/server/src/session-task-catalog.ts';
import { SessionTaskHistory } from '../apps/server/src/session-task-history.ts';
import { admitSessionTask } from '../apps/server/src/task-admission.ts';

assert(process.argv[2], 'Supply a recorded console journal directory.');
const journalPath = resolve(process.argv[2], 'records.jsonl');
const sourceBytes = await readFile(journalPath);
const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
await mkdir('.local/checks', { recursive: true });
const directory = await mkdtemp(resolve('.local/checks/session-continuity-'));
await writeFile(resolve(directory, 'records.jsonl'), sourceBytes);
const store = new LocalStore(directory);
const membership = new SessionTaskHistory(store);
const catalogs = new SessionTaskCatalogs(store, validator);
const history = new RunHistory(store);
const plans = new TaskPlans(store, validator);
const verdicts = new VerdictHistory(store, validator);
const assignments = new AssignmentHistory(store, validator);
const results = [];
try {
  for (const row of store.scan('user-session:')) {
    const session = row.value;
    membership.validate(session);
    assert.equal(row.key, `user-session:${session.id}`);
    assert.equal(
      session.state,
      'closed',
      'Acceptance journal must retain confirmed Session close.',
    );
    assert.equal(session.resources, 'released');
    const catalog = catalogs.read(session);
    const members = [...membership.members(session)].sort((a, b) => a.position - b.position);
    assert(members.length, 'Session must contain an actual admitted task.');
    const checkedRuns = [];
    const nativeSessions = new Set();
    const ownedRuns = new Set();
    for (const [index, member] of members.entries()) {
      assert.equal(member.position, index + 1);
      assert(!ownedRuns.has(member.runId));
      ownedRuns.add(member.runId);
      assert(membership.has(session, member.runId));
      const run = store.get(`run:${member.runId}`).value;
      assert.equal(run.id, member.runId);
      assert.equal(store.get(`run-user-session:${run.id}`).value.sessionId, session.id);
      assert.notEqual(
        run.source,
        'test_fixture',
        'Only actual simulation/hardware sources qualify.',
      );
      assert(['succeeded', 'failed', 'unknown', 'cancelled'].includes(run.state));
      const task = catalog.tasks[run.scenario];
      assert(task, 'Run must reference an admitted Session catalog task.');
      assert.equal(run.finalGoalId, task.goal.id);
      const fullVerdicts = run.verdicts.map((value) => verdicts.resolve(run.id, value));
      const plan = plans.read(run.id);
      const goals = new TaskGoals(
        validator,
        task.goal,
        task.allowedSubgoalChecks,
        task.predefinedGoals,
      );
      if (plan) goals.admit(goals.prepare(plan));
      const actualEvents = history.restore(run).events;
      const requestIds = new Set();
      const attemptIds = new Set();
      for (const request of run.requests) {
        validator.parse('SubgoalRequest', request);
        assert.equal(request.task_id, run.id);
        assert(!requestIds.has(request.idempotency_key));
        assert(!attemptIds.has(request.attempt_id));
        requestIds.add(request.idempotency_key);
        attemptIds.add(request.attempt_id);
        const goal = goals.get(request.goal_id);
        assert.deepEqual(request.success_contract, goal.successContract);
        assert.deepEqual(request.budget, goal.budget);
        assert.deepEqual(request.entities, goal.entities);
        assert.deepEqual(request.required_capabilities, goal.capabilities);
        const owner = run.assignments[run.decisionAssignmentId];
        assert.equal(request.decision_owner_id, owner.sessionId);
        assert.equal(request.owner_assignment_id, owner.id);
        assert(run.requests.filter((value) => value.goal_id === request.goal_id).length <= 3);
      }
      for (const execution of run.executions) {
        validator.parse('ExecutionStatus', execution);
        assert.equal(execution.task_scope.task_id, run.id);
        const request = run.requests.find(
          (value) =>
            value.goal_id === execution.task_scope.goal_id &&
            value.attempt_id === execution.task_scope.attempt_id,
        );
        assert(request, 'Execution must have a same-run goal/attempt request.');
        assert.equal(execution.task_scope.recovery_id, request.recovery_id);
        assert(execution.control_steps <= request.budget.max_control_steps);
        assert(execution.device_confirmed && execution.state === 'ended');
      }
      for (const verdict of fullVerdicts) {
        const execution = run.executions.find(
          (value) => value.execution_id === verdict.execution_id,
        );
        assert(execution, 'Formal verdict must resolve its actual execution.');
        assert.deepEqual(verdict.task_scope, execution.task_scope);
        assert.equal(verdict.boundary_event_id, execution.boundary_event_id);
        const request = run.requests.find(
          (value) =>
            value.goal_id === verdict.task_scope.goal_id &&
            value.attempt_id === verdict.task_scope.attempt_id,
        );
        assert.equal(verdict.goal_contract_id, request.success_contract.id);
        assert.equal(verdict.goal_contract_version, request.success_contract.version);
        assert(
          actualEvents.some(
            (event) =>
              event.type === 'verification.completed' &&
              event.detail.result.verdict_id === verdict.verdict_id,
          ),
        );
      }
      for (const assignment of Object.values(run.assignments)) {
        assert.equal(assignment.status, 'retired');
        assert(
          !nativeSessions.has(assignment.sessionId),
          'Task assignments require independent Sessions.',
        );
        nativeSessions.add(assignment.sessionId);
        const details = assignments.read(run.id, assignment.id);
        assert(details, 'Retired assignment must retain inspectable original context.');
        assert.equal(details.assignment.brief.task_scope.task_id, run.id);
      }
      if (run.state === 'succeeded') {
        const final = fullVerdicts.at(-1);
        assert.equal(final.status, 'passed');
        assert.equal(final.task_scope.goal_id, run.finalGoalId);
        assert.equal(final.task_scope.attempt_id, `attempt-${run.attempt}`);
        assert(plan.items.every((item) => ['done', 'abandoned'].includes(item.status)));
        const owner = assignments.read(run.id, run.decisionAssignmentId).assignment;
        assert(owner.todos.every((todo) => todo.status === 'completed'));
        assert(actualEvents.some((event) => event.type === 'run.succeeded'));
      }
      const currentContext = admitSessionTask(
        {
          scenario: run.scenario,
          requestId: session.requestId,
          catalogRevision: catalog.revision,
          contextRunIds: [run.id],
        },
        {
          session,
          allowedTasks: Object.keys(catalog.tasks),
          catalogRevision: catalog.revision,
          tasks: catalog.tasks,
          store,
          validator,
        },
      );
      assert.equal(currentContext.context[0].runId, run.id);
      assert.equal(currentContext.context[0].outcome, run.state);
      assert.equal(currentContext.context[0].userSessionId, session.id);
      const goalIds = [...new Set(run.requests.map((request) => request.goal_id))];
      const conditionSets = new Set(
        run.requests.map((request) =>
          JSON.stringify(
            'all' in request.success_contract
              ? { all: request.success_contract.all }
              : { any: request.success_contract.any },
          ),
        ),
      );
      checkedRuns.push({
        runId: run.id,
        outcome: run.state,
        requests: run.requests.length,
        executions: run.executions.length,
        formalVerdictStatuses: fullVerdicts.map((verdict) => verdict.status),
        goalIds,
        distinctConditionSets: conditionSets.size,
        eventCount: actualEvents.length,
        retiredAssignments: Object.keys(run.assignments).length,
      });
    }
    for (const owner of store.scan('run-user-session:'))
      if (owner.value.sessionId === session.id) {
        assert.equal(owner.version, 1);
        assert(
          members.some((member) => owner.key === `run-user-session:${member.runId}`),
          'Reverse task ownership must have a published Session membership.',
        );
      }
    for (const request of store.scan(`session-task-request:${session.id}:`)) {
      if (request.value.runId === null) continue;
      const run = store.get(`run:${request.value.runId}`).value;
      assert(ownedRuns.has(run.id));
      assert.equal(request.value.taskId, run.scenario);
    }
    results.push({
      sessionId: session.id,
      resources: session.resources,
      taskCount: members.length,
      multipleTaskHistoryPresent: members.length > 1,
      multipleGoalConditionsPresent: checkedRuns.some(
        (run) => run.goalIds.length > 1 && run.distinctConditionSets > 1,
      ),
      runs: checkedRuns,
    });
  }
  assert(results.length, 'Journal must contain actual closed User Sessions.');
  if (process.argv.includes('--require-multiple-tasks'))
    assert(
      results.some((result) => result.multipleTaskHistoryPresent),
      'Recorded source has no retained Session with multiple admitted tasks.',
    );
  if (process.argv.includes('--require-distinct-goals'))
    assert(
      results.some((result) => result.multipleGoalConditionsPresent),
      'Recorded source has no task with multiple goals and different admitted conditions.',
    );
  const result = {
    sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
    sessions: results,
    scope: 'Production readers on a copied actual journal; no new model or physical execution.',
  };
  await writeFile(resolve(directory, 'audit.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ ...result, auditDirectory: directory }));
} finally {
  store.close();
}
