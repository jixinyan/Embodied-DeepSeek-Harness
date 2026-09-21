import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createUserMessage, createToolResultMessage, ToolCallId } from '@deepseek-ai/dsh-llm';
import { Session, SessionId, SessionSeq, SessionLogOffset } from '@deepseek-ai/dsh-session';
import TokenMeter from '@deepseek-ai/dsh-token-meter';
import { LocalStore, SessionAudits, SessionHistory, sessionHistoryOptions } from '@edh/storage';
import { createDshHost } from '../../apps/server/src/runtime.js';

async function withStore(action: (store: LocalStore) => Promise<void>) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/edh-session-history-'));
  const store = new LocalStore(directory);
  try {
    await action(store);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}
function appendDocument(session: Session, text: string) {
  return session.append(
    'user/message',
    createUserMessage({
      source: { kind: 'plugin', plugin: 'document-reader', form: 'relay' },
      content: [{ type: 'text', text }],
    }),
    { surfaceOp: 'append' },
  );
}

test('native history releases resident events while preserving sequence, surface and immutable reads', async () => {
  await withStore(async (store) => {
    const session = Session.create(SessionId('document-review'));
    const document = await readFile('README.md', 'utf8');
    for (let index = 0; index < 12; index++) appendDocument(session, `${index}\n${document}`);
    const events = session.snapshotEvents();
    const messages = session.deriveMessages();
    const nodes = [...session.surface.nodes];
    const history = new SessionHistory(store, {
      maxResidentEvents: 2,
      maxResidentBytes: 1024 * 1024,
    });
    const status = history.retain('run', 'agent', session);
    assert.equal(status.residentEvents, 2);
    assert.equal(status.releasedEvents, 10);
    assert.equal(session.seq, events.length);
    assert.deepEqual(session.snapshotEvents(), events);
    assert.deepEqual(session.surface.nodes, nodes);
    assert.deepEqual(session.deriveMessages(), messages);
    const first = session.eventAt(SessionSeq(0))!;
    assert(Object.isFrozen(first));
    assert(Object.isFrozen(first.data));
    assert.throws(() => Object.assign(first.data, { changed: true }), TypeError);
    assert.deepEqual(
      session.snapshotEvents(SessionLogOffset(3), SessionLogOffset(10)),
      events.slice(3, 10),
    );
    const next = appendDocument(session, 'Continue the documentation review.');
    assert.equal(next.seq, events.length);
    assert.equal(events.length, 12);
    history.retain('run', 'agent', session);
    assert.equal(session.residentStartSeq, 11);
    store.compact();
    assert.deepEqual(session.eventAt(SessionSeq(0)), events[0]);
    const sequence = store.statistics().sequence;
    assert.equal(history.retain('run', 'agent', session).releasedEvents, 0);
    assert.equal(store.statistics().sequence, sequence);
    assert.throws(() => history.retain('another-run', 'agent', session), /ownership cannot change/);
    assert.equal(store.statistics().sequence, sequence);
  });
});

test('byte limits release an oversized resident event without losing its document', async () => {
  await withStore(async (store) => {
    const session = Session.create(SessionId('document-bytes'));
    const document = await readFile('README.md', 'utf8');
    const event = appendDocument(session, document);
    const history = new SessionHistory(store, { maxResidentEvents: 100, maxResidentBytes: 1 });
    const status = history.retain('run', 'agent', session);
    assert.equal(status.residentEvents, 0);
    assert.equal(status.residentBytes, 0);
    assert.equal(session.seq, 1);
    assert.deepEqual(session.eventAt(event.seq), event);
    assert.deepEqual(session.deriveMessages(), [event.data]);
    appendDocument(session, 'Continue.');
    assert.equal(session.seq, 2);
    assert.equal(history.retain('run', 'agent', session).residentEvents, 0);
  });
});

test('native tool-result rewrite validates archived originals and preserves source identities', async () => {
  await withStore(async (store) => {
    const session = Session.create(SessionId('document-tool-result'));
    const document = await readFile('README.md', 'utf8');
    const message = createToolResultMessage({
      callId: ToolCallId('read-readme'),
      content: [{ type: 'text', text: document }],
      isError: false,
    });
    const original = session.append(
      'tool/result',
      { turn: 0, step: 0, message },
      { surfaceOp: 'append' },
    );
    const history = new SessionHistory(store, { maxResidentEvents: 1, maxResidentBytes: 1 });
    history.retain('run', 'agent', session);
    const replace = {
      surfaceOp: { op: 'replace' as const, start: original.seq, end: original.seq },
      sourceEventSeqs: [original.seq],
    };
    assert.throws(
      () => session.append('tool/result', { ...original.data, step: 1 }, replace),
      /may change only content/,
    );
    assert.equal(session.seq, 1);
    const replacement = session.append('tool/result', original.data, replace);
    assert.deepEqual(session.surface.nodes, [replacement.seq]);
    assert.deepEqual(session.deriveMessages(), [message]);
    history.retain('run', 'agent', session);
    assert.deepEqual(session.eventAt(original.seq), original);
    const restored = Session.create(SessionId('document-replay'), session.snapshotEvents());
    assert.deepEqual(restored.deriveMessages(), session.deriveMessages());
  });
});

