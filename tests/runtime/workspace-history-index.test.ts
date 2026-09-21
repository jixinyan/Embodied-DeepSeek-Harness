import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LocalStore } from '@edh/storage';
import { WorkspaceHistoryIndex } from '../../apps/server/src/workspace-history-index.js';
import { readRunList, readSessionList } from '../../apps/server/src/workspace-history.js';
import { workspaceDocuments } from './support/workspace-documents.js';

async function directory(action: (path: string) => Promise<void>) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const path = await mkdtemp(resolve('.local/work/workspace-index-'));
  try {
    await action(path);
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}

test('persistent summaries follow source and ownership writes without page-time body reads', async () => {
  await directory(async (path) => {
    const store = new LocalStore(path);
    const { runs, sessions } = await workspaceDocuments(store, 12);
    let index = new WorkspaceHistoryIndex(store);
    try {
      assert.equal(index.statistics().sourceReads, 36);
      for (let i = 0; i < 5; i++) {
        readRunList(index, new URLSearchParams(), runs[0]!.id);
        readSessionList(index, new URLSearchParams(), null);
        readRunList(index, new URLSearchParams({ session: sessions[0]!.id }), null);
      }
      assert.equal(index.statistics().sourceReads, 36);
      readSessionList(index, new URLSearchParams(), sessions[0]!.id);
      assert.equal(index.statistics().sourceReads, 37);
      store.put(`run:${runs[1]!.id}`, { ...runs[1], state: 'interrupted' }, 1);
      assert.equal(index.get('run', runs[1]!.id)!.state, 'interrupted');
      store.put(`run-user-session:${runs[1]!.id}`, { sessionId: sessions[1]!.id }, 0);
      assert.deepEqual(
        readRunList(index, new URLSearchParams({ session: sessions[1]!.id }), null).runs.map(
          (row) => row.id,
        ),
        [runs[1]!.id],
      );
      store.put(`run-user-session:${runs[1]!.id}`, { sessionId: sessions[0]!.id }, 1);
      assert.equal(
        readRunList(index, new URLSearchParams({ session: sessions[1]!.id }), null).runs.length,
        0,
      );
      store.put('run-user-session:later-document', { sessionId: sessions[0]!.id }, 0);
      store.put('run:later-document', { ...runs[0], id: 'later-document' }, 0);
      assert.equal(index.get('run', 'later-document')!.userSessionId, sessions[0]!.id);
      const reads = index.statistics().sourceReads;
      store.put('document:unrelated', { text: 'Independent document' }, 0);
      assert.equal(index.statistics().sourceReads, reads);
      const current = store.get(`user-session:${sessions[1]!.id}`)!;
      store.put(
        `user-session:${sessions[1]!.id}`,
        { ...sessions[1], error: 'Operator annotation' },
        current.version,
      );
      assert.equal(index.get('session', sessions[1]!.id)!.error, 'Operator annotation');
      const before = readRunList(index, new URLSearchParams(), null);
      assert(store.compact().compacted);
      assert.deepEqual(readRunList(index, new URLSearchParams(), null), before);
      index.close();
      index = new WorkspaceHistoryIndex(store);
      assert.equal(index.statistics().sourceReads, 0);
      assert.deepEqual(readRunList(index, new URLSearchParams(), null), before);
    } finally {
      index.close();
      store.close();
    }
  });
});

