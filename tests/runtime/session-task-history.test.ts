import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LocalStore } from '@edh/storage';
import {
  SessionTaskHistory,
  sessionTaskKey,
  sessionTaskCount,
  emptySessionTaskHistory,
} from '../../apps/server/src/session-task-history.js';
import { workspaceDocuments } from './support/workspace-documents.js';
import { WorkspaceHistoryIndex } from '../../apps/server/src/workspace-history-index.js';
import { UserSessions } from '../../apps/server/src/user-sessions.js';
import { readRunList } from '../../apps/server/src/workspace-history.js';

async function withStore(action: (store: LocalStore, directory: string) => Promise<void>) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/session-task-history-'));
  const store = new LocalStore(directory);
  try {
    await action(store, directory);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('migration preserves legacy task membership and configuration through compaction and reopen', async () => {
  await withStore(async (store, directory) => {
    const { sessions } = await workspaceDocuments(store, 4);
    const source = sessions[0]!;
    const history = new SessionTaskHistory(store);
    const current = store.get(`user-session:${source.id}`)!;
    assert.throws(
      () => history.migrate({ ...source, runIds: ['foreign'] }, current.version),
      /source changed before migration/,
    );
    assert.equal(store.get(sessionTaskKey(source.id, 'foreign')), undefined);
    const migrated = history.migrate(source, current.version);
    const { runIds, ...rest } = source;
    assert.deepEqual(migrated, {
      ...rest,
      taskHistory: {
        format: 'edh.session-task-history.v1',
        count: runIds.length,
        lastRunId: runIds.at(-1),
      },
    });
    assert.equal('runIds' in migrated, false);
    assert.equal(sessionTaskCount(migrated), 2);
    for (const runId of runIds) assert(history.has(migrated, runId));
    assert.equal(history.has(migrated, 'foreign'), false);
    const sequence = store.statistics().sequence;
    history.migrate(migrated, store.get(`user-session:${source.id}`)!.version);
    assert.equal(store.statistics().sequence, sequence);
    store.compact();
    store.close();
    const reopened = new LocalStore(directory);
    try {
      const reader = new SessionTaskHistory(reopened);
      assert.deepEqual(reader.validate(migrated).taskHistory, migrated.taskHistory);
      for (const runId of runIds) assert(reader.has(migrated, runId));
      assert.equal(reopened.get(sessionTaskKey(source.id, runIds[0]!))!.version, 1);
    } finally {
      reopened.close();
    }
  });
});

test('task append publishes membership before the updated head and rejects stale or duplicate admission', async () => {
  await withStore(async (store) => {
    const source = { id: 'document-session', taskHistory: emptySessionTaskHistory() };
    store.put('user-session:document-session', source, 0);
    const history = new SessionTaskHistory(store);
    const published: string[] = [];
    const stop = store.observe((change) => {
      if (change.type === 'put') published.push(change.key);
    });
    const next = history.append(source, 'document-one');
    stop();
    assert.deepEqual(published, [
      sessionTaskKey(source.id, 'document-one'),
      'user-session:document-session',
    ]);
    assert.equal(next.taskHistory.count, 1);
    assert.equal(next.taskHistory.lastRunId, 'document-one');
    assert.equal(source.taskHistory.count, 0);
    assert(history.has(next, 'document-one'));
    assert.throws(() => history.append(source, 'document-two'), /source changed/);
    assert.throws(() => history.append(next, 'document-one'), /already exists/);
    assert.equal(store.get(sessionTaskKey(source.id, 'document-two')), undefined);
  });
});

test('interrupted membership publication does not admit the unpublished task into session context', async () => {
  await withStore(async (store) => {
    const source = { id: 'document-session', taskHistory: emptySessionTaskHistory() };
    store.put('user-session:document-session', source, 0);
    let hold: ReturnType<LocalStore['holdWrites']> | undefined;
    const stop = store.observe((change) => {
      if (change.type === 'put' && change.key.startsWith('session-task-member:'))
        hold = store.holdWrites();
    });
    const history = new SessionTaskHistory(store);
    try {
      assert.throws(() => history.append(source, 'document-one'), /writes are suspended/);
      assert.deepEqual(store.get('user-session:document-session')!.value, source);
      assert.throws(() => history.has(source, 'document-one'), /outside the published history/);
    } finally {
      stop();
      hold?.release();
    }
    assert.throws(() => history.append(source, 'document-one'), /already exists/);
    assert.equal(sessionTaskCount(source), 0);
  });
});

test('legacy migration resumes persisted membership publication without rewriting immutable members', async () => {
  await withStore(async (store) => {
    const source = { id: 'document-session', runIds: ['document-one', 'document-two'] };
    store.put('user-session:document-session', source, 0);
    let hold: ReturnType<LocalStore['holdWrites']> | undefined;
    const stop = store.observe((change) => {
      if (change.type === 'put' && change.key === sessionTaskKey(source.id, 'document-one'))
        hold = store.holdWrites();
    });
    const history = new SessionTaskHistory(store);
    try {
      assert.throws(() => history.migrate(source, 1), /writes are suspended/);
      assert.deepEqual(store.get('user-session:document-session')!.value, source);
    } finally {
      stop();
      hold?.release();
    }
    const next = history.migrate(source, 1);
    assert.equal(store.get(sessionTaskKey(source.id, 'document-one'))!.version, 1);
    assert.equal(next.taskHistory.count, 2);
    for (const runId of source.runIds) assert(history.has(next, runId));
  });
});

test('membership inspection rejects rewritten records and conflicting history heads', async () => {
  await withStore(async (store) => {
    const source = { id: 'document-session', taskHistory: emptySessionTaskHistory() };
    store.put('user-session:document-session', source, 0);
    const history = new SessionTaskHistory(store);
    const first = history.append(source, 'document-one');
    const next = history.append(first, 'document-two');
    assert.throws(
      () => history.validate({ ...next, taskHistory: { ...next.taskHistory, count: 3 } }),
      /head/,
    );
    assert.throws(
      () =>
        history.has(
          { ...next, taskHistory: { ...next.taskHistory, lastRunId: 'document-one' } },
          'document-two',
        ),
      /head/,
    );
    const key = sessionTaskKey(source.id, 'document-one');
    store.put(key, store.get(key)!.value, 1);
    assert.throws(() => history.has(next, 'document-one'), /identity or version/);
    assert.throws(() => history.validate({ ...next, runIds: [] }));
    assert.throws(
      () => history.migrate({ id: 'duplicate', runIds: ['same', 'same'] }, 0),
      /duplicate/,
    );
  });
});

test('one session stores 2000 document memberships without growing its history header', async () => {
  await withStore(async (store, directory) => {
    let record = { id: 'document-session', taskHistory: emptySessionTaskHistory() };
    store.put('user-session:document-session', record, 0);
    const history = new SessionTaskHistory(store);
    for (let i = 0; i < 2000; i++) {
      record = history.append(record, `document-${String(i).padStart(6, '0')}`);
      assert(Buffer.byteLength(JSON.stringify(record)) < 256);
      assert.equal('runIds' in record, false);
    }
    assert.equal(record.taskHistory.count, 2000);
    store.compact();
    store.close();
    const reopened = new LocalStore(directory);
    try {
      const reader = new SessionTaskHistory(reopened);
      reader.validate(record);
      for (const id of ['document-000000', 'document-001000', 'document-001999'])
        assert(reader.has(record, id));
      assert.equal(reader.has(record, 'document-002000'), false);
    } finally {
      reopened.close();
    }
  });
});

test('session startup migration and membership publication preserve indexed history and task replay', async () => {
  await withStore(async (store) => {
    const { sessions, runs } = await workspaceDocuments(store, 3);
    const index = new WorkspaceHistoryIndex(store);
    try {
      const lifecycle = new UserSessions(store);
      const source = lifecycle.get(sessions[0]!.id);
      assert.equal(source.runIds, undefined);
      assert.equal(index.get('session', source.id)!.runCount, 2);
      const appended = new SessionTaskHistory(store).append(source, runs[1]!.id);
      store.put(`run-user-session:${runs[1]!.id}`, { sessionId: source.id }, 0);
      store.put(
        `session-task-request:${source.id}:document-request`,
        {
          taskId: 'document',
          runId: runs[1]!.id,
        },
        0,
      );
      assert.equal(appended.taskHistory.count, 3);
      assert.equal(index.get('session', source.id)!.runCount, 3);
      assert.deepEqual(
        readRunList(index, new URLSearchParams({ session: source.id }), null).runs.map(
          (run) => run.id,
        ),
        runs.map((run) => run.id).reverse(),
      );
      assert.equal(
        lifecycle.replayTask(source.id, 'document', 'document-request')!.runId,
        runs[1]!.id,
      );
      assert.equal(lifecycle.activeId, null);
      await lifecycle.close();
    } finally {
      index.close();
    }
  });
});
