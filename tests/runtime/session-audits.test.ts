import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalStore, SessionAudits } from '@edh/storage';

test('native audit history exceeds one-record limits without rewriting its durable prefix', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'edh-audit-'));
  let store = new LocalStore(directory);
  try {
    const events = Array.from({ length: 9 }, (_, index) => ({
      index,
      text: 'x'.repeat(1024 * 1024),
    }));
    const audits = new SessionAudits(store);
    audits.append('run', 'agent', events.slice(0, 3));
    audits.append('run', 'agent', events.slice(0, 6));
    audits.append('run', 'agent', events);
    const size = (await stat(resolve(directory, 'records.jsonl'))).size;
    assert(size < 10 * 1024 * 1024, 'Each event should be persisted once, not once per snapshot.');
    audits.append('run', 'agent', events);
    assert.equal((await stat(resolve(directory, 'records.jsonl'))).size, size);
    assert.deepEqual(audits.read('run')[0]!.value, events);
    assert.throws(() => audits.append('run', 'agent', events.slice(0, 3)), /regressed/);
    assert.throws(
      () => audits.append('run', 'agent', [...events.slice(0, -1), { index: 8 }]),
      /prefix changed/,
    );
    store.close();
    store = new LocalStore(directory);
    assert.deepEqual(new SessionAudits(store).read('run')[0]!.value, events);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('audit indexes preserve legacy history and reconcile an interrupted append suffix', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'edh-audit-legacy-'));
  const store = new LocalStore(directory);
  try {
    const audits = new SessionAudits(store);
    store.put('session-audit:run:legacy', [{ event: 'old' }], 0);
    assert.deepEqual(audits.read('run')[0]!.value, [{ event: 'old' }]);
    audits.append('run', 'legacy', [{ event: 'old' }, { event: 'new' }]);
    // Simulate event persistence followed by a crash before publishing the index.
    store.put('session-audit-event:run:legacy:2', { event: 'pending' }, 0);
    assert.equal((audits.read('run')[0]!.value as unknown[]).length, 2);
    assert.throws(
      () =>
        audits.append('run', 'legacy', [{ event: 'old' }, { event: 'new' }, { event: 'conflict' }]),
      /append conflict/,
    );
    audits.append('run', 'legacy', [{ event: 'old' }, { event: 'new' }, { event: 'pending' }]);
    assert.equal((audits.read('run')[0]!.value as unknown[]).length, 3);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
