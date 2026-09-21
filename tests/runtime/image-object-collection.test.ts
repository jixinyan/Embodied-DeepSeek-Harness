import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import {
  LocalStore,
  LocalImageStore,
  ImageMaintenanceConflict,
  inspectStoredImageReferences,
} from '@edh/storage';

const data = new Uint8Array(await readFile('apps/console/public/logo.png'));
const input = { data, mediaType: 'image/png' as const };

async function withImages(
  run: (images: LocalImageStore, context: Context, directory: string) => Promise<void>,
) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/image-object-collection-'));
  const context = new Context();
  try {
    await context.plugin(LocalImageStore, { directory });
    await run(context.attachments as LocalImageStore, context, directory);
  } finally {
    await context.fiber.dispose();
    await rm(directory, { recursive: true, force: true });
  }
}

async function publishedImages(images: LocalImageStore) {
  const retained = await images.saveImage(input);
  const request = await images.readImageRequest(retained, {
    maxPixels: 128 * 128,
    maxBytes: 64 * 1024,
  });
  const unreferenced = await images.saveImage({
    data: request.data,
    mediaType: request.mediaType,
  });
  assert.notEqual(retained.attachmentId, unreferenced.attachmentId);
  return { retained, unreferenced, request };
}

test('original collection retains shared referenced bytes and leaves request-cache policy independent', async () => {
  await withImages(async (images, context, directory) => {
    const { retained, unreferenced, request } = await publishedImages(images);
    const original = await images.readImage(retained);
    const inspected = await images.inspectStorage();
    const result = await images.collectUnreferencedObjects(inspected.revision, [
      retained.attachmentId,
      retained.attachmentId,
    ]);
    assert.equal(result.removedFiles, 1);
    assert.equal(result.reclaimedBytes, unreferenced.bytes);
    assert.equal(result.retainedObjects, 1);
    assert.deepEqual(result.after.objects, { files: 1, bytes: retained.bytes });
    assert.deepEqual(result.after.requestCache, result.before.requestCache);
    assert.notEqual(result.after.revision, inspected.revision);
    assert.deepEqual(await images.readImage(retained), original);
    await assert.rejects(images.readImage(unreferenced), /missing/);
    await context.fiber.dispose();
    const reopened = new Context();
    try {
      await reopened.plugin(LocalImageStore, { directory });
      const store = reopened.attachments as LocalImageStore;
      assert.deepEqual(await store.readImage(retained), original);
      assert.deepEqual(
        await store.readImageRequest(retained, { maxPixels: 128 * 128, maxBytes: 64 * 1024 }),
        request,
      );
    } finally {
      await reopened.fiber.dispose();
    }
  });
});

test('collection rejects stale revisions and invalid or absent roots before deleting any object', async () => {
  await withImages(async (images) => {
    const old = await images.inspectStorage();
    const { retained, unreferenced } = await publishedImages(images);
    await assert.rejects(
      images.collectUnreferencedObjects(old.revision, [retained.attachmentId]),
      /changed/,
    );
    const inspected = await images.inspectStorage();
    await assert.rejects(images.collectUnreferencedObjects(inspected.revision, ['../invalid']));
    await assert.rejects(
      images.collectUnreferencedObjects(inspected.revision, [`${retained.attachmentId}\n`]),
    );
    await assert.rejects(
      images.collectUnreferencedObjects(inspected.revision, [`sha256:${'0'.repeat(64)}`]),
      /Referenced original images are missing/,
    );
    assert.equal((await images.readImage(retained)).data.byteLength, retained.bytes);
    assert.equal((await images.readImage(unreferenced)).data.byteLength, unreferenced.bytes);
    await assert.rejects(
      images.collectUnreferencedObjects(inspected.revision, [retained.attachmentId]),
      /changed/,
    );
  });
});

