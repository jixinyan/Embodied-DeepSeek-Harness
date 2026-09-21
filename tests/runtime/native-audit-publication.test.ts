import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { Session, SessionId } from '@deepseek-ai/dsh-session';
import { LocalStore, SessionAudits } from '@edh/storage';

async function withStore(action: (store: LocalStore, directory: string) => Promise<void>) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/edh-native-audit-'));
  const store = new LocalStore(directory);
  try {
    await action(store, directory);
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

test('native audit publication appends only new records and retains exact source identity after reopen', async () => {
  await withStore(async (store, directory) => {
    const audits = new SessionAudits(store);
    const session = Session.create(SessionId('native-document-review'));
    const document = await readFile('README.md', 'utf8');
    for (let index = 0; index < 140; index++) {
      appendDocument(session, `Review ${index}\n${document}`);
      audits.appendNative('run', 'agent', session);
    }
    const index = store.get('session-audit:run:agent');
    assert.deepEqual(index?.value, {
      format: 'edh.session-audit.v2',
      count: session.seq,
      sessionId: session.id,
    });
    for (let offset = 0; offset < session.seq; offset++)
      assert.equal(store.get(`session-audit-event:run:agent:${offset}`)?.version, 1);
    const before = (await stat(resolve(directory, 'records.jsonl'))).size;
    audits.appendNative('run', 'agent', session);
    assert.equal((await stat(resolve(directory, 'records.jsonl'))).size, before);
    assert.deepEqual(store.get('session-audit:run:agent'), index);
    const events = session.snapshotEvents();
    assert.deepEqual(audits.read('run')[0]!.value, events);
    const first = audits.page('run', 'agent', 0, events.length);
    appendDocument(session, 'Review complete.');
    audits.appendNative('run', 'agent', session);
    assert.deepEqual(audits.page('run', 'agent', 0, events.length), first);
    store.compact();
    store.close();
    const reopened = new LocalStore(directory);
    try {
      const reader = new SessionAudits(reopened);
      assert.deepEqual(reader.read('run')[0]!.value, session.snapshotEvents());
      const sequence = reopened.statistics().sequence;
      reader.appendNative('run', 'agent', session);
      assert.equal(reopened.statistics().sequence, sequence);
    } finally {
      reopened.close();
    }
  });
});

test('native identity binding rejects another session with an identical historical prefix', async () => {
  await withStore(async (store) => {
    const audits = new SessionAudits(store);
    const session = Session.create(SessionId('native-owner'));
    appendDocument(session, 'Explicit documentation context.');
    audits.appendNative('run', 'agent', session);
    const other = Session.create(SessionId('other-owner'), session.snapshotEvents());
    const sequence = store.statistics().sequence;
    assert.throws(() => audits.appendNative('run', 'agent', other), /different native session/);
    assert.throws(
      () => audits.append('run', 'agent', session.snapshotEvents()),
      /different native session/,
    );
    assert.equal(store.statistics().sequence, sequence);
    assert.deepEqual(audits.read('run')[0]!.value, session.snapshotEvents());
  });
});

test('native publication adopts validated v1 and inline audits without rewriting immutable events', async () => {
  await withStore(async (store) => {
    const audits = new SessionAudits(store);
    const session = Session.create(SessionId('native-migration'));
    appendDocument(session, 'Migration document.');
    const events = session.snapshotEvents();
    audits.append('run', 'indexed', events);
    store.put('session-audit:run:inline', events, 0);
    for (const assignment of ['indexed', 'inline']) {
      audits.appendNative('run', assignment, session);
      assert.deepEqual(store.get(`session-audit:run:${assignment}`)?.value, {
        format: 'edh.session-audit.v2',
        count: events.length,
        sessionId: session.id,
      });
      for (let offset = 0; offset < events.length; offset++)
        assert.equal(store.get(`session-audit-event:run:${assignment}:${offset}`)?.version, 1);
      assert.deepEqual(
        audits.read('run').find((entry) => entry.key.endsWith(assignment))?.value,
        events,
      );
    }
  });
});

test('adoption checks the entire published prefix before changing an unbound audit', async () => {
  await withStore(async (store) => {
    const audits = new SessionAudits(store);
    const session = Session.create(SessionId('native-source'));
    appendDocument(session, 'First document.');
    appendDocument(session, 'Last document.');
    const events = session.snapshotEvents();
    const changed = [...structuredClone(events)];
    changed[0] = { ...changed[0]!, time: changed[0]!.time + 1 };
    const other = Session.create(SessionId('native-changed'), changed);
    audits.append('run', 'indexed', events);
    store.put('session-audit:run:inline', events, 0);
    const sequence = store.statistics().sequence;
    for (const assignment of ['indexed', 'inline']) {
      assert.throws(() => audits.appendNative('run', assignment, other), /prefix changed/);
      assert.equal(store.statistics().sequence, sequence);
      assert.deepEqual(
        audits.read('run').find((entry) => entry.key.endsWith(assignment))?.value,
        events,
      );
    }
    assert.throws(() => audits.append('run', 'inline', changed), /prefix changed/);
    assert.equal(store.statistics().sequence, sequence);
  });
});

test('native publication reconciles a persisted suffix and rejects conflicting unpublished records', async () => {
  await withStore(async (store) => {
    const audits = new SessionAudits(store);
    const session = Session.create(SessionId('native-reconcile'));
    audits.appendNative('run', 'agent', session);
    const published = session.seq;
    const event = appendDocument(session, 'Document awaiting index publication.');
    store.put(`session-audit-event:run:agent:${published}`, event, 0);
    assert.equal(audits.index('run').sessions[0]!.eventTotal, published);
    audits.appendNative('run', 'agent', session);
    assert.equal(audits.index('run').sessions[0]!.eventTotal, session.seq);
    assert.equal(store.get(`session-audit-event:run:agent:${published}`)?.version, 1);
    const boundary = session.seq;
    const next = appendDocument(session, 'Next admitted document.');
    store.put(`session-audit-event:run:agent:${boundary}`, { ...next, time: next.time + 1 }, 0);
    assert.throws(() => audits.appendNative('run', 'agent', session), /append conflict/);
    assert.equal(audits.index('run').sessions[0]!.eventTotal, boundary);
    assert.deepEqual(audits.read('run')[0]!.value, session.snapshotEvents().slice(0, boundary));
  });
});

test('native append failure preserves the published boundary and keeps the written suffix unpublished', async () => {
  await withStore(async (store) => {
    const audits = new SessionAudits(store);
    const session = Session.create(SessionId('native-record-limit'));
    audits.appendNative('run', 'agent', session);
    const published = session.seq;
    appendDocument(session, 'Accepted document before the oversized record.');
    const document = await readFile('README.md', 'utf8');
    appendDocument(session, document.repeat(Math.ceil((9 * 1024 * 1024) / document.length)));
    assert.throws(() => audits.appendNative('run', 'agent', session), /oversized record/);
    assert.equal(audits.index('run').sessions[0]!.eventTotal, published);
    assert(store.get(`session-audit-event:run:agent:${published}`));
    assert.equal(store.get(`session-audit-event:run:agent:${published + 1}`), undefined);
    assert.deepEqual(audits.read('run')[0]!.value, session.snapshotEvents().slice(0, published));
    assert.throws(() => audits.appendNative('run', 'agent', session), /oversized record/);
    assert.equal(store.get(`session-audit-event:run:agent:${published}`)?.version, 1);
  });
});

test('malformed v2 ownership and missing legacy prefix events fail before native publication', async () => {
  await withStore(async (store) => {
    const audits = new SessionAudits(store);
    const session = Session.create(SessionId('native-validation'));
    appendDocument(session, 'Validation document.');
    store.put(
      'session-audit:run:missing',
      { format: 'edh.session-audit.v1', count: session.seq },
      0,
    );
    const sequence = store.statistics().sequence;
    assert.throws(() => audits.appendNative('run', 'missing', session), /Incomplete session audit/);
    assert.equal(store.statistics().sequence, sequence);
    store.put(
      'session-audit:run:regressed',
      { format: 'edh.session-audit.v2', count: session.seq + 1, sessionId: session.id },
      0,
    );
    assert.throws(() => audits.appendNative('run', 'regressed', session), /history regressed/);
    for (const [index, value] of [
      { format: 'edh.session-audit.v2', count: 0 },
      { format: 'edh.session-audit.v2', count: 0, sessionId: '' },
      { format: 'edh.session-audit.v2', count: 0, sessionId: session.id, other: true },
    ].entries()) {
      const assignment = `invalid-${index}`;
      store.put(`session-audit:run:${assignment}`, value, 0);
      assert.throws(() => audits.appendNative('run', assignment, session));
      assert.throws(() => audits.page('run', assignment));
    }
  });
});
