import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LocalStore } from '@edh/storage';
import { UserSessions } from '../../apps/server/src/user-sessions.js';
import { workspaceDocuments } from './support/workspace-documents.js';

async function withStore(action: (store: LocalStore, directory: string) => Promise<void>) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/session-requests-'));
  const store = new LocalStore(directory);
  try {
    await action(store, directory);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('session request lookup preserves source documents across repeated reads, compaction and reopen', async () => {
  await withStore(async (store, directory) => {
    const { sessions } = await workspaceDocuments(store, 12);
    const lifecycle = new UserSessions(store);
    const retained = new Map(sessions.map((source) => [source.id, lifecycle.get(source.id)]));
    const sequence = store.statistics().sequence;
    for (const source of sessions) {
      const key = `session-open-request:${source.requestId}`;
      assert.equal(store.get(key)!.version, 1);
      assert.deepEqual(lifecycle.replaySession(source), retained.get(source.id));
      const edited = lifecycle.replaySession(source)!;
      edited.configuration.callerEdit = true;
      assert.deepEqual(lifecycle.replaySession(source), retained.get(source.id));
    }
    assert.equal(store.statistics().sequence, sequence);
    assert.equal(lifecycle.activeId, null);
    assert.equal(
      lifecycle.replaySession({ ...sessions[0]!, requestId: 'unregistered' }),
      undefined,
    );
    await lifecycle.close();
    store.compact();
    store.close();
    const reopened = new LocalStore(directory);
    try {
      const before = reopened.statistics().sequence;
      const reader = new UserSessions(reopened);
      for (const source of sessions)
        assert.deepEqual(reader.replaySession(source), retained.get(source.id));
      assert.equal(reopened.statistics().sequence, before);
      await reader.close();
    } finally {
      reopened.close();
    }
  });
});

test('session replay binds the full serialized configuration and profile identity', async () => {
  await withStore(async (store) => {
    const {
      sessions: [source],
    } = await workspaceDocuments(store, 1);
    const lifecycle = new UserSessions(store);
    for (const changed of [
      { profileId: 'another-profile' },
      { deploymentDigest: 'another-deployment' },
      { configuration: { ...source!.configuration, checkpoint: 'another-checkpoint' } },
    ])
      assert.throws(
        () => lifecycle.replaySession({ ...source!, ...changed }),
        /different configuration/,
      );
    assert.deepEqual(
      lifecycle.replaySession({
        ...source!,
        configuration: { ...source!.configuration, absent: undefined },
      }),
      lifecycle.get(source!.id),
    );
    assert.throws(() => lifecycle.replaySession({ ...source!, requestId: '../invalid' }));
    await lifecycle.close();
  });
});

test('startup recovers a source-only admission as interrupted without activating an environment', async () => {
  await withStore(async (store) => {
    const {
      sessions: [source],
    } = await workspaceDocuments(store, 1);
    const key = `user-session:${source!.id}`;
    const version = store.get(key)!.version;
    store.put(key, { ...source, state: 'opening', resources: 'allocating' }, version);
    const lifecycle = new UserSessions(store);
    const retained = lifecycle.replaySession(source!)!;
    assert.equal(retained.state, 'interrupted');
    assert.equal(retained.resources, 'unknown');
    assert.equal(lifecycle.activeId, null);
    assert.equal(store.get(`session-open-request:${source!.requestId}`)!.version, 1);
    await assert.rejects(lifecycle.end(source!.id), /read-only/);
    await lifecycle.close();
  });
});

test('request publication obeys journal write exclusion and leaves source documents intact', async () => {
  await withStore(async (store) => {
    const {
      sessions: [source],
    } = await workspaceDocuments(store, 1);
    const before = store.statistics().sequence;
    const hold = store.holdWrites();
    try {
      assert.throws(() => new UserSessions(store), /writes are suspended/);
      assert.equal(store.statistics().sequence, before);
      assert.deepEqual(store.get(`user-session:${source!.id}`)!.value, source);
    } finally {
      hold.release();
    }
    const lifecycle = new UserSessions(store);
    assert.deepEqual(lifecycle.replaySession(source!), lifecycle.get(source!.id));
    await lifecycle.close();
  });
});

test('duplicate source request IDs fail before the session service admits work', async () => {
  await withStore(async (store) => {
    const { sessions } = await workspaceDocuments(store, 2);
    const second = sessions[1]!;
    store.put(`user-session:${second.id}`, { ...second, requestId: sessions[0]!.requestId }, 1);
    assert.throws(() => new UserSessions(store), /identity conflicts with its source/);
  });
});

test('rewritten request records are rejected by reads and startup', async () => {
  await withStore(async (store) => {
    const {
      sessions: [source],
    } = await workspaceDocuments(store, 1);
    const lifecycle = new UserSessions(store);
    const key = `session-open-request:${source!.requestId}`;
    store.put(key, store.get(key)!.value, 1);
    assert.throws(() => lifecycle.replaySession(source!), /identity or version conflicts/);
    assert.throws(() => new UserSessions(store), /identity conflicts with its source/);
    await lifecycle.close();
  });
});

test('request reads reject source identity changes and startup rejects orphaned request records', async () => {
  await withStore(async (store) => {
    const {
      sessions: [source],
    } = await workspaceDocuments(store, 1);
    const lifecycle = new UserSessions(store);
    const key = `user-session:${source!.id}`;
    store.put(key, { ...source, requestId: 'changed-request' }, store.get(key)!.version);
    assert.throws(() => lifecycle.replaySession(source!), /source is missing or conflicting/);
    await lifecycle.close();
  });
  await withStore(async (store) => {
    store.put(
      'session-open-request:orphan',
      {
        format: 'edh.session-open-request.v1',
        requestId: 'orphan',
        sessionId: 'absent',
      },
      0,
    );
    assert.throws(() => new UserSessions(store), /source is missing or conflicting/);
  });
});
