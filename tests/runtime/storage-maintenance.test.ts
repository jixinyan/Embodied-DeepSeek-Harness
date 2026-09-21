import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LocalStore } from '@edh/storage';
import {
  maintenanceBlocker,
  admitStorageCompaction,
  admitImageCacheCleanup,
} from '../../apps/server/src/storage-maintenance.js';
import { HttpError } from '../../apps/server/src/local-http.js';

test('maintenance admission checks activity and the inspected durable sequence', async () => {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/maintenance-admission-'));
  const store = new LocalStore(directory);
  const idle = {
    stopping: false,
    admitting: false,
    sessionBusy: false,
    sessionId: null,
    activeTask: false,
  };
  try {
    store.put('document', { text: 'stored document' }, 0);
    const inspected = store.statistics();
    assert.equal(maintenanceBlocker(idle), null);
    assert.doesNotThrow(() =>
      admitStorageCompaction({ expectedSequence: inspected.sequence }, inspected, null),
    );
    for (const activity of [
      { ...idle, stopping: true },
      { ...idle, admitting: true },
      { ...idle, sessionBusy: true },
      { ...idle, sessionId: 'retained-session' },
      { ...idle, activeTask: true },
    ]) {
      const blockedBy = maintenanceBlocker(activity);
      assert.ok(blockedBy);
      assert.throws(
        () =>
          admitStorageCompaction({ expectedSequence: inspected.sequence }, inspected, blockedBy),
        (error) => error instanceof HttpError && error.status === 409,
      );
    }
    for (const input of [
      {},
      { expectedSequence: -1 },
      { expectedSequence: 1.5 },
      { expectedSequence: '1' },
      { expectedSequence: 1, extra: true },
    ])
      assert.throws(
        () => admitStorageCompaction(input, inspected, null),
        (error) => error instanceof HttpError && error.status === 400,
      );
    store.put('document', { text: 'updated document' }, 1);
    assert.throws(
      () =>
        admitStorageCompaction({ expectedSequence: inspected.sequence }, store.statistics(), null),
      (error) => error instanceof HttpError && error.status === 409,
    );
    assert.deepEqual(store.get('document'), { version: 2, value: { text: 'updated document' } });
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('image cache admission accepts only an inspected revision and an idle workspace', () => {
  assert.equal(admitImageCacheCleanup({ expectedRevision: 'inspection:3' }, null), 'inspection:3');
  for (const input of [
    {},
    { expectedRevision: '' },
    { expectedRevision: 3 },
    { expectedRevision: 'inspection:3', path: '/private' },
    { expectedRevision: 'x'.repeat(513) },
  ])
    assert.throws(
      () => admitImageCacheCleanup(input, null),
      (error) => error instanceof HttpError && error.status === 400,
    );
  assert.throws(
    () => admitImageCacheCleanup({ expectedRevision: 'inspection:3' }, 'A task is active.'),
    (error) => error instanceof HttpError && error.status === 409,
  );
});
