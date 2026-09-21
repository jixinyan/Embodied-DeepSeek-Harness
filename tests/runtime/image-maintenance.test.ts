import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { LocalImageStore, ImageMaintenanceConflict } from '@edh/storage';

const data = new Uint8Array(await readFile('apps/console/public/logo.png'));
const input = { data, mediaType: 'image/png' as const };
const policy = { maxPixels: 128 * 128, maxBytes: 64 * 1024 };

async function withImages(
  run: (images: LocalImageStore, context: Context, directory: string) => Promise<void>,
) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/image-maintenance-'));
  const context = new Context();
  try {
    await context.plugin(LocalImageStore, { directory });
    await run(context.attachments as LocalImageStore, context, directory);
  } finally {
    await context.fiber.dispose();
    await rm(directory, { recursive: true, force: true });
  }
}

test('cache inspection and cleanup preserve original image bytes and regenerate the request variant', async () => {
  await withImages(async (images) => {
    const empty = await images.inspectStorage();
    assert.equal(empty.state, 'ready');
    if (empty.state !== 'ready') throw new Error('Unexpected active image operation.');
    assert.deepEqual(empty.objects, { files: 0, bytes: 0 });
    assert.deepEqual(empty.requestCache, { files: 0, bytes: 0 });
    const ref = await images.saveImage(input);
    const original = await images.readImage(ref);
    const request = await images.readImageRequest(ref, policy);
    const inspected = await images.inspectStorage();
    assert.equal(inspected.state, 'ready');
    if (inspected.state !== 'ready') throw new Error('Unexpected active image operation.');
    assert.deepEqual(inspected.objects, { files: 1, bytes: original.data.byteLength });
    assert.deepEqual(inspected.requestCache, { files: 1, bytes: request.data.byteLength });
    const cleared = await images.clearRequestCache(inspected.revision);
    assert.equal(cleared.removedFiles, 1);
    assert.equal(cleared.reclaimedBytes, request.data.byteLength);
    assert.deepEqual(cleared.after.requestCache, { files: 0, bytes: 0 });
    assert.deepEqual(cleared.after.objects, inspected.objects);
    assert.deepEqual(await images.readImage(ref), original);
    const regenerated = await images.readImageRequest(ref, policy);
    assert.deepEqual(regenerated, request);
  });
});

test('cache cleanup requires a current inspection and excludes pending writers and inspections', async () => {
  await withImages(async (images) => {
    const ref = await images.saveImage(input);
    const inspected = await images.inspectStorage();
    const pending = images.readImageRequest(ref, policy);
    assert.equal((await images.inspectStorage()).state, 'busy');
    await assert.rejects(images.clearRequestCache(inspected.revision), ImageMaintenanceConflict);
    await pending;
    await assert.rejects(images.clearRequestCache(inspected.revision), /changed/);
    const current = await images.inspectStorage();
    const inspection = images.inspectStorage();
    await assert.rejects(images.clearRequestCache(current.revision), ImageMaintenanceConflict);
    await inspection;
    const cleanup = images.clearRequestCache(current.revision);
    assert.equal((await images.inspectStorage()).state, 'busy');
    await assert.rejects(images.readImageRequest(ref, policy), ImageMaintenanceConflict);
    await assert.rejects(images.saveImage(input), ImageMaintenanceConflict);
    await cleanup;
  });
});

test('cache maintenance rejects unknown entries and links before deleting cached data', async () => {
  await withImages(async (images, _context, directory) => {
    const ref = await images.saveImage(input);
    const request = await images.readImageRequest(ref, policy);
    const inspected = await images.inspectStorage();
    const hash = request.variantId.slice('sha256:'.length);
    const cached = resolve(images.root, 'request-images', hash.slice(0, 2), hash);
    const unknown = resolve(images.root, 'request-images', 'unexpected.txt');
    await writeFile(unknown, 'Unexpected cache directory entry');
    await assert.rejects(images.clearRequestCache(inspected.revision), /invalid shard/);
    assert.deepEqual(new Uint8Array(await readFile(cached)), request.data);
    await rm(unknown);
    const current = await images.inspectStorage();
    const external = resolve(directory, 'outside-cache');
    await mkdir(external);
    await writeFile(resolve(external, 'keep.txt'), 'Retain this document');
    const linked = resolve(images.root, 'request-images', hash.slice(0, 2) === 'ff' ? 'fe' : 'ff');
    await symlink(external, linked, 'dir');
    await assert.rejects(images.inspectStorage(), /invalid shard/);
    await assert.rejects(images.clearRequestCache(current.revision), /invalid shard/);
    assert.equal(await readFile(resolve(external, 'keep.txt'), 'utf8'), 'Retain this document');
    assert.deepEqual(new Uint8Array(await readFile(cached)), request.data);
    await rm(linked);
  });
});

test('recognized request-cache staging files are included and original staging remains untouched', async () => {
  await withImages(async (images) => {
    const ref = await images.saveImage(input);
    const request = await images.readImageRequest(ref, policy);
    const hash = request.variantId.slice('sha256:'.length);
    const unfinished = resolve(
      images.root,
      'request-images',
      hash.slice(0, 2),
      `${hash}.12345678-1234-1234-1234-123456789abc.tmp`,
    );
    await writeFile(unfinished, 'Incomplete derived request image');
    const originalStaging = resolve(images.root, 'tmp', '12345678-1234-1234-1234-123456789abc');
    await writeFile(originalStaging, 'Unpublished original image document');
    const inspected = await images.inspectStorage();
    assert.equal(inspected.state, 'ready');
    if (inspected.state !== 'ready') throw new Error('Unexpected active image operation.');
    assert.equal(inspected.requestCache.files, 2);
    const result = await images.clearRequestCache(inspected.revision);
    assert.equal(result.removedFiles, 2);
    await assert.rejects(access(unfinished), { code: 'ENOENT' });
    assert.equal(await readFile(originalStaging, 'utf8'), 'Unpublished original image document');
    assert.equal((await images.readImage(ref)).data.byteLength, ref.bytes);
  });
});

test('native disposal waits for admitted cache cleanup and closed services reject new maintenance', async () => {
  await withImages(async (images, context) => {
    const ref = await images.saveImage(input);
    await images.readImageRequest(ref, policy);
    const inspected = await images.inspectStorage();
    const cleanup = images.clearRequestCache(inspected.revision);
    await context.fiber.dispose();
    assert.equal((await cleanup).after.requestCache.files, 0);
    await assert.rejects(images.inspectStorage(), /closed/);
    await assert.rejects(images.clearRequestCache(inspected.revision), /closed/);
  });
});

test('cancelled maintenance leaves cache and originals readable', async () => {
  await withImages(async (images) => {
    const ref = await images.saveImage(input);
    const request = await images.readImageRequest(ref, policy);
    const inspected = await images.inspectStorage();
    const signal = AbortSignal.abort(new Error('Inspection cancelled.'));
    await assert.rejects(images.inspectStorage(signal), /cancelled/);
    await assert.rejects(images.clearRequestCache(inspected.revision, signal), /cancelled/);
    assert.deepEqual(await images.readImageRequest(ref, policy), request);
  });
});
