import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LocalStore, type StoreChange } from '@edh/storage';

async function directory(action: (path: string) => Promise<void>) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const path = await mkdtemp(resolve('.local/work/store-observers-'));
  try {
    await action(path);
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}

test('observers see committed records and detached revisions through compaction', async () => {
  await directory(async (path) => {
    const store = new LocalStore(path);
    const changes: StoreChange[] = [];
    try {
      const stop = store.observe((change) => {
        store.assertCurrent();
        changes.push(change);
        if (change.type === 'put') {
          assert.equal(store.get(change.key)!.version, store.revision(change.key)!.version);
          assert.throws(() => store.put('recursive', {}, 0), /cannot mutate/);
          assert.throws(() => store.compact(), /cannot mutate/);
          assert.throws(() => store.close(), /cannot close/);
        }
      });
      store.put('document:first', { text: 'earlier document '.repeat(1000) }, 0);
      store.put('document:second', { text: 'retained' }, 0);
      store.put('document:first', { text: 'current' }, 1);
      const firstRevision = store.revision('document:first')!;
      assert.equal(firstRevision.version, 2);
      Object.assign(firstRevision, { version: 900 });
      assert.equal(store.revision('document:first')!.version, 2);
      assert.equal(store.revision('absent'), undefined);
      assert.deepEqual(
        [...store.revisions('document:')].map((row) => row.key),
        ['document:first', 'document:second'],
      );
      const before = store.revision('document:first')!.hash;
      assert(store.compact().compacted);
      assert.notEqual(store.revision('document:first')!.hash, before);
      assert.deepEqual(
        changes.map((change) => change.type),
        ['put', 'put', 'put', 'compact'],
      );
      stop();
      store.put('document:third', {}, 0);
      assert.equal(changes.length, 4);
    } finally {
      store.close();
    }
  });
});

test('observer failure preserves the durable source and stops the current store', async () => {
  await directory(async (path) => {
    const store = new LocalStore(path);
    store.observe(() => {
      store.put('recursive', {}, 0);
    });
    try {
      assert.throws(() => store.put('document', { text: 'committed' }, 0), /cannot mutate/);
      assert.throws(() => store.get('document'), /not readable/);
      assert.throws(() => store.revision('document'), /not readable/);
      assert.throws(() => [...store.revisions('')], /not readable/);
      assert.throws(() => store.put('next', {}, 0), /not writable/);
    } finally {
      store.close();
    }
    const reopened = new LocalStore(path);
    try {
      assert.deepEqual(reopened.get('document'), { version: 1, value: { text: 'committed' } });
      assert.equal(reopened.get('recursive'), undefined);
    } finally {
      reopened.close();
    }
  });
});

test('cached readers detect same-size edits and replaced journals before serving metadata', async () => {
  await directory(async (path) => {
    for (const mode of ['edit', 'replace']) {
      const store = new LocalStore(resolve(path, mode));
      try {
        store.put('document', { text: 'original' }, 0);
        const journal = resolve(store.directory, 'records.jsonl');
        const original = await readFile(journal, 'utf8');
        if (mode === 'edit') await writeFile(journal, original.replace('original', 'modified'));
        else {
          const replacement = resolve(store.directory, 'replacement.jsonl');
          await writeFile(replacement, original);
          await rename(replacement, journal);
        }
        assert.throws(() => store.assertCurrent(), /outside its writer/);
        assert.throws(() => store.revision('document'), /not readable/);
        assert.throws(() => store.put('next', {}, 0), /not writable/);
      } finally {
        store.close();
      }
    }
  });
});
