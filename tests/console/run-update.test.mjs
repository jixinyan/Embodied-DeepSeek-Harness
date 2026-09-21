import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { on, once } from 'node:events';
import {
  createRunUpdate,
  mergeRunUpdate,
  runEventCursor,
  maxEventBatch,
  maxEventBatchBytes,
  receivedRunSequence,
  retainRunEvents,
  maxRetainedEvents,
  maxRetainedEventBytes,
  appendRunHistory,
} from '../../apps/console/public/run-update.js';
import { RunEventStream } from '../../apps/server/src/run-event-stream.ts';

function notes(count) {
  return Array.from({ length: count }, (_, index) => ({
    sequence: index + 1,
    at: '2026-09-20T00:00:00.000Z',
    type: 'user.note',
    detail: { text: `Inspection note ${index + 1}` },
  }));
}

test('retained event windows advance absolute cursors across eviction and projection updates', () => {
  const state = {
    id: 'window-check',
    events: notes(2000),
    status: 'ready',
    recoveryStatus: { id: 'history-recovery', resolved: false, error: 'Recorded learning error.' },
  };
  let current = { ...state, events: [], status: 'loading' };
  while (receivedRunSequence(current) < state.events.length) {
    current = retainRunEvents(
      mergeRunUpdate(current, createRunUpdate(state, receivedRunSequence(current))),
    );
    assert.ok(current.events.length <= maxRetainedEvents);
    assert.equal(current.events.at(-1).sequence, receivedRunSequence(current));
  }
  assert.equal(current.eventOffset, 1500);
  assert.deepEqual(current.events, state.events.slice(1500));
  const unchanged = retainRunEvents(mergeRunUpdate(current, createRunUpdate(state, 2000)));
  assert.equal(unchanged.events, current.events);
  assert.equal(unchanged.eventOffset, 1500);
  assert.equal(unchanged.status, 'ready');
  assert.deepEqual(unchanged.recoveryStatus, state.recoveryStatus);
  const more = { ...state, events: notes(2001) };
  const next = retainRunEvents(mergeRunUpdate(current, createRunUpdate(more, 2000)));
  assert.equal(next.eventOffset, 1501);
  assert.equal(receivedRunSequence(next), 2001);
  assert.throws(() => mergeRunUpdate(next, createRunUpdate(more, 2000)), /discontinuous/);
});

test('byte retention preserves one oversized event and supports detached history windows', () => {
  const events = notes(4);
  events[0].detail.text = 'x'.repeat(maxRetainedEventBytes + 1);
  events[1].detail.text = 'é'.repeat(maxRetainedEventBytes / 3);
  events[2].detail.text = 'é'.repeat(maxRetainedEventBytes / 3);
  const initial = { id: 'window-check', events: events.slice(0, 1), eventCount: 1 };
  assert.equal(retainRunEvents(initial).events.length, 1);
  const current = retainRunEvents({ ...initial, events, eventCount: 4 });
  assert.equal(current.eventOffset, 2);
  assert.equal(receivedRunSequence(current), 4);
  assert.deepEqual(current.events, events.slice(2));
  const page = {
    runId: current.id,
    afterSequence: 1,
    throughSequence: 2,
    eventTotal: 2,
    events: [events[1]],
  };
  const view = appendRunHistory(
    { id: current.id, events: [], eventOffset: 1, eventCount: 2 },
    page,
  );
  assert.equal(receivedRunSequence(view), 2);
  assert.equal(view.eventOffset, 1);
  assert.equal(receivedRunSequence(current), 4);
  for (const bad of [
    { ...current, eventOffset: -1 },
    { ...current, eventOffset: 0 },
    { ...current, eventCount: 3 },
    { ...current, eventCount: NaN },
  ])
    assert.throws(() => retainRunEvents(bad), /Invalid retained/);
});

