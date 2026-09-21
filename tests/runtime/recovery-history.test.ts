import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LocalStore } from '@edh/storage';
import { RunHistory, RecoveryHistory, type RunState, type RunEvent } from '@edh/tasks';

async function withHistory(
  work: (store: LocalStore, run: RunState, history: RecoveryHistory) => Promise<void> | void,
) {
  const parent = resolve('.local/work');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(resolve(parent, 'recovery-history-'));
  const store = new LocalStore(directory);
  const state: RunState = {
    id: 'history-documents',
    instruction: 'Read recovery history acceptance documents.',
    scenario: 'history-inspection',
    source: 'test_fixture',
    state: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamDigest: 'history-inspection',
    teamId: 'history-inspection',
    decisionAssignmentId: '',
    attempt: 1,
    recoveryId: null,
    retryChanges: [],
    assignments: {},
    events: [],
    eventCount: 0,
    executions: [],
    requests: [],
    verdicts: [],
    latestSensor: null,
    agentSeen: {},
    skillIds: [],
    error: null,
  };
  try {
    await work(store, state, new RecoveryHistory(store));
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('recovery stores ordered references and reads a stable filtered history boundary', async () => {
  await withHistory((store, run, history) => {
    const publisher = new RunHistory(store);
    const context = {
      attemptSummary: 'Read the selected documents.',
      changes: ['Inspect history'],
    };
    history.create('recovery', run.id, context);
    context.changes.push('Changed local copy');
    const expected = [];
    for (let sequence = 1; sequence <= 140; sequence++) {
      const { event } = publisher.append(run, sequence - 1, 'user.note', { sequence });
      if (sequence % 2 === 0) {
        history.append('recovery', run.id, sequence);
        expected.push({ sequence, type: event.type, detail: event.detail });
      }
    }
    assert.deepEqual(history.read('recovery').events, []);
    assert.deepEqual(history.read('recovery').context.changes, ['Inspect history']);
    const first = history.page('recovery', 0, 65);
    assert.equal(first.events.length, 32);
    assert.equal(first.eventTotal, 65);
    assert.deepEqual(first.events, expected.slice(0, 32));
    publisher.append(run, 140, 'user.note', {});
    history.append('recovery', run.id, 141);
    const second = history.page('recovery', 32, 65);
    assert.deepEqual(second.events, expected.slice(32, 64));
    assert.deepEqual(history.page('recovery', 64, 65).events, expected.slice(64, 65));
    assert.deepEqual(history.page('recovery', 65, 65).events, []);
    assert.equal(history.read('recovery').eventCount, 71);
    const full = history.restore('recovery');
    assert.deepEqual(full.events.slice(0, 70), expected);
    full.events[0]!.detail.sequence = 'local change';
    assert.deepEqual(history.page('recovery', 0, 1).events, expected.slice(0, 1));
    history.update('recovery', null, 'Learning paused for history inspection.');
    assert.equal(history.read('recovery').error, 'Learning paused for history inspection.');
    publisher.append(run, 141, 'user.note', {});
    assert.equal(history.append('recovery', run.id, 142), 72);
  });
});

test('recovery pages preserve byte limits, oversized single events and legacy documents', async () => {
  await withHistory((store, run, history) => {
    const publisher = new RunHistory(store);
    history.create('recovery', run.id, {});
    for (const [index, text] of ['é'.repeat(20_000), 'é'.repeat(40_000), 'last'].entries()) {
      publisher.append(run, index, 'user.note', { text });
      history.append('recovery', run.id, index + 1);
    }
    for (let index = 0; index < 3; index++)
      assert.equal(history.page('recovery', index).events.length, 1);
    const legacy = history.restore('recovery');
    delete legacy.runId;
    delete legacy.eventCount;
    store.put('recovery:legacy', legacy, 0);
    assert.deepEqual(history.page('legacy', 1).events, legacy.events.slice(1, 2));
    assert.deepEqual(history.restore('legacy'), legacy);
    assert.throws(() => history.append('legacy', run.id, 3), /does not accept/);
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      assert.deepEqual(new RecoveryHistory(reopened).restore('legacy'), legacy);
      assert.deepEqual(new RecoveryHistory(reopened).restore('recovery').events, legacy.events);
    } finally {
      reopened.close();
    }
  });
});

test('unpublished, foreign, missing and unordered references fail without advancing the trace', async () => {
  await withHistory((store, run, history) => {
    const publisher = new RunHistory(store);
    history.create('recovery', run.id, {});
    const { event } = publisher.append(run, 0, 'user.note', {});
    store.put(`event:${run.id}:2`, { ...event, sequence: 2 }, 0);
    assert.throws(() => history.append('recovery', run.id, 2), /outside published/);
    assert.throws(() => history.append('recovery', 'foreign', 1), /does not accept/);
    assert.throws(() => history.append('recovery', run.id, 0), /outside published/);
    assert.equal(history.read('recovery').eventCount, 0);
    history.append('recovery', run.id, 1);
    assert.throws(() => history.append('recovery', run.id, 1), /must increase/);
    assert.equal(history.read('recovery').eventCount, 1);
    for (const [after, through] of [
      [-1, 1],
      [0, 2],
      [1, 0],
      [NaN, 1],
    ])
      assert.throws(() => history.page('recovery', after!, through!), /page boundary/);
    store.put('recovery-event:recovery:2', 2, 0);
    assert.equal(history.restore('recovery').events.length, 1);
    const trace = history.read('recovery');
    store.put('recovery:recovery', { ...trace, eventCount: 2 }, 2);
    assert.throws(() => history.page('recovery', 1), /outside published/);
    store.put(`run:${run.id}`, { ...run, eventCount: 3 }, 1);
    store.put('recovery-event:recovery:2', 3, 1);
    assert.throws(() => history.page('recovery', 1), /missing run event/);
    store.put('recovery-event:recovery:2', 1, 2);
    assert.throws(() => history.page('recovery', 1), /invalid event sequence/);
    assert.throws(() => history.read('missing'), /not found/);
    assert.throws(() => history.create('', run.id, {}), /identities/);
  });
});

test('recovery metadata stays bounded while referenced bodies exceed a journal record limit', async () => {
  await withHistory(async (store, run, history) => {
    const publisher = new RunHistory(store);
    history.create('recovery', run.id, {});
    for (let index = 0; index < 160; index++) {
      publisher.append(run, index, 'user.note', { text: 'x'.repeat(64 * 1024) });
      history.append('recovery', run.id, index + 1);
    }
    assert.ok(Buffer.byteLength(JSON.stringify(history.read('recovery'))) < 1024);
    assert.ok((await stat(resolve(store.directory, 'records.jsonl'))).size > 8 * 1024 * 1024);
    let cursor = 0;
    while (cursor < 160) {
      const page = history.page('recovery', cursor);
      assert.equal(page.events.length, 1);
      assert.equal(page.events[0]!.sequence, cursor + 1);
      assert.equal(String(page.events[0]!.detail.text).length, 64 * 1024);
      cursor = page.throughIndex;
    }
    const saved = store.get<RunEvent>(`event:${run.id}:1`)!.value;
    assert.equal(saved.sequence, 1);
  });
});
