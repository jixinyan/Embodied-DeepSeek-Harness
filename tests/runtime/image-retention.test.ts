import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, mkdtemp, readFile, rm, open, unlink, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Context } from '@deepseek-ai/cordis';
import { ContractValidator } from '@edh/contracts';
import { LocalStore, LocalImageStore, ImageMaintenanceConflict } from '@edh/storage';
import {
  ImageRetention,
  type ImageReferenceSource,
} from '../../apps/server/src/image-retention.js';
import {
  admitOriginalImageMaintenance,
  maintenanceBlocker,
} from '../../apps/server/src/storage-maintenance.js';
import { assertLocalRequest, HttpError } from '../../apps/server/src/local-http.js';

const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const signal = () => new AbortController().signal;

class FileReferences implements ImageReferenceSource {
  constructor(
    readonly id: string,
    readonly path: string,
  ) {}
  async acquire(signal: AbortSignal) {
    signal.throwIfAborted();
    const lock = this.path + '.lock';
    const handle = await open(lock, 'wx', 0o600);
    try {
      const document = await readFile(this.path, { encoding: 'utf8', signal });
      const attachmentIds = JSON.parse(document);
      return {
        revision: createHash('sha256').update(document).digest('hex'),
        attachmentIds,
        release: async () => {
          await handle.close();
          await unlink(lock);
        },
      };
    } catch (error) {
      await handle.close();
      await unlink(lock);
      throw error;
    }
  }
}

