import assert from 'node:assert/strict';
import test from 'node:test';
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Context } from '@deepseek-ai/cordis';
import { AttachmentId } from '@deepseek-ai/dsh-attachment';
import { LocalImageStore, type LocalImageOptions } from '@edh/storage';
import { detectImage } from '../../harness/agent-runtime/storage/src/dsh/attachment-local/image.ts';

const logo = new Uint8Array(await readFile('apps/console/public/logo.png'));
const input = { data: logo, mediaType: 'image/png' as const };

async function withImages(
  work: (store: LocalImageStore, directory: string, ctx: Context) => Promise<void>,
  options: Omit<LocalImageOptions, 'directory'> = {},
) {
  const parent = resolve('.local/work');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(resolve(parent, 'local-images-'));
  const ctx = new Context();
  try {
    await ctx.plugin(LocalImageStore, { directory, ...options });
    await work(ctx.attachments as LocalImageStore, directory, ctx);
  } finally {
    await ctx.fiber.dispose();
    await rm(directory, { recursive: true, force: true });
  }
}

test('native attachment service persists the project logo and deduplicates concurrent saves', async () => {
  await withImages(async (store, directory) => {
    const refs = await Promise.all([store.saveImage(input), store.saveImage(input)]);
    assert.deepEqual(refs[0], refs[1]);
    const ref = refs[0]!;
    const image = await store.readImage(ref);
    assert.equal(
      ref.attachmentId,
      `sha256:${createHash('sha256').update(image.data).digest('hex')}`,
    );
    assert.equal(image.data.byteLength, ref.bytes);
    const metadata = await detectImage(image.data);
    assert.equal(metadata.width, ref.width);
    assert.equal(metadata.height, ref.height);
    assert.equal(metadata.carriesMetadata, false);
    assert.equal(metadata.space, 'srgb');
    assert.equal(metadata.depth, 'uchar');
    assert.deepEqual(await readdir(resolve(store.root, 'tmp')), []);
    if (process.platform !== 'win32') {
      assert.equal((await stat(store.imageHostPath(ref))).mode & 0o777, 0o400);
      assert.equal((await stat(directory)).mode & 0o777, 0o700);
    }
    const second = new Context();
    try {
      await second.plugin(LocalImageStore, { directory });
      assert.deepEqual(await second.attachments.readImage(ref), image);
    } finally {
      await second.fiber.dispose();
    }
    image.data.fill(0);
    assert.notDeepEqual((await store.readImage(ref)).data, image.data);
  });
});

test('image batch admission rejects invalid bytes and media before publishing any member', async () => {
  await withImages(
    async (store) => {
      await assert.rejects(store.saveImages([input, { ...input, mediaType: 'image/jpeg' }]), {
        code: 'IMAGE_TYPE_MISMATCH',
      });
      await assert.rejects(access(store.root), { code: 'ENOENT' });
      await assert.rejects(store.saveImage({ ...input, data: logo.slice(0, 40) }));
      await assert.rejects(access(store.root), { code: 'ENOENT' });
      await assert.rejects(store.saveImages([input, input, input]), { code: 'TOO_MANY_IMAGES' });
    },
    { maxImagesPerMessage: 2 },
  );
});

test('decoded dimensions and encoded bytes obey configured admission limits', async () => {
  await withImages(
    async (store) => {
      await assert.rejects(store.saveImage(input), /byte limit/);
      await assert.rejects(access(store.root), { code: 'ENOENT' });
    },
    { maxImageBytes: 10 },
  );
  await withImages(
    async (store) => {
      await assert.rejects(store.saveImage(input), { code: 'IMAGE_TOO_MANY_PIXELS' });
      await assert.rejects(access(store.root), { code: 'ENOENT' });
    },
    { maxImagePixels: 16 },
  );
});

test('native prompt admission stores bytes and returns durable image references', async () => {
  await withImages(async (store) => {
    const admitted = await store.admitPromptContent([
      { type: 'text', text: 'Project logo image document.' },
      { type: 'image', mediaType: 'image/png', data: Buffer.from(logo).toString('base64') },
    ]);
    assert.deepEqual(admitted[0], { type: 'text', text: 'Project logo image document.' });
    assert.equal(admitted[1]!.type, 'image');
    if (admitted[1]!.type !== 'image') throw new Error('Expected admitted image.');
    const stored = await store.readImage(admitted[1]!.attachment);
    assert.ok(stored.data.byteLength > 0);
  });
});

