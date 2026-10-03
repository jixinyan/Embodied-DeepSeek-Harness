import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { LocalStore } from '@edh/storage';
import type { RunState } from '@edh/tasks';
import type { DomainRecordOwner } from './domain-retention.js';

const id = z.string().regex(/^[A-Za-z0-9-]{1,128}$/);
const openSchema = z
  .object({
    format: z.literal('edh.session-open-request.v1'),
    requestId: id,
    sessionId: id,
  })
  .strict();
const taskSchema = z
  .object({
    taskId: z.string().min(1),
    inputIdentity: z.string().optional(),
    runId: id.nullable(),
  })
  .strict();
const runSchema = z
  .object({
    scenario: z.string().min(1),
    runId: id.nullable(),
    deploymentDigest: z.string().optional(),
  })
  .strict();
const archiveSchema = z
  .object({
    format: z.literal('edh.request-identity-archive.v1'),
    requestKey: z.string().min(1).max(512),
    requestVersion: z.number().int().positive().max(2),
    input: z.unknown(),
    archivedAt: z.iso.datetime(),
  })
  .strict();

export class RequestArchiveConflict extends Error {}

export function archivedRequestKey(requestKey: string): string {
  return `archived-request:${JSON.stringify([requestKey])}`;
}

export class RequestIdentityArchives {
  constructor(private readonly store: LocalStore) {}

  private source(key: string, input: unknown, version: number) {
    if (key.startsWith('session-open-request:')) {
      const requestId = id.parse(key.slice('session-open-request:'.length));
      const value = openSchema.parse(input);
      if (value.requestId !== requestId || version !== 1)
        throw new Error('Archived session request identity or source version conflicts.');
      return { sessionId: value.sessionId, runId: undefined };
    }
    if (key.startsWith('session-task-request:')) {
      const [sessionId] = z
        .tuple([id, id])
        .parse(key.slice('session-task-request:'.length).split(':'));
      const value = taskSchema.parse(input);
      if (version > 2 || (value.runId === null && version !== 1))
        throw new Error('Archived task request source version conflicts.');
      return { sessionId, runId: value.runId ?? undefined };
    }
    if (key.startsWith('request:')) {
      id.parse(key.slice('request:'.length));
      const value = runSchema.parse(input);
      if (version > 2 || (value.runId === null && version !== 1))
        throw new Error('Archived run request source version conflicts.');
      return { sessionId: undefined, runId: value.runId ?? undefined };
    }
    throw new Error('Request identity archive requires a supported request namespace.');
  }

  read(requestKey: string) {
    const key = archivedRequestKey(requestKey);
    const row = this.store.get(key);
    if (!row) return undefined;
    const value = archiveSchema.parse(row.value);
    if (row.version !== 1 || value.requestKey !== requestKey)
      throw new Error('Request identity archive key or immutable version conflicts.');
    this.source(requestKey, value.input, value.requestVersion);
    const original = this.store.get(requestKey);
    if (
      original &&
      (original.version !== value.requestVersion || !isDeepStrictEqual(original.value, value.input))
    )
      throw new Error('Request identity archive conflicts with its retained source.');
    return value;
  }

  validate(): void {
    for (const row of this.store.revisions('archived-request:')) {
      const [requestKey] = z
        .tuple([z.string().min(1).max(512)])
        .parse(JSON.parse(row.key.slice('archived-request:'.length)));
      if (row.key !== archivedRequestKey(requestKey))
        throw new Error('Request identity archive key is not canonical.');
      this.read(requestKey);
    }
  }

  archive(requestKeys: readonly string[], expectedSequence: number) {
    this.store.assertCurrent();
    if (
      !Number.isSafeInteger(expectedSequence) ||
      expectedSequence < 0 ||
      expectedSequence !== this.store.statistics().sequence
    )
      throw new RequestArchiveConflict('Storage changed. Inspect request identities again.');
    const keys = z.array(z.string().min(1).max(512)).min(1).parse(requestKeys);
    if (new Set(keys).size !== keys.length)
      throw new Error('Duplicate request identity selection.');
    const records = keys.map((requestKey) => {
      const previous = this.read(requestKey);
      if (previous) return { key: archivedRequestKey(requestKey), value: previous, existing: true };
      const original = this.store.get(requestKey);
      if (!original) throw new RequestArchiveConflict('Request source is unavailable.');
      const source = this.source(requestKey, original.value, original.version);
      if (source.sessionId) {
        const session = this.store.get<{ id: string; state: string; resources: string }>(
          `user-session:${source.sessionId}`,
        )?.value;
        if (
          !session ||
          session.id !== source.sessionId ||
          session.state !== 'closed' ||
          session.resources !== 'released'
        )
          throw new RequestArchiveConflict(
            'Close the session and confirm released resources before archiving requests.',
          );
      }
      if (source.runId) {
        const run = this.store.get<RunState>(`run:${source.runId}`)?.value;
        if (
          !run ||
          run.id !== source.runId ||
          !['succeeded', 'failed', 'cancelled', 'interrupted', 'unknown'].includes(run.state)
        )
          throw new RequestArchiveConflict('Request task must have a retained terminal outcome.');
      }
      return {
        key: archivedRequestKey(requestKey),
        existing: false,
        value: archiveSchema.parse({
          format: 'edh.request-identity-archive.v1',
          requestKey,
          requestVersion: original.version,
          input: original.value,
          archivedAt: new Date().toISOString(),
        }),
      };
    });
    for (const record of records) if (!record.existing) this.store.put(record.key, record.value, 0);
    return {
      archivedRecords: records.filter((record) => !record.existing).length,
      keys: records.map(({ key }) => key),
      storeSequence: this.store.statistics().sequence,
    };
  }

  owner(): DomainRecordOwner {
    return {
      id: 'archived-request',
      prefix: 'archived-request:',
      version: '1',
      inspect: ({ key }) => {
        const [requestKey] = z
          .tuple([z.string().min(1).max(512)])
          .parse(JSON.parse(key.slice('archived-request:'.length)));
        if (key !== archivedRequestKey(requestKey) || !this.read(requestKey))
          throw new Error('Request identity archive is missing or conflicting.');
        return { references: [], retain: true };
      },
    };
  }
}