test('incremental updates retain complete ordered history and publish state at the final batch', () => {
  const state = { id: 'transport-check', events: notes(300), status: 'ready' };
  let current = { ...state, events: [], status: 'loading' };
  const batches = [];
  while (current.events.length < state.events.length) {
    const update = createRunUpdate(state, current.events.length);
    batches.push(update.events.length);
    const previous = current;
    current = mergeRunUpdate(current, update);
    if (update.projection === null) assert.equal(current.status, 'loading');
    assert.equal(previous.events.length, update.afterSequence);
  }
  assert.deepEqual(batches, [128, 128, 44]);
  assert.deepEqual(current.events, state.events);
  assert.equal(current.status, 'ready');
  assert.equal(current.eventCount, 300);
});

test('projection-only updates reuse history and transmit no historical event bodies', () => {
  const state = { id: 'transport-check', events: notes(4000), output: 'First word' };
  const update = createRunUpdate({ ...state, output: 'First word completed' }, 4000);
  const current = mergeRunUpdate(state, update);
  assert.equal(current.events, state.events);
  assert.equal(current.output, 'First word completed');
  assert.deepEqual(update.events, []);
  assert.ok(!JSON.stringify(update).includes('Inspection note'));
  assert.ok(Buffer.byteLength(JSON.stringify(update)) < 400);
});

test('event batches respect encoded byte limits and retain oversized individual events', () => {
  const events = notes(3);
  events[0].detail.text = 'é'.repeat(maxEventBatchBytes / 4);
  events[1].detail.text = 'é'.repeat(maxEventBatchBytes / 4);
  const state = { id: 'transport-check', events };
  const first = createRunUpdate(state, 0);
  assert.equal(first.events.length, 1);
  assert.ok(Buffer.byteLength(JSON.stringify(first.events[0])) <= maxEventBatchBytes);
  const second = createRunUpdate(state, 1);
  assert.equal(second.events.length, 2);
  events[0].detail.text = 'a'.repeat(maxEventBatchBytes + 1);
  assert.deepEqual(createRunUpdate(state, 0).events, [events[0]]);
  const partial = mergeRunUpdate({ ...state, events: [] }, createRunUpdate(state, 0));
  assert.throws(() =>
    mergeRunUpdate(partial, createRunUpdate({ ...state, events: events.slice(0, 2) }, 1)),
  );
});

test('cursor admission and event merging reject missing, duplicate and malformed history', () => {
  const state = { id: 'transport-check', events: notes(2) };
  assert.equal(runEventCursor('0', 2), 0);
  assert.equal(runEventCursor('2', 2), 2);
  for (const cursor of ['', '-1', '01', '1.5', '2x', '3', '9007199254740992'])
    assert.throws(() => runEventCursor(cursor, 2));
  for (const cursor of [-1, 3, NaN, Infinity, '1', null])
    assert.throws(() => createRunUpdate(state, cursor));
  const initial = { ...state, events: [] };
  const update = createRunUpdate(state, 0);
  for (const malformed of [
    { ...update, protocol: 'unknown' },
    { ...update, runId: 'another-run' },
    { ...update, afterSequence: 1 },
    { ...update, throughSequence: 1 },
    { ...update, eventTotal: 1 },
    { ...update, eventTotal: 3 },
    { ...update, events: [state.events[1], state.events[0]] },
    { ...update, projection: null },
    { ...update, projection: { id: 'another-run', eventCount: 2 } },
    { ...update, projection: { id: state.id, eventCount: 2, events: [] } },
    { ...update, projection: { id: state.id, eventCount: 1 } },
  ])
    assert.throws(() => mergeRunUpdate(initial, malformed));
  const merged = mergeRunUpdate(initial, update);
  assert.throws(() => mergeRunUpdate(merged, update));
  assert.throws(() => createRunUpdate({ ...state, events: [state.events[1]] }, 0));
});

test('restart annotation is included in the visible cursor and survives a later projection', () => {
  const events = notes(2);
  const state = {
    id: 'transport-check',
    eventCount: 2,
    events: [...events, { sequence: 3, type: 'run.interrupted', detail: {} }],
    status: 'interrupted',
  };
  const current = mergeRunUpdate({ ...state, events }, createRunUpdate(state, 2));
  assert.equal(current.events.length, 3);
  assert.equal(current.eventCount, 3);
  assert.equal(createRunUpdate(state, 3).events.length, 0);
});

