import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AssignmentReports } from '@edh/communication';
import type { SensorSample } from '@edh/execution';
import { SensorSamples } from '@edh/perception';
import { LocalStore } from '@edh/storage';
import {
  AssignmentHistory,
  RecoveryHistory,
  RunHistory,
  VerdictHistory,
  type RecoveryTrace,
} from '@edh/tasks';
import { VerificationBoundaries, VerificationContexts } from '@edh/verification';
import { taskRecordOwners } from '../../apps/server/src/task-record-owners.js';
import { assignmentDocuments } from './support/assignment-documents.js';

const keyFor = (prefix: string, ...ids: string[]) => prefix + JSON.stringify(ids);

async function workspace(work: (store: LocalStore) => Promise<void>) {
  await mkdir('.local/work', { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/task-record-owners-'));
  const store = new LocalStore(directory);
  try {
    await work(store);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

async function documents(store: LocalStore) {
  const { state, assignment, validator, input } = await assignmentDocuments();
  const planner = state.assignments[assignment.id]!;
  const brief = planner.brief!;
  brief.caller_agent_id = 'user';
  brief.caller_assignment_id = 'user';
  brief.expected_output.recipient = 'user';
  brief.evidence_refs = ['brief-evidence'];
  brief.known_facts = [
    {
      statement: 'The document has a pending deployment check.',
      observed_at: state.createdAt,
      evidence_refs: ['fact-evidence'],
    },
  ];
  const samples = new SensorSamples(store, validator, state.id, state.source);
  const sample = (evidenceId: string, scope = brief.task_scope) =>
    samples.retain({
      source: state.source,
      sequence: 0,
      description: 'Authored source document. No model or physical provider executed.',
      visualization: {},
      evidence: {
        id: evidenceId,
        kind: 'event',
        source: 'authored-document',
        visibility: 'agent',
        task_scope: scope,
        clock_id: 'document-clock',
        created_at: state.createdAt,
        observed_at: state.createdAt,
      },
    });
  for (const name of ['brief-evidence', 'fact-evidence', 'last-observation']) sample(name);
  state.agentSeen[planner.id] = samples.read('last-observation')!;
  const reports = new AssignmentReports(store, validator);
  const accepted = reports.submit(assignment, input(0)).record;
  planner.report = accepted.report;
  planner.reportVersion = accepted.version;
  const results = ['failed', 'passed'].map((status) => {
    const scope = {
      ...brief.task_scope,
      attempt_id: status === 'failed' ? 'attempt-1' : 'attempt-2',
      ...(status === 'passed' ? { recovery_id: 'document:recovery' } : {}),
    };
    const actor = {
      id: `${status}-verifier`,
      member: 'verifier',
      sessionId: `${status}-session`,
      status: 'retired',
      model: 'unconnected-document-model',
      tools: [],
      verificationContextStored: true,
      brief: validator.parse('InvocationBrief', {
        ...brief,
        assignment_id: `${status}-verifier`,
        caller_assignment_id: planner.id,
        caller_agent_id: planner.sessionId,
        task_scope: scope,
        expected_output: { schema: 'builtin:AgentReport.v1', recipient: planner.id },
      }),
    };
    state.assignments[actor.id] = actor;
    sample(`${status}-evidence`, scope);
    const result = validator.parse('VerificationResult', {
      schema_version: 'physical.verification.v1',
      verdict_id: `${status}-verdict`,
      verification_request_id: `${status}-request`,
      execution_id: `${status}-execution`,
      verifier_id: actor.sessionId,
      verifier_assignment_id: actor.id,
      task_scope: scope,
      status,
      goal_contract_id: brief.success_contract.id,
      goal_contract_version: brief.success_contract.version,
      boundary_event_id: `${status}-boundary`,
      checks: [
        { check_id: 'review', value: status === 'passed', evidence_refs: [`${status}-evidence`] },
      ],
      evidence_refs: [`${status}-evidence`],
      explanation: 'Authored verification document.',
      observed_at: state.createdAt,
      clock_id: 'document-clock',
    });
    const execution = validator.parse('ExecutionStatus', {
      schema_version: 'physical.execution.v1',
      execution_id: result.execution_id,
      task_scope: scope,
      state: 'paused',
      state_version: 1,
      control_steps: 0,
      policy_calls: 0,
      elapsed_wall_time_s: 0,
      device_confirmed: true,
      observation_refs: result.evidence_refs,
      clock_id: 'document-clock',
      recorded_at: state.createdAt,
      boundary_event_id: result.boundary_event_id,
      boundary_at: state.createdAt,
      stop_reason: 'user_stop',
    });
    new VerificationBoundaries(store, validator, state.id).admit(undefined, execution);
    const contexts = new VerificationContexts(store, validator, samples, state.id);
    contexts.open(actor.id, {
      requestId: result.verification_request_id,
      executionId: result.execution_id,
      boundaryId: result.boundary_event_id,
      scope,
      evidenceId: `${status}-evidence`,
    });
    contexts.update(actor.id, result.checks, `${status}-evidence`);
    contexts.close();
    state.verdicts.push(new VerdictHistory(store, validator).retain(state.id, result));
    state.executions.push(execution);
    return result;
  });
  const failed = results[0]!;
  const passed = results[1]!;
  const request = validator.parse('SubgoalRequest', {
    schema_version: 'physical.subgoal.v1',
    task_id: state.id,
    goal_id: brief.task_scope.goal_id,
    attempt_id: 'attempt-1',
    instruction: 'Review the supplied document.',
    entities: {},
    required_capabilities: [],
    success_contract: brief.success_contract,
    budget: { max_control_steps: 10, max_wall_time_s: 30 },
    context_refs: ['brief-evidence'],
    team_run_id: brief.team_run_id,
    owner_assignment_id: planner.id,
    decision_owner_id: planner.sessionId,
    idempotency_key: 'document-request',
  });
  state.requests.push(request);
  const archives = new AssignmentHistory(store, validator);
  for (const actorId of Object.keys(state.assignments)) archives.retain(state, actorId);
  store.put(`run:${state.id}`, state, 0);
  const history = new RunHistory(store);
  for (let index = 1; index <= 3; index++)
    history.append(state, index, 'documentation.review', { index });
  const recovery = new RecoveryHistory(store);
  recovery.create('document:recovery', state.id, {
    decision: 'retry',
    attemptSummary: 'Read the missing deployment evidence.',
    changes: ['Inspect the referenced result.'],
    ownerAssignmentId: planner.id,
    originalGoalId: brief.task_scope.goal_id,
    failedVerdict: failed,
    failedRequest: request,
    failedExecution: state.executions[0],
  });
  recovery.append('document:recovery', state.id, 1);
  recovery.append('document:recovery', state.id, 3);
  recovery.update('document:recovery', passed, null);
  const owners = taskRecordOwners(store, validator);
  const inspect = (key: string) => {
    const owner = owners.find((item) => key.startsWith(item.prefix));
    assert(owner);
    const row = store.get(key);
    assert(row);
    return owner.inspect({ key, ...row });
  };
  return { state, planner, validator, failed, passed, recovery, inspect, owners };
}

test('assignment owners retain brief facts, observations, caller archives, reports and formal contexts across reopen', async () => {
  await workspace(async (store) => {
    const { state, planner, validator, inspect } = await documents(store);
    const plannerKey = keyFor('assignment-history:', state.id, planner.id);
    const refs = inspect(plannerKey).references;
    assert.deepEqual(
      new Set(refs),
      new Set([
        `run:${state.id}`,
        `report:${planner.id}`,
        ...['brief-evidence', 'fact-evidence', 'last-observation'].map((id) =>
          keyFor('sensor-sample:', state.id, id),
        ),
      ]),
    );
    const verifierKey = keyFor('assignment-history:', state.id, 'passed-verifier');
    const verifierRefs = inspect(verifierKey).references;
    assert(verifierRefs.includes(plannerKey));
    assert(verifierRefs.includes('recovery:document:recovery'));
    assert(verifierRefs.includes(keyFor('verification-context:', state.id, 'passed-verifier')));
    for (const name of [...refs, ...verifierRefs]) assert(store.revision(name));
    store.compact();
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      const owner = taskRecordOwners(reopened, validator)[0]!;
      assert.deepEqual(
        owner.inspect({ key: plannerKey, ...reopened.get(plannerKey)! }).references,
        refs,
      );
    } finally {
      reopened.close();
    }
  });
});

test('assignment owners reject missing facts, changed actors, private observations and missing verification sources without writes', async () => {
  for (const condition of ['fact', 'caller', 'observation', 'context', 'report', 'summary'])
    await workspace(async (store) => {
      const { state, planner, inspect } = await documents(store);
      const plannerKey = keyFor('assignment-history:', state.id, planner.id);
      const verifierKey = keyFor('assignment-history:', state.id, 'passed-verifier');
      let target = plannerKey;
      if (condition === 'fact')
        store.retire(
          [keyFor('sensor-sample:', state.id, 'fact-evidence')],
          store.statistics().sequence,
        );
      if (condition === 'caller') {
        store.retire([plannerKey], store.statistics().sequence);
        target = verifierKey;
      }
      if (condition === 'observation') {
        const key = keyFor('sensor-sample:', state.id, 'last-observation');
        const sample = store.get<SensorSample>(key)!.value;
        sample.evidence.visibility = 'debug_only';
        store.retire([key], store.statistics().sequence);
        store.put(key, sample, 0);
      }
      if (condition === 'context') {
        store.retire(
          [keyFor('verification-context:', state.id, 'passed-verifier')],
          store.statistics().sequence,
        );
        target = verifierKey;
      }
      if (condition === 'report')
        store.retire([`report:${planner.id}`], store.statistics().sequence);
      if (condition === 'summary') {
        state.assignments[planner.id]!.model = 'conflicting-model';
        store.put(`run:${state.id}`, state, store.revision(`run:${state.id}`)!.version);
      }
      const sequence = store.statistics().sequence;
      assert.throws(() => inspect(target), /missing|restricted|conflict/);
      assert.equal(store.statistics().sequence, sequence);
    });
});

test('recovery owners preserve both verdicts, decision context and every published event reference', async () => {
  await workspace(async (store) => {
    const { state, planner, inspect } = await documents(store);
    const refs = inspect('recovery:document:recovery').references;
    for (const name of [
      `run:${state.id}`,
      keyFor('assignment-history:', state.id, planner.id),
      keyFor('verdict-history:', state.id, 'failed-verdict'),
      keyFor('verdict-history:', state.id, 'passed-verdict'),
      keyFor('sensor-sample:', state.id, 'failed-evidence'),
      keyFor('sensor-sample:', state.id, 'passed-evidence'),
      keyFor('verification-boundary:', state.id, 'failed-execution', 'failed-boundary'),
      'recovery-event:document:recovery:1',
      'recovery-event:document:recovery:2',
      `event:${state.id}:1`,
      `event:${state.id}:3`,
    ])
      assert(refs.includes(name), name);
    assert(!refs.includes(`event:${state.id}:2`));
    assert.deepEqual(inspect('recovery-event:document:recovery:2').references, [
      'recovery:document:recovery',
      `run:${state.id}`,
      `event:${state.id}:3`,
    ]);
    store.put('recovery-event:document:recovery:3', 3, 0);
    assert(
      !inspect('recovery:document:recovery').references.includes(
        'recovery-event:document:recovery:3',
      ),
    );
    assert(
      inspect('recovery-event:document:recovery:3').references.includes(`event:${state.id}:3`),
    );
  });
});

test('recovery inspection rejects missing or rewritten intermediate sources and unpublished run events', async () => {
  for (const condition of [
    'index',
    'event',
    'rewritten-index',
    'rewritten-event',
    'unpublished',
    'verdict',
    'unordered',
  ])
    await workspace(async (store) => {
      const { state, inspect } = await documents(store);
      const indexKey = 'recovery-event:document:recovery:1';
      const eventKey = `event:${state.id}:1`;
      if (condition === 'index' || condition === 'event' || condition === 'verdict')
        store.retire(
          [
            condition === 'index'
              ? indexKey
              : condition === 'event'
                ? eventKey
                : keyFor('verdict-history:', state.id, 'failed-verdict'),
          ],
          store.statistics().sequence,
        );
      if (condition === 'rewritten-index' || condition === 'rewritten-event') {
        const key = condition === 'rewritten-index' ? indexKey : eventKey;
        store.put(key, store.get(key)!.value, 1);
      }
      if (condition === 'unpublished') {
        state.eventCount = 2;
        store.put(`run:${state.id}`, state, store.revision(`run:${state.id}`)!.version);
      }
      if (condition === 'unordered') {
        const key = 'recovery-event:document:recovery:2';
        store.retire([key], store.statistics().sequence);
        store.put(key, 1, 0);
      }
      assert.throws(
        () => inspect('recovery:document:recovery'),
        /missing|rewritten|outside published|unordered/,
      );
    });
});

test('recovery inspection validates failed request and execution ownership and original-goal success', async () => {
  for (const condition of ['goal', 'owner', 'request', 'execution', 'result', 'verifier'])
    await workspace(async (store) => {
      const { state, inspect, failed } = await documents(store);
      const key = 'recovery:document:recovery';
      const row = store.get<RecoveryTrace>(key)!;
      const value = row.value;
      if (condition === 'goal') value.context.originalGoalId = 'other-goal';
      if (condition === 'owner') value.context.ownerAssignmentId = 'failed-verifier';
      if (condition === 'request')
        value.context.failedRequest = { ...state.requests[0], instruction: 'Changed source' };
      if (condition === 'execution')
        value.context.failedExecution = { ...state.executions[0], execution_id: 'other-execution' };
      if (condition === 'result') value.result = failed;
      if (condition === 'verifier') {
        state.assignments['failed-verifier']!.sessionId = 'other-session';
        store.put(`run:${state.id}`, state, store.revision(`run:${state.id}`)!.version);
      }
      store.put(key, value, row.version);
      assert.throws(() => inspect(key), /conflict|original.goal|decision owner/);
    });
});

test('inline recovery and run sources preserve explicit provenance without creating indexed history', async () => {
  await workspace(async (store) => {
    const { state, recovery, inspect } = await documents(store);
    const restored = recovery.restore('document:recovery');
    delete restored.eventCount;
    const { eventCount: _count, ...legacyRun } = new RunHistory(store).restore(state);
    const traceKey = 'recovery:document:recovery';
    store.put(traceKey, restored, store.revision(traceKey)!.version);
    store.put(`run:${state.id}`, legacyRun, store.revision(`run:${state.id}`)!.version);
    store.retire(
      [
        'recovery-event:document:recovery:1',
        'recovery-event:document:recovery:2',
        ...[1, 2, 3].map((sequence) => `event:${state.id}:${sequence}`),
      ],
      store.statistics().sequence,
    );
    const before = store.statistics().sequence;
    const refs = inspect(traceKey).references;
    assert(!refs.some((key) => key.startsWith('event:') || key.startsWith('recovery-event:')));
    assert.equal(store.statistics().sequence, before);
    restored.events[0]!.detail = { different: true };
    store.put(traceKey, restored, store.revision(traceKey)!.version);
    assert.throws(() => inspect(traceKey), /Inline recovery event conflicts/);
    delete restored.runId;
    store.put(traceKey, restored, store.revision(traceKey)!.version);
    assert.throws(() => inspect(traceKey));
  });
});

test('pending recoveries preserve failed provenance without requiring a successful result', async () => {
  await workspace(async (store) => {
    const { recovery, inspect } = await documents(store);
    recovery.update('document:recovery', null, 'Learning interrupted during document inspection.');
    const refs = inspect('recovery:document:recovery').references;
    assert(refs.some((key) => key.includes('failed-verdict')));
    assert(!refs.some((key) => key.includes('passed-verdict')));
  });
});

test('recovery execution telemetry retains debug evidence without granting agent visibility', async () => {
  await workspace(async (store) => {
    const { state, validator, inspect } = await documents(store);
    const samples = new SensorSamples(store, validator, state.id, state.source);
    const sample = samples.read('failed-evidence')!;
    sample.evidence.id = 'execution-debug';
    sample.evidence.visibility = 'debug_only';
    samples.retain(sample);
    const key = 'recovery:document:recovery';
    const row = store.get<RecoveryTrace>(key)!;
    const execution = validator.parse('ExecutionStatus', row.value.context.failedExecution);
    execution.observation_refs.push('execution-debug');
    row.value.context.failedExecution = execution;
    store.put(key, row.value, row.version);
    assert(inspect(key).references.includes(keyFor('sensor-sample:', state.id, 'execution-debug')));
    assert.equal(samples.read('execution-debug')!.evidence.visibility, 'debug_only');
  });
});

test('task owners reject noncanonical keys and rewritten archives and preserve unpublished assignment archives', async () => {
  await workspace(async (store) => {
    const { state, planner, owners, inspect } = await documents(store);
    const key = keyFor('assignment-history:', state.id, planner.id);
    const row = store.get(key)!;
    assert.throws(
      () =>
        owners[0]!.inspect({
          key: 'assignment-history:' + JSON.stringify([state.id, planner.id], null, 1),
          ...row,
        }),
      /not canonical/,
    );
    assert.throws(
      () =>
        owners[2]!.inspect({
          key: 'recovery-event:document:recovery:02',
          version: 1,
          value: 3,
        }),
      /identity/,
    );
    const archive = store.get<{ assignment: typeof planner }>(key)!.value;
    state.assignments[planner.id] = archive.assignment;
    store.put(`run:${state.id}`, state, store.revision(`run:${state.id}`)!.version);
    assert(inspect(key).references.includes(`run:${state.id}`));
    store.put(key, row.value, 1);
    assert.throws(() => inspect(key), /rewritten/);
  });
});
