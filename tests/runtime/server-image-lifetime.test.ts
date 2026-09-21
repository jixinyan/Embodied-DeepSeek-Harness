import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import { LocalImageStore } from '@edh/storage';
import { startServer } from '../../apps/server/src/http-server.js';

async function withDirectory(run: (directory: string) => Promise<void>) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/server-images-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('deployment construction receives the native image service and failed startup drains writes', async () => {
  await withDirectory(async (dataDirectory) => {
    const data = await readFile('apps/console/public/logo.png');
    let images: AttachmentStore | undefined;
    let publication: ReturnType<AttachmentStore['saveImage']> | undefined;
    const failure = new Error('Deployment configuration is incomplete.');
    await assert.rejects(
      startServer({
        root: resolve('.'),
        dataDirectory,
        imageStorage: { maxPendingOperations: 4 },
        deployment: (services) => {
          assert.ok(Object.isFrozen(services));
          images = services.images;
          publication = images.saveImage({ data, mediaType: 'image/png' });
          throw failure;
        },
      }),
      (error) => error === failure,
    );
    assert.ok(images);
    assert.ok(publication);
    const ref = await publication;
    assert.ok(ref.bytes > 0);
    const path = images.imageHostPath(ref);
    assert.ok(path);
    assert.ok((await readFile(path)).byteLength > 0);
    await assert.rejects(images.readImage(ref), /closed/i);
  });
});

test('custom native image mounting shares deployment lifetime and validates exclusive configuration', async () => {
  await withDirectory(async (dataDirectory) => {
    const failure = new Error('Deployment configuration is incomplete.');
    let images: AttachmentStore | undefined;
    let ref: Awaited<ReturnType<AttachmentStore['saveImage']>> | undefined;
    let disposed = false;
    await assert.rejects(
      startServer({
        root: resolve('.'),
        dataDirectory,
        mountImages: async (context, directory) => {
          assert.equal(directory, dataDirectory);
          await context.plugin(LocalImageStore, { directory });
          context.effect(() => () => {
            disposed = true;
          });
          images = context.attachments;
          ref = await images.saveImage({
            data: await readFile('apps/console/public/logo.png'),
            mediaType: 'image/png',
          });
        },
        deployment: async (services) => {
          assert.ok(ref);
          const stored = await services.images.readImage(ref);
          assert.deepEqual(stored.ref, ref);
          assert.equal(stored.data.byteLength, ref.bytes);
          throw failure;
        },
      }),
      (error) => error === failure,
    );
    assert.equal(disposed, true);
    assert.ok(images);
    await assert.rejects(
      images.saveImage({
        data: await readFile('apps/console/public/logo.png'),
        mediaType: 'image/png',
      }),
      /closed/i,
    );
    await assert.rejects(
      startServer({
        root: resolve('.'),
        dataDirectory,
        imageStorage: {},
        mountImages: async (context, directory) => {
          await context.plugin(LocalImageStore, { directory });
        },
        deployment: () => {
          throw failure;
        },
      }),
      /local image store or a custom image provider/,
    );
  });
});

test('a custom mount without an attachment service fails and releases its native context', async () => {
  await withDirectory(async (dataDirectory) => {
    let disposed = false;
    let constructed = false;
    await assert.rejects(
      startServer({
        root: resolve('.'),
        dataDirectory,
        mountImages: (context) => {
          context.effect(() => () => {
            disposed = true;
          });
        },
        deployment: () => {
          constructed = true;
          throw new Error('Image service is required.');
        },
      }),
      /did not mount attachments/,
    );
    assert.equal(disposed, true);
    assert.equal(constructed, false);
  });
});
