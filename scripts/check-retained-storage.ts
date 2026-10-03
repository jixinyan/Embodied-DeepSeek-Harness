import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ContractValidator } from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { DomainRetention, DomainRetentionConflict } from '../apps/server/src/domain-retention.js';
import { workspaceRecordOwners } from '../apps/server/src/workspace-record-owners.js';
import { nativeWorkspaceRetention } from '../apps/server/src/native-workspace-retention.js';
import {
  RequestIdentityArchives,
  RequestArchiveConflict,
} from '../apps/server/src/request-identity-archives.js';
import { sessionRetirementSelection } from '../apps/server/src/session-retention.js';
import {
  UserSessions,
  SessionConflict,
  type UserSessionRecord,
} from '../apps/server/src/user-sessions.js';
import { SessionTaskCatalogs } from '../apps/server/src/session-task-catalog.js';
import { WorkspaceHistoryIndex } from '../apps/server/src/workspace-history-index.js';

const args = parseArgs({
  options: {
    'data-directory': { type: 'string' },
    'retire-private-copy': { type: 'boolean', default: false },
    'native-binding': { type: 'boolean', default: false },
  },
}).values;
if (!args['data-directory']) throw new Error('Provide an actual retained data directory.');
const source = resolve(args['data-directory'], 'records.jsonl');
const digest = async () =>
  createHash('sha256')
    .update(await readFile(source))
    .digest('hex');
const sourceDigest = await digest();
await mkdir('.local/work', { recursive: true });
const directory = await mkdtemp(resolve('.local/work/retained-storage-'));
await copyFile(source, resolve(directory, 'records.jsonl'));
const skillDirectory = resolve(args['data-directory'], 'skills');
if (args['native-binding'] && existsSync(skillDirectory))
  await cp(skillDirectory, resolve(directory, 'skills'), { recursive: true, errorOnExist: true });
assert.equal(
  createHash('sha256')
    .update(await readFile(resolve(directory, 'records.jsonl')))
    .digest('hex'),
  sourceDigest,
  'Private journal does not match the retained source snapshot.',
);
const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
let store = new LocalStore(directory);
let index: WorkspaceHistoryIndex | undefined;
const checks: Record<string, unknown> = { source, sourceDigest, privateDirectory: directory };
try {
  const originalKeys = [...store.revisions('')].map(({ key }) => key);
  const extension = {
    version: 'private-copy-complete-journal-sources-v1',
    inspect: ({ key }: { key: string }) =>
      key.startsWith('archived-request:') ? [] : originalKeys,
  };
  const native = args['native-binding']
    ? nativeWorkspaceRetention({
        store,
        validator,
        providers: ['robotwin', 'robocasa', 'behavior', 'robodojo'],
        additionalTools: [],
      })
    : undefined;
  const owners = workspaceRecordOwners(
    store,
    validator,
    native?.domainRetention?.references ?? extension,
  );
  const counts: Record<string, number> = {};
  for (const row of store.scan('')) {
    const owner = owners.find((candidate) => row.key.startsWith(candidate.prefix));
    assert.ok(owner, `Missing namespace owner: ${row.key}`);
    const declared = owner.inspect(row);
    for (const key of declared.references)
      assert.ok(store.revision(key), `Missing reference: ${key}`);
    counts[owner.prefix] = (counts[owner.prefix] ?? 0) + 1;
  }
  checks.ownerRecords = counts;
  checks.originalRecords = originalKeys.length;
  checks.retentionBinding = native ? 'edh-native-workspace-v1' : extension.version;
  if (args['retire-private-copy']) {
    const sessions = [...store.scan<UserSessionRecord>('user-session:')].map(({ value }) => value);
    assert.ok(sessions.length, 'Retirement requires actual closed session histories.');
    const selected = sessionRetirementSelection(
      store,
      sessions.map(({ id }) => id),
    );
    const archives = new RequestIdentityArchives(store);
    index = new WorkspaceHistoryIndex(store);
    assert.ok(index.page('session').records.length);
    const retention = new DomainRetention(store, validator, {
      version: native?.domainRetention?.version ?? 'private-copy-actual-history-v1',
      sources: native?.domainRetention?.sources ?? [],
      owners,
    });
    const signal = new AbortController().signal;
    if (selected.requestKeys.some((key) => !archives.read(key)))
      await assert.rejects(retention.inspect(selected.keys, signal), DomainRetentionConflict);
    assert.throws(
      () => archives.archive(selected.requestKeys, store.statistics().sequence + 1),
      RequestArchiveConflict,
    );
    const archived = archives.archive(selected.requestKeys, store.statistics().sequence);
    const preview = await retention.inspect(selected.keys, signal);
    const retired = await retention.retire(preview.token, signal);
    assert.equal(retired.removedRecords, selected.keys.length);
    assert.equal(index.page('session').records.length, 0);
    assert.equal(index.page('run').records.length, 0);
    await assert.rejects(retention.retire(preview.token, signal), DomainRetentionConflict);
    index.close();
    index = undefined;
    store.close();
    store = new LocalStore(directory);
    index = new WorkspaceHistoryIndex(store);
    assert.equal(index.page('session').records.length, 0);
    assert.equal(index.page('run').records.length, 0);
    const restarted = new UserSessions(store, new SessionTaskCatalogs(store, validator));
    assert.equal(restarted.list().length, 0);
    for (const session of sessions)
      assert.throws(() => restarted.replaySession(session), SessionConflict);
    for (const requestKey of selected.requestKeys) {
      assert.ok(new RequestIdentityArchives(store).read(requestKey));
      if (requestKey.startsWith('session-task-request:')) {
        const [sessionId, requestId] = requestKey.slice('session-task-request:'.length).split(':');
        assert.throws(
          () => restarted.replayTask(sessionId!, 'archived-request', requestId!),
          SessionConflict,
        );
      }
    }
    checks.archival = archived;
    checks.retirement = {
      removedRecords: retired.removedRecords,
      remainingRecords: store.statistics().records,
    };
    checks.restart = {
      historyReconciled: true,
      archivedRequestsReserved: true,
      tokenReplayRejected: true,
    };
  }
  assert.equal(
    await digest(),
    sourceDigest,
    'Original retained journal changed during validation.',
  );
  checks.sourceUnchanged = true;
  await writeFile(resolve(directory, 'acceptance.json'), `${JSON.stringify(checks, null, 2)}\n`, {
    flag: 'wx',
  });
  console.log(JSON.stringify(checks, null, 2));
} finally {
  index?.close();
  store.close();
}
