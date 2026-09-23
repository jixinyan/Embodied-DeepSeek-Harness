import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { AssignmentReports } from '@edh/communication';
import { SensorSamples } from '@edh/perception';
import { LocalStore } from '@edh/storage';
import { AssignmentHistory, RunHistory, VerdictHistory } from '@edh/tasks';
import { VerificationBoundaries, VerificationContexts } from '@edh/verification';
import { runRecordOwners } from '../../apps/server/src/run-record-owners.js';
import { admitSessionTask } from '../../apps/server/src/task-admission.js';
import { SessionTaskHistory } from '../../apps/server/src/session-task-history.js';
import { UserClarifications } from '../../apps/server/src/clarifications.js';
import type { UserSessionRecord } from '../../apps/server/src/user-sessions.js';
import { verdictDocuments } from './support/verdict-documents.js';

const keyFor = (prefix: string, ...ids: string[]) => prefix + JSON.stringify(ids);

async function workspace(work: (store: LocalStore) => Promise<void>) {
  await mkdir('.local/work', { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/run-record-owners-'));
  const store = new LocalStore(directory);
  try {
    await work(store);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

async function documents(store: LocalStore, archived = true, eventCount = 3) {
  const { state, assignment, validator, result, input } = await verdictDocuments();
  const planner = state.assignments[assignment.id]!;
  planner.member = 'lead';
  const brief = planner.brief!;
  brief.caller_agent_id = 'user';
  brief.caller_assignment_id = 'user';
  brief.expected_output.recipient = 'user';
  brief.evidence_refs = ['document-evidence'];
  state.finalGoalId = brief.task_scope.goal_id!;
  const verifierId = `${assignment.id}-verifier`;
  const verifier = {
    ...structuredClone(planner),
    id: verifierId,
    member: 'verifier',
    sessionId: `${assignment.id}-session`,
    verificationContextStored: true,
    brief: validator.parse('InvocationBrief', {
      ...brief,
      assignment_id: verifierId,
      caller_assignment_id: planner.id,
      caller_agent_id: planner.sessionId,
      expected_output: { schema: 'builtin:AgentReport.v1', recipient: planner.id },
    }),
  };
  state.assignments[verifierId] = verifier;
  result.verifier_id = verifier.sessionId;
  result.verifier_assignment_id = verifierId;
  const samples = new SensorSamples(store, validator, state.id, state.source);
  const sample = samples.retain({
    source: state.source,
    sequence: 0,
    description: 'Authored run source. No model or physical provider executed.',
    visualization: {},
    evidence: {
      id: 'document-evidence',
      kind: 'event',
      source: 'authored-document',
      visibility: 'agent',
      task_scope: brief.task_scope,
      clock_id: 'document-clock',
      created_at: state.createdAt,
      observed_at: state.createdAt,
    },
  });
  state.latestSensor = sample;
  state.agentSeen[planner.id] = sample;
  const report = new AssignmentReports(store, validator).submit(assignment, {
    ...input(0),
    evidenceRefs: ['document-evidence'],
  }).record;
  planner.report = report.report;
  planner.reportVersion = report.version;
  const execution = validator.parse('ExecutionStatus', {
    schema_version: 'physical.execution.v1',
    execution_id: result.execution_id,
    task_scope: result.task_scope,
    state: 'paused',
    state_version: 1,
    control_steps: 0,
    policy_calls: 0,
    elapsed_wall_time_s: 0,
    device_confirmed: true,
    observation_refs: ['document-evidence'],
    clock_id: 'document-clock',
    recorded_at: state.createdAt,
    boundary_event_id: result.boundary_event_id,
    boundary_at: state.createdAt,
    stop_reason: 'user_stop',
  });
  new VerificationBoundaries(store, validator, state.id).admit(undefined, execution);
  state.executions = [execution];
  state.requests = [
    validator.parse('SubgoalRequest', {
      schema_version: 'physical.subgoal.v1',
      task_id: state.id,
      goal_id: brief.task_scope.goal_id,
      attempt_id: brief.task_scope.attempt_id,
      instruction: state.instruction,
      entities: {},
      required_capabilities: [],
      success_contract: brief.success_contract,
      budget: { max_control_steps: 10, max_wall_time_s: 30 },
      context_refs: ['document-evidence'],
      team_run_id: brief.team_run_id,
      owner_assignment_id: planner.id,
      decision_owner_id: planner.sessionId,
      idempotency_key: 'document-request',
    }),
  ];
  const contexts = new VerificationContexts(store, validator, samples, state.id);
  contexts.open(verifierId, {
    requestId: result.verification_request_id,
    executionId: result.execution_id,
    boundaryId: result.boundary_event_id,
    scope: result.task_scope,
    evidenceId: 'document-evidence',
  });
  contexts.update(verifierId, result.checks, 'document-evidence');
  contexts.close();
  state.verdicts = [new VerdictHistory(store, validator).retain(state.id, result)];
  if (archived) {
    const history = new AssignmentHistory(store, validator);
    history.retain(state, planner.id);
    history.retain(state, verifierId);
  }
  store.put(`run:${state.id}`, state, 0);
  const history = new RunHistory(store);
  for (let sequence = 1; sequence <= eventCount; sequence++)
    history.append(state, sequence, 'documentation.review', { sequence });
  const configuration = {
    mode: state.source,
    digest: state.teamDigest,
    model: 'document-model-not-connected',
    team: validator.parse('TeamDefinition', {
      schema_version: 'physical.team.v1',
      team_id: state.teamId,
      entrypoint: 'lead',
      members: {
        lead: 'builtin:planner',
        verifier: 'builtin:verifier',
        evolver: 'builtin:evolver',
      },
      bindings: { decision_owner: 'lead', final_verifier: 'verifier', recovery_evolver: 'evolver' },
      tool_bindings: {},
    }),
  };
  store.put(`run-config:${state.id}`, configuration, 0);
  const owners = runRecordOwners(store, validator);
  const inspect = (key = `run:${state.id}`) => {
    const owner = owners.find((item) => key.startsWith(item.prefix));
    assert(owner);
    const row = store.get(key);
    assert(row);
    return owner.inspect({ key, ...row });
  };
  return { state, planner, verifierId, validator, result, configuration, inspect, owners };
}

async function sessionDocuments(store: LocalStore) {
  const prior = await documents(store);
  const current = await documents(store);
  const session: UserSessionRecord = {
    id: 'document-session',
    profileId: 'document-profile',
    requestId: 'document-open',
    deploymentDigest: 'document-deployment',
    configuration: current.configuration,
    createdAt: current.state.createdAt,
    updatedAt: current.state.updatedAt,
    state: 'closed',
    resources: 'released',
    runIds: [prior.state.id, current.state.id],
  };
  store.put(`user-session:${session.id}`, session, 0);
  for (const runId of session.runIds!)
    store.put(`run-user-session:${runId}`, { sessionId: session.id }, 0);
  const submission = admitSessionTask(
    {
      scenario: 'review',
      requestId: 'document-task',
      contextRunIds: [prior.state.id],
    },
    {
      session,
      allowedTasks: ['review'],
      tasks: {
        review: {
          instruction: current.state.instruction,
          goal: {
            id: current.state.finalGoalId!,
            configuration: 'document-configuration',
            successContract: current.planner.brief!.success_contract,
            entities: {},
            capabilities: [],
            taskSemantics: ['documentation-review'],
            budget: { max_control_steps: 10, max_wall_time_s: 30 },
          },
        },
      },
      store,
      validator: current.validator,
    },
  );
  current.state.taskContext = submission.context;
  store.put(
    `run:${current.state.id}`,
    current.state,
    store.revision(`run:${current.state.id}`)!.version,
  );
  return { prior, current, session };
}

test('run owners retain complete published events and typed assignment, evidence and verification dependencies across reopen', async () => {
  await workspace(async (store) => {
    const { state, planner, verifierId, validator, result, inspect } = await documents(
      store,
      true,
      130,
    );
    const output = inspect();
    assert.equal(output.retain, false);
    const refs = new Set(output.references);
    for (const name of [
      `run-config:${state.id}`,
      `report:${planner.id}`,
      keyFor('assignment-history:', state.id, planner.id),
      keyFor('assignment-history:', state.id, verifierId),
      keyFor('sensor-sample:', state.id, 'document-evidence'),
      keyFor('verification-context:', state.id, verifierId),
      keyFor('verification-boundary:', state.id, result.execution_id, result.boundary_event_id),
      keyFor('verdict-history:', state.id, result.verdict_id),
      ...Array.from({ length: 130 }, (_, index) => `event:${state.id}:${index + 1}`),
    ]) {
      assert(refs.has(name), name);
      assert(store.revision(name));
    }
    store.compact();
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      assert.deepEqual(
        runRecordOwners(reopened, validator)[0]!.inspect({
          key: `run:${state.id}`,
          ...reopened.get(`run:${state.id}`)!,
        }),
        output,
      );
    } finally {
      reopened.close();
    }
  });
});

test('run owners reject missing and rewritten published events and exclude unpublished suffixes', async () => {
  for (const condition of ['missing', 'rewritten', 'suffix'])
    await workspace(async (store) => {
      const { state, inspect } = await documents(store);
      const key = `event:${state.id}:2`;
      const event = store.get(key)!;
      if (condition === 'missing') store.retire([key], store.statistics().sequence);
      if (condition === 'rewritten') store.put(key, event.value, 1);
      if (condition === 'suffix') {
        const suffix = `event:${state.id}:4`;
        store.put(
          suffix,
          { sequence: 4, type: 'documentation.review', at: state.updatedAt, detail: {} },
          0,
        );
        assert(!inspect().references.includes(suffix));
      } else assert.throws(() => inspect(), /Incomplete|rewritten/);
    });
});

test('inline assignments, observations and request owners are checked against their retained sources', async () => {
  for (const condition of [
    'valid',
    'sample',
    'report',
    'context',
    'request',
    'verifier',
    'execution',
  ])
    await workspace(async (store) => {
      const { state, planner, verifierId, inspect } = await documents(store, false);
      if (condition === 'valid') {
        assert(!inspect().references.some((key) => key.startsWith('assignment-history:')));
        return;
      }
      if (condition === 'sample') state.agentSeen[planner.id]!.description = 'Changed source';
      if (condition === 'report') state.assignments[planner.id]!.report!.summary = 'Changed source';
      if (condition === 'context')
        store.retire(
          [keyFor('verification-context:', state.id, verifierId)],
          store.statistics().sequence,
        );
      if (condition === 'request') state.requests[0]!.decision_owner_id = 'other-owner';
      if (condition === 'verifier') state.verdicts[0]!.verifier_id = 'other-verifier';
      if (condition === 'execution') state.requests = [];
      store.put(`run:${state.id}`, state, store.revision(`run:${state.id}`)!.version);
      const before = store.statistics().sequence;
      assert.throws(() => inspect(), /conflict|missing|admitted request/);
      assert.equal(store.statistics().sequence, before);
    });
});

test('configuration owners validate immutable mode, Team and complete session configuration', async () => {
  for (const condition of ['mode', 'digest', 'version', 'session', 'member'])
    await workspace(async (store) => {
      const { current, session } = await sessionDocuments(store);
      const { state, configuration, inspect } = current;
      const key = `run-config:${state.id}`;
      if (condition === 'member') {
        state.assignments[state.decisionAssignmentId]!.member = 'unconfigured-member';
        store.put(`run:${state.id}`, state, store.revision(`run:${state.id}`)!.version);
      } else if (condition === 'session') {
        session.configuration = { ...session.configuration, model: 'other-model' };
        store.put(
          `user-session:${session.id}`,
          session,
          store.revision(`user-session:${session.id}`)!.version,
        );
      } else if (condition === 'version') store.put(key, configuration, 1);
      else {
        const changed =
          condition === 'mode'
            ? { ...configuration, mode: 'hardware' }
            : { ...configuration, digest: 'other-team' };
        store.retire([key], store.statistics().sequence);
        store.put(key, changed, 0);
      }
      assert.throws(() => inspect(key), /conflict|absent from/);
    });
});

test('selected historical task context retains same-session sources and accepts subsequent cleanup revisions', async () => {
  await workspace(async (store) => {
    const { prior, current, session } = await sessionDocuments(store);
    const refs = current.inspect().references;
    for (const name of [
      `run:${prior.state.id}`,
      `user-session:${session.id}`,
      `run-user-session:${prior.state.id}`,
      keyFor('verdict-history:', prior.state.id, prior.result.verdict_id),
    ])
      assert(refs.includes(name));
    store.put(
      `run:${prior.state.id}`,
      prior.state,
      store.revision(`run:${prior.state.id}`)!.version,
    );
    assert(current.inspect().references.includes(`run:${prior.state.id}`));
    new SessionTaskHistory(store).migrate(
      session,
      store.revision(`user-session:${session.id}`)!.version,
    );
    assert(
      current
        .inspect()
        .references.includes(keyFor('session-task-member:', session.id, prior.state.id)),
    );
    const record = store.get<{ sessionId: string }>(`run-user-session:${prior.state.id}`)!.value;
    store.retire([`run-user-session:${prior.state.id}`], store.statistics().sequence);
    store.put(`run-user-session:${prior.state.id}`, { ...record, sessionId: 'other-session' }, 0);
    assert.throws(() => current.inspect(), /ownership.*conflict/);
  });
});

test('run interruption owners retain restart sources and reject changed annotations', async () => {
  await workspace(async (store) => {
    const { state, inspect } = await documents(store);
    state.state = 'running';
    store.put(`run:${state.id}`, state, store.revision(`run:${state.id}`)!.version);
    assert.equal(inspect().retain, true);
    new RunHistory(store).interrupt(state, store.revision(`run:${state.id}`)!.version);
    const key = `run-interruption:${state.id}`;
    assert(inspect().references.includes(key));
    assert.deepEqual(inspect(key), { references: [`run:${state.id}`], retain: false });
    store.put(key, store.get(key)!.value, 1);
    assert.throws(() => inspect(key), /immutable version/);
  });
});

test('inline event reference ownership is explicit, versioned and preserves authored source references', async () => {
  await workspace(async (store) => {
    const { state, validator, inspect } = await documents(store);
    const restored = new RunHistory(store).restore(state);
    delete restored.eventCount;
    restored.events[0]!.detail = { sourceRecord: `run-config:${state.id}` };
    store.put(`run:${state.id}`, restored, store.revision(`run:${state.id}`)!.version);
    assert.throws(() => inspect(), /explicit payload reference ownership/);
    const owner = runRecordOwners(store, validator, {
      inlineEventReferences: {
        version: 'document-review-v1',
        inspect(event) {
          assert.equal(event.type, 'documentation.review');
          const detail = z
            .object({ sourceRecord: z.string().optional(), sequence: z.number().optional() })
            .strict()
            .parse(event.detail);
          return detail.sourceRecord ? [detail.sourceRecord] : [];
        },
      },
    })[0]!;
    const sequence = store.statistics().sequence;
    const result = owner.inspect({ key: `run:${state.id}`, ...store.get(`run:${state.id}`)! });
    assert(result.references.includes(`run-config:${state.id}`));
    assert(!result.references.some((key) => key.startsWith('event:')));
    assert(owner.version.includes('document-review-v1'));
    assert.equal(store.statistics().sequence, sequence);
  });
});

test('run clarification snapshots retain exact durable question and response state', async () => {
  await workspace(async (store) => {
    const { state, planner, inspect } = await documents(store);
    const questions = new UserClarifications(store, state.id, (record) => {
      state.clarification = record;
    });
    questions.request({
      assignmentId: planner.id,
      callId: 'document-question',
      goalId: state.finalGoalId,
      attemptId: 'attempt-1',
      question: 'Which document should be inspected?',
      reason: 'The input is ambiguous.',
      options: [],
    });
    questions.cancel('Documentation inspection ended.');
    store.put(`run:${state.id}`, state, store.revision(`run:${state.id}`)!.version);
    const key = `clarification:${state.id}:${state.clarification!.id}`;
    assert(inspect().references.includes(key));
    store.retire([key], store.statistics().sequence);
    assert.throws(() => inspect(), /clarification conflicts/);
  });
});