test('write exclusion preserves resident events and publication can continue after release', async () => {
  await withStore(async (store) => {
    const session = Session.create(SessionId('document-write-hold'));
    const original = appendDocument(session, await readFile('README.md', 'utf8'));
    const history = new SessionHistory(store, { maxResidentEvents: 1, maxResidentBytes: 1 });
    const hold = store.holdWrites();
    try {
      assert.throws(() => history.retain('run', 'agent', session), /writes are suspended/);
      assert.equal(session.residentStartSeq, 0);
      assert.equal(session.eventAt(original.seq), original);
    } finally {
      hold.release();
    }
    history.retain('run', 'agent', session);
    assert.equal(session.residentStartSeq, 1);
    assert.deepEqual(session.eventAt(original.seq), original);
  });
});

test('release requires a matching published prefix and a stable archive identity', async () => {
  await withStore(async (store) => {
    const session = Session.create(SessionId('document-archive-owner'));
    appendDocument(session, 'First document.');
    const audits = new SessionAudits(store);
    audits.appendNative('run', 'agent', session);
    const reader = audits.archive('run', 'agent', session.id);
    appendDocument(session, 'Second document.');
    assert.throws(() => session.releaseEvents(session.seq, reader), /does not preserve event/);
    assert.equal(session.residentStartSeq, 0);
    audits.appendNative('run', 'agent', session);
    assert.throws(
      () =>
        session.releaseEvents(session.seq, audits.archive('run', 'agent', SessionId('foreign'))),
      /identity cannot change/,
    );
    session.releaseEvents(SessionLogOffset(1), reader);
    assert.throws(() => session.releaseEvents(SessionLogOffset(0), reader), /Invalid.*boundary/);
    assert.throws(() => session.releaseEvents(SessionLogOffset(3), reader), /Invalid.*boundary/);
    assert.throws(() => session.releaseEvents(Number.NaN as SessionLogOffset, reader), TypeError);
    assert.throws(
      () => session.releaseEvents(session.seq, audits.archive('run', 'agent', session.id)),
      /identity cannot change/,
    );
    session.releaseEvents(session.seq, reader);
    assert.equal(session.snapshotEvents().length, 2);
  });
});

test('rewritten durable events fail on access after their resident copy was released', async () => {
  await withStore(async (store) => {
    const session = Session.create(SessionId('document-integrity'));
    const original = appendDocument(session, 'An immutable source document.');
    new SessionHistory(store, { maxResidentEvents: 1, maxResidentBytes: 1 }).retain(
      'run',
      'agent',
      session,
    );
    const key = 'session-audit-event:run:agent:0';
    store.put(key, { ...original, time: original.time + 1 }, 1);
    assert.throws(() => session.eventAt(SessionSeq(0)), /rewritten/);
    assert.throws(() => session.deriveMessages(), /rewritten/);
    assert.throws(() => session.snapshotEvents(), /rewritten/);
  });
});

