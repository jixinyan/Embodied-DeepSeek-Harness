import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LocalStore } from '@edh/storage';
import { RunHistory, type RunEvent, type RunState } from '@edh/tasks';
import {
  appendRunHistory,
  createRunUpdate,
  mergeRunUpdate,
} from '../../apps/console/public/run-update.js';

function note(sequence: number, text = 'History reader acceptance document'): RunEvent {
  return { sequence, at: '2026-09-20T00:00:00.000Z', type: 'user.note', detail: { text } };
}

function record(): RunState {
  const at = '2026-09-20T00:00:00.000Z';
  return {
    id: 'history-reader',
    instruction: 'Read the history acceptance documents.',
    scenario: 'history-inspection',
    source: 'test_fixture',
    state: 'cancelled',
    createdAt: at,
    updatedAt: at,
    teamDigest: 'history-reader',
    teamId: 'history-reader',
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
}

async function withStore(run: (store: LocalStore) => void | Promise<void>) {
  const parent = resolve('.local/work');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(resolve(parent, 'history-pages-'));
  const store = new LocalStore(directory);
  try {
    await run(store);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('journal pages retain a fixed published frontier while later events are appended', async () => {
  await withStore((store) => {
    const state = record();
    const history = new RunHistory(store);
    for (let sequence = 1; sequence <= 300; sequence++)
      store.put(`event:${state.id}:${sequence}`, note(sequence), 0);
    state.eventCount = 300;
    store.put(`run:${state.id}`, state, 0);
    let current = { ...state };
    const first = history.page(state, 0, 300);
    assert.equal(first.events.length, 128);
    current = appendRunHistory(current, first);
    store.put(`event:${state.id}:301`, note(301), 0);
    state.eventCount = 301;
    store.put(`run:${state.id}`, state, 1);
    while (current.events.length < 300)
      current = appendRunHistory(current, history.page(state, current.events.length, 300));
    assert.equal(current.eventCount, 300);
    assert.deepEqual(
      current.events,
      Array.from({ length: 300 }, (_, i) => note(i + 1)),
    );
    const page = history.page(state, 300);
    const update = createRunUpdate({ ...state, events: page.events, eventOffset: 300 }, 300);
    current = mergeRunUpdate(current, update);
    assert.equal(current.events.at(-1)?.sequence, 301);
    assert.equal(current.eventCount, 301);
    assert.ok(!Object.hasOwn(current, 'eventOffset'));
  });
});

test('bounded reads do not materialize records beyond the requested range', async () => {
  await withStore((store) => {
    const state = { ...record(), eventCount: 129 };
    for (let sequence = 1; sequence <= 128; sequence++)
      store.put(`event:${state.id}:${sequence}`, note(sequence), 0);
    const history = new RunHistory(store);
    assert.equal(history.page(state, 0).events.length, 128);
    assert.equal(history.page(state, 128, 128).events.length, 0);
    assert.throws(() => history.page(state, 128), /Incomplete published/);
    assert.throws(() => history.restore(state), /Incomplete published/);
  });
});

test('history pages preserve UTF-8 bodies and oversized individual records', async () => {
  await withStore((store) => {
    const state = { ...record(), eventCount: 3 };
    const events = [note(1, 'é'.repeat(70_000)), note(2, 'é'.repeat(70_000)), note(3)];
    for (const event of events) store.put(`event:${state.id}:${event.sequence}`, event, 0);
    const history = new RunHistory(store);
    assert.deepEqual(history.page(state, 0).events, [events[0]]);
    assert.deepEqual(history.page(state, 1).events, events.slice(1));
    assert.deepEqual(history.page(state, 0, 3, 128, 10).events, [events[0]]);
    const detached = history.page(state, 0);
    detached.events[0]!.detail.text = 'Edited returned document';
    assert.deepEqual(history.page(state, 0).events, [events[0]]);
  });
});

test('restart annotation replaces no ordinary event and has one stable visible cursor', async () => {
  await withStore((store) => {
    const state = { ...record(), state: 'running' as const, eventCount: 1 };
    store.put(`event:${state.id}:1`, note(1), 0);
    store.put(`event:${state.id}:2`, note(2, 'Unpublished journal suffix'), 0);
    store.put(`run:${state.id}`, state, 0);
    const history = new RunHistory(store);
    assert.equal(history.total(state), 1);
    assert.deepEqual(history.page(state, 0).events, [note(1)]);
    history.interrupt(state, 1);
    const interrupted = store.get<RunState>(`run:${state.id}`)!.value;
    assert.equal(history.total(interrupted), 2);
    const page = history.page(interrupted, 1);
    assert.equal(page.events[0]!.type, 'run.interrupted');
    assert.equal(page.events[0]!.sequence, 2);
    assert.equal(
      store.get<RunEvent>(`event:${state.id}:2`)!.value.detail.text,
      'Unpublished journal suffix',
    );
    assert.deepEqual(history.page(interrupted, 2).events, []);
    assert.deepEqual(history.restore(interrupted).events, [
      ...history.page(interrupted, 0, 1).events,
      ...page.events,
    ]);
  });
});

test('legacy inline records and reopened journals support the same page boundaries', async () => {
  await withStore((store) => {
    const state = record();
    delete state.eventCount;
    state.events = [note(1), note(2), note(3)];
    store.put(`run:${state.id}`, state, 0);
    const page = new RunHistory(store).page(state, 1, 2);
    assert.deepEqual(page.events, [note(2)]);
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      const loaded = reopened.get<RunState>(`run:${state.id}`)!.value;
      assert.deepEqual(new RunHistory(reopened).page(loaded, 1, 2), page);
    } finally {
      reopened.close();
    }
  });
});

test('history boundaries and restart metadata fail at the invalid record', async () => {
  await withStore((store) => {
    const state = { ...record(), eventCount: 3 };
    const history = new RunHistory(store);
    for (const [after, through] of [
      [-1, 0],
      [2, 1],
      [0, 4],
      [NaN, 1],
      [0, Infinity],
    ])
      assert.throws(() => history.page(state, after!, through!), /Invalid run history/);
    assert.throws(() => history.total({ ...state, eventCount: -1 }), /Invalid run event count/);
    assert.throws(() => history.page(state, 0, 3, 0), /Invalid run history/);
    assert.throws(() => history.page(state, 0, 3, 1, 0), /Invalid run history/);
    store.put(`run-interruption:${state.id}`, { ...note(5), type: 'run.interrupted' }, 0);
    assert.throws(() => history.total({ ...state, state: 'interrupted' }), /Restart annotation/);
    const current = { ...state, events: [] };
    assert.throws(
      () =>
        appendRunHistory(current, {
          runId: state.id,
          afterSequence: 0,
          throughSequence: 0,
          eventTotal: 2,
          events: [],
        }),
      /selected boundary/,
    );
  });
});