test('original collection excludes active readers and writers and rejects new object consumers', async () => {
  await withImages(async (images) => {
    const { retained } = await publishedImages(images);
    const inspected = await images.inspectStorage();
    const reading = images.readImage(retained);
    await assert.rejects(
      images.collectUnreferencedObjects(inspected.revision, [retained.attachmentId]),
      ImageMaintenanceConflict,
    );
    await reading;
    const writing = images.saveImage(input);
    await assert.rejects(
      images.collectUnreferencedObjects(inspected.revision, [retained.attachmentId]),
      ImageMaintenanceConflict,
    );
    await writing;
    const current = await images.inspectStorage();
    const collection = images.collectUnreferencedObjects(current.revision, [retained.attachmentId]);
    await assert.rejects(images.readImage(retained), ImageMaintenanceConflict);
    assert.throws(() => images.imageHostPath(retained), ImageMaintenanceConflict);
    await assert.rejects(images.saveImage(input), ImageMaintenanceConflict);
    await assert.rejects(
      images.readImageRequest(retained, { maxPixels: 128 * 128, maxBytes: 64 * 1024 }),
      ImageMaintenanceConflict,
    );
    await assert.rejects(images.clearRequestCache(current.revision), ImageMaintenanceConflict);
    assert.equal((await images.inspectStorage()).state, 'busy');
    await collection;
    assert.equal((await images.readImage(retained)).data.byteLength, retained.bytes);
  });
});

test('all original shards are validated before collection and foreign links remain intact', async () => {
  await withImages(async (images, _context, directory) => {
    const { retained, unreferenced } = await publishedImages(images);
    const original = await images.readImage(unreferenced);
    const inspected = await images.inspectStorage();
    const unexpected = resolve(images.root, 'objects', 'unexpected.txt');
    await writeFile(unexpected, 'Unrecognized original entry');
    await assert.rejects(
      images.collectUnreferencedObjects(inspected.revision, [retained.attachmentId]),
      /invalid shard/,
    );
    assert.deepEqual(await images.readImage(unreferenced), original);
    await rm(unexpected);
    const current = await images.inspectStorage();
    const external = resolve(directory, 'external');
    await mkdir(external);
    const outside = resolve(external, 'document.txt');
    await writeFile(outside, 'Retained external document');
    const link = resolve(images.root, 'objects', 'linked');
    await symlink(external, link, 'dir');
    await assert.rejects(
      images.collectUnreferencedObjects(current.revision, [retained.attachmentId]),
      /invalid shard/,
    );
    assert.equal(await readFile(outside, 'utf8'), 'Retained external document');
    assert.deepEqual(await images.readImage(unreferenced), original);
    await rm(link);
  });
});

test('collection snapshots retained roots and native disposal awaits admitted removal', async () => {
  await withImages(async (images, context) => {
    const { retained, unreferenced } = await publishedImages(images);
    const originalPath = images.imageHostPath(retained);
    const removedPath = images.imageHostPath(unreferenced);
    const inspected = await images.inspectStorage();
    const roots: string[] = [retained.attachmentId];
    const collection = images.collectUnreferencedObjects(inspected.revision, roots);
    roots.length = 0;
    await context.fiber.dispose();
    assert.equal((await collection).retainedObjects, 1);
    await access(originalPath);
    await assert.rejects(access(removedPath), { code: 'ENOENT' });
    await assert.rejects(images.collectUnreferencedObjects(inspected.revision, []), /closed/);
  });
});

test('cancelled collection reports its reason and preserves objects before deletion starts', async () => {
  await withImages(async (images) => {
    const { retained, unreferenced } = await publishedImages(images);
    const inspected = await images.inspectStorage();
    await assert.rejects(
      images.collectUnreferencedObjects(
        inspected.revision,
        [retained.attachmentId],
        AbortSignal.abort(new Error('Collection cancelled.')),
      ),
      /cancelled/,
    );
    const controller = new AbortController();
    const collection = images.collectUnreferencedObjects(
      inspected.revision,
      [retained.attachmentId],
      controller.signal,
    );
    controller.abort(new Error('Collection interrupted.'));
    await assert.rejects(collection, /interrupted/);
    assert.equal((await images.readImage(retained)).data.byteLength, retained.bytes);
    assert.equal((await images.readImage(unreferenced)).data.byteLength, unreferenced.bytes);
  });
});

