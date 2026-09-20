import { randomUUID } from 'node:crypto';
import type { LocalStore } from '@edh/storage';
import type { EmbodiedBackend } from '@edh/execution';
import { UpperRun, terminal } from './application.js';
import type { SessionEnvironment } from './deployment.js';

export interface UserSessionRecord {
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
  runIds: string[];
  error?: string;
}
export class SessionConflict extends Error {}
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
  constructor(private readonly store: LocalStore) {
    for (const row of store.list<UserSessionRecord>('user-session:')) {
      if (row.value.state === 'closed' || row.value.state === 'interrupted') continue;
      this.save({
        ...row.value,
        state: 'interrupted',
        resources: 'unknown',
        error:
          'Server restarted. No environment or agent work was resumed; reconcile provider resources before reuse.',
      });
    }
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
    input: {
      requestId: string;
      profileId: string;
      deploymentDigest: string;
      configuration: Record<string, unknown>;
    },
    allocate: (signal: AbortSignal) => Promise<SessionEnvironment> | SessionEnvironment,
  ): Promise<UserSessionRecord> {
    return this.exclusive(async () => {
      const prior = this.list().find((row) => row.requestId === input.requestId);
      if (prior) {
        if (
          prior.profileId !== input.profileId ||
          prior.deploymentDigest !== input.deploymentDigest
        )
          throw new SessionConflict('Session request ID belongs to a different configuration.');
        return prior;
      }
      if (this.current)
        throw new SessionConflict('End the current session before allocating another environment.');
      const record: UserSessionRecord = {
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        state: 'opening',
        resources: 'allocating',
        runIds: [],
      };
      this.save(record);
      const current = (this.current = { record } as NonNullable<UserSessions['current']>);
      try {
        current.environment = await allocate(this.shutdown.signal);
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
  task(
    id: string,
    taskId: string,
    requestId: string,
    create: (backend: EmbodiedBackend, record: UserSessionRecord) => UpperRun,
  ): Promise<{ runId: string; replayed?: boolean }> {
    return this.exclusive(async () => {
      const record = this.get(id);
      const key = `session-task-request:${id}:${requestId}`;
      const prior = this.store.get<{ taskId: string; runId: string | null }>(key);
      if (prior) {
        if (prior.value.taskId !== taskId)
          throw new SessionConflict('Task request ID reused with different input.');
        if (!prior.value.runId)
          throw new SessionConflict('Task admission was interrupted; inspect history.');
        return { runId: prior.value.runId, replayed: true };
      }
      const current = this.current;
      if (current?.record.id !== id || !current.environment || current.record.state !== 'ready')
        throw new SessionConflict('Session is not ready for another task.');
      if (current.drain) await current.drain;
      // A failed new allocation must close its own port, not the prior retired run.
      delete current.run;
      this.store.put(key, { taskId, runId: null }, 0);
      current.record.state = 'running';
      this.save(current.record);
      let backend: EmbodiedBackend | undefined;
      try {
        backend = await current.environment.createTaskBackend(taskId, {
          signal: this.shutdown.signal,
        });
        this.shutdown.signal.throwIfAborted();
        const run = create(backend, record);
        current.run = run;
        current.record.runIds.push(run.state.id);
        this.save(current.record);
        this.store.put(`run-user-session:${run.state.id}`, { sessionId: id }, 0);
        this.store.put(key, { taskId, runId: run.state.id }, 1);
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
