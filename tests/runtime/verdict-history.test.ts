import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { LocalStore } from '@edh/storage';
import { VerdictHistory } from '@edh/tasks';
import { verdictDocuments } from './support/verdict-documents.js';
import { readVerdictDetails } from '../../apps/server/src/verdict-view.js';
import { HttpError } from '../../apps/server/src/local-http.js';

async function withStore(action: (store: LocalStore, directory: string) => Promise<void>) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/verdict-history-'));
  const store = new LocalStore(directory);
  try {
    await action(store, directory);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('accepted verdict archives preserve full facts while projections retain bounded explanation previews', async () => {
  await withStore(async (store, directory) => {
    const { state, result, validator } = await verdictDocuments();
    const history = new VerdictHistory(store, validator);
    const summary = history.retain(state.id, result);
    assert.equal('checks' in summary, false);
    assert.equal(summary.checkCount, result.checks.length);
    assert(summary.explanationPreview.length <= 512);
    assert.equal(summary.explanationTruncated, true);
    assert.equal(summary.status, 'unknown');
    assert.deepEqual(history.resolve(state.id, summary), result);
    const edited = history.resolve(state.id, summary);
    edited.checks[0]!.reason = 'Caller-owned change';
    assert.deepEqual(history.resolve(state.id, summary), result);
    const sequence = store.statistics().sequence;
    assert.deepEqual(history.retain(state.id, result), summary);
    assert.equal(store.statistics().sequence, sequence);
    store.compact();
    store.close();
    const reopened = new LocalStore(directory);
    try {
      assert.deepEqual(new VerdictHistory(reopened, validator).resolve(state.id, summary), result);
    } finally {
      reopened.close();
    }
  });
});

test('archive publication rejects write exclusion and conflicting immutable results', async () => {
  await withStore(async (store) => {
    const { state, result, validator } = await verdictDocuments();
    const history = new VerdictHistory(store, validator);
    const hold = store.holdWrites();
    try {
      assert.throws(() => history.retain(state.id, result), /writes are suspended/);
    } finally {
      hold.release();
    }
    assert.equal(history.read(state.id, result.verdict_id), undefined);
    history.retain(state.id, result);
    assert.throws(
      () => history.retain(state.id, { ...result, explanation: 'Changed result' }),
      /immutable/,
    );
    assert.throws(() => history.retain('foreign', result), /another run/);
  });
});

test('selected verdict reads reject missing archives, rewritten records and summary conflicts', async () => {
  await withStore(async (store) => {
    const { state, result, validator } = await verdictDocuments();
    const history = new VerdictHistory(store, validator);
    const summary = history.retain(state.id, result);
    for (const change of [
      { checkCount: 0 },
      { explanationPreview: 'Unrelated text' },
      { status: 'failed' as const },
      { execution_id: 'foreign' },
    ])
      assert.throws(
        () => history.resolve(state.id, { ...summary, ...change }),
        /summary conflicts/,
      );
    assert.throws(
      () => history.resolve(state.id, { ...summary, verdict_id: 'missing' }),
      /archive is missing/,
    );
    const key = `verdict-history:${JSON.stringify([state.id, result.verdict_id])}`;
    store.put(key, store.get(key)!.value, 1);
    assert.throws(() => history.resolve(state.id, summary), /rewritten/);
  });
});

test('legacy verdicts and Unicode preview boundaries retain explicit complete-result reads', async () => {
  await withStore(async (store) => {
    const { state, result, validator } = await verdictDocuments();
    const history = new VerdictHistory(store, validator);
    assert.deepEqual(history.resolve(state.id, result), result);
    const text = 'a'.repeat(511) + '🐋';
    const summary = history.retain(state.id, { ...result, explanation: text });
    assert.equal(summary.explanationPreview, 'a'.repeat(511));
    assert.equal(history.resolve(state.id, summary).explanation, text);
  });
});

test('real HTTP reads expose only the selected accepted verdict with strict task ownership', async () => {
  await withStore(async (store) => {
    const { state, result, validator } = await verdictDocuments();
    state.verdicts = [new VerdictHistory(store, validator).retain(state.id, result)];
    store.put(`run:${state.id}`, state, 0);
    const server = createServer((request, response) => {
      try {
        const detail = readVerdictDetails(
          store,
          validator,
          state.id,
          new URL(request.url!, 'http://localhost').searchParams,
        );
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(detail));
      } catch (error) {
        response.writeHead(error instanceof HttpError ? error.status : 500);
        response.end(String(error));
      }
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
      assert.deepEqual(await (await fetch(`${url}?verdict=${result.verdict_id}`)).json(), {
        runId: state.id,
        result,
      });
      for (const query of ['', 'verdict=a&verdict=b', 'verdict=__proto__', 'verdict=a&extra=b'])
        assert.equal((await fetch(`${url}?${query}`)).status, 400);
      assert.equal((await fetch(`${url}?verdict=unknown`)).status, 404);
      new VerdictHistory(store, validator).retain(state.id, {
        ...result,
        verdict_id: 'archive-without-run-publication',
      });
      assert.equal((await fetch(`${url}?verdict=archive-without-run-publication`)).status, 404);
      assert.throws(
        () =>
          readVerdictDetails(
            store,
            validator,
            'foreign',
            new URLSearchParams({ verdict: result.verdict_id }),
          ),
        /not found/,
      );
      state.verdicts.push(state.verdicts[0]!);
      store.put(`run:${state.id}`, state, 1);
      const duplicate = await fetch(`${url}?verdict=${result.verdict_id}`);
      assert.equal(duplicate.status, 500);
      assert.match(await duplicate.text(), /duplicate accepted verdict identities/);
    } finally {
      await new Promise<void>((done, reject) => {
        server.close((error) => (error ? reject(error) : done()));
        server.closeIdleConnections();
      });
    }
  });
});

test(
  'verdict archives exceed 100 MiB with compact projections under a constrained heap',
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
          'tests/runtime/support/verdict-history-memory.ts',
          directory,
        ],
        { env: { ...process.env, TMPDIR: resolve('.local/work') } },
      );
      const output = JSON.parse(result.stdout);
      assert(output.documentBytes > 100 * 1024 * 1024);
      assert(output.projectionBytes < 2 * 1024 * 1024);
      assert.equal(output.loaded, output.count);
    });
  },
);