async function workspace(
  run: (value: {
    store: LocalStore;
    images: LocalImageStore;
    source: FileReferences;
    retained: Awaited<ReturnType<LocalImageStore['saveImage']>>;
    external: Awaited<ReturnType<LocalImageStore['saveImage']>>;
    unused: Awaited<ReturnType<LocalImageStore['saveImage']>>;
  }) => Promise<void>,
) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/image-retention-'));
  const context = new Context();
  const store = new LocalStore(directory);
  try {
    await context.plugin(LocalImageStore, { directory });
    const images = context.attachments as LocalImageStore;
    const retained = await images.saveImage({
      data: await readFile('apps/console/public/logo.png'),
      mediaType: 'image/png',
    });
    const variant = async (size: number) => {
      const request = await images.readImageRequest(retained, {
        maxPixels: size * size,
        maxBytes: 64 * 1024,
      });
      return images.saveImage({ data: request.data, mediaType: request.mediaType });
    };
    const external = await variant(128);
    const unused = await variant(64);
    store.put('historical-image-document', { content: [{ image: retained }] }, 0);
    const source = new FileReferences('extension-files', resolve(directory, 'references.json'));
    await writeFile(source.path, JSON.stringify([external.attachmentId]));
    await run({ store, images, source, retained, external, unused });
  } finally {
    await context.fiber.dispose();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('journal write holds preserve a reference snapshot until every holder releases', async () => {
  await workspace(async ({ store }) => {
    const first = store.holdWrites();
    const second = store.holdWrites();
    assert.equal(first.sequence, second.sequence);
    assert.throws(() => store.put('new', {}, 0), /suspended/);
    assert.throws(() => store.compact(), /suspended/);
    assert.ok(store.get('historical-image-document'));
    first.release();
    first.release();
    assert.throws(() => store.put('new', {}, 0), /suspended/);
    second.release();
    assert.equal(store.put('new', { accepted: true }, 0), 1);
    assert.equal(store.statistics().sequence, first.sequence + 1);
  });
});

test('inspection and token-bound collection preserve journal and leased external originals', async () => {
  await workspace(async ({ store, images, source, retained, external, unused }) => {
    const retention = new ImageRetention(store, validator, images, {
      version: '1',
      sources: [source],
    });
    const firstBytes = await images.readImage(retained);
    const externalBytes = await images.readImage(external);
    const preview = await retention.inspect(signal());
    assert.equal(preview.inspection.retainedObjects.files, 2);
    assert.equal(preview.inspection.unreferencedObjects.files, 1);
    assert.equal(preview.inspection.unreferencedObjects.bytes, unused.bytes);
    assert.deepEqual(preview.sourceIds, ['journal', 'extension-files']);
    await assert.rejects(access(source.path + '.lock'), { code: 'ENOENT' });
    preview.inspection.revision = 'changed-copy';
    const result = await retention.collect(preview.token, signal());
    assert.equal(result.removedFiles, 1);
    assert.equal(result.retainedObjects, 2);
    assert.deepEqual(await images.readImage(retained), firstBytes);
    assert.deepEqual(await images.readImage(external), externalBytes);
    await assert.rejects(images.readImage(unused), /missing/);
    await assert.rejects(retention.collect(preview.token, signal()), /Inspect/);
    await assert.rejects(access(source.path + '.lock'), { code: 'ENOENT' });
    store.put('after-collection', { completed: true }, 0);
  });
});

test('changed journal, image or external references invalidate the inspected collection', async () => {
  for (const change of ['journal', 'images', 'external']) {
    await workspace(async ({ store, images, source, retained, unused }) => {
      const retention = new ImageRetention(store, validator, images, {
        version: '1',
        sources: [source],
      });
      const preview = await retention.inspect(signal());
      if (change === 'journal') store.put('new-root', { image: unused }, 0);
      if (change === 'images')
        await images.readImageRequest(retained, { maxPixels: 32 * 32, maxBytes: 64 * 1024 });
      if (change === 'external')
        await writeFile(source.path, JSON.stringify([unused.attachmentId]));
      await assert.rejects(retention.collect(preview.token, signal()), ImageMaintenanceConflict);
      assert.equal((await images.readImage(unused)).data.byteLength, unused.bytes);
      await assert.rejects(retention.collect(preview.token, signal()), /Inspect/);
      await assert.rejects(access(source.path + '.lock'), { code: 'ENOENT' });
      const updated = await retention.inspect(signal());
      assert.notEqual(updated.token, preview.token);
    });
  }
});

test('unreleased sessions and incomplete SKILL sources block original deletion and release leases', async () => {
  for (const reason of ['session', 'skill']) {
    await workspace(async ({ store, images, source, unused }) => {
      if (reason === 'session')
        store.put('user-session:interrupted', { state: 'interrupted', resources: 'unknown' }, 0);
      else
        store.put(
          'skill:missing-source',
          {
            metadata: {
              schema_version: 'physical.skill_metadata.v1',
              skill_id: 'missing-source',
              version: '1',
              task_semantics: ['document inspection'],
              required_capabilities: ['read-documents'],
              source_configurations: ['document-config'],
              evidence_refs: ['evidence'],
              recovery_id: 'missing-recovery',
              verdict_ref: 'passed-verdict',
              origin: 'test_fixture',
              limitations: ['Authored metadata; no physical experiment.'],
              validation_status: 'test_fixture',
              validated_configurations: [],
            },
          },
          0,
        );
      const retention = new ImageRetention(store, validator, images, {
        version: '1',
        sources: [source],
      });
      await assert.rejects(retention.inspect(signal()), ImageMaintenanceConflict);
      await assert.rejects(access(source.path + '.lock'), { code: 'ENOENT' });
      assert.equal((await images.readImage(unused)).data.byteLength, unused.bytes);
      store.put('after-rejection', {}, 0);
    });
  }
});

test('invalid external roots and acquisition failures release every acquired source', async () => {
  await workspace(async ({ store, images, source, unused }) => {
    await writeFile(source.path, JSON.stringify(['invalid-image']));
    const invalid = new ImageRetention(store, validator, images, {
      version: '1',
      sources: [source],
    });
    await assert.rejects(invalid.inspect(signal()));
    await assert.rejects(access(source.path + '.lock'), { code: 'ENOENT' });
    await writeFile(source.path, JSON.stringify([unused.attachmentId]));
    const absent = new FileReferences('missing-file', source.path + '.missing');
    const failing = new ImageRetention(store, validator, images, {
      version: '1',
      sources: [source, absent],
    });
    await assert.rejects(failing.inspect(signal()), { code: 'ENOENT' });
    for (const entry of [source, absent])
      await assert.rejects(access(entry.path + '.lock'), { code: 'ENOENT' });
    store.put('after-failure', {}, 0);
    assert.equal((await images.readImage(unused)).data.byteLength, unused.bytes);
  });
});

test('retention excludes overlapping operations and releases write holds after cancellation', async () => {
  await workspace(async ({ store, images, unused }) => {
    const retention = new ImageRetention(store, validator, images, { version: '1', sources: [] });
    const controller = new AbortController();
    const pending = retention.inspect(controller.signal);
    assert.throws(() => store.put('concurrent', {}, 0), /suspended/);
    await assert.rejects(retention.inspect(signal()), ImageMaintenanceConflict);
    controller.abort(new Error('Retention cancelled.'));
    await assert.rejects(pending, /cancelled/);
    store.put('after-cancellation', {}, 0);
    assert.equal((await images.readImage(unused)).data.byteLength, unused.bytes);
    const preview = await retention.inspect(signal());
    assert.ok(preview.token);
  });
});

test('HTTP admission requires local origin, idle activity and an exact current preview token', async () => {
  await workspace(async ({ store, images, unused }) => {
    const retention = new ImageRetention(store, validator, images, { version: '1', sources: [] });
    const server = createServer((req, res) => {
      void (async () => {
        assertLocalRequest(req, (server.address() as AddressInfo).port);
        const chunks = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const collecting = req.url === '/collect';
        const token = admitOriginalImageMaintenance(input, collecting, null);
        const result = collecting
          ? await retention.collect(token!, signal())
          : await retention.inspect(signal());
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      })().catch((error) => {
        res.writeHead(
          error instanceof HttpError
            ? error.status
            : error instanceof ImageMaintenanceConflict
              ? 409
              : 500,
        );
        res.end(JSON.stringify({ error: error.message }));
      });
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const request = (route: string, input: unknown, origin?: string) =>
        fetch(url + route, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
          body: JSON.stringify(input),
        });
      assert.equal((await request('/inspect', {}, 'https://foreign.example')).status, 403);
      assert.equal((await request('/collect', { attachmentIds: [] })).status, 400);
      const response = await request('/inspect', {});
      assert.equal(response.status, 200);
      const preview = await response.json();
      const collection = await request('/collect', { token: preview.token });
      assert.equal(collection.status, 200);
      assert.equal((await collection.json()).removedFiles, 2);
      assert.equal((await request('/collect', { token: preview.token })).status, 409);
      await assert.rejects(images.readImage(unused), /missing/);
      for (const activity of [
        { sessionId: 'open' },
        { activeTask: true },
        { admitting: true },
        { sessionBusy: true },
        { stopping: true },
      ]) {
        const reason = maintenanceBlocker({
          stopping: false,
          admitting: false,
          sessionBusy: false,
          sessionId: null,
          activeTask: false,
          ...activity,
        });
        assert.throws(
          () => admitOriginalImageMaintenance({}, false, reason),
          (error) => error instanceof HttpError && error.status === 409,
        );
      }
    } finally {
      await new Promise<void>((done, reject) => {
        server.close((error) => (error ? reject(error) : done()));
        server.closeIdleConnections();
      });
    }
  });
});

test('reference source configuration rejects duplicate identities and empty versions', async () => {
  await workspace(async ({ store, images, source }) => {
    assert.throws(
      () =>
        new ImageRetention(store, validator, images, { version: '1', sources: [source, source] }),
      /identity/,
    );
    assert.throws(() => new ImageRetention(store, validator, images, { version: '', sources: [] }));
  });
});
