import { spawn, type ChildProcess } from 'node:child_process';
import { connect } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { Ajv, type ValidateFunction } from 'ajv';
import { z } from 'zod';

const nonblank = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);
const milliseconds = z.number().int().min(100).max(3_600_000);
const readiness = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('http_json'),
      url: z.url(),
      headers: z.record(z.string(), z.string()).optional(),
      schema: z.record(z.string(), z.unknown()),
    })
    .strict(),
  z.object({ type: z.literal('websocket'), url: z.url() }).strict(),
]);
export const managedServiceConfigurations = z.record(
  z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/),
  z
    .object({
      label: nonblank,
      command: z.array(nonblank).min(1),
      cwd: nonblank,
      env: z.record(z.string(), z.string()),
      readiness,
      startupTimeoutMs: milliseconds,
      probeTimeoutMs: milliseconds,
      probeIntervalMs: milliseconds,
      shutdownTimeoutMs: milliseconds,
    })
    .strict(),
);
export type ManagedServiceConfiguration = z.infer<typeof managedServiceConfigurations>[string];
export interface ManagedServiceStatus {
  readonly id: string;
  readonly label: string;
  readonly state: 'idle' | 'starting' | 'ready' | 'stopping' | 'stopped' | 'failed';
  readonly leases: number;
  readonly pid: number | null;
  readonly startedAt: string | null;
  readonly stoppedAt: string | null;
  readonly error: string | null;
}
export interface ManagedServiceLifecycle {
  inspect(): readonly ManagedServiceStatus[];
  close(): Promise<void>;
}
export interface ManagedServiceLease {
  readonly signal: AbortSignal;
  release(): Promise<void>;
}
interface Entry {
  readonly id: string;
  readonly configuration: ManagedServiceConfiguration;
  readonly validate?: ValidateFunction;
  readonly subscribers: Set<AbortController>;
  state: ManagedServiceStatus['state'];
  refs: number;
  child?: ChildProcess;
  exit?: Promise<void>;
  start?: Promise<void>;
  stop?: Promise<void>;
  controller?: AbortController;
  error?: Error;
  startedAt?: string;
  stoppedAt?: string;
}
class ReadinessSchemaError extends Error {}
function errorOf(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
function listening(url: URL, signal: AbortSignal): Promise<boolean> {
  return new Promise((accept, reject) => {
    const socket = connect({
      host: url.hostname,
      port: Number(url.port || (['https:', 'wss:'].includes(url.protocol) ? 443 : 80)),
      signal,
    });
    socket.once('connect', () => {
      socket.destroy();
      accept(true);
    });
    socket.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ECONNREFUSED') accept(false);
      else reject(error);
    });
  });
}
async function probe(entry: Entry, signal: AbortSignal): Promise<void> {
  const ready = entry.configuration.readiness;
  if (ready.type === 'http_json') {
    const response = await fetch(ready.url, {
      ...(ready.headers ? { headers: ready.headers } : {}),
      redirect: 'error',
      signal,
    });
    if (!response.ok) throw new Error(`Service readiness returned HTTP ${response.status}.`);
    const body = await response.json();
    if (!entry.validate!(body))
      throw new ReadinessSchemaError(
        `Service readiness response fails its declared schema: ${JSON.stringify(entry.validate!.errors)}`,
      );
    return;
  }
  await new Promise<void>((accept, reject) => {
    signal.throwIfAborted();
    const socket = new WebSocket(ready.url);
    let opened = false;
    const abort = () => {
      socket.close();
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
    socket.addEventListener(
      'error',
      () => {
        signal.removeEventListener('abort', abort);
        reject(new Error('Service WebSocket readiness handshake failed.'));
      },
      { once: true },
    );
    socket.addEventListener(
      'open',
      () => {
        opened = true;
        socket.close(1000, 'Readiness completed');
      },
      { once: true },
    );
    socket.addEventListener(
      'close',
      (event) => {
        signal.removeEventListener('abort', abort);
        if (opened && event.code === 1000) accept();
        else reject(new Error(`Service WebSocket readiness closed with code ${event.code}.`));
      },
      { once: true },
    );
  });
}
export async function waitFor<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort: () => void;
  const interrupted = new Promise<never>((_accept, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([promise, interrupted]);
  } finally {
    signal.removeEventListener('abort', abort!);
  }
}

export class ManagedServices implements ManagedServiceLifecycle {
  private readonly entries = new Map<string, Entry>();
  private readonly leases = new Set<{
    controller: AbortController;
    release: () => Promise<void>;
  }>();
  private closed = false;
  private closing?: Promise<void>;
  constructor(configuration: unknown) {
    const definitions = managedServiceConfigurations.parse(configuration);
    const ajv = new Ajv({ strict: true, allErrors: true });
    for (const [id, definition] of Object.entries(definitions)) {
      const url = new URL(definition.readiness.url);
      if (
        !(
          definition.readiness.type === 'http_json' ? ['http:', 'https:'] : ['ws:', 'wss:']
        ).includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error(`Invalid managed service readiness URL: ${id}`);
      this.entries.set(id, {
        id,
        configuration: definition,
        state: 'idle',
        refs: 0,
        subscribers: new Set(),
        ...(definition.readiness.type === 'http_json'
          ? { validate: ajv.compile(definition.readiness.schema) }
          : {}),
      });
    }
  }
  inspect(): readonly ManagedServiceStatus[] {
    return [...this.entries.values()].map((entry) => ({
      id: entry.id,
      label: entry.configuration.label,
      state: entry.state,
      leases: entry.refs,
      pid: entry.child?.pid ?? null,
      startedAt: entry.startedAt ?? null,
      stoppedAt: entry.stoppedAt ?? null,
      error: entry.error?.message ?? null,
    }));
  }
  private fail(entry: Entry, error: unknown): void {
    entry.error = errorOf(error);
    entry.state = 'failed';
    entry.controller?.abort(entry.error);
    for (const subscriber of entry.subscribers) subscriber.abort(entry.error);
  }
  private start(entry: Entry): Promise<void> {
    if (entry.state === 'failed') return Promise.reject(entry.error);
    if (entry.state === 'stopping') return entry.stop!.then(() => this.start(entry));
    if (entry.start && ['starting', 'ready'].includes(entry.state)) return entry.start;
    entry.state = 'starting';
    entry.controller = new AbortController();
    delete entry.startedAt;
    delete entry.stoppedAt;
    const signal = AbortSignal.any([
      entry.controller.signal,
      AbortSignal.timeout(entry.configuration.startupTimeoutMs),
    ]);
    entry.start = (async () => {
      if (entry.stop) await entry.stop;
      signal.throwIfAborted();
      if (
        await listening(
          new URL(entry.configuration.readiness.url),
          AbortSignal.any([signal, AbortSignal.timeout(entry.configuration.probeTimeoutMs)]),
        )
      )
        throw new Error(`Managed service endpoint is already occupied: ${entry.id}`);
      signal.throwIfAborted();
      const child = spawn(entry.configuration.command[0]!, entry.configuration.command.slice(1), {
        cwd: entry.configuration.cwd,
        env: { ...process.env, ...entry.configuration.env },
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: process.platform !== 'win32',
      });
      entry.child = child;
      entry.startedAt = new Date().toISOString();
      entry.exit = new Promise<void>((accept) => {
        child.once('error', (error) => {
          this.fail(entry, error);
          accept();
        });
        child.once('exit', (code, exitSignal) => {
          entry.stoppedAt = new Date().toISOString();
          if (entry.state !== 'stopping')
            this.fail(
              entry,
              new Error(
                `Managed service ${entry.id} exited unexpectedly (code=${code}, signal=${exitSignal}).`,
              ),
            );
          accept();
        });
      });
      let lastProbeError: unknown;
      for (;;) {
        signal.throwIfAborted();
        try {
          await probe(
            entry,
            AbortSignal.any([signal, AbortSignal.timeout(entry.configuration.probeTimeoutMs)]),
          );
          break;
        } catch (error) {
          if (error instanceof ReadinessSchemaError || error instanceof SyntaxError) throw error;
          lastProbeError = error;
        }
        if (signal.aborted)
          throw new Error(`Managed service ${entry.id} did not become ready.`, {
            cause: lastProbeError ?? signal.reason,
          });
        await delay(entry.configuration.probeIntervalMs, undefined, { signal });
      }
      signal.throwIfAborted();
      entry.state = 'ready';
    })().catch(async (error) => {
      if (entry.state !== 'stopping' && entry.state !== 'stopped') this.fail(entry, error);
      try {
        await this.stop(entry);
      } catch (cleanup) {
        throw new AggregateError(
          [error, cleanup],
          `Managed service ${entry.id} startup and cleanup failed.`,
        );
      }
      throw error;
    });
    return entry.start;
  }
  private stop(entry: Entry): Promise<void> {
    if (entry.stop && entry.state === 'stopping') return entry.stop;
    entry.state = 'stopping';
    entry.controller?.abort(new Error(`Managed service ${entry.id} is stopping.`));
    entry.stop = (async () => {
      const child = entry.child;
      if (child?.pid && child.exitCode === null && child.signalCode === null) {
        if (process.platform === 'win32') child.kill('SIGTERM');
        else process.kill(-child.pid, 'SIGTERM');
        try {
          await waitFor(entry.exit!, AbortSignal.timeout(entry.configuration.shutdownTimeoutMs));
        } catch (error) {
          if (child.exitCode === null && child.signalCode === null) {
            if (process.platform === 'win32') child.kill('SIGKILL');
            else process.kill(-child.pid, 'SIGKILL');
            await entry.exit;
          }
          this.fail(entry, error);
          throw new Error(`Managed service ${entry.id} exceeded its graceful shutdown deadline.`, {
            cause: error,
          });
        }
      }
      delete entry.child;
      entry.state = entry.error ? 'failed' : 'stopped';
      entry.stoppedAt ??= new Date().toISOString();
    })();
    return entry.stop;
  }
  async acquire(ids: readonly string[], signal: AbortSignal): Promise<ManagedServiceLease> {
    signal.throwIfAborted();
    if (this.closed) throw new Error('Managed services are closed.');
    if (new Set(ids).size !== ids.length)
      throw new Error('Managed service lease contains duplicate identities.');
    const selected = ids.map((id) => {
      const entry = this.entries.get(id);
      if (!entry) throw new Error(`Unknown managed service: ${id}`);
      return entry;
    });
    const controller = new AbortController();
    const held: Entry[] = [];
    let releasing: Promise<void> | undefined;
    let lease: { controller: AbortController; release: () => Promise<void> };
    const release = () =>
      (releasing ??= (async () => {
        this.leases.delete(lease);
        const errors: unknown[] = [];
        for (const entry of [...held].reverse()) {
          entry.subscribers.delete(controller);
          entry.refs--;
          if (!entry.refs) {
            try {
              await this.stop(entry);
            } catch (error) {
              errors.push(error);
            }
          }
        }
        if (errors.length)
          throw new AggregateError(errors, 'Managed service lease release failed.');
      })());
    lease = { controller, release };
    this.leases.add(lease);
    try {
      for (const entry of selected) {
        if (this.closed) throw new Error('Managed services are closed.');
        entry.refs++;
        entry.subscribers.add(controller);
        held.push(entry);
        await waitFor(this.start(entry), AbortSignal.any([signal, controller.signal]));
      }
      signal.throwIfAborted();
      controller.signal.throwIfAborted();
      return { signal: controller.signal, release };
    } catch (error) {
      try {
        await release();
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Managed service admission and release failed.');
      }
      throw error;
    }
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.closing = (async () => {
      const leases = [...this.leases];
      for (const lease of leases)
        lease.controller.abort(new Error('Managed services are closing.'));
      const releases = await Promise.allSettled(leases.map((lease) => lease.release()));
      const results = await Promise.allSettled(
        [...this.entries.values()].reverse().map((entry) => this.stop(entry)),
      );
      const errors = [...releases, ...results]
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason);
      if (errors.length) throw new AggregateError(errors, 'Managed service shutdown failed.');
    })();
    return this.closing;
  }
}
