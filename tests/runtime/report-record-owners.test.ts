import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  AssignmentReports,
  type AcceptedReport,
  type ReportAcknowledgement,
} from '@edh/communication';
import { LocalStore } from '@edh/storage';
import { SensorSamples } from '@edh/perception';
import { AssignmentHistory } from '@edh/tasks';
import { reportRecordOwners } from '../../apps/server/src/report-record-owners.js';
import { assignmentDocuments } from './support/assignment-documents.js';

async function documents(store: LocalStore, archived = false, recipient = 'document-caller') {
  const source = await assignmentDocuments();
  const { assignment, state, validator, input } = source;
  assignment.brief.expected_output.recipient = recipient;
  assignment.brief.caller_assignment_id = recipient;
  assignment.brief.caller_agent_id = recipient === 'user' ? 'user' : 'caller-session';
  if (recipient !== 'user') {
    state.assignments[recipient] = {
      id: recipient,
      member: 'document-planner',
      sessionId: 'caller-session',
      status: 'retired',
      model: 'not-connected',
      tools: [],
      brief: validator.parse('InvocationBrief', {
        ...assignment.brief,
        assignment_id: recipient,
        caller_agent_id: 'user',
        caller_assignment_id: 'user',
        expected_output: { schema: 'builtin:AgentReport.v1', recipient: 'user' },
      }),
    };
  }
  new SensorSamples(store, validator, state.id, state.source).retain({
    source: state.source,
    sequence: 0,
    description: 'Authored report evidence. No model or physical provider executed.',
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
  if (archived) {
    const history = new AssignmentHistory(store, validator);
    history.retain(state, assignment.id);
    if (recipient !== 'user') history.retain(state, recipient);
  }
  store.put(`run:${state.id}`, state, 0);
  const reports = new AssignmentReports(store, validator);
  const first = reports.submit(assignment, {
    ...input(0),
    evidenceRefs: ['document-evidence'],
  }).record;
  const latest = reports.submit(assignment, input(1)).record;
  reports.markDelivery(first.id, { state: recipient === 'user' ? 'recorded' : 'settled' });
  if (recipient !== 'user')
    reports.acknowledge(assignment.id, first.id, recipient, {
      disposition: 'accepted',
      summary: 'The requested document context was received.',
    });
  const owners = reportRecordOwners(store, validator);
  const inspect = (key: string) => {
    const owner = owners.find((candidate) => key.startsWith(candidate.prefix));
    assert(owner);
    const row = store.get(key);
    assert(row);
    return owner.inspect({ key, ...row });
  };
  return { ...source, reports, first, latest, inspect, recipient };
}

async function workspace(work: (store: LocalStore) => Promise<void>) {
  await mkdir('.local/work', { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/report-record-owners-'));
  const store = new LocalStore(directory);
  try {
    await work(store);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('report owners preserve sender, recipient, evidence, history and receipt sources across reopen', async () => {
  await workspace(async (store) => {
    const source = await documents(store, true);
    const { state, assignment, recipient, first, latest, inspect } = source;
    const actorKeys = [assignment.id, recipient].map(
      (id) => `assignment-history:${JSON.stringify([state.id, id])}`,
    );
    const evidenceKey = `sensor-sample:${JSON.stringify([state.id, 'document-evidence'])}`;
    const expected = [
      `run:${state.id}`,
      ...actorKeys,
      evidenceKey,
      `report-delivery:${first.id}`,
      `report-ack:${first.id}`,
    ];
    assert.deepEqual(inspect(`report-record:${first.id}`), { references: expected, retain: false });
    assert.deepEqual(inspect(`report:${assignment.id}`), {
      references: [
        `run:${state.id}`,
        ...actorKeys,
        `report-record:${first.id}`,
        `report-record:${latest.id}`,
      ],
      retain: false,
    });
    for (const prefix of ['report-delivery:', 'report-ack:'])
      assert.deepEqual(inspect(prefix + first.id), {
        references: [`report-record:${first.id}`],
        retain: false,
      });
    store.compact();
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      const owners = reportRecordOwners(reopened, source.validator);
      const name = `report-record:${first.id}`;
      assert.deepEqual(
        owners
          .find((owner) => owner.prefix === 'report-record:')!
          .inspect({
            key: name,
            ...reopened.get(name)!,
          }).references,
        expected,
      );
    } finally {
      reopened.close();
    }
  });
});

test('legacy current reports resolve delivery sources without inventing archive records', async () => {
  await workspace(async (store) => {
    const { assignment, first, latest, reports, inspect } = await documents(store, false, 'user');
    const { previousReportId: _previous, ...legacy } = latest;
    store.retire(
      [
        `report-record:${first.id}`,
        `report-record:${latest.id}`,
        `report-delivery:${first.id}`,
        `report:${assignment.id}`,
      ],
      store.statistics().sequence,
    );
    store.put(`report:${assignment.id}`, first, 0);
    store.put(`report:${assignment.id}`, legacy, 1);
    reports.markDelivery(latest.id, { state: 'recorded' });
    const before = store.statistics().sequence;
    assert.deepEqual(inspect(`report-delivery:${latest.id}`), {
      references: [`report:${assignment.id}`],
      retain: false,
    });
    assert.equal(reports.readRecord(latest.id), undefined);
    assert.deepEqual(reports.history(assignment.id), [legacy]);
    assert.equal(store.statistics().sequence, before);
    assert.equal(
      inspect(`report:${assignment.id}`).references.includes(`report-record:${latest.id}`),
      false,
    );
  });
});

test('missing report dependencies fail inspection without changing retained records', async () => {
  for (const missing of ['run', 'sender', 'recipient', 'evidence', 'predecessor'])
    await workspace(async (store) => {
      const source = await documents(store, true);
      const { state, assignment, recipient, first, latest } = source;
      const keys = {
        run: `run:${state.id}`,
        sender: `assignment-history:${JSON.stringify([state.id, assignment.id])}`,
        recipient: `assignment-history:${JSON.stringify([state.id, recipient])}`,
        evidence: `sensor-sample:${JSON.stringify([state.id, 'document-evidence'])}`,
        predecessor: `report-record:${first.id}`,
      };
      store.retire([keys[missing as keyof typeof keys]], store.statistics().sequence);
      const sequence = store.statistics().sequence;
      assert.throws(
        () => source.inspect(`report-record:${missing === 'predecessor' ? latest.id : first.id}`),
        /missing|Incomplete/,
      );
      assert.equal(store.statistics().sequence, sequence);
    });
});

test('report readers reject rewritten archives and acknowledgements, malformed delivery and conflicting current bodies', async () => {
  for (const condition of ['archive', 'acknowledgement', 'delivery', 'body', 'head-version'])
    await workspace(async (store) => {
      const { reports, first, latest, assignment } = await documents(store);
      if (condition === 'archive') {
        store.put(`report-record:${first.id}`, first, 1);
        assert.throws(() => reports.readRecord(first.id), /immutable version/);
      }
      if (condition === 'acknowledgement') {
        const key = `report-ack:${first.id}`;
        store.put(key, store.get(key)!.value, 1);
        assert.throws(() => reports.acknowledgement(first.id), /immutable version/);
      }
      if (condition === 'delivery') {
        const key = `report-delivery:${first.id}`;
        store.put(key, { state: 'unrecognized' }, store.get(key)!.version);
        assert.throws(() => reports.delivery(first.id));
        const sequence = store.statistics().sequence;
        assert.throws(() =>
          reports.markDelivery(first.id, { state: 'settled', extra: true } as never),
        );
        assert.equal(store.statistics().sequence, sequence);
      }
      if (condition === 'body') {
        const key = `report-record:${latest.id}`;
        store.retire([key], store.statistics().sequence);
        store.put(
          key,
          { ...latest, report: { ...latest.report, summary: 'Conflicting document' } },
          0,
        );
        assert.throws(() => reports.read(assignment.id), /current archive conflicts/);
      }
      if (condition === 'head-version') {
        store.put(`report:${assignment.id}`, latest, 2);
        assert.throws(() => reports.read(assignment.id), /published report identity or version/);
      }
    });
});

test('report ownership rejects foreign recipients, private evidence and mismatched receipt identities', async () => {
  for (const condition of ['recipient', 'evidence', 'receipt'])
    await workspace(async (store) => {
      const source = await documents(store);
      const { first, state } = source;
      if (condition === 'recipient') {
        const key = `report-record:${first.id}`;
        store.retire([key], store.statistics().sequence);
        store.put(key, { ...first, recipient: 'foreign-assignment' }, 0);
      }
      if (condition === 'evidence') {
        const key = `sensor-sample:${JSON.stringify([state.id, 'document-evidence'])}`;
        const sample = new SensorSamples(store, source.validator, state.id, state.source).read(
          'document-evidence',
        )!;
        sample.evidence.visibility = 'debug_only';
        store.retire([key], store.statistics().sequence);
        store.put(key, sample, 0);
      }
      if (condition === 'receipt') {
        const key = `report-ack:${first.id}`;
        const record = store.get<ReportAcknowledgement>(key)!.value;
        store.retire([key], store.statistics().sequence);
        store.put(key, { ...record, recipientAssignmentId: 'foreign-recipient' }, 0);
      }
      assert.throws(() => source.inspect(`report-record:${first.id}`), /conflict|restricted/);
    });
});

test('report predecessor validation rejects a final report followed by another revision', async () => {
  await workspace(async (store) => {
    const { first, latest, reports } = await documents(store);
    const record: AcceptedReport = { ...first, report: { ...first.report, status: 'completed' } };
    delete record.report.requested_context;
    const name = `report-record:${first.id}`;
    store.retire([name], store.statistics().sequence);
    store.put(name, record, 0);
    assert.throws(() => reports.predecessor(latest), /Incomplete published report history/);
  });
});
