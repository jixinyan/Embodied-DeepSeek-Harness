import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ContractValidator } from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { UserSessions, type UserSessionRecord } from '../../apps/server/src/user-sessions.js';
import { DomainRetention } from '../../apps/server/src/domain-retention.js';
import { SessionTaskCatalogs } from '../../apps/server/src/session-task-catalog.js';
import { SessionTaskHistory, sessionTaskKey } from '../../apps/server/src/session-task-history.js';
import { sessionRecordOwners } from '../../apps/server/src/session-record-owners.js';
import { workspaceDocuments } from './support/workspace-documents.js';

const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const catalogDocument = JSON.parse(
  await readFile('tests/runtime/support/task-catalog.json', 'utf8'),
);

async function workspace(work: (store: LocalStore) => Promise<void>) {
  await mkdir('.local/work', { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/session-record-owners-'));
  const store = new LocalStore(directory);
  try {
    await work(store);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

function inspector(store: LocalStore) {
  const owners = sessionRecordOwners(store, validator);
  return (key: string) => {
    const owner = owners.find((candidate) => key.startsWith(candidate.prefix));
    assert(owner);
    const row = store.get(key);
    assert(row);
    return owner.inspect({ key, ...row });
  };
}

test('session owners retain exact request, task membership, ownership and catalog dependencies', async () => {
  await workspace(async (store) => {
    const { sessions, runs } = await workspaceDocuments(store, 3);
    const catalogs = new SessionTaskCatalogs(store, validator);
    const lifecycle = new UserSessions(store, catalogs);
    const source = lifecycle.get(sessions[0]!.id);
    source.taskCatalog = catalogs.retain(source, catalogDocument, 'deployment');
    store.put(`user-session:${source.id}`, source, store.get(`user-session:${source.id}`)!.version);
    const inspect = inspector(store);
    const expected = [
      `session-open-request:${source.requestId}`,
      `session-task-catalog:${source.id}`,
      ...[runs[0]!, runs[2]!].flatMap(({ id }) => [
        `run:${id}`,
        `run-user-session:${id}`,
        sessionTaskKey(source.id, id),
      ]),
    ];
    assert.deepEqual([...inspect(`user-session:${source.id}`).references].sort(), expected.sort());
    assert.deepEqual(inspect(`session-open-request:${source.requestId}`), {
      references: [`user-session:${source.id}`],
      retain: true,
    });
    assert.deepEqual(inspect(`session-task-catalog:${source.id}`), {
      references: [`user-session:${source.id}`],
      retain: false,
    });
    const requestKey = `session-task-request:${source.id}:authored-request`;
    store.put(requestKey, { taskId: 'document-review', runId: null }, 0);
    assert.deepEqual(inspect(requestKey), {
      references: [`user-session:${source.id}`],
      retain: true,
    });
    store.put(requestKey, { taskId: 'document-review', runId: runs[0]!.id }, 1);
    assert.deepEqual(
      [...inspect(requestKey).references].sort(),
      [
        `user-session:${source.id}`,
        `run:${runs[0]!.id}`,
        `run-user-session:${runs[0]!.id}`,
        sessionTaskKey(source.id, runs[0]!.id),
      ].sort(),
    );
    for (const run of [runs[0]!, runs[2]!]) {
      assert(inspect(sessionTaskKey(source.id, run.id)).references.includes(`run:${run.id}`));
      assert(
        inspect(`run-user-session:${run.id}`).references.includes(`user-session:${source.id}`),
      );
    }
    store.put('request:authored-legacy', { scenario: 'document-review', runId: null }, 0);
    assert.deepEqual(inspect('request:authored-legacy'), { references: [], retain: true });
    store.put('request:authored-legacy', { scenario: 'document-review', runId: runs[1]!.id }, 1);
    assert.deepEqual(inspect('request:authored-legacy'), {
      references: [`run:${runs[1]!.id}`],
      retain: true,
    });
    await lifecycle.close();
    const before = inspect(`user-session:${source.id}`);
    store.compact();
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      assert.deepEqual(inspector(reopened)(`user-session:${source.id}`), before);
    } finally {
      reopened.close();
    }
  });
});

test('published membership enumeration checks every position and excludes unpublished suffixes', async () => {
  await workspace(async (store) => {
    const { sessions } = await workspaceDocuments(store, 5);
    const lifecycle = new UserSessions(store);
    const source = lifecycle.get(sessions[0]!.id);
    const history = new SessionTaskHistory(store);
    const members = [...history.members(source)];
    assert.deepEqual(
      members.map((member) => member.position),
      [1, 2, 3],
    );
    const unpublishedKey = sessionTaskKey(source.id, 'unpublished-run');
    store.put(
      unpublishedKey,
      {
        format: 'edh.session-task-member.v1',
        sessionId: source.id,
        runId: 'unpublished-run',
        position: 4,
      },
      0,
    );
    assert.deepEqual([...history.members(source)], members);
    const missingKey = sessionTaskKey(source.id, members[1]!.runId);
    store.retire([missingKey], store.statistics().sequence);
    assert.throws(() => [...history.members(source)], /incomplete/);
    assert.throws(() => inspector(store)(`user-session:${source.id}`), /incomplete/);
    await lifecycle.close();
  });
});

test('membership enumeration rejects duplicate positions, conflicting keys and rewritten entries', async () => {
  for (const condition of ['duplicate-position', 'identity', 'key', 'version'])
    await workspace(async (store) => {
      const { sessions } = await workspaceDocuments(store, 3);
      const lifecycle = new UserSessions(store);
      const source = lifecycle.get(sessions[0]!.id);
      const history = new SessionTaskHistory(store);
      const member = [...history.members(source)][0]!;
      if (condition === 'duplicate-position') {
        store.put(
          sessionTaskKey(source.id, 'additional-run'),
          { ...member, runId: 'additional-run' },
          0,
        );
      } else {
        const key = sessionTaskKey(source.id, member.runId);
        if (condition === 'identity') {
          store.retire([key], store.statistics().sequence);
          store.put(key, { ...member, sessionId: 'foreign' }, 0);
        } else if (condition === 'key') {
          store.put(sessionTaskKey(source.id, 'conflicting-key'), member, 0);
        } else store.put(key, member, 1);
      }
      assert.throws(() => [...history.members(source)], /conflicts/);
      await lifecycle.close();
    });
});

test('session owners reject conflicting reverse ownership, request identity and catalog content', async () => {
  for (const condition of ['ownership', 'request', 'catalog'])
    await workspace(async (store) => {
      const { sessions, runs } = await workspaceDocuments(store, 3);
      const catalogs = new SessionTaskCatalogs(store, validator);
      const lifecycle = new UserSessions(store, catalogs);
      const source = lifecycle.get(sessions[0]!.id);
      if (condition === 'ownership') {
        const key = `run-user-session:${runs[0]!.id}`;
        store.retire([key], store.statistics().sequence);
        store.put(key, { sessionId: sessions[1]!.id }, 0);
      }
      if (condition === 'request') source.requestId = sessions[1]!.requestId;
      if (condition === 'catalog') {
        source.taskCatalog = catalogs.retain(source, catalogDocument, 'deployment');
        source.taskCatalog.digest = '0'.repeat(64);
      }
      const key = `user-session:${source.id}`;
      store.put(key, source, store.get(key)!.version);
      assert.throws(() => inspector(store)(key), /conflicts|source identity/);
      await lifecycle.close();
    });
});

test('legacy inline history declares task dependencies without requiring migrated membership records', async () => {
  await workspace(async (store) => {
    const { sessions } = await workspaceDocuments(store, 3);
    for (const source of sessions)
      store.put(
        `session-open-request:${source.requestId}`,
        {
          format: 'edh.session-open-request.v1',
          requestId: source.requestId,
          sessionId: source.id,
        },
        0,
      );
    const source = sessions[0]!;
    const result = inspector(store)(`user-session:${source.id}`);
    assert.equal(result.references.filter((key) => key.startsWith('run:')).length, 2);
    assert.equal(
      result.references.some((key) => key.startsWith('session-task-member:')),
      false,
    );
    assert.throws(
      () => [...new SessionTaskHistory(store).members({ ...source, runIds: ['same', 'same'] })],
      /duplicate/,
    );
  });
});

test('configured retention preserves request replay sources even when a whole session is selected', async () => {
  await workspace(async (store) => {
    const source: UserSessionRecord = {
      id: 'authored-empty-session',
      requestId: 'authored-request',
      profileId: 'document-review',
      deploymentDigest: 'authored-configuration',
      configuration: {},
      createdAt: '2026-09-22T00:00:00.000Z',
      updatedAt: '2026-09-22T00:00:00.000Z',
      state: 'closed',
      resources: 'released',
      runIds: [],
    };
    store.put(`user-session:${source.id}`, source, 0);
    const lifecycle = new UserSessions(store);
    const service = new DomainRetention(store, validator, {
      version: 'document-session-retention',
      owners: sessionRecordOwners(store, validator),
      sources: [],
    });
    const sequence = store.statistics().sequence;
    await assert.rejects(
      service.inspect([`user-session:${source.id}`], new AbortController().signal),
      /Retained record.*references selected record/,
    );
    await assert.rejects(
      service.inspect(
        [`user-session:${source.id}`, `session-open-request:${source.requestId}`],
        new AbortController().signal,
      ),
      /retained by a reference source/,
    );
    assert.equal(store.statistics().sequence, sequence);
    assert.equal(lifecycle.replaySession(source)!.id, source.id);
    await lifecycle.close();
  });
});