test('display names retain printable filenames and exclude paths and control characters', async () => {
  await withImages(async (store) => {
    const ref = await store.saveImage({ ...input, name: 'C:\\camera\\frame\u0000.png' });
    assert.equal(ref.name, 'frame.png');
    const other = await store.saveImage({ ...input, name: '/camera/frame.png' });
    assert.deepEqual(other, ref);
  });
});

test('normalization and model request projection preserve source dimensions and alpha', async () => {
  await withImages(
    async (store) => {
      const original = await detectImage(logo);
      const ref = await store.saveImage(input);
      assert.ok(ref.width * ref.height <= 256 * 256);
      assert.deepEqual(ref.originalDimensions, { width: original.width, height: original.height });
      const policy = { maxPixels: 64 * 64, maxBytes: 100_000 };
      const first = await store.readImageRequest(ref, policy);
      assert.ok(first.width * first.height <= policy.maxPixels);
      assert.equal(first.depth, 'uchar');
      assert.equal(first.space, 'srgb');
      assert.equal(first.hasAlpha, original.hasAlpha);
      assert.deepEqual(await store.readImageRequest(ref, policy), first);
      const other = await store.readImageRequest(ref, { ...policy, maxPixels: 32 * 32 });
      assert.notEqual(other.variantId, first.variantId);
      await assert.rejects(store.readImageRequest(ref, { ...policy, maxPixels: 0 }));
      const digest = String(first.variantId).slice('sha256:'.length);
      const cache = resolve(store.root, 'request-images', digest.slice(0, 2), digest);
      await writeFile(cache, logo.slice(0, 40));
      await assert.rejects(store.readImageRequest(ref, policy));
    },
    { normalizedImageMaxPixels: 256 * 256 },
  );
});

test('corrupted or missing objects and changed reference metadata fail immediately', async () => {
  await withImages(async (store) => {
    const ref = await store.saveImage(input);
    await assert.rejects(store.readImage({ ...ref, width: ref.width + 1 }), {
      code: 'ATTACHMENT_CORRUPT',
    });
    await assert.rejects(store.readImage({ ...ref, attachmentId: AttachmentId('../outside') }), {
      code: 'INVALID_ATTACHMENT_REF',
    });
    const path = store.imageHostPath(ref);
    await chmod(path, 0o600);
    await writeFile(path, new Uint8Array(ref.bytes));
    await assert.rejects(store.readImage(ref), { code: 'ATTACHMENT_CORRUPT' });
    await assert.rejects(store.saveImage(input), { code: 'ATTACHMENT_CORRUPT' });
    await rm(path);
    await assert.rejects(store.readImage(ref), { code: 'ATTACHMENT_NOT_FOUND' });
  });
});

test('bounded operations release capacity and cancelled reads propagate their reason', async () => {
  await withImages(
    async (store) => {
      const pending = store.saveImage(input);
      await assert.rejects(store.saveImage(input), /operation limit/);
      const ref = await pending;
      const controller = new AbortController();
      const reason = new Error('Cancelled image document read.');
      controller.abort(reason);
      await assert.rejects(store.readImage(ref, controller.signal), (error) => error === reason);
      await assert.rejects(
        store.readImageRequest(ref, { maxPixels: 1024, maxBytes: 100_000 }, controller.signal),
        (error) => error === reason,
      );
      assert.equal((await store.readImage(ref)).data.byteLength, ref.bytes);
    },
    { maxPendingOperations: 1 },
  );
});

test('configuration errors fail before registering the service', async () => {
  const ctx = new Context();
  try {
    for (const options of [
      { directory: 'relative' },
      { directory: '/' },
      { directory: resolve('.local/work'), maxImagesPerMessage: 17 },
      { directory: resolve('.local/work'), imageCompressionConcurrency: 0 },
      { directory: resolve('.local/work'), maxPendingOperations: -1 },
    ])
      assert.throws(() => new LocalImageStore(ctx, options));
    assert.equal(ctx.attachments, undefined);
  } finally {
    await ctx.fiber.dispose();
  }
});

test('service disposal waits for accepted publication and rejects subsequent work', async () => {
  await withImages(async (store, directory, ctx) => {
    const bytes = new Uint8Array(logo);
    const pending = store.saveImage({ ...input, data: bytes });
    bytes.fill(0);
    await ctx.fiber.dispose();
    const ref = await pending;
    await assert.rejects(store.readImage(ref), /closed/);
    await assert.rejects(store.saveImage(input), /closed/);
    const reader = new Context();
    try {
      await reader.plugin(LocalImageStore, { directory });
      assert.equal((await reader.attachments.readImage(ref)).data.byteLength, ref.bytes);
    } finally {
      await reader.fiber.dispose();
    }
  });
});
