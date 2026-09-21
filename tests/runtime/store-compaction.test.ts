import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
  access,
} from 'node:fs/promises';
import { watch } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile, spawn } from 'node:child_process';
import { LocalStore } from '@edh/storage';

async function directory(run: (path: string) => Promise<void>) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const path = await mkdtemp(resolve('.local/work/store-compaction-'));
  try {
    await run(path);
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}

function populate(store: LocalStore) {
  for (let version = 0; version < 8; version++)
    store.put(
      'run:document',
      { note: 'é🙂'.repeat(1024), version, evidence: ['sample:1'] },
      version,
    );
  store.put('event:1', { evidence: 'sample:1', text: 'Retained event' }, 0);
  store.put('sample:1', { image: 'sha256:saved-reference', visibility: 'agent' }, 0);
  store.put('skill:1', { evidence: 'sample:1', title: 'Retained experience' }, 0);
}

test('atomic compaction preserves every current value, CAS version, order and sequence across reopen', async () => {
  await directory(async (path) => {
    let store = new LocalStore(path);
    try {
      populate(store);
      const before = store.list('');
      const sequence = store.statistics().sequence;
      const result = store.compact();
      assert.equal(result.compacted, true);
      assert.ok(result.reclaimedBytes > 0);
      assert.equal(result.after.supersededBytes, 0);
      assert.equal(result.after.records, before.length);
      assert.equal(result.after.sequence, sequence);
      assert.deepEqual(store.list(''), before);
      assert.equal((await stat(resolve(path, 'records.jsonl'))).size, result.after.journalBytes);
      assert.throws(() => store.put('run:document', {}, 7), /Version conflict/);
      assert.equal(store.put('run:document', { note: 'updated after checkpoint' }, 8), 9);
      assert.equal(store.put('new:record', { number: 1 }, 0), 1);
      const latest = store.list('');
      store.close();
      store = new LocalStore(path);
      assert.deepEqual(store.list(''), latest);
      assert.equal(store.statistics().sequence, sequence + 2);
      store.compact();
      store.close();
      store = new LocalStore(path);
      assert.deepEqual(store.list(''), latest);
      assert.equal(store.put('run:document', { note: 'next update' }, 9), 10);
      assert.equal(
        (await readdir(path)).some((name) => name.startsWith('records.compact-')),
        false,
      );
    } finally {
      store.close();
    }
  });
});

test('compaction keeps an unchanged journal when no smaller checkpoint is available', async () => {
  await directory(async (path) => {
    let store = new LocalStore(path);
    try {
      assert.equal(store.compact().compacted, false);
      store.put('tiny', 1, 0);
      const bytes = await readFile(resolve(path, 'records.jsonl'));
      assert.equal(store.compact().compacted, false);
      assert.deepEqual(await readFile(resolve(path, 'records.jsonl')), bytes);
    } finally {
      store.close();
    }
    await writeFile(resolve(path, 'records.jsonl'), '\n'.repeat(1024));
    store = new LocalStore(path);
    try {
      assert.equal(store.compact().after.journalBytes, 0);
      assert.deepEqual(store.list(''), []);
    } finally {
      store.close();
    }
    store = new LocalStore(path);
    try {
      assert.equal(store.put('first', { durable: true }, 0), 1);
    } finally {
      store.close();
    }
  });
});

test('checkpoint reopen repairs only a torn append suffix and rejects an incomplete checkpoint', async () => {
  await directory(async (path) => {
    let store = new LocalStore(path);
    populate(store);
    store.compact();
    const expected = store.list('');
    store.close();
    const journal = resolve(path, 'records.jsonl');
    const checkpoint = await readFile(journal);
    await appendFile(journal, '{"sequence":');
    store = new LocalStore(path);
    try {
      assert.deepEqual(store.list(''), expected);
      assert.equal((await stat(journal)).size, checkpoint.byteLength);
    } finally {
      store.close();
    }
    for (const length of [20, checkpoint.indexOf(10) + 15]) {
      const partial = checkpoint.subarray(0, length);
      await writeFile(journal, partial);
      assert.throws(() => new LocalStore(path), /incomplete/);
      assert.deepEqual(await readFile(journal), partial);
      await assert.rejects(access(resolve(path, 'writer.lock')), { code: 'ENOENT' });
    }
  });
});

