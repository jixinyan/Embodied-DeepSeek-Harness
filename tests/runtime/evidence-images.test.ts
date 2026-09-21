import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm, chmod, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Context } from '@deepseek-ai/cordis';
import { ContractValidator } from '@edh/contracts';
import { SensorSamples } from '@edh/perception';
import { LocalStore, LocalImageStore } from '@edh/storage';
import type { RunState } from '@edh/tasks';
import { serveEvidenceImage } from '../../apps/server/src/evidence-images.js';
import { HttpError, assertLocalRequest } from '../../apps/server/src/local-http.js';

const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);

function documentRun(id: string): RunState {
  const now = new Date().toISOString();
  return {
    id,
    instruction: 'Inspect the saved project logo document.',
    scenario: 'image-document-inspection',
    source: 'test_fixture',
    state: 'interrupted',
    createdAt: now,
    updatedAt: now,
    teamDigest: 'document-inspection',
    teamId: 'document-inspection',
    decisionAssignmentId: '',
    attempt: 1,
    recoveryId: null,
    retryChanges: [],
    assignments: {},
    events: [],
    eventCount: 0,
    executions: [],
    requests: [],
    verdicts: [],
    latestSensor: null,
    agentSeen: {},
    skillIds: [],
    error: 'Document-only acceptance: no model or environment was executed.',
  };
}

async function withImageServer(
  run: (context: {
    url: string;
    path: string;
    privatePath: string;
    images: LocalImageStore;
    store: LocalStore;
    ref: Awaited<ReturnType<LocalImageStore['saveImage']>>;
  }) => Promise<void>,
) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/image-http-'));
  const store = new LocalStore(directory);
  const ctx = new Context();
  const server = createServer((req, res) => {
    void (async () => {
      assertLocalRequest(req, (server.address() as AddressInfo).port);
      if (
        await serveEvidenceImage(req, res, new URL(req.url!, 'http://localhost'), {
          store,
          validator,
          images: ctx.attachments,
        })
      )
        return;
      throw new HttpError(404, 'Route not found.');
    })().catch((error) => {
      res.writeHead(error instanceof HttpError ? error.status : 500, {
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify({ error: error.message }));
    });
  });
  try {
    await ctx.plugin(LocalImageStore, { directory });
    const images = ctx.attachments as LocalImageStore;
    const ref = await images.saveImage({
      data: await readFile('apps/console/public/logo.png'),
      mediaType: 'image/png',
    });
    for (const id of ['document-run', 'other-run']) store.put(`run:${id}`, documentRun(id), 0);
    const samples = new SensorSamples(store, validator, 'document-run', 'test_fixture');
    for (const visibility of ['agent', 'debug_only'] as const)
      samples.retain({
        evidence: {
          id: `logo:${visibility}`,
          kind: 'image',
          source: 'repository-logo-document',
          visibility,
          created_at: '2026-09-20T00:00:00.000Z',
          observed_at: '2026-09-20T00:00:00.000Z',
          clock_id: 'document-clock',
          task_scope: { task_id: 'document-run' },
        },
        images: [ref],
        sequence: 1,
        source: 'test_fixture',
        description: 'Actual repository logo saved for image-access acceptance.',
        visualization: {},
      });
    await new Promise<void>((done, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', reject);
        done();
      });
    });
    const path = `/api/runs/document-run/evidence/logo%3Aagent/images/${encodeURIComponent(ref.attachmentId)}`;
    await run({
      url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      path,
      privatePath: path.replace('logo%3Aagent', 'logo%3Adebug_only'),
      images,
      store,
      ref,
    });
  } finally {
    await new Promise<void>((done, reject) => {
      if (!server.listening) return done();
      server.close((error) => (error ? reject(error) : done()));
      server.closeIdleConnections();
    });
    await ctx.fiber.dispose();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('real HTTP image reads preserve saved bytes and scope across journal compaction', async () => {
  await withImageServer(async ({ url, path, images, ref, store }) => {
    const response = await fetch(url + path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), ref.mediaType);
    assert.equal(response.headers.get('content-length'), String(ref.bytes));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(
      new Uint8Array(await response.arrayBuffer()),
      (await images.readImage(ref)).data,
    );
    const head = await fetch(url + path, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), String(ref.bytes));
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    for (let version = 0; version < 8; version++)
      store.put('inspection:note', { text: 'Image inspection document'.repeat(128) }, version);
    assert.equal(store.compact().compacted, true);
    const compacted = await fetch(url + path);
    assert.equal(compacted.status, 200);
    assert.deepEqual(
      new Uint8Array(await compacted.arrayBuffer()),
      (await images.readImage(ref)).data,
    );
    await images.readImageRequest(ref, { maxPixels: 128 * 128, maxBytes: 64 * 1024 });
    const inspected = await images.inspectStorage();
    assert.equal((await images.clearRequestCache(inspected.revision)).removedFiles, 1);
    const afterCacheCleanup = await fetch(url + path);
    assert.equal(afterCacheCleanup.status, 200);
    assert.deepEqual(
      new Uint8Array(await afterCacheCleanup.arrayBuffer()),
      (await images.readImage(ref)).data,
    );
  });
});

test('image reads require the owning run, visible evidence and associated reference', async () => {
  await withImageServer(async ({ url, path, privatePath }) => {
    for (const [route, status] of [
      [privatePath, 403],
      [path.replace('document-run', 'other-run'), 404],
      [path.replace('document-run', 'missing-run'), 404],
      [path.replace('logo%3Aagent', 'unknown-evidence'), 404],
      [path.replace(/images\/.*$/, 'images/unassociated'), 404],
      [path.replace('logo%3Aagent', '%ZZ'), 400],
      [path.replace('logo%3Aagent', '%2Fetc'), 400],
    ] as const) {
      const response = await fetch(url + route);
      assert.equal(response.status, status);
      await response.arrayBuffer();
    }
    const method = await fetch(url + path, { method: 'POST' });
    assert.equal(method.status, 405);
    assert.equal(method.headers.get('allow'), 'GET, HEAD');
    await method.arrayBuffer();
  });
});

test('browser cross-origin and cross-site image requests are rejected over actual HTTP', async () => {
  await withImageServer(async ({ url, path }) => {
    for (const headers of [
      { origin: 'https://outside.example' },
      { 'sec-fetch-site': 'cross-site' },
      { 'sec-fetch-site': 'same-site' },
      { host: 'outside.example' },
    ]) {
      const status = await new Promise<number | undefined>((done, reject) => {
        const req = request(url + path, { headers }, (res) => {
          res.on('error', reject);
          res.on('end', () => done(res.statusCode));
          res.resume();
        });
        req.on('error', reject);
        req.end();
      });
      assert.equal(status, 403, JSON.stringify(headers));
    }
    const response = await fetch(url + path, {
      headers: { origin: url, 'sec-fetch-site': 'same-origin' },
    });
    assert.equal(response.status, 200);
    await response.arrayBuffer();
  });
});

test('missing and corrupted image files fail without disclosing private file paths', async () => {
  await withImageServer(async ({ url, path, images, ref }) => {
    const file = images.imageHostPath(ref);
    await chmod(file, 0o600);
    await writeFile(file, new Uint8Array(ref.bytes));
    const corrupt = await fetch(url + path);
    assert.equal(corrupt.status, 500);
    assert.doesNotMatch(await corrupt.text(), /Users|attachments\/v1/);
    await rm(file);
    const missing = await fetch(url + path);
    assert.equal(missing.status, 410);
    await missing.arrayBuffer();
  });
});
