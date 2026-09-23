import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AssignmentReports } from '@edh/communication';
import { SensorSamples } from '@edh/perception';
import { LocalStore } from '@edh/storage';
import { AssignmentHistory, RecoveryHistory, RunHistory, VerdictHistory } from '@edh/tasks';
import { RunEventReferences } from '../../apps/server/src/event-record-owners.js';
import { runRecordOwners } from '../../apps/server/src/run-record-owners.js';
import { UserClarifications } from '../../apps/server/src/clarifications.js';
import { verdictDocuments } from './support/verdict-documents.js';

const keyFor = (prefix: string, ...ids: string[]) => prefix + JSON.stringify(ids);

async function workspace(work: (store: LocalStore) => Promise<void>) {
  await mkdir('.local/work', { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/event-record-owners-'));
  const store = new LocalStore(directory);
  try {
    await work(store);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

async function documents(store: LocalStore) {
  const source = await verdictDocuments();
  const { state, assignment, validator, result } = source;
  assignment.brief.caller_agent_id = 'user';
  assignment.brief.caller_assignment_id = 'user';
  assignment.brief.expected_output.recipient = 'user';
  assignment.brief.evidence_refs = ['document-evidence'];
  const sample = new SensorSamples(store, validator, state.id, state.source).retain({
    source: state.source,
    sequence: 0,
    description: 'Authored journal document; no model or physical provider executed.',
    visualization: {},
    evidence: {
      id: 'document-evidence',
      kind: 'event',
      source: 'authored-document',
      visibility: 'agent',
      task_scope: assignment.brief.task_scope,
      clock_id: 'document-clock',
      created_at: state.createdAt,
      observed_at: state.createdAt,
    },
  });
  state.verdicts = [new VerdictHistory(store, validator).retain(state.id, result)];
  const actor = structuredClone(state.assignments[assignment.id]!);
  new AssignmentHistory(store, validator).retain(state, assignment.id);
  store.put(`run:${state.id}`, state, 0);
  const references = new RunEventReferences(store, validator);
  const emit = (type: string, detail: Record<string, unknown>) => {
    const { event } = new RunHistory(store).append(
      state,
      store.revision(`run:${state.id}`)!.version,
      type,
      detail,
    );
    return { key: `event:${state.id}:${event.sequence}`, event };
  };
  const inspect = (key: string) => references.owner().inspect({ key, ...store.get(key)! });
  const message = (payload: Record<string, unknown>) =>
    emit('message.delivered', {
      messageId: 'document-message',
      sender: 'user',
      recipient: assignment.id,
      payload,
      images: [],
    });
  return { ...source, sample, actor, references, emit, inspect, message };
}

test('event ownership preserves observation, delegation and verdict sources across journal reopen', async () => {
  await workspace(async (store) => {
    const { state, assignment, validator, result, sample, actor, emit, inspect, message } =
      await documents(store);
    const records = [
      emit('agent.created', { assignment: actor }),
      emit('observation.consumed', { assignmentId: assignment.id, evidence: sample.evidence }),
      emit('verification.checked', {
        assignmentId: assignment.id,
        evidence: sample.evidence,
        facts: result.checks,
      }),
      emit('verification.completed', { result }),
      message({ kind: 'initial', brief: assignment.brief }),
      message({ kind: 'team.send', message: 'Inspect the document.', evidence: [sample] }),
    ];
    const outputs = records.map(({ key }) => inspect(key));
    for (const output of outputs) {
      assert.equal(output.retain, false);
      for (const name of [
        `run:${state.id}`,
        keyFor('assignment-history:', state.id, assignment.id),
        keyFor('sensor-sample:', state.id, sample.evidence.id),
      ])
        assert(output.references.includes(name), name);
    }
    assert(
      outputs[3]!.references.includes(keyFor('verdict-history:', state.id, result.verdict_id)),
    );
    store.compact();
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      const owner = new RunEventReferences(reopened, validator).owner();
      assert.deepEqual(
        records.map(({ key }) => owner.inspect({ key, ...reopened.get(key)! })),
        outputs,
      );
    } finally {
      reopened.close();
    }
  });
});

test('event ownership rejects changed evidence, verifier, actor and immutable event identities', async () => {
  for (const condition of ['evidence', 'verifier', 'actor', 'version', 'key', 'missing'])
    await workspace(async (store) => {
      const { state, assignment, result, sample, emit, inspect } = await documents(store);
      if (condition === 'evidence') sample.evidence.clock_id = 'different-clock';
      if (condition === 'verifier') result.verifier_id = 'different-verifier';
      const record =
        condition === 'verifier'
          ? emit('verification.completed', { result })
          : emit('observation.consumed', {
              assignmentId: condition === 'actor' ? 'unknown-actor' : assignment.id,
              evidence: sample.evidence,
            });
      if (condition === 'version') store.put(record.key, record.event, 1);
      if (condition === 'key') {
        record.key = `event:${state.id}:01`;
        store.put(record.key, record.event, 0);
      }
      if (condition === 'missing')
        store.retire(
          [keyFor('sensor-sample:', state.id, sample.evidence.id)],
          store.statistics().sequence,
        );
      const sequence = store.statistics().sequence;
      assert.throws(() => inspect(record.key), /conflict|missing/);
      assert.equal(store.statistics().sequence, sequence);
    });
});

test('report events preserve historical versions and current-only legacy delivery sources', async () => {
  await workspace(async (store) => {
    const { assignment, validator, input, emit, inspect, message } = await documents(store);
    const reports = new AssignmentReports(store, validator);
    const accepted = reports.submit(assignment, input(0)).record;
    const record = emit('agent.report', {
      assignmentId: assignment.id,
      reportId: accepted.id,
      version: accepted.version,
      recipient: accepted.recipient,
      report: accepted.report,
    });
    const delivery = emit('agent.report-delivery', { reportId: accepted.id, state: 'settled' });
    const delivered = message({
      kind: 'agent-report',
      reportId: accepted.id,
      version: accepted.version,
      report: accepted.report,
      evidence: [],
    });
    for (const { key } of [record, delivery, delivered])
      assert(inspect(key).references.includes(`report-record:${accepted.id}`));
    store.retire([`report-record:${accepted.id}`], store.statistics().sequence);
    assert(inspect(delivery.key).references.includes(`report:${assignment.id}`));
    store.put(`report-record:${accepted.id}`, accepted, 0);
    reports.submit(assignment, input(1));
    assert(inspect(record.key).references.includes(`report-record:${accepted.id}`));
  });
});

test('recovery messages preserve exact source pages and the preceding page boundary', async () => {
  await workspace(async (store) => {
    const { state, assignment, emit, inspect, message } = await documents(store);
    const history = new RecoveryHistory(store);
    const recoveryId = 'document-recovery';
    const context = { reason: 'Review the failed document check.' };
    history.create(recoveryId, state.id, context);
    for (let index = 0; index < 3; index++) {
      const { event } = emit('agent.status', { assignmentId: assignment.id, status: 'retired' });
      history.append(recoveryId, state.id, event.sequence);
    }
    const page = history.page(recoveryId, 1, 3);
    const progress = message({ kind: 'recovery-progress', ...page });
    for (const key of [
      `recovery:${recoveryId}`,
      ...[1, 2, 3].map((index) => `recovery-event:${recoveryId}:${index}`),
    ])
      assert(inspect(progress.key).references.includes(key));
    const start = {
      kind: 'recovery-start',
      context,
      brief: {
        ...assignment.brief,
        task_scope: { ...assignment.brief.task_scope, recovery_id: recoveryId },
      },
    };
    assert(inspect(message(start).key).references.includes(`recovery:${recoveryId}`));
    assert.throws(
      () => inspect(message({ ...start, context: { reason: 'Changed context.' } }).key),
      /conflict/,
    );
    assert.throws(
      () => inspect(message({ kind: 'recovery-progress', ...page, events: [] }).key),
      /conflict/,
    );
    store.retire([`recovery-event:${recoveryId}:1`], store.statistics().sequence);
    assert.throws(() => inspect(progress.key), /missing/);
  });
});

test('historical clarification messages retain stable questions after lifecycle advancement', async () => {
  await workspace(async (store) => {
    const { state, assignment, emit, inspect } = await documents(store);
    const questions = new UserClarifications(store, state.id, () => {});
    const question = questions.request({
      assignmentId: assignment.id,
      callId: 'document-question',
      goalId: assignment.brief.task_scope.goal_id,
      attemptId: assignment.brief.task_scope.attempt_id,
      question: 'Which deployment document should be inspected?',
      reason: 'The supplied document requires an explicit selection.',
      options: [],
    });
    const { key } = emit('user.clarification', { clarification: question });
    questions.cancel('Document inspection ended.');
    assert(inspect(key).references.includes(`clarification:${state.id}:${question.id}`));
    question.question = 'A different question.';
    assert.throws(
      () => inspect(emit('user.clarification', { clarification: question }).key),
      /conflict/,
    );
  });
});

test('custom references require versioned inspection and compose with legacy inline run history', async () => {
  await workspace(async (store) => {
    const { state, validator, references, emit, inspect, message } = await documents(store);
    const custom = emit('document.linked', { source: 'document:source' });
    assert.throws(() => inspect(custom.key), /explicit reference ownership/);
    assert.throws(
      () => inspect(message({ kind: 'document.message', source: 'document:source' }).key),
      /explicit reference ownership/,
    );
    const extension = {
      version: 'document-links-v1',
      prefix: 'document:',
      inspect() {
        return [this.prefix + 'source'];
      },
    };
    const customReferences = new RunEventReferences(store, validator, extension);
    assert.notEqual(customReferences.version, references.version);
    assert(customReferences.inspect(custom.event, state.id).includes('document:source'));
    const restored = new RunHistory(store).restore(state);
    delete restored.eventCount;
    restored.verdicts = [];
    restored.assignments = {};
    restored.decisionAssignmentId = '';
    restored.events = [custom.event];
    store.put(`run:${state.id}`, restored, store.revision(`run:${state.id}`)!.version);
    const owner = runRecordOwners(store, validator, {
      inlineEventReferences: customReferences,
    })[0]!;
    assert(
      owner
        .inspect({ key: `run:${state.id}`, ...store.get(`run:${state.id}`)! })
        .references.includes('document:source'),
    );
    const invalid = new RunEventReferences(store, validator, {
      version: 'invalid-reference',
      inspect: () => [''],
    });
    assert.throws(() => invalid.inspect(custom.event, state.id));
  });
});

test('unpublished assignment events remain inspectable and conflicting inline archives fail', async () => {
  await workspace(async (store) => {
    const { state, actor, references, emit, inspect } = await documents(store);
    const { key, event } = emit('agent.created', { assignment: actor });
    state.eventCount = 0;
    state.assignments = {};
    store.put(`run:${state.id}`, state, store.revision(`run:${state.id}`)!.version);
    assert(inspect(key).references.includes(`run:${state.id}`));
    assert.throws(() => references.inspect(event, state.id), /assignment source/);
    delete state.eventCount;
    state.events = [{ ...event, detail: { assignment: { ...actor, member: 'other-member' } } }];
    store.put(`run:${state.id}`, state, store.revision(`run:${state.id}`)!.version);
    assert.throws(() => inspect(key), /published inline history/);
  });
});
