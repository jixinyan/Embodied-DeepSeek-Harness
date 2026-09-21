import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ContractValidator } from '@edh/contracts';
import { parseTaskCatalog } from '@edh/tasks';
import { LocalStore } from '@edh/storage';
import { SessionTaskCatalogs } from '../../apps/server/src/session-task-catalog.js';
import { UserSessions, type UserSessionRecord } from '../../apps/server/src/user-sessions.js';
import { admitSessionTask } from '../../apps/server/src/task-admission.js';
import { sessionSummary } from '../../apps/server/src/workspace-history.js';
import { emptySessionTaskHistory } from '../../apps/server/src/session-task-history.js';

const source = JSON.parse(await readFile('tests/runtime/support/task-catalog.json', 'utf8'));
const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const session = (): UserSessionRecord => ({
  id: 'document-session',
  requestId: 'document-request',
  profileId: 'document-profile',
  deploymentDigest: 'document-deployment',
  createdAt: '2026-09-21T00:00:00.000Z',
  updatedAt: '2026-09-21T00:00:00.000Z',
  state: 'closed',
  resources: 'released',
  configuration: {},
  taskHistory: emptySessionTaskHistory(),
});
async function workspace(
  work: (store: LocalStore, catalogs: SessionTaskCatalogs) => Promise<void> | void,
) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/session-catalog-'));
  const store = new LocalStore(directory);
  try {
    await work(store, new SessionTaskCatalogs(store, validator));
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('catalog definitions validate complete task fields without admitting executable or state payloads', () => {
  const definition = source.tasks['document-review'];
  const parsed = parseTaskCatalog(source, validator);
  assert.deepEqual(parsed, source);
  for (const value of [
    { ...source, revision: ' ' },
    { ...source, tasks: {} },
    { ...source, hiddenState: {} },
    { ...source, tasks: { '../task': definition } },
    { ...source, tasks: { task: { ...definition, createBackend: 'executable' } } },
    { ...source, tasks: { task: { ...definition, instruction: 'x'.repeat(4001) } } },
    {
      ...source,
      tasks: { task: { ...definition, goal: { ...definition.goal, capabilities: [42] } } },
    },
  ])
    assert.throws(() => parseTaskCatalog(value, validator));
  parsed.tasks['document-review']!.goal.entities.document = 'changed';
  assert.equal(definition.goal.entities.document, 'project-spec');
});

test('retained catalogs preserve source, scope and exact content through replay and journal reopen', async () => {
  await workspace(async (store, catalogs) => {
    const record = session();
    record.taskCatalog = catalogs.retain(record, source, 'environment');
    store.put(`user-session:${record.id}`, record, 0);
    const sequence = store.statistics().sequence;
    assert.deepEqual(catalogs.retain(record, source, 'environment'), record.taskCatalog);
    const loaded = catalogs.read(record);
    assert.deepEqual(loaded.tasks, source.tasks);
    loaded.tasks['document-review']!.goal.entities.document = 'changed';
    assert.deepEqual(catalogs.read(record).tasks, source.tasks);
    assert.equal(store.statistics().sequence, sequence);
    assert.deepEqual(sessionSummary(record).taskCatalog, record.taskCatalog);
    assert.throws(
      () => catalogs.retain(record, { ...source, revision: 'v2' }, 'environment'),
      /immutable/,
    );
    assert.throws(() => catalogs.read({ ...record, profileId: 'other' }), /ownership/);
    assert.throws(() => catalogs.read({ ...record, deploymentDigest: 'other' }), /ownership/);
    const sessions = new UserSessions(store, catalogs);
    assert.equal(sessions.replaySession(record)?.taskCatalog?.digest, record.taskCatalog.digest);
    await sessions.close();
    store.compact();
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      const reopenedCatalogs = new SessionTaskCatalogs(reopened, validator);
      assert.deepEqual(reopenedCatalogs.read(record).tasks, source.tasks);
      assert.equal(new UserSessions(reopened, reopenedCatalogs).activeId, null);
    } finally {
      reopened.close();
    }
  });
});

test('catalog reads reject absent, rewritten and mismatched immutable sources', async () => {
  await workspace((store, catalogs) => {
    const record = session();
    record.taskCatalog = catalogs.retain(record, source, 'deployment');
    assert.throws(() => catalogs.read({ ...record, id: 'absent' }), /missing/);
    assert.throws(
      () =>
        catalogs.read({
          ...record,
          taskCatalog: { ...record.taskCatalog!, digest: 'a'.repeat(64) },
        }),
      /conflicts/,
    );
    const key = `session-task-catalog:${record.id}`;
    const stored = store.get(key)!;
    store.put(key, stored.value, 1);
    assert.throws(() => catalogs.read(record), /version conflicts/);
    store.put(`user-session:${record.id}`, record, 0);
    assert.throws(() => new UserSessions(store, catalogs), /version conflicts/);
  });
});

test('task submission confirms the selected catalog digest and retains complete criteria', async () => {
  await workspace((store, catalogs) => {
    const record = session();
    record.taskCatalog = catalogs.retain(record, source, 'environment');
    const catalog = catalogs.read(record);
    const options = {
      session: record,
      tasks: catalog.tasks,
      allowedTasks: Object.keys(catalog.tasks),
      catalogRevision: catalog.descriptor.digest,
      store,
      validator,
    };
    const input = {
      scenario: 'document-review',
      requestId: 'document-request',
      catalogRevision: catalog.descriptor.digest,
    };
    const submitted = admitSessionTask(input, options);
    assert.deepEqual(submitted.goal, source.tasks['document-review'].goal);
    assert.equal(submitted.catalogRevision, catalog.descriptor.digest);
    assert.throws(
      () => admitSessionTask({ ...input, catalogRevision: undefined }, options),
      /catalog/,
    );
    assert.throws(() => admitSessionTask({ ...input, catalogRevision: 'old' }, options), /catalog/);
    assert.throws(
      () => admitSessionTask({ ...input, scenario: 'unavailable' }, options),
      /criteria/,
    );
    const changed = admitSessionTask(
      { ...input, catalogRevision: 'different' },
      { ...options, catalogRevision: 'different' },
    );
    assert.notEqual(submitted.identity, changed.identity);
    assert.equal(store.statistics().sequence, 1);
  });
});
