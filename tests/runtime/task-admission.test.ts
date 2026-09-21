import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ContractValidator } from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { TaskGoals, taskContextSummary, type GoalBinding, type RunState } from '@edh/tasks';
import { admitSessionTask } from '../../apps/server/src/task-admission.js';
import { UserSessions, type UserSessionRecord } from '../../apps/server/src/user-sessions.js';

const goal: GoalBinding = {
  id: 'store-cup',
  configuration: 'declared-cup-task',
  successContract: {
    id: 'cup-in-cabinet',
    version: '1',
    all: [{ check_id: 'cup-inside', check: 'inside', args: ['cup', 'cabinet'] }],
    source: { kind: 'user', reference: 'selected-task-criteria' },
  },
  entities: { cup: 'cup', cabinet: 'cabinet' },
  capabilities: ['manipulate'],
  taskSemantics: ['object-storage'],
  budget: { max_control_steps: 100, max_wall_time_s: 60 },
};
const tasks = { cup: { instruction: 'Put the cup in the cabinet.', goal } };

function userSession(): UserSessionRecord {
  return {
    id: randomUUID(),
    profileId: 'selected-profile',
    requestId: randomUUID(),
    deploymentDigest: 'configured-deployment',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: 'ready',
    resources: 'held',
    configuration: {},
    runIds: [],
  };
}