test('reopening reconciles stale and missing summaries and removes source-less rows', async () => {
  await directory(async (path) => {
    let store = new LocalStore(path);
    const { runs, sessions } = await workspaceDocuments(store, 4);
    let index = new WorkspaceHistoryIndex(store);
    index.close();
    store.put(`run:${runs[0]!.id}`, { ...runs[0], instruction: 'Updated review instruction' }, 1);
    store.put(`run-user-session:${runs[1]!.id}`, { sessionId: sessions[0]!.id }, 0);
    store.close();
    const database = new DatabaseSync(resolve(path, 'workspace-history.sqlite'));
    try {
      database
        .prepare('DELETE FROM summaries WHERE kind=? AND id=?')
        .run('session', sessions[2]!.id);
      database.exec(`INSERT INTO summaries SELECT kind, 'absent-source', created_ms, session_id,
        source_version, source_hash, owner_version, owner_hash, summary, checksum
        FROM summaries WHERE kind='run' LIMIT 1`);
    } finally {
      database.close();
    }
    store = new LocalStore(path);
    index = new WorkspaceHistoryIndex(store);
    try {
      assert.equal(index.statistics().sourceReads, 5);
      assert.equal(index.get('run', runs[0]!.id)!.instruction, 'Updated review instruction');
      assert.equal(index.get('run', runs[1]!.id)!.userSessionId, sessions[0]!.id);
      assert.equal(index.get('session', sessions[2]!.id)!.id, sessions[2]!.id);
      assert.equal(index.get('run', 'absent-source'), undefined);
    } finally {
      index.close();
      store.close();
    }
  });
});

test('an actual SQLite writer lock stops source admission after durable publication and recovers on reopen', async () => {
  await directory(async (path) => {
    let store = new LocalStore(path);
    const { runs } = await workspaceDocuments(store, 1);
    let index = new WorkspaceHistoryIndex(store);
    const database = new DatabaseSync(resolve(path, 'workspace-history.sqlite'));
    database.exec('BEGIN IMMEDIATE');
    try {
      assert.throws(
        () =>
          store.put(
            `run:${runs[0]!.id}`,
            { ...runs[0], instruction: 'Durable updated instruction' },
            1,
          ),
        /locked/,
      );
      assert.throws(() => store.get(`run:${runs[0]!.id}`), /not readable/);
      assert.throws(() => store.put('next', {}, 0), /not writable/);
      assert.throws(() => readRunList(index, new URLSearchParams(), null), /unavailable/);
    } finally {
      database.exec('ROLLBACK');
      database.close();
      index.close();
      store.close();
    }
    store = new LocalStore(path);
    index = new WorkspaceHistoryIndex(store);
    try {
      assert.equal(store.revision(`run:${runs[0]!.id}`)!.version, 2);
      assert.equal(index.get('run', runs[0]!.id)!.instruction, 'Durable updated instruction');
      assert.equal(index.statistics().sourceReads, 2);
    } finally {
      index.close();
      store.close();
    }
  });
});

test('summary checksum failures remain explicit across index reopen', async () => {
  await directory(async (path) => {
    const store = new LocalStore(path);
    await workspaceDocuments(store, 1);
    let index = new WorkspaceHistoryIndex(store);
    const database = new DatabaseSync(resolve(path, 'workspace-history.sqlite'));
    database.exec("UPDATE summaries SET summary='{}' WHERE kind='run'");
    database.close();
    try {
      assert.throws(() => readRunList(index, new URLSearchParams(), null), /integrity/);
      assert.throws(() => readSessionList(index, new URLSearchParams(), null), /unavailable/);
      index.close();
      index = new WorkspaceHistoryIndex(store);
      assert.throws(() => readRunList(index, new URLSearchParams(), null), /integrity/);
    } finally {
      index.close();
      store.close();
    }
  });
});

test('compaction publication remains recoverable when the derived index is locked', async () => {
  await directory(async (path) => {
    let store = new LocalStore(path);
    const { runs } = await workspaceDocuments(store, 2);
    store.put(`run:${runs[0]!.id}`, { ...runs[0], instruction: 'Retained instruction' }, 1);
    let index = new WorkspaceHistoryIndex(store);
    const before = readRunList(index, new URLSearchParams(), null);
    const database = new DatabaseSync(resolve(path, 'workspace-history.sqlite'));
    database.exec('BEGIN IMMEDIATE');
    try {
      assert.throws(() => store.compact(), /locked/);
      assert.throws(() => store.get(`run:${runs[0]!.id}`), /not readable/);
    } finally {
      database.exec('ROLLBACK');
      database.close();
      index.close();
      store.close();
    }
    store = new LocalStore(path);
    index = new WorkspaceHistoryIndex(store);
    try {
      assert.equal(store.statistics().supersededBytes, 0);
      assert.deepEqual(readRunList(index, new URLSearchParams(), null), before);
    } finally {
      index.close();
      store.close();
    }
  });
});

