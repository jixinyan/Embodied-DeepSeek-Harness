import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { LocalStore } from '@edh/storage';
import {
  readRunList,
  readSessionList,
  workspacePageLimits,
} from '../../apps/server/src/workspace-history.js';
import { HttpError, assertLocalRequest } from '../../apps/server/src/local-http.js';
import { workspaceDocuments } from './support/workspace-documents.js';

async function withStore(action: (store: LocalStore, directory: string) => Promise<void>) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/edh-workspace-history-'));
  const store = new LocalStore(directory);
  try {
    await action(store, directory);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('workspace pages retain deterministic tied-date order and independent active records', async () => {
  await withStore(async (store) => {
    const { runs, sessions } = await workspaceDocuments(store);
    const expected = runs.map((row) => row.id).reverse();
    const received: string[] = [];
    let before: string | null = null;
    do {
      const page = readRunList(store, new URLSearchParams(before ? { before } : {}), runs[0]!.id);
      assert(page.runs.length <= workspacePageLimits.records);
      assert.equal(page.activeRun!.id, runs[0]!.id);
      received.push(...page.runs.map((row) => row.id));
      before = page.nextBeforeId;
    } while (before);
    assert.deepEqual(received, expected);
    const first = readSessionList(store, new URLSearchParams(), sessions[0]!.id);
    assert.equal(first.sessions.length, 32);
    assert.equal(first.activeSession!.id, sessions[0]!.id);
    assert.deepEqual(first.activeSession!.configuration, sessions[0]!.configuration);
    assert.equal('configuration' in first.sessions[0]!, false);
    assert.equal('runIds' in first.sessions[0]!, false);
    first.sessions[0]!.environment = 'caller edit';
    assert.equal(
      readSessionList(store, new URLSearchParams(), null).sessions[0]!.environment,
      'document-records',
    );
    const middle = readSessionList(
      store,
      new URLSearchParams({ before: first.nextBeforeId! }),
      null,
    );
    const last = readSessionList(
      store,
      new URLSearchParams({ before: middle.nextBeforeId! }),
      null,
    );
    assert.deepEqual(
      [...first.sessions, ...middle.sessions, ...last.sessions].map((row) => row.id),
      sessions.map((row) => row.id).reverse(),
    );
    assert.equal(last.nextBeforeId, null);
  });
});

test('session-scoped task pages preserve membership and reject foreign or malformed cursors', async () => {
  await withStore(async (store) => {
    const { runs, sessions } = await workspaceDocuments(store);
    const scope = sessions[0]!.id;
    const first = readRunList(store, new URLSearchParams({ session: scope }), null);
    const last = readRunList(
      store,
      new URLSearchParams({ session: scope, before: first.nextBeforeId! }),
      null,
    );
    assert.deepEqual(
      [...first.runs, ...last.runs].map((row) => row.id),
      runs
        .filter((_, i) => i % 2 === 0)
        .map((row) => row.id)
        .reverse(),
    );
    assert(
      readRunList(store, new URLSearchParams({ session: 'standalone' }), null).runs.every(
        (row) => row.userSessionId === null,
      ),
    );
    for (const params of [
      { before: 'missing' },
      { session: 'missing' },
      { before: runs[1]!.id, session: scope },
    ])
      assert.throws(() => readRunList(store, new URLSearchParams(params), null));
    for (const query of ['before=a&before=b', 'limit=1000', 'before=__proto__', 'session='])
      assert.throws(() => readRunList(store, new URLSearchParams(query), null));
    assert.throws(() => readSessionList(store, new URLSearchParams({ session: scope }), null));
    assert.throws(() => readSessionList(store, new URLSearchParams({ before: 'missing' }), null));
  });
});

test('byte-limited pages preserve continuity across oversized summaries and later insertions', async () => {
  await withStore(async (store) => {
    const { runs } = await workspaceDocuments(store, 4);
    const oversized = { ...runs[2]!, instruction: 'Document review '.repeat(30000) };
    store.put(`run:${oversized.id}`, oversized, 1);
    const first = readRunList(store, new URLSearchParams(), null);
    assert.deepEqual(
      first.runs.map((row) => row.id),
      [runs[3]!.id],
    );
    const second = readRunList(store, new URLSearchParams({ before: first.nextBeforeId! }), null);
    assert.deepEqual(
      second.runs.map((row) => row.id),
      [oversized.id],
    );
    assert(Buffer.byteLength(JSON.stringify(second.runs)) > workspacePageLimits.bytes);
    const inserted = { ...runs[0]!, id: 'zz-new-document' };
    store.put(`run:${inserted.id}`, inserted, 0);
    const third = readRunList(store, new URLSearchParams({ before: second.nextBeforeId! }), null);
    assert.deepEqual(
      third.runs.map((row) => row.id),
      [runs[1]!.id, runs[0]!.id],
    );
    assert.equal(third.nextBeforeId, null);
    assert.equal(readRunList(store, new URLSearchParams(), null).runs[0]!.id, inserted.id);
  });
});

test('workspace HTTP reads expose bounded summaries and explicit query errors', async () => {
  await withStore(async (store) => {
    await workspaceDocuments(store);
    const server = createServer((req, res) => {
      try {
        assertLocalRequest(req, (server.address() as AddressInfo).port);
        const url = new URL(req.url!, 'http://localhost');
        const value =
          url.pathname === '/api/runs'
            ? readRunList(store, url.searchParams, null)
            : readSessionList(store, url.searchParams, null);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(value));
      } catch (error) {
        res.writeHead(error instanceof HttpError ? error.status : 500);
        res.end(JSON.stringify({ error: String(error) }));
      }
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const page = await (await fetch(`${url}/api/runs`)).json();
      assert.equal(page.runs.length, 32);
      assert.equal((await fetch(`${url}/api/runs?before=${page.nextBeforeId}`)).status, 200);
      assert.equal((await fetch(`${url}/api/runs?before=unknown`)).status, 404);
      assert.equal((await fetch(`${url}/api/sessions?before=a&before=b`)).status, 400);
      assert.equal(
        (await fetch(`${url}/api/sessions`, { headers: { Origin: 'https://untrusted.example' } }))
          .status,
        403,
      );
    } finally {
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
    }
  });
});

test(
  'workspace summaries page over more than 100 MiB of documents under a constrained heap',
  { timeout: 90000 },
  async () => {
    await withStore(async (store, directory) => {
      store.close();
      const result = await promisify(execFile)(
        process.execPath,
        [
          '--max-old-space-size=64',
          '--import',
          'tsx',
          'tests/runtime/support/workspace-history-memory.ts',
          directory,
        ],
        { env: { ...process.env, TMPDIR: resolve('.local/work') } },
      );
      const output = JSON.parse(result.stdout);
      assert(output.documentBytes > 100 * 1024 * 1024);
      assert.equal(output.runsRead, output.count);
      assert.equal(output.sessionsRead, output.count);
    });
  },
);
