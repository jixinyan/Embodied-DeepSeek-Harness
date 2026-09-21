import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { ContractValidator } from '@edh/contracts';
import type { LocalStore } from '@edh/storage';
import { parseTaskCatalog, type TaskCatalogDefinition } from '@edh/tasks';
import type { UserSessionRecord } from './user-sessions.js';
import type { SessionEnvironment } from './deployment.js';

const descriptorSchema = z
  .object({
    revision: z.string().min(1),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    source: z.enum(['deployment', 'environment']),
  })
  .strict();
export type SessionCatalogDescriptor = z.infer<typeof descriptorSchema>;
const recordSchema = z
  .object({
    format: z.literal('edh.session-task-catalog.v1'),
    sessionId: z.string().regex(/^[A-Za-z0-9-]{1,128}$/),
    profileId: z.string().min(1),
    deploymentDigest: z.string().min(1),
    descriptor: descriptorSchema,
    catalog: z.unknown(),
  })
  .strict();
const digest = (catalog: TaskCatalogDefinition) =>
  createHash('sha256').update(JSON.stringify(catalog)).digest('hex');

export class SessionTaskCatalogs {
  constructor(
    private readonly store: LocalStore,
    private readonly validator: ContractValidator,
  ) {}

  async capture(
    session: UserSessionRecord,
    environment: SessionEnvironment,
    binding: { source: SessionCatalogDescriptor['source']; configured?: TaskCatalogDefinition },
    signal: AbortSignal,
  ): Promise<SessionCatalogDescriptor> {
    signal.throwIfAborted();
    if (binding.source === 'environment' && typeof environment.describeTasks !== 'function')
      throw new Error('Environment task discovery requires describeTasks.');
    const value =
      binding.source === 'environment'
        ? await environment.describeTasks!({ signal })
        : binding.configured;
    signal.throwIfAborted();
    return this.retain(session, value, binding.source);
  }

  retain(session: UserSessionRecord, value: unknown, source: SessionCatalogDescriptor['source']) {
    const catalog = parseTaskCatalog(value, this.validator);
    const descriptor = descriptorSchema.parse({
      revision: catalog.revision,
      digest: digest(catalog),
      source,
    });
    const record = recordSchema.parse({
      format: 'edh.session-task-catalog.v1',
      sessionId: session.id,
      profileId: session.profileId,
      deploymentDigest: session.deploymentDigest,
      descriptor,
      catalog,
    });
    const key = `session-task-catalog:${session.id}`;
    const previous = this.store.get(key);
    if (previous) {
      if (previous.version !== 1 || !isDeepStrictEqual(previous.value, record))
        throw new Error('Session task catalog is immutable.');
    } else this.store.put(key, record, 0);
    this.read({ ...session, taskCatalog: descriptor });
    return descriptor;
  }

  read(
    session: UserSessionRecord,
  ): TaskCatalogDefinition & { descriptor: SessionCatalogDescriptor } {
    const expected = descriptorSchema.parse(session.taskCatalog);
    const stored = this.store.get(`session-task-catalog:${session.id}`);
    if (!stored) throw new Error('Session task catalog is missing.');
    const record = recordSchema.parse(stored.value);
    if (
      stored.version !== 1 ||
      record.sessionId !== session.id ||
      record.profileId !== session.profileId ||
      record.deploymentDigest !== session.deploymentDigest ||
      !isDeepStrictEqual(record.descriptor, expected)
    )
      throw new Error('Session task catalog ownership or version conflicts.');
    const catalog = parseTaskCatalog(record.catalog, this.validator);
    if (catalog.revision !== expected.revision || digest(catalog) !== expected.digest)
      throw new Error('Session task catalog content conflicts with its descriptor.');
    return { ...catalog, descriptor: expected };
  }
}