test('an explicit empty root set collects all original objects and retains original staging', async () => {
  await withImages(async (images) => {
    await publishedImages(images);
    const staging = resolve(images.root, 'tmp', '12345678-1234-1234-1234-123456789abc');
    await writeFile(staging, 'Unpublished original staging');
    const inspected = await images.inspectStorage();
    const result = await images.collectUnreferencedObjects(inspected.revision, []);
    assert.equal(result.removedFiles, 2);
    assert.deepEqual(result.after.objects, { files: 0, bytes: 0 });
    assert.equal(await readFile(staging, 'utf8'), 'Unpublished original staging');
    assert.equal(
      (await images.collectUnreferencedObjects(result.after.revision, [])).removedFiles,
      0,
    );
  });
});

test('journal reference inventory preserves images shared by historical and extension records', async () => {
  await withImages(async (images, _context, directory) => {
    const { retained, unreferenced } = await publishedImages(images);
    let store = new LocalStore(directory);
    try {
      store.put('source:first', { images: [retained, retained] }, 0);
      store.put('source:second', { content: [{ type: 'image', attachment: retained }] }, 0);
      for (let index = 0; index < 6; index++)
        store.put(`extension:${index}`, { nested: { image: retained } }, 0);
      store.put('description', { note: 'Authored persistence records; no sensor executed.' }, 0);
      const sequence = store.statistics().sequence;
      const report = inspectStoredImageReferences(store);
      assert.equal(report.storeSequence, sequence);
      assert.equal(report.recordsScanned, 9);
      assert.deepEqual(report.references, [
        {
          attachmentId: retained.attachmentId,
          recordCount: 8,
          exampleKeys: ['source:first', 'source:second', 'extension:0', 'extension:1'],
        },
      ]);
      assert.equal(store.statistics().sequence, sequence);
      report.references[0]!.exampleKeys.length = 0;
      assert.equal(inspectStoredImageReferences(store).references[0]!.exampleKeys.length, 4);
      store.put('description', { note: 'Updated authored persistence description.' }, 1);
      store.compact();
      store.close();
      store = new LocalStore(directory);
      const reopened = inspectStoredImageReferences(store);
      const inspected = await images.inspectStorage();
      const result = await images.collectUnreferencedObjects(
        inspected.revision,
        reopened.references.map((reference) => reference.attachmentId),
      );
      assert.equal(result.removedFiles, 1);
      assert.equal((await images.readImage(retained)).data.byteLength, retained.bytes);
      await assert.rejects(images.readImage(unreferenced), /missing/);
      assert.equal(inspectStoredImageReferences(store).references[0]!.recordCount, 8);
    } finally {
      store.close();
    }
  });
});

test('reference inventory fails on invalid structured attachment identities and excludes prose', async () => {
  await withImages(async (images, _context, directory) => {
    const { retained } = await publishedImages(images);
    const store = new LocalStore(directory);
    try {
      store.put('prose', { text: `Reference mentioned in prose: ${retained.attachmentId}` }, 0);
      assert.deepEqual(inspectStoredImageReferences(store).references, []);
      store.put('invalid', { nested: [{ attachmentId: '../invalid' }] }, 0);
      const sequence = store.statistics().sequence;
      assert.throws(() => inspectStoredImageReferences(store));
      assert.equal(store.statistics().sequence, sequence);
      store.put('invalid', { attachmentId: `${retained.attachmentId}\n` }, 1);
      assert.throws(() => inspectStoredImageReferences(store));
      assert.equal((await images.readImage(retained)).data.byteLength, retained.bytes);
    } finally {
      store.close();
    }
  });
});