test('native token measurement and lazy projections read archived history without changing context', async () => {
  await withStore(async (store) => {
    const host = await createDshHost([]);
    try {
      const session = host.sessions.create(SessionId('document-meter'));
      for (let i = 0; i < 16; i++)
        appendDocument(session, `Review ${i}: ${await readFile('README.md', 'utf8')}`);
      const messages = session.deriveMessages();
      const history = new SessionHistory(store, {
        maxResidentEvents: 1,
        maxResidentBytes: 1024,
      });
      history.retain('run', 'agent', session);
      await host.plugin(TokenMeter);
      const measurement = host.tokenMeter.measure(session);
      assert.equal(measurement.nodes.length, 16);
      assert(measurement.surfaceTokens > 0);
      const projection = host.sessionProjections.snapshot(session);
      const again = host.tokenMeter.measure(session);
      assert.deepEqual(again, measurement);
      assert.deepEqual(session.deriveMessages(), messages);
      assert.deepEqual(host.sessionProjections.snapshot(session), projection);
      const nodes = [...session.surface.nodes];
      const range = { start: nodes[0]!, end: nodes.at(-1)! };
      session.append('compaction/prune', {
        shadowedRange: range,
        shadowedSeqs: nodes,
        shadowedTokenCount: measurement.surfaceTokens,
      });
      session.append(
        'user/message',
        createUserMessage({
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'Continue with the deployment documentation.' }],
        }),
        { surfaceOp: { op: 'replace', ...range }, sourceEventSeqs: nodes },
      );
      history.retain('run', 'agent', session);
      const reduced = host.tokenMeter.measure(session);
      assert(reduced.surfaceTokens < measurement.surfaceTokens);
      assert.equal(reduced.nodes.length, 1);
      const replay = Session.create(SessionId('meter-replay'), session.snapshotEvents());
      assert.equal(host.tokenMeter.measure(replay).surfaceTokens, reduced.surfaceTokens);
      appendDocument(session, 'Review the deployment configuration as well.');
      assert(host.tokenMeter.measure(session).surfaceTokens > reduced.surfaceTokens);
    } finally {
      await host.fiber.dispose();
    }
  });
});

test('request metadata remains current across archive boundaries and later route changes', async () => {
  await withStore(async (store) => {
    const session = Session.create(SessionId('document-request-metadata'));
    const first = {
      config: { provider: 'openai-compatible', model: 'deployment-model' },
      system: 'Review the supplied documentation.',
    };
    const context = { ...first.config, contextWindow: 32768 };
    session.append('request/header', { header: first, reason: 'initial' });
    session.append('request/context', context);
    appendDocument(session, await readFile('README.md', 'utf8'));
    const history = new SessionHistory(store, { maxResidentEvents: 1, maxResidentBytes: 1 });
    history.retain('run', 'agent', session);
    assert.deepEqual(session.requestHeader(), first);
    assert.deepEqual(session.requestContext(), context);
    const next = { ...first, system: 'Review the deployment documentation.' };
    session.append('request/header', { header: next, reason: 'change' });
    history.retain('run', 'agent', session);
    assert.deepEqual(session.requestHeader(), next);
    const restored = Session.create(SessionId('metadata-replay'), session.snapshotEvents());
    assert.deepEqual(restored.requestHeader(), next);
    assert.deepEqual(restored.requestContext(), context);
  });
});

test('release cannot run inside native event publication', async () => {
  await withStore(async (store) => {
    const host = await createDshHost([]);
    try {
      const session = host.sessions.create(SessionId('document-append-boundary'));
      const audits = new SessionAudits(store);
      const reader = audits.archive('run', 'agent', session.id);
      let checked = false;
      host.on('session/event', (current) => {
        if (current !== session) return;
        assert.throws(() => session.releaseEvents(session.seq, reader), /during event publication/);
        checked = true;
      });
      appendDocument(session, 'Document admitted through native publication.');
      assert(checked);
      assert.equal(session.residentStartSeq, 0);
      audits.appendNative('run', 'agent', session);
      session.releaseEvents(session.seq, reader);
      assert.equal(session.residentStartSeq, 1);
    } finally {
      await host.fiber.dispose();
    }
  });
});

test('resident history policy rejects unknown fields and invalid limits', () => {
  for (const value of [
    null,
    { maxResidentEvents: 0, maxResidentBytes: 1024 },
    { maxResidentEvents: 1, maxResidentBytes: -1 },
    { maxResidentEvents: 1.5, maxResidentBytes: 1024 },
    { maxResidentEvents: 1, maxResidentBytes: Number.POSITIVE_INFINITY },
    { maxResidentEvents: 1, maxResidentBytes: 1024, extra: true },
  ])
    assert.throws(() => sessionHistoryOptions(value));
});

test(
  'a live native session archives more than 96 MiB under a 64 MiB old-space limit',
  { timeout: 60000 },
  async () => {
    await withStore(async (store) => {
      store.close();
      const result = await promisify(execFile)(
        process.execPath,
        [
          '--max-old-space-size=64',
          '--import',
          'tsx',
          'tests/runtime/support/session-history-memory.ts',
          store.directory,
        ],
        { cwd: process.cwd(), env: { ...process.env, TMPDIR: resolve('.local/work') } },
      );
      const report = JSON.parse(result.stdout);
      assert(report.journalBytes > 96 * 1024 * 1024);
      assert(report.archivedBefore > 100);
      assert.equal(report.residentEvents, 2);
      assert.equal(report.surfaceNodes, 1);
    });
  },
);