async function withStore(run: (store: LocalStore) => Promise<void> | void) {
  const parent = resolve('.local/work');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(resolve(parent, 'task-admission-'));
  const store = new LocalStore(directory);
  try {
    await run(store);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

function cancelledRecord(): RunState {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    instruction: 'Inspect the work area.',
    scenario: 'inspection',
    source: 'simulation',
    state: 'cancelled',
    createdAt: now,
    updatedAt: now,
    teamDigest: 'declared-team',
    teamId: 'team',
    decisionAssignmentId: '',
    attempt: 1,
    finalGoalId: 'inspect',
    recoveryId: null,
    retryChanges: [],
    assignments: {},
    events: [{ sequence: 1, at: now, type: 'audit', detail: { text: 'private audit payload' } }],
    executions: [],
    requests: [],
    verdicts: [],
    latestSensor: null,
    agentSeen: {},
    skillIds: [],
    error: 'Cancelled before execution.',
  };
}

test('task admission preserves selected criteria and binds the actual user instruction', async () => {
  await withStore(async (store) => {
    const options = { session: userSession(), allowedTasks: ['cup'], tasks, store };
    const request = { scenario: 'cup', requestId: randomUUID() };
    const original = admitSessionTask(request, options);
    assert.equal(original.identity, 'cup');
    assert.equal(original.instruction, tasks.cup.instruction);
    assert.deepEqual(original.context, []);
    const custom = admitSessionTask(
      { ...request, instruction: '  Use the left cabinet.  ' },
      options,
    );
    assert.equal(custom.instruction, 'Use the left cabinet.');
    assert.notEqual(custom.identity, original.identity);
    assert.equal(
      custom.identity,
      admitSessionTask({ ...request, instruction: 'Use the left cabinet.' }, options).identity,
    );
    assert.deepEqual(custom.goal, goal);
    assert.notEqual(custom.goal, goal);
    const validator = new ContractValidator(
      JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
    );
    assert.deepEqual(new TaskGoals(validator, custom.goal).get(goal.id), goal);
  });
});

test('task admission rejects unregistered criteria, raw context and malformed input', async () => {
  await withStore((store) => {
    const options = { session: userSession(), allowedTasks: ['cup'], tasks, store };
    const request = { scenario: 'cup', requestId: randomUUID() };
    for (const input of [
      { ...request, scenario: 'unknown' },
      { ...request, requestId: 'short' },
      { ...request, goal },
      { ...request, context: 'unscoped transcript' },
      { ...request, instruction: '' },
      { ...request, instruction: ' ' },
      { ...request, instruction: null },
      { ...request, instruction: 'x'.repeat(4001) },
      { ...request, contextRunIds: null },
      { ...request, contextRunIds: 'run' },
      { ...request, contextRunIds: ['duplicate', 'duplicate'] },
      { ...request, contextRunIds: ['../record'] },
      { ...request, contextRunIds: ['a', 'b', 'c', 'd', 'e'] },
    ])
      assert.throws(() => admitSessionTask(input, options));
    assert.throws(() => admitSessionTask(request, { ...options, allowedTasks: [] }));
  });
});

test('explicit historical context reads scoped journal records without private payloads', async () => {
  await withStore((store) => {
    const session = userSession();
    const run = cancelledRecord();
    session.runIds.push(run.id);
    store.put(`run:${run.id}`, run, 0);
    store.put(`run-user-session:${run.id}`, { sessionId: session.id }, 0);
    const options = { session, allowedTasks: ['cup'], tasks, store };
    const request = { scenario: 'cup', requestId: randomUUID(), contextRunIds: [run.id] };
    const admitted = admitSessionTask(request, options);
    assert.equal(admitted.context[0]!.outcome, 'cancelled');
    assert.equal(admitted.context[0]!.finalVerification, null);
    assert.equal(admitted.context[0]!.recordVersion, 1);
    assert.deepEqual(admitted.contextRunIds, [run.id]);
    const encoded = taskContextSummary(admitted.context);
    assert.ok(encoded.includes(run.instruction));
    assert.ok(encoded.includes('Observe the current environment'));
    assert.ok(!encoded.includes('private audit payload'));
    assert.ok(!encoded.includes('assignments'));
    assert.notEqual(
      admitted.identity,
      admitSessionTask({ ...request, contextRunIds: [] }, options).identity,
    );
    store.put('accepted-submission', admitted, 0);
    run.instruction = 'Changed record text';
    store.put(`run:${run.id}`, run, 1);
    assert.equal(
      store.get<typeof admitted>('accepted-submission')!.value.context[0]!.instruction,
      'Inspect the work area.',
    );
    store.put(`run-user-session:${run.id}`, { sessionId: randomUUID() }, 1);
    assert.throws(() => admitSessionTask(request, options), /ownership/);
    assert.throws(
      () => admitSessionTask(request, { ...options, session: userSession() }),
      /this user session/,
    );
  });
});

test('context admission rejects active, missing and oversized history', async () => {
  await withStore((store) => {
    const session = userSession();
    const run = cancelledRecord();
    session.runIds.push(run.id);
    const options = { session, allowedTasks: ['cup'], tasks, store };
    const request = { scenario: 'cup', requestId: randomUUID(), contextRunIds: [run.id] };
    assert.throws(() => admitSessionTask(request, options), /unavailable/);
    store.put(`run-user-session:${run.id}`, { sessionId: session.id }, 0);
    run.state = 'running';
    store.put(`run:${run.id}`, run, 0);
    assert.throws(() => admitSessionTask(request, options), /still active/);
    run.state = 'cancelled';
    run.instruction = 'x'.repeat(17000);
    store.put(`run:${run.id}`, run, 1);
    assert.throws(() => admitSessionTask(request, options), /exceeds 16 KiB/);
  });
});

test('request replay checks complete input identity and durable task ownership', async () => {
  await withStore((store) => {
    const session = userSession();
    const run = cancelledRecord();
    session.state = 'closed';
    session.resources = 'released';
    session.runIds.push(run.id);
    store.put(`user-session:${session.id}`, session, 0);
    store.put(`run:${run.id}`, run, 0);
    store.put(`run-user-session:${run.id}`, { sessionId: session.id }, 0);
    const sessions = new UserSessions(store);
    const options = { session, allowedTasks: ['cup'], tasks, store };
    const request = { scenario: 'cup', requestId: randomUUID(), instruction: 'Move slowly.' };
    const submission = admitSessionTask(request, options);
    const key = `session-task-request:${session.id}:${request.requestId}`;
    store.put(key, { taskId: 'cup', runId: run.id, inputIdentity: submission.identity }, 0);
    assert.deepEqual(
      sessions.replayTask(session.id, 'cup', request.requestId, submission.identity),
      { runId: run.id, replayed: true },
    );
    for (const changed of [
      { ...request, instruction: 'Use another route.' },
      { ...request, contextRunIds: [run.id] },
    ]) {
      const other = admitSessionTask(changed, options);
      assert.throws(
        () => sessions.replayTask(session.id, 'cup', request.requestId, other.identity),
        /different input/,
      );
    }
    const legacyId = randomUUID();
    store.put(
      `session-task-request:${session.id}:${legacyId}`,
      { taskId: 'cup', runId: run.id },
      0,
    );
    const legacy = admitSessionTask({ scenario: 'cup', requestId: legacyId }, options);
    assert.equal(sessions.replayTask(session.id, 'cup', legacyId, legacy.identity)?.runId, run.id);
    const incompleteId = randomUUID();
    const incompleteKey = `session-task-request:${session.id}:${incompleteId}`;
    store.put(incompleteKey, { taskId: 'cup', runId: null }, 0);
    assert.throws(() => sessions.replayTask(session.id, 'cup', incompleteId), /interrupted/);
    store.put(incompleteKey, { taskId: 'cup', runId: randomUUID() }, 1);
    assert.throws(() => sessions.replayTask(session.id, 'cup', incompleteId), /interrupted/);
    store.put(`run-user-session:${run.id}`, { sessionId: randomUUID() }, 1);
    assert.throws(() => sessions.replayTask(session.id, 'cup', legacyId), /interrupted/);
  });
});
