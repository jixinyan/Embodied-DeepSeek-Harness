import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { createDshSession } from '../../harness/agent-runtime/agents/src/runtime.js';

const definition = {
  provider: 'unregistered',
  model: 'unused',
  instructions: 'Lifecycle admission test.',
  tools: [],
};

test('serial creation waits for initialization before a queued turn can begin', async (t) => {
  const host = await createDshHost([]);
  t.after(() => host.fiber.dispose());
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const events: string[] = [];
  host.on('agent/created', async ({ agent, source, signal }) => {
    assert.equal(source, 'startup');
    assert.equal(signal?.aborted, false);
    events.push('created-entered');
    agent.followup(
      createUserMessage({
        content: [{ type: 'text', text: 'queued work' }],
        source: { kind: 'user' },
      }),
    );
    entered.resolve();
    await release.promise;
    events.push('created-complete');
  });
  host.on('agent/created', async () => {
    events.push('second-created-listener');
  });
  host.on('agent/pre-step', async () => {
    events.push('pre-step');
    return { kind: 'reject' };
  });

  const creation = createDshSession(host, { ...definition, sessionId: 'serial-created' });
  await entered.promise;
  assert.deepEqual(events, ['created-entered']);
  assert(host.agents.get(SessionId('serial-created')));
  release.resolve();
  const handle = await creation;
  await handle.agent.whenIdle();
  assert.deepEqual(events, [
    'created-entered',
    'created-complete',
    'second-created-listener',
    'pre-step',
  ]);
  assert.equal(
    handle.agent.session.snapshotEvents().findLast((event) => event.type === 'turn/end')?.type,
    'turn/end',
  );
  await handle.dispose();
});

test('owner disposal aborts pending creation and prevents a queued turn', async () => {
  const host = await createDshHost([]);
  const entered = Promise.withResolvers<void>();
  const events: string[] = [];
  host.on('agent/created', async ({ agent, signal }) => {
    assert(signal);
    agent.followup(
      createUserMessage({
        content: [{ type: 'text', text: 'queued during initialization' }],
        source: { kind: 'user' },
      }),
    );
    entered.resolve();
    await new Promise<void>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  });
  host.on('agent/created', async () => {
    events.push('later-listener');
  });
  host.on('agent/pre-step', async () => {
    events.push('pre-step');
    return { kind: 'reject' };
  });
  const registry = host.agents;
  const sessions = host.sessions;
  const creation = createDshSession(host, { ...definition, sessionId: 'disposed-created' });
  await entered.promise;
  const disposal = host.fiber.dispose();
  await assert.rejects(creation);
  await disposal;
  assert.deepEqual(events, []);
  assert.equal(registry.get(SessionId('disposed-created')), undefined);
  assert.equal(sessions.get(SessionId('disposed-created')), undefined);
});

test('creation listener failure preserves its error and clears both registries', async (t) => {
  const host = await createDshHost([]);
  t.after(() => host.fiber.dispose());
  const failure = new Error('creation listener failed');
  host.on('agent/created', async () => {
    await Promise.resolve();
    throw failure;
  });
  await assert.rejects(
    createDshSession(host, { ...definition, sessionId: 'failed-created' }),
    (error) => error === failure,
  );
  assert.equal(host.agents.get(SessionId('failed-created')), undefined);
  assert.equal(host.sessions.get(SessionId('failed-created')), undefined);
});

test('fetch cancellation records only declared turn-end cause fields', async (t) => {
  const received = Promise.withResolvers<void>();
  const server = createServer((_request, response) => {
    received.resolve();
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.flushHeaders();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert(address && typeof address !== 'string');

  const host = await createDshHost([]);
  t.after(() => host.fiber.dispose());
  host.on('agent/pre-step', async ({ signal }) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/pending`, { signal });
    await response.text();
    return { kind: 'reject' };
  });
  const handle = await createDshSession(host, { ...definition, sessionId: 'fetch-cancel' });
  handle.agent.followup(
    createUserMessage({
      content: [{ type: 'text', text: 'start request' }],
      source: { kind: 'user' },
    }),
  );
  await received.promise;
  const reason = { kind: 'hook' as const, reason: 'request stopped' };
  handle.agent.cancel(reason);
  await handle.agent.whenIdle();
  const end = handle.agent.session.snapshotEvents().findLast((event) => event.type === 'turn/end');
  assert(end && end.type === 'turn/end');
  assert.deepEqual(end.data.reason, {
    kind: 'aborted',
    reason: { kind: 'hook', reason: 'request stopped' },
  });
  assert.deepEqual(Object.keys(end.data.reason.reason).sort(), ['kind', 'reason']);
  await handle.dispose();
});
