import assert from 'node:assert/strict';
import test from 'node:test';
import { appendFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { execFile, spawn } from 'node:child_process';
import { LocalStore, type StoreChange } from '@edh/storage';

async function directory(action: (path: string) => Promise<void>) {
  await mkdir('.local/work', { recursive: true });
  const path = await mkdtemp(resolve('.local/work/store-retirement-'));
  try {
    await action(path);
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}

function populate(store: LocalStore) {
  store.put('document:retired', { text: 'Expired document'.repeat(1024) }, 0);
  store.put('document:retained', { text: 'First document' }, 0);
  store.put('document:retained', { text: 'Current document' }, 1);
  store.put('document:last', { text: 'Last document' }, 0);
}

test('batch retirement preserves retained values, versions and order across appends, compaction and reopen', async () => {
  await directory(async (path) => {
    let store = new LocalStore(path);
    try {
      populate(store);
      store.compact();
      const expected = store.list('').filter((entry) => entry.key !== 'document:retired');
      const before = store.statistics();
      const changes: StoreChange[] = [];
      const unsubscribe = store.observe((change) => {
        changes.push(change);
        if (change.type === 'retire') {
          assert.equal(store.get('document:retired'), undefined);
          assert.deepEqual(store.list(''), expected);
          assert.equal(store.statistics().sequence, before.sequence + 1);
        }
      });
      const result = store.retire(['document:retired'], before.sequence);
      unsubscribe();
      assert.deepEqual(changes, [{ type: 'retire' }]);
      assert.equal(result.removedRecords, 1);
      assert.deepEqual(result.before, before);
      assert(result.byteDifference > 0);
      assert.equal(result.after.sequence, before.sequence + 1);
      assert.equal(result.after.supersededBytes, 0);
      assert.equal(result.after.journalBytes, (await stat(resolve(path, 'records.jsonl'))).size);
      assert.equal(store.revision('document:retired'), undefined);
      assert.deepEqual(
        [...store.revisions('')].map((entry) => entry.key),
        expected.map((entry) => entry.key),
      );
      store.close();
      store = new LocalStore(path);
      assert.deepEqual(store.list(''), expected);
      assert.equal(store.statistics().sequence, 5);
      assert.throws(() => store.put('document:retained', {}, 1), /Version conflict/);
      store.put('document:retained', { text: 'Updated document'.repeat(1024) }, 2);
      store.put('document:retained', { text: 'Latest document' }, 3);
      assert.equal(store.put('document:retired', { text: 'New lifetime' }, 0), 1);
      assert(store.compact().compacted);
      const latest = store.list('');
      store.close();
      store = new LocalStore(path);
      assert.deepEqual(store.list(''), latest);
      assert.equal(store.statistics().sequence, 8);
      assert.equal(store.retire(['document:retired', 'document:last'], 8).removedRecords, 2);
      store.close();
      store = new LocalStore(path);
      assert.equal(store.statistics().sequence, 9);
      assert.deepEqual(store.list(''), [latest[0]]);
    } finally {
      store.close();
    }
  });
});

test('removing every record preserves the global sequence even when its checkpoint is larger', async () => {
  await directory(async (path) => {
    let store = new LocalStore(path);
    try {
      store.put('a', 1, 0);
      const result = store.retire(['a'], 1);
      assert.equal(result.after.records, 0);
      assert.equal(result.after.sequence, 2);
      assert.equal(result.after.currentRecordBytes, 0);
      assert(result.after.checkpointBytes > 0);
      assert(result.byteDifference < 0);
      store.close();
      await appendFile(resolve(path, 'records.jsonl'), '{"sequence":');
      store = new LocalStore(path);
      assert.deepEqual(store.list(''), []);
      assert.equal(store.statistics().sequence, 2);
      assert.equal(store.compact().compacted, false);
      assert.equal(store.put('b', 'New document', 0), 1);
      assert.equal(store.statistics().sequence, 3);
      store.close();
      store = new LocalStore(path);
      assert.deepEqual(store.get('b'), { version: 1, value: 'New document' });
    } finally {
      store.close();
    }
  });
});

test('invalid or stale retirement and reference write holds leave authoritative bytes unchanged', async () => {
  await directory(async (path) => {
    const store = new LocalStore(path);
    try {
      populate(store);
      const journal = resolve(path, 'records.jsonl');
      const original = await readFile(journal);
      for (const [keys, sequence] of [
        [[], 4],
        [['document:retired', 'document:retired'], 4],
        [['document:retired', 'missing'], 4],
        [[''], 4],
        [['document:retired'], 3],
        [['document:retired'], Number.NaN],
      ] as [string[], number][]) {
        assert.throws(() => store.retire(keys, sequence));
        assert.deepEqual(await readFile(journal), original);
        assert.equal(store.statistics().sequence, 4);
      }
      const first = store.holdWrites();
      const second = store.holdWrites();
      first.release();
      assert.throws(() => store.retire(['document:retired'], 4), /suspended/);
      second.release();
      second.release();
      store.put('new', {}, 0);
      assert.throws(() => store.retire(['document:retired'], 4), /sequence conflict/);
      store.retire(['document:retired'], 5);
      assert.equal(store.statistics().sequence, 6);
    } finally {
      store.close();
    }
  });
});

test('observer mutation failure follows a durable retirement and stops the writer until reopen', async () => {
  await directory(async (path) => {
    let store = new LocalStore(path);
    try {
      populate(store);
      store.observe(() => {
        store.retire(['document:last'], 5);
      });
      assert.throws(() => store.retire(['document:retired'], 4), /observers cannot mutate/);
      assert.throws(() => store.get('document:last'), /not readable/);
      store.close();
      store = new LocalStore(path);
      assert.equal(store.statistics().sequence, 5);
      assert.equal(store.get('document:retired'), undefined);
      assert(store.get('document:last'));
    } finally {
      store.close();
    }
  });
});

test('v2 checkpoint corruption and incomplete prefixes fail without changing source bytes', async () => {
  await directory(async (path) => {
    const store = new LocalStore(path);
    populate(store);
    store.retire(['document:retired'], 4);
    store.close();
    const journal = resolve(path, 'records.jsonl');
    const original = await readFile(journal, 'utf8');
    const lines = original.trimEnd().split('\n');
    const header = JSON.parse(lines[0]!);
    assert.equal(header.format, 'edh-domain-checkpoint-v2');
    const invalidOffset = { ...header, sequenceOffset: 1 };
    invalidOffset.hash = createHash('sha256')
      .update(
        JSON.stringify([
          invalidOffset.format,
          invalidOffset.sequence,
          invalidOffset.records,
          invalidOffset.sequenceOffset,
        ]),
      )
      .digest('hex');
    const zeroRecords = { ...header, records: 0 };
    zeroRecords.hash = createHash('sha256')
      .update(
        JSON.stringify([
          zeroRecords.format,
          zeroRecords.sequence,
          zeroRecords.records,
          zeroRecords.sequenceOffset,
        ]),
      )
      .digest('hex');
    for (const invalid of [
      original.slice(0, 20),
      lines[0] + '\n',
      lines.slice(0, 2).join('\n') + '\n',
      original.replace('"sequenceOffset":2', '"sequenceOffset":3'),
      [JSON.stringify(invalidOffset), ...lines.slice(1)].join('\n') + '\n',
      JSON.stringify(zeroRecords) + '\n',
      original.replace('Current document', 'Invalid document'),
    ]) {
      assert.notEqual(invalid, original);
      await writeFile(journal, invalid);
      assert.throws(() => new LocalStore(path));
      assert.equal(await readFile(journal, 'utf8'), invalid);
      await assert.rejects(stat(resolve(path, 'writer.lock')), { code: 'ENOENT' });
    }
  });
});

test('external journal replacement or modification prevents retirement publication', async () => {
  for (const replace of [false, true])
    await directory(async (path) => {
      const store = new LocalStore(path);
      try {
        populate(store);
        const journal = resolve(path, 'records.jsonl');
        const bytes = await readFile(journal);
        if (replace) await rm(journal);
        await writeFile(journal, Buffer.concat([bytes, Buffer.from('\n')]));
        assert.throws(() => store.retire(['document:retired'], 4), /outside its writer/);
        assert.deepEqual(await readFile(journal), Buffer.concat([bytes, Buffer.from('\n')]));
      } finally {
        store.close();
      }
    });
});

test(
  'retirement streams a journal exceeding the actual child heap limit',
  { timeout: 60000 },
  async () => {
    await directory(async (path) => {
      const result = await promisify(execFile)(
        process.execPath,
        [
          '--max-old-space-size=64',
          '--import',
          'tsx',
          'tests/runtime/support/store-retirement.ts',
          path,
        ],
        { env: { ...process.env, TMPDIR: resolve('.local/work') } },
      );
      const report = JSON.parse(result.stdout);
      assert.equal(report.records, 48);
      assert.equal(report.sequence, 193);
      assert(report.before > 64 * 1024 * 1024);
      assert(report.after < report.before);
    });
  },
);

test(
  'actual process termination during retirement preserves either the complete original or complete result',
  { timeout: 60000 },
  async () => {
    await directory(async (path) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'tests/runtime/support/store-retirement.ts', path],
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
        if (name?.startsWith('records.compact-') && !terminated) terminated = child.kill('SIGKILL');
      });
      try {
        const exit = await new Promise<{ signal: NodeJS.Signals | null }>((done, reject) => {
          child.once('error', reject);
          child.once('close', (_code, signal) => done({ signal }));
        });
        assert.equal(stderr, '');
        assert(terminated);
        assert.equal(exit.signal, 'SIGKILL');
        await rm(resolve(path, 'writer.lock'));
        const store = new LocalStore(path);
        try {
          const sequence = store.statistics().sequence;
          assert([192, 193].includes(sequence));
          assert.equal(store.statistics().records, sequence === 192 ? 96 : 48);
          for (let index = 0; index < 96; index++) {
            const record = store.get<{ index: number; revision: number; text: string }>(
              `document:${index}`,
            );
            if (sequence === 193 && index % 2 === 0) assert.equal(record, undefined);
            else {
              assert.equal(record!.version, 2);
              assert.equal(record!.value.index, index);
              assert.equal(record!.value.revision, 2);
              assert.equal(record!.value.text.length, 512 * 1024);
            }
          }
        } finally {
          store.close();
        }
      } finally {
        watcher.close();
        child.kill('SIGKILL');
      }
    });
  },
);
