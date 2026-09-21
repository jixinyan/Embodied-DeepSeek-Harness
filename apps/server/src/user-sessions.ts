import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { LocalStore } from '@edh/storage';
import type { EmbodiedBackend } from '@edh/execution';
import type { TaskCatalogDefinition, TaskDefinition } from '@edh/tasks';
import type { SessionTaskCatalogs, SessionCatalogDescriptor } from './session-task-catalog.js';
import { UpperRun, terminal } from './application.js';
import type { SessionEnvironment } from './deployment.js';
import {
  SessionTaskHistory,
  emptySessionTaskHistory,
  type SessionTaskFields,
} from './session-task-history.js';

export type UserSessionRecord = SessionTaskFields & {
  id: string;
  profileId: string;
  requestId: string;
  deploymentDigest: string;
  createdAt: string;
  updatedAt: string;
  state:
    | 'opening'
    | 'ready'
    | 'running'
    | 'draining'
    | 'closing'
    | 'closed'
    | 'error'
    | 'interrupted';
  resources: 'allocating' | 'held' | 'released' | 'unknown';
  configuration: Record<string, unknown>;
  taskCatalog?: SessionCatalogDescriptor;
  error?: string;
};
export class SessionConflict extends Error {}
type SessionOpenInput = Pick<
  UserSessionRecord,
  'requestId' | 'profileId' | 'deploymentDigest' | 'configuration'
>;
const requestIdentity = z.string().regex(/^[A-Za-z0-9-]{1,128}$/);
const sessionRequestSchema = z
  .object({
    format: z.literal('edh.session-open-request.v1'),
    requestId: requestIdentity,
    sessionId: requestIdentity,
  })
  .strict();