test('checkpoint header and record corruption stop replay without rewriting authoritative bytes', async () => {
  await directory(async (path) => {
    const store = new LocalStore(path);
    populate(store);
    store.compact();
    store.close();
    const journal = resolve(path, 'records.jsonl');
    const original = await readFile(journal, 'utf8');
    for (const corrupted of [
      original.replace('"records":4', '"records":5'),
      original.replace('Retained event', 'Modified event'),
      original.replace('edh-domain-checkpoint-v1', 'edh-domain-checkpoint-v9'),
    ]) {
      assert.notEqual(corrupted, original);
      await writeFile(journal, corrupted);
      assert.throws(() => new LocalStore(path));
      assert.equal(await readFile(journal, 'utf8'), corrupted);
      await assert.rejects(access(resolve(path, 'writer.lock')), { code: 'ENOENT' });
    }
  });
});

test('corrupted current records and external journal changes prevent compaction publication', async () => {
  for (const mutation of ['body', 'append', 'replace'] as const)
    await directory(async (path) => {
      const store = new LocalStore(path);
      try {
        populate(store);
        const journal = resolve(path, 'records.jsonl');
        const original = await readFile(journal, 'utf8');
        if (mutation === 'body')
          await writeFile(journal, original.replace('Retained event', 'Modified event'));
        if (mutation === 'append') await appendFile(journal, '\n');
        if (mutation === 'replace') {
          await rm(journal);
          await writeFile(journal, original);
        }
        const changed = await readFile(journal);
        assert.throws(() => store.compact(), /corruption|outside its writer/);
        assert.deepEqual(await readFile(journal), changed);
        assert.throws(() => store.get('event:1'), /not readable/);
        assert.equal(
          (await readdir(path)).some((name) => name.startsWith('records.compact-')),
          false,
        );
      } finally {
        store.close();
      }
    });
});

test('an unpublished staging file cannot replace the authoritative journal on reopen', async () => {
  await directory(async (path) => {
    let store = new LocalStore(path);
    populate(store);
    const expected = store.list('');
    store.close();
    await writeFile(resolve(path, 'records.compact-unpublished.jsonl'), '{"incomplete":');
    store = new LocalStore(path);
    try {
      assert.deepEqual(store.list(''), expected);
    } finally {
      store.close();
    }
  });
});

test(
  'compaction and reopen process more journal bytes than the child heap limit',
  { timeout: 60000 },
  async () => {
    await directory(async (path) => {
      const result = await promisify(execFile)(
        process.execPath,
        [
          '--max-old-space-size=64',
          '--import',
          'tsx',
          'tests/runtime/support/store-compaction.ts',
          path,
        ],
        { env: { ...process.env, TMPDIR: resolve('.local/work') } },
      );
      const report = JSON.parse(result.stdout);
      assert.equal(report.records, 96);
      assert.ok(report.before > 64 * 1024 * 1024);
      assert.ok(report.after < report.before);
    });
  },
);

test(
  'process termination during real checkpoint publication retains a complete readable journal',
  { timeout: 60000 },
  async () => {
    await directory(async (path) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'tests/runtime/support/store-compaction.ts', path],
        {
          env: { ...process.env, TMPDIR: resolve('.local/work') },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      let terminated = false;
      const watcher = watch(path, (_event, name) => {
        if (name?.startsWith('records.compact-') && !terminated) {
          terminated = child.kill('SIGKILL');
        }
      });
      try {
        const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
          (done, reject) => {
            child.once('error', reject);
            child.once('close', (code, signal) => done({ code, signal }));
          },
        );
        assert.equal(stderr, '');
        assert.equal(terminated, true);
        assert.equal(exit.signal, 'SIGKILL');
        await rm(resolve(path, 'writer.lock'));
        const reopened = new LocalStore(path);
        try {
          assert.equal(reopened.statistics().records, 96);
          for (let index = 0; index < 96; index++) {
            const record = reopened.get<{ index: number; revision: number; text: string }>(
              `document:${index}`,
            )!;
            assert.equal(record.version, 2);
            assert.equal(record.value.index, index);
            assert.equal(record.value.revision, 2);
            assert.equal(record.value.text.length, 512 * 1024);
          }
        } finally {
          reopened.close();
        }
      } finally {
        watcher.close();
        child.kill('SIGKILL');
      }
    });
  },
);