test('partial event windows preserve absolute cursors and reject missing pages', () => {
  const state = { id: 'transport-check', events: notes(300) };
  const window = {
    ...state,
    eventOffset: 128,
    eventCount: 300,
    events: state.events.slice(128, 256),
  };
  const update = createRunUpdate(window, 128);
  assert.equal(update.afterSequence, 128);
  assert.equal(update.throughSequence, 256);
  assert.equal(update.eventTotal, 300);
  assert.equal(update.projection, null);
  for (const invalid of [
    { ...window, eventOffset: 129 },
    { ...window, eventCount: 200 },
    { ...window, eventCount: undefined },
    { ...window, events: [] },
  ])
    assert.throws(() => createRunUpdate(invalid, 128));
});

test('snapshot clients receive the complete projection over real HTTP', async (t) => {
  const state = { id: 'transport-check', events: notes(3), status: 'ready' };
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const stream = new RunEventStream(
      state.id,
      res,
      () => state,
      'snapshot',
      0,
      () => {},
    );
    stream.start();
    stream.close();
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((failure) => (failure ? reject(failure) : resolve())),
    );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/events`);
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  assert.equal(await response.text(), `id: 3\nevent: snapshot\ndata: ${JSON.stringify(state)}\n\n`);
});

test(
  'native EventSource resumes real HTTP batches after disconnect and handles writable backpressure',
  { timeout: 15000 },
  async (t) => {
    const state = { id: 'transport-check', events: notes(900), status: 'ready', output: '' };
    for (const event of state.events) event.detail.text += 'a'.repeat(4096);
    const initialCursor = createRunUpdate(state, 0).throughSequence;
    let connections = 0;
    let lastEventId;
    let backpressureObserved = false;
    const readCursors = [];
    let current = { ...state, events: [], status: 'loading' };
    let active;
    const streams = new Set();
    const server = createServer((req, res) => {
      connections++;
      lastEventId = req.headers['last-event-id'];
      const cursor = runEventCursor(lastEventId ?? '0', state.events.length);
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('retry: 10\n\n');
      const stream = new RunEventStream(
        state.id,
        res,
        (afterSequence) => {
          readCursors.push(afterSequence);
          return {
            ...state,
            eventCount: state.events.length,
            eventOffset: afterSequence,
            events: state.events.slice(afterSequence, afterSequence + maxEventBatch),
          };
        },
        'delta',
        cursor,
        () => streams.delete(stream),
      );
      streams.add(stream);
      active = stream;
      stream.start();
      backpressureObserved ||= res.writableNeedDrain;
      if (connections === 1) stream.close();
    });
    t.after(async () => {
      for (const stream of streams) stream.close();
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((failure) => (failure ? reject(failure) : resolve())),
      );
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const source = new EventSource(`http://127.0.0.1:${server.address().port}/events`);
    t.after(() => source.close());
    let received = 0;
    for await (const [event] of on(source, 'run-update', { signal: t.signal })) {
      const update = JSON.parse(event.data);
      current = retainRunEvents(mergeRunUpdate(current, update));
      received++;
      assert.equal(event.lastEventId, String(receivedRunSequence(current)));
      assert.ok(current.events.length <= maxRetainedEvents);
      assert.ok(update.events.length <= maxEventBatch);
      if (current.output === 'Updated without a new event') break;
      if (update.projection && !current.output) {
        state.output = 'Updated without a new event';
        active.notify();
        active.notify();
      }
    }
    source.close();
    assert.equal(connections, 2);
    assert.equal(lastEventId, String(initialCursor));
    assert.equal(readCursors[0], 0);
    assert.ok(readCursors.includes(initialCursor));
    assert.equal(readCursors.at(-1), 900);
    assert.ok(received > 2);
    assert.equal(backpressureObserved, true);
    assert.ok(current.eventOffset > 0);
    assert.deepEqual(current.events, state.events.slice(current.eventOffset));
    assert.equal(current.status, 'ready');
  },
);
