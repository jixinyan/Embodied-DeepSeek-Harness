import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AttachmentId } from '@deepseek-ai/dsh-attachment/brand';
import { ContractValidator } from '@edh/contracts';
import type { SensorSample } from '@edh/execution';
import { SensorSamples, sensorImages } from '@edh/perception';
import { LocalStore } from '@edh/storage';

const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);

function document(id = 'document'): SensorSample {
  return {
    evidence: {
      id,
      kind: 'event',
      source: 'authored-metadata-document',
      created_at: '2026-09-20T00:00:00.000Z',
      observed_at: '2026-09-20T00:00:00.000Z',
      clock_id: 'document-clock',
      visibility: 'agent',
      task_scope: { task_id: 'document-task' },
    },
    sequence: 0,
    source: 'test_fixture',
    description: 'Authored metadata for storage acceptance; no sensor was executed.',
    visualization: {},
  };
}

async function withStore(work: (store: LocalStore) => Promise<void> | void) {
  const parent = resolve('.local/work');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(resolve(parent, 'sensor-samples-'));
  const store = new LocalStore(directory);
  try {
    await work(store);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('sensor metadata is detached, immutable, idempotent and readable after reopening', async () => {
  await withStore(async (store) => {
    const samples = new SensorSamples(store, validator, 'run', 'test_fixture');
    const input = document();
    input.images = [
      {
        attachmentId: AttachmentId('declared-image'),
        mediaType: 'image/png',
        bytes: 80,
        width: 2,
        height: 2,
      },
    ];
    const original = structuredClone(input);
    const saved = samples.retain(input);
    input.description = 'Local input change';
    saved.images![0]!.width = 3;
    samples.read('document')!.evidence.visibility = 'debug_only';
    assert.deepEqual(samples.read('document'), original);
    const size = (await stat(resolve(store.directory, 'records.jsonl'))).size;
    assert.deepEqual(samples.retain(original), original);
    assert.equal((await stat(resolve(store.directory, 'records.jsonl'))).size, size);
    assert.throws(() => samples.retain(input), /immutable evidence ID/);
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      const reader = new SensorSamples(reopened, validator, 'run', 'test_fixture');
      assert.deepEqual(reader.read('document'), original);
      assert.deepEqual(reader.retain(original), original);
      assert.throws(() => reader.retain(input), /immutable evidence ID/);
      assert.equal(reader.read('missing'), undefined);
    } finally {
      reopened.close();
    }
  });
});

test('attachment conflicts are checked before writing any records for a new sample', async () => {
  await withStore(async (store) => {
    const samples = new SensorSamples(store, validator, 'run', 'test_fixture');
    const image = {
      attachmentId: AttachmentId('declared-image'),
      mediaType: 'image/png' as const,
      bytes: 80,
      width: 2,
      height: 2,
    };
    samples.retain({ ...document(), images: [image] });
    const size = (await stat(resolve(store.directory, 'records.jsonl'))).size;
    assert.throws(
      () =>
        samples.retain({
          ...document('rejected'),
          images: [
            { ...image, attachmentId: AttachmentId('unreserved') },
            { ...image, width: 3 },
          ],
        }),
      /immutable attachment ID/,
    );
    assert.equal(samples.read('rejected'), undefined);
    assert.equal((await stat(resolve(store.directory, 'records.jsonl'))).size, size);
    samples.retain({
      ...document('accepted'),
      images: [{ ...image, attachmentId: AttachmentId('unreserved'), width: 4 }, image],
    });
    assert.equal(samples.read('accepted')!.images![0]!.width, 4);
  });
});

test('catalog namespaces preserve task separation and debug visibility', async () => {
  await withStore((store) => {
    const first = new SensorSamples(store, validator, 'run:a', 'test_fixture');
    const second = new SensorSamples(store, validator, 'run', 'test_fixture');
    const privateRecord = document('b');
    privateRecord.evidence.visibility = 'debug_only';
    first.retain(privateRecord);
    second.retain(document('a:b'));
    second.retain(document('b'));
    assert.equal(first.read('b')!.evidence.visibility, 'debug_only');
    assert.equal(second.read('b')!.evidence.visibility, 'agent');
    assert.equal(first.read('a:b'), undefined);
    assert.throws(() => sensorImages([first.read('b')!]), /not agent-visible/);
    const otherSource = new SensorSamples(store, validator, 'run', 'hardware');
    assert.throws(() => otherSource.read('b'), /metadata or source/);
  });
});

test('invalid identities and metadata fail before publication', async () => {
  await withStore((store) => {
    for (const id of ['', '../run', 'run\n', 'x'.repeat(129)])
      assert.throws(() => new SensorSamples(store, validator, id, 'test_fixture'), /identity/);
    const samples = new SensorSamples(store, validator, 'run', 'test_fixture');
    for (const id of ['', '../record', 'record\n', 'x'.repeat(129)])
      assert.throws(() => samples.read(id), /identity/);
    assert.throws(() => samples.retain({ ...document(), source: 'hardware' }), /source/);
    assert.throws(() => samples.retain({ ...document(), sequence: -1 }), /metadata/);
    assert.throws(
      () => samples.retain({ ...document(), description: 'x'.repeat(65537) }),
      /metadata/,
    );
    assert.equal(store.list('sensor-').length, 0);
    store.close();
    assert.throws(() => samples.retain(document()), /not readable/);
  });
});

test('JSON metadata retains stable replay semantics for optional fields and numeric zero', async () => {
  await withStore((store) => {
    const samples = new SensorSamples(store, validator, 'run', 'test_fixture');
    const input = { ...document(), visualization: { zero: -0 } };
    Object.assign(input, { images: undefined });
    const saved = samples.retain(input);
    assert.equal(Object.hasOwn(saved, 'images'), false);
    assert.equal(Object.is(saved.visualization.zero, 0), true);
    assert.deepEqual(samples.retain(input), saved);
    assert.deepEqual(samples.read(input.evidence.id), saved);
  });
});

test('partial attachment reservations remain immutable without publishing a sample', async () => {
  await withStore((store) => {
    const image = {
      attachmentId: AttachmentId('declared-image'),
      mediaType: 'image/png' as const,
      bytes: 80,
      width: 2,
      height: 2,
    };
    store.put(`sensor-image:${JSON.stringify(['run', image.attachmentId])}`, image, 0);
    const samples = new SensorSamples(store, validator, 'run', 'test_fixture');
    assert.equal(samples.read('document'), undefined);
    assert.throws(
      () => samples.retain({ ...document(), images: [{ ...image, width: 3 }] }),
      /immutable attachment ID/,
    );
    assert.equal(samples.read('document'), undefined);
    samples.retain({ ...document(), images: [image] });
    assert.deepEqual(samples.read('document')!.images, [image]);
    const key = `sensor-sample:${JSON.stringify(['run', 'document'])}`;
    store.put(key, samples.read('document'), 1);
    assert.throws(() => samples.read('document'), /immutable sensor record/);
  });
});

test('published sensor records reject missing or inconsistent attachment metadata', async () => {
  await withStore((store) => {
    const image = {
      attachmentId: AttachmentId('declared-image'),
      mediaType: 'image/png' as const,
      bytes: 80,
      width: 2,
      height: 2,
    };
    const key = `sensor-sample:${JSON.stringify(['run', 'document'])}`;
    store.put(key, { ...document(), images: [image] }, 0);
    const samples = new SensorSamples(store, validator, 'run', 'test_fixture');
    assert.throws(() => samples.read('document'), /inconsistent attachment metadata/);
    store.put(`sensor-image:${JSON.stringify(['run', image.attachmentId])}`, image, 0);
    assert.equal(samples.read('document')!.images![0]!.width, 2);
    store.put(`sensor-image:${JSON.stringify(['run', image.attachmentId])}`, image, 1);
    assert.throws(() => samples.read('document'), /inconsistent attachment metadata/);
    store.put(`sensor-sample:${JSON.stringify(['run', 'foreign'])}`, document(), 0);
    assert.throws(() => samples.read('foreign'), /immutable sensor record/);
  });
});

test('persist and reopen sensor documents exceeding a 64 MiB child heap limit', async () => {
  await withStore(async (store) => {
    store.close();
    const result = await promisify(execFile)(
      process.execPath,
      [
        '--max-old-space-size=64',
        '--import',
        'tsx',
        'tests/runtime/support/sensor-samples-memory.ts',
        store.directory,
      ],
      { cwd: process.cwd(), env: { ...process.env, TMPDIR: resolve('.local/work') } },
    );
    const report = JSON.parse(result.stdout) as { count: number; journalBytes: number };
    assert.equal(report.count, 1600);
    assert.ok(report.journalBytes > 64 * 1024 * 1024);
  });
});