const sessionRequestKey = (id: string) => `session-open-request:${requestIdentity.parse(id)}`;
/** Product-level environment ownership. Agent execution remains entirely inside UpperRun/DSH. */
export class UserSessions {
  private current:
    | {
        record: UserSessionRecord;
        environment?: SessionEnvironment;
        run?: UpperRun;
        drain?: Promise<void> | undefined;
      }
    | undefined;
  private pending: Promise<unknown> | undefined;
  private stopping = false;
  private shutdown = new AbortController();
  private closePromise?: Promise<void>;
  private readonly tasks: SessionTaskHistory;
  constructor(
    private readonly store: LocalStore,
    private readonly catalogs?: SessionTaskCatalogs,
  ) {
    this.tasks = new SessionTaskHistory(store);
    for (const row of store.scan<UserSessionRecord>('user-session:')) {
      if (row.key !== `user-session:${requestIdentity.parse(row.value.id)}`)
        throw new Error('User session identity conflicts with its record key.');
      this.retainRequest(row.value);
      const record = this.tasks.migrate(row.value, row.version);
      if (record.taskCatalog) {
        if (!this.catalogs) throw new Error('Session task catalog reader is required.');
        this.catalogs.read(record);
      }
      if (record.state === 'closed' || record.state === 'interrupted') continue;
      this.save({
        ...record,
        state: 'interrupted',
        resources: 'unknown',
        error:
          'Server restarted. No environment or agent work was resumed; reconcile provider resources before reuse.',
      });
    }
    for (const row of store.scan('session-open-request:')) {
      const request = sessionRequestSchema.parse(row.value);
      if (row.version !== 1 || row.key !== sessionRequestKey(request.requestId))
        throw new Error('Session request record identity or version conflicts.');
      this.requestSource(request.requestId);
    }
  }
  private retainRequest(record: UserSessionRecord): void {
    const request = sessionRequestSchema.parse({
      format: 'edh.session-open-request.v1',
      requestId: record.requestId,
      sessionId: record.id,
    });
    const key = sessionRequestKey(record.requestId);
    const existing = this.store.get(key);
    if (existing) {
      if (
        existing.version !== 1 ||
        !isDeepStrictEqual(sessionRequestSchema.parse(existing.value), request)
      )
        throw new Error('Session request identity conflicts with its source.');
      return;
    }
    this.store.put(key, request, 0);
  }
  private requestSource(requestId: string): UserSessionRecord | undefined {
    const row = this.store.get(sessionRequestKey(requestId));
    if (!row) return undefined;
    const request = sessionRequestSchema.parse(row.value);
    if (row.version !== 1 || request.requestId !== requestId)
      throw new Error('Session request record identity or version conflicts.');
    const source = this.store.get<UserSessionRecord>(`user-session:${request.sessionId}`)?.value;
    if (!source || source.id !== request.sessionId || source.requestId !== requestId)
      throw new Error('Session request source is missing or conflicting.');
    this.tasks.validate(source);
    return source;
  }
  replaySession(input: SessionOpenInput): UserSessionRecord | undefined {
    const prior = this.requestSource(input.requestId);
    if (!prior) return undefined;
    if (
      prior.profileId !== input.profileId ||
      prior.deploymentDigest !== input.deploymentDigest ||
      !isDeepStrictEqual(prior.configuration, JSON.parse(JSON.stringify(input.configuration)))
    )
      throw new SessionConflict('Session request ID belongs to a different configuration.');
    return prior;
  }
  private save(record: UserSessionRecord): void {
    record.updatedAt = new Date().toISOString();
    const key = `user-session:${record.id}`;
    this.store.put(key, record, this.store.get(key)?.version ?? 0);
  }
  list(): UserSessionRecord[] {
    return this.store
      .list<UserSessionRecord>('user-session:')
      .map((row) => row.value)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  get activeId(): string | null {
    return this.current?.record.id ?? null;
  }
  get busy(): boolean {
    return Boolean(this.pending);
  }
  get(id: string): UserSessionRecord {
    const value = this.store.get<UserSessionRecord>(`user-session:${id}`)?.value;
    if (!value) throw new SessionConflict('User session not found.');
    if (value.id !== id) throw new Error('User session identity conflicts with its record key.');
    this.tasks.validate(value);
    return value;
  }
  private exclusive<T>(action: () => Promise<T>): Promise<T> {
    if (this.pending || this.stopping)
      return Promise.reject(new SessionConflict('Session lifecycle is busy or stopping.'));
    const promise = Promise.resolve().then(action);
    this.pending = promise;
    return promise.finally(() => {
      if (this.pending === promise) this.pending = undefined;
    });
  }
  open(
    input: SessionOpenInput,
    allocate: (signal: AbortSignal) => Promise<SessionEnvironment> | SessionEnvironment,
    catalog?: { source: SessionCatalogDescriptor['source']; configured?: TaskCatalogDefinition },
  ): Promise<UserSessionRecord> {
    return this.exclusive(async () => {
      const prior = this.replaySession(input);
      if (prior) return prior;
      if (this.current)
        throw new SessionConflict('End the current session before allocating another environment.');
      if (catalog && !this.catalogs) throw new Error('Session task catalog reader is required.');
      const record: UserSessionRecord = {
        ...input,
        configuration: JSON.parse(JSON.stringify(input.configuration)),
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        state: 'opening',
        resources: 'allocating',
        taskHistory: emptySessionTaskHistory(),
      };
      this.save(record);
      this.retainRequest(record);
      const current = (this.current = { record } as NonNullable<UserSessions['current']>);
      try {
        current.environment = await allocate(this.shutdown.signal);
        this.shutdown.signal.throwIfAborted();
        if (catalog)
          record.taskCatalog = await this.catalogs!.capture(
            record,
            current.environment,
            catalog,
            this.shutdown.signal,
          );
        this.shutdown.signal.throwIfAborted();
        record.state = 'ready';
        record.resources = 'held';
        this.save(record);
        return structuredClone(record);
      } catch (error) {
        record.state = 'error';
        record.resources = 'unknown';
        record.error =
          'Environment admission failed; inspect provider diagnostics and end the session.';
        this.save(record);
        throw error;
      }
    });
  }
  replayTask(id: string, taskId: string, requestId: string, inputIdentity = taskId) {
    const record = this.get(id);
    const prior = this.store.get<{
      taskId: string;
      runId: string | null;
      inputIdentity?: string;
    }>(`session-task-request:${id}:${requestId}`);
    if (!prior) return undefined;
    if (
      prior.value.taskId !== taskId ||
      (prior.value.inputIdentity ?? prior.value.taskId) !== inputIdentity
    )
      throw new SessionConflict('Task request ID reused with different input.');
    const runId = prior.value.runId;
    if (
      !runId ||
      !this.tasks.has(record, runId) ||
      !this.store.get(`run:${runId}`) ||
      this.store.get<{ sessionId: string }>(`run-user-session:${runId}`)?.value.sessionId !== id
    )
      throw new SessionConflict('Task admission was interrupted; inspect history.');
    return { runId, replayed: true };
  }
  task(
    id: string,
    taskId: string,
    requestId: string,
    create: (backend: EmbodiedBackend, record: UserSessionRecord) => UpperRun,
    inputIdentity = taskId,
    definition?: { task: TaskDefinition; catalogRevision: string },
  ): Promise<{ runId: string; replayed?: boolean }> {
    return this.exclusive(async () => {
      const record = this.get(id);
      const key = `session-task-request:${id}:${requestId}`;
      const replayed = this.replayTask(id, taskId, requestId, inputIdentity);
      if (replayed) return replayed;
      const current = this.current;
      if (current?.record.id !== id || !current.environment || current.record.state !== 'ready')
        throw new SessionConflict('Session is not ready for another task.');
      if (current.drain) await current.drain;
      // A failed new allocation must close its own port, not the prior retired run.
      delete current.run;
      this.store.put(key, { taskId, inputIdentity, runId: null }, 0);
      current.record.state = 'running';
      this.save(current.record);
      let backend: EmbodiedBackend | undefined;
      try {
        backend = await current.environment.createTaskBackend(taskId, {
          signal: this.shutdown.signal,
          ...(definition ? structuredClone(definition) : {}),
        });
        this.shutdown.signal.throwIfAborted();
        const run = create(backend, record);
        current.run = run;
        current.record = this.tasks.append(current.record, run.state.id);
        this.store.put(`run-user-session:${run.state.id}`, { sessionId: id }, 0);
        this.store.put(key, { taskId, inputIdentity, runId: run.state.id }, 1);
        await run.start();
        this.changed(run);
        return { runId: run.state.id };
      } catch (error) {
        current.record.state = 'error';
        current.record.resources = 'unknown';
        current.record.error = 'Task admission failed; end this session before continuing.';
        this.save(current.record);
        if (current.run) await current.run.close();
        else await backend?.close();
        throw error;
      }
    });
  }
  changed(run: UpperRun): void {
    const current = this.current;
    if (
      !current ||
      current.run !== run ||
      !terminal(run.state.state) ||
      current.drain ||
      current.record.state !== 'running'
    )
      return;
    current.record.state = 'draining';
    this.save(current.record);
    // Preserve pending Evolver publication and final role receipts before retiring task scopes.
    current.drain = Promise.resolve().then(async () => {
      try {
        await run.settle();
        await run.close();
        if (current.record.state === 'draining') {
          current.record.state = 'ready';
          this.save(current.record);
        }
      } catch {
        if (current.record.state !== 'closing') {
          current.record.state = 'error';
          current.record.resources = 'unknown';
          current.record.error =
            'Task cleanup failed. End the session and inspect provider resources.';
          this.save(current.record);
        }
      } finally {
        current.drain = undefined;
      }
    });
  }
  private async release(id: string): Promise<UserSessionRecord> {
    const record = this.get(id);
    if (record.state === 'closed') return record;
    const current = this.current;
    if (!current || current.record.id !== id)
      throw new SessionConflict(
        'Historical session is read-only; provider resources cannot be recovered automatically.',
      );
    current.record.state = 'closing';
    this.save(current.record);
    const errors: unknown[] = [];
    const attempt = async (f: () => unknown) => {
      try {
        await f();
      } catch (e) {
        errors.push(e);
      }
    };
    // Cancel before waiting for drain: an in-flight model must not deadlock shutdown.
    await attempt(() => current.run?.close());
    await attempt(() => current.drain);
    await attempt(() => current.environment?.close());
    current.record.state = errors.length ? 'error' : 'closed';
    current.record.resources = errors.length ? 'unknown' : 'released';
    if (errors.length)
      current.record.error =
        'Session cleanup failed; provider resources are not confirmed released.';
    this.save(current.record);
    if (errors.length)
      throw new AggregateError(errors, 'Session cleanup failed; all stages were attempted.');
    this.current = undefined;
    return structuredClone(current.record);
  }
  end(id: string): Promise<UserSessionRecord> {
    return this.exclusive(() => this.release(id));
  }
  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.stopping = true;
    this.shutdown.abort(new Error('Server is stopping.'));
    this.closePromise = Promise.resolve().then(async () => {
      try {
        await this.pending;
      } catch {
        /* Admission records retain the failure. */
      }
      if (this.current) await this.release(this.current.record.id);
    });
    return this.closePromise;
  }
}