test('retirement reconciles removed summaries and ownership in the live index and on reopen', async () => {
  await directory(async (path) => {
    let store = new LocalStore(path);
    const { runs, sessions } = await workspaceDocuments(store, 4);
    let index = new WorkspaceHistoryIndex(store);
    try {
      const retained = index.get('run', runs[1]!.id)!;
      const keys = [
        `run:${runs[0]!.id}`,
        `run-user-session:${runs[0]!.id}`,
        `run-user-session:${runs[2]!.id}`,
        `user-session:${sessions[0]!.id}`,
      ];
      store.retire(keys, store.statistics().sequence);
      assert.equal(index.get('run', runs[0]!.id), undefined);
      assert.equal(index.get('session', sessions[0]!.id), undefined);
      assert.equal(index.get('run', runs[2]!.id)!.userSessionId, null);
      assert.deepEqual(index.get('run', runs[1]!.id), retained);
      assert.equal(index.page('run').records.length, 3);
      assert.equal(index.page('session').records.length, 3);
      index.close();
      store.close();
      store = new LocalStore(path);
      index = new WorkspaceHistoryIndex(store);
      assert.equal(index.statistics().sourceReads, 0);
      assert.equal(index.get('run', runs[0]!.id), undefined);
      assert.equal(index.get('session', sessions[0]!.id), undefined);
      assert.deepEqual(index.get('run', runs[1]!.id), retained);
    } finally {
      index.close();
      store.close();
    }
  });
});

test('retirement remains durable when a real SQLite lock interrupts derived index publication', async () => {
  await directory(async (path) => {
    let store = new LocalStore(path);
    const { runs } = await workspaceDocuments(store, 2);
    let index = new WorkspaceHistoryIndex(store);
    const database = new DatabaseSync(resolve(path, 'workspace-history.sqlite'));
    database.exec('BEGIN IMMEDIATE');
    const sequence = store.statistics().sequence;
    try {
      assert.throws(() => store.retire([`run:${runs[0]!.id}`], sequence), /locked/);
      assert.throws(() => store.get(`run:${runs[0]!.id}`), /not readable/);
      assert.throws(() => index.get('run', runs[0]!.id), /unavailable/);
    } finally {
      database.exec('ROLLBACK');
      database.close();
      index.close();
      store.close();
    }
    store = new LocalStore(path);
    index = new WorkspaceHistoryIndex(store);
    try {
      assert.equal(store.statistics().sequence, sequence + 1);
      assert.equal(index.get('run', runs[0]!.id), undefined);
      assert(index.get('run', runs[1]!.id));
    } finally {
      index.close();
      store.close();
    }
  });
});

test('cached summaries reject external source changes before returning a page', async () => {
  await directory(async (path) => {
    const store = new LocalStore(path);
    await workspaceDocuments(store, 1);
    const index = new WorkspaceHistoryIndex(store);
    try {
      const journal = resolve(path, 'records.jsonl');
      const bytes = await readFile(journal);
      await writeFile(journal, Buffer.concat([bytes, Buffer.from('\n')]));
      assert.throws(() => readRunList(index, new URLSearchParams(), null), /outside its writer/);
      assert.throws(() => store.put('document:next', {}, 0), /not writable/);
    } finally {
      index.close();
      store.close();
    }
  });
});

test('unknown index versions fail without rewriting the existing database', async () => {
  await directory(async (path) => {
    const store = new LocalStore(path);
    const database = new DatabaseSync(resolve(path, 'workspace-history.sqlite'));
    database.exec('PRAGMA user_version=99');
    database.close();
    try {
      assert.throws(() => new WorkspaceHistoryIndex(store), /Unsupported/);
      const reader = new DatabaseSync(resolve(path, 'workspace-history.sqlite'));
      try {
        assert.equal(reader.prepare('PRAGMA user_version').get()!.user_version, 99);
      } finally {
        reader.close();
      }
      store.put('document:next', { text: 'Source remains readable' }, 0);
      assert(store.get('document:next'));
    } finally {
      store.close();
    }
  });
});
