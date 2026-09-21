import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ContractValidator } from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { SessionTaskCatalogs } from '../../apps/server/src/session-task-catalog.ts';
import { workspaceDocuments } from '../runtime/support/workspace-documents.ts';
import { createTaskCatalogSelection } from '../../apps/console/public/task-catalog.js';

test('console catalog selection reads retained HTTP documents and requires explicit retry after mismatched identity', async () => {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/catalog-http-'));
  const store = new LocalStore(directory);
  const validator = new ContractValidator(
    JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
  );
  const source = JSON.parse(await readFile('tests/runtime/support/task-catalog.json', 'utf8'));
  const catalogs = new SessionTaskCatalogs(store, validator);
  const { sessions: [session] } = await workspaceDocuments(store, 1);
  session.taskCatalog = catalogs.retain(session, source, 'environment');
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.url);
    assert.equal(request.url, `/api/sessions/${session.id}/tasks`);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(catalogs.read(session)));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const errors = [];
  let notify;
  let changed = new Promise((resolve) => { notify = resolve; });
  const selection = createTaskCatalogSelection(
    async (path, data, signal) => {
      assert.equal(data, undefined);
      const response = await fetch(url + path, { signal });
      assert.equal(response.status, 200);
      return response.json();
    },
    () => notify(),
    (error) => errors.push(error),
  );
  try {
    selection.select(session);
    assert.equal(selection.status, 'loading');
    assert.equal(selection.ready(session), false);
    await changed;
    assert.equal(selection.status, 'ready');
    assert.equal(selection.ready(session), true);
    assert.deepEqual(selection.catalog.tasks, source.tasks);
    selection.select(session);
    assert.equal(requests.length, 1);
    const mismatch = { ...session, taskCatalog: { ...session.taskCatalog, digest: 'a'.repeat(64) } };
    changed = new Promise((resolve) => { notify = resolve; });
    selection.select(mismatch);
    await changed;
    assert.equal(selection.status, 'error');
    assert.equal(selection.catalog, null);
    assert.equal(selection.ready(mismatch), false);
    assert.match(errors[0], /does not match/);
    selection.select(mismatch);
    assert.equal(requests.length, 2);
    changed = new Promise((resolve) => { notify = resolve; });
    selection.select(session, true);
    await changed;
    assert.equal(selection.ready(session), true);
    assert.equal(requests.length, 3);
    selection.select(session, true);
    selection.close();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(selection.status, 'inactive');
    assert.equal(selection.catalog, null);
    assert.equal(errors.length, 1);
    assert.equal(selection.ready(null), true);
  } finally {
    selection.close();
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
