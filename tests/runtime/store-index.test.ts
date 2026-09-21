import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
  access,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { LocalStore } from '@edh/storage';

async function directory(run: (path: string) => Promise<void>) {
  const parent = resolve('.local/work');
  await mkdir(parent, { recursive: true });
  const path = await mkdtemp(resolve(parent, 'store-index-'));
  try {
    await run(path);
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}

test('indexed journal preserves versions, detached reads, order and single-writer admission', async () => {
  await directory(async (path) => {
    const store = new LocalStore(path);
    try {
      assert.throws(() => new LocalStore(path), /locked/);
      assert.equal(store.put('a', { text: 'α🙂' }, 0), 1);
      store.put('b', { text: 'second' }, 0);
      assert.equal(store.put('a', { text: 'updated' }, 1), 2);
      assert.throws(() => store.put('a', {}, 1), /Version conflict/);
      store.get<{ text: string }>('a')!.value.text = 'local change';
      assert.equal(store.get<{ text: string }>('a')!.value.text, 'updated');
      assert.deepEqual(
        store.list('').map((entry) => entry.key),
        ['a', 'b'],
      );
      assert.equal(store.get('missing'), undefined);
    } finally {
      store.close();
    }
    assert.throws(() => store.get('a'), /not readable/);
    assert.throws(() => store.put('c', {}, 0), /not writable/);
    const reopened = new LocalStore(path);
    try {
      assert.deepEqual(reopened.get('a'), { version: 2, value: { text: 'updated' } });
      assert.equal(reopened.put('c', { text: 'third' }, 0), 1);
      assert.deepEqual(
        reopened.list('').map((entry) => entry.key),
        ['a', 'b', 'c'],
      );
    } finally {
      reopened.close();
    }
  });
});

test('byte positions preserve UTF-8, CRLF and empty lines across reopen and append', async () => {
  await directory(async (path) => {
    let store = new LocalStore(path);
    store.put('unicode', { text: 'é🙂'.repeat(20_000) }, 0);
    store.put('last', { text: 'last document' }, 0);
    store.close();
    const journal = resolve(path, 'records.jsonl');
    const content = await readFile(journal, 'utf8');
    await writeFile(journal, '\n' + content.replaceAll('\n', '\r\n') + '\n');
    store = new LocalStore(path);
    try {
      assert.equal(store.get<{ text: string }>('unicode')!.value.text, 'é🙂'.repeat(20_000));
      assert.equal(store.get<{ text: string }>('last')!.value.text, 'last document');
      store.put('after', { text: 'appended document' }, 0);
      assert.equal(store.get<{ text: string }>('after')!.value.text, 'appended document');
    } finally {
      store.close();
    }
  });
});

test('incomplete journal tails are excluded before positional reads and new writes', async () => {
  await directory(async (path) => {
    let store = new LocalStore(path);
    store.put('accepted', { text: 'durable' }, 0);
    store.close();
    const journal = resolve(path, 'records.jsonl');
    const size = (await stat(journal)).size;
    await appendFile(journal, Buffer.from([123, 34, 120, 34, 58, 34, 240, 159]));
    store = new LocalStore(path);
    try {
      assert.equal((await stat(journal)).size, size);
      assert.equal(store.get<{ text: string }>('accepted')!.value.text, 'durable');
      store.put('next', { text: 'next' }, 0);
      assert.equal(store.get<{ text: string }>('next')!.value.text, 'next');
    } finally {
      store.close();
    }
  });
});

test('lazy scans verify each requested record and stop after detected corruption', async () => {
  await directory(async (path) => {
    const store = new LocalStore(path);
    try {
      store.put('document:first', { text: 'first' }, 0);
      store.put('document:second', { text: 'original' }, 0);
      const journal = resolve(path, 'records.jsonl');
      const text = await readFile(journal, 'utf8');
      await writeFile(journal, text.replace('original', 'modified'));
      const records = store.scan('document:');
      assert.equal(records.next().value!.key, 'document:first');
      assert.throws(() => records.next(), /corruption/);
      assert.throws(() => store.get('document:first'), /not readable/);
      assert.throws(() => store.put('document:third', {}, 0), /not writable/);
    } finally {
      store.close();
    }
    assert.throws(() => new LocalStore(path), /corruption/);
    await assert.rejects(access(resolve(path, 'writer.lock')), { code: 'ENOENT' });
  });
});

test('unexpected external appends prevent further indexed writes', async () => {
  await directory(async (path) => {
    const store = new LocalStore(path);
    try {
      store.put('first', {}, 0);
      await appendFile(resolve(path, 'records.jsonl'), '\n');
      assert.throws(() => store.put('second', {}, 0), /outside its writer/);
      assert.throws(() => store.put('third', {}, 0), /not writable/);
    } finally {
      store.close();
    }
  });
});

test(
  'write, reopen and scan a journal larger than the child process heap limit',
  { timeout: 60000 },
  async () => {
    await directory(async (path) => {
      const result = await promisify(execFile)(
        process.execPath,
        [
          '--max-old-space-size=64',
          '--import',
          'tsx',
          'tests/runtime/support/store-memory.ts',
          path,
        ],
        { cwd: process.cwd(), env: { ...process.env, TMPDIR: resolve('.local/work') } },
      );
      const report = JSON.parse(result.stdout) as { count: number; journalBytes: number };
      assert.equal(report.count, 128);
      assert.ok(report.journalBytes > 64 * 1024 * 1024);
    });
  },
);
