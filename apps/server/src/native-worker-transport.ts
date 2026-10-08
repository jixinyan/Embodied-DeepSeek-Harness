import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import type { ExecutionStatus, TaskScope } from '@edh/contracts';
import type { BackendFault } from '@edh/execution';
import { waitFor } from './managed-services.js';
import type { NativeWorkerConfiguration } from './native-worker-configuration.js';
import type { NativeProfileCleanup } from './native-profile-cleanup.js';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Native worker returned a non-object message.');
  return value as JsonObject;
}

const responseSchema = z.union([
  z.object({ id: z.string().min(1).max(128), result: z.json() }).strict(),
  z
    .object({
      id: z.string().min(1).max(128),
      error: z.object({ type: z.string().trim().min(1), message: z.string() }).strict(),
    })
    .strict(),
]);

const requestSchema = z
  .object({
    id: z.string().min(1).max(128),
    op: z
      .string()
      .min(1)
      .max(64)
      .refine((value) => value.trim().length > 0),
    args: z.record(z.string(), z.json()),
  })
  .strict();

export interface WorkerObservation {
  observation_id: string;
  observed_at: string;
  images: Record<string, string>;
  images_omitted?: boolean;
}

export interface WorkerPublication {
  status: ExecutionStatus;
  observation: WorkerObservation;
  diagnostic?: string;
  uncertain_actions: number;
  control?: {
    request_id: string;
    segment_id: string;
    action: number[];
    executed_actions: number;
    action_completed: boolean;
    raw_sim_steps: number;
  };
}

export interface WorkerFramePublication {
  run_task_id: string;
  execution_id: string;
  task_scope: TaskScope;
  policy_request_id: string;
  segment_id: string;
  native_step_index: number;
  simulation_time_s: number;
  observation: WorkerObservation;
}

export class NativeWorkerTransport {
  private readonly child: ChildProcess;
  private readonly pending = new Map<
    string,
    {
      operation: string;
      resolve(value: unknown): void;
      reject(error: Error): void;
      cleanup(): void;
    }
  >();
  private processing: Promise<void> = Promise.resolve();
  private listener: ((publication: WorkerPublication) => Promise<void>) | undefined;
  private frameListener: ((publication: WorkerFramePublication) => Promise<void>) | undefined;
  private policyListener: ((publication: unknown) => void) | undefined;
  private faultAdmission: ((publication: unknown) => BackendFault) | undefined;
  private faultListener: ((error: Error, publication?: BackendFault) => void) | undefined;
  private fault?: Error;
  private closeAcknowledged = false;
  private readonly exited: Promise<void>;
  private termination: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  static async create(
    configuration: NativeWorkerConfiguration,
    profileCleanup?: NativeProfileCleanup,
  ): Promise<NativeWorkerTransport> {
    const transport = new NativeWorkerTransport(configuration, profileCleanup);
    try {
      if (transport.child.pid !== undefined)
        await configuration.onProcessStarted?.(transport.child.pid);
      return transport;
    } catch (error) {
      try {
        await transport.close();
      } catch (releaseError) {
        throw new AggregateError(
          [error, releaseError],
          'Native worker startup observer and process release failed.',
        );
      }
      throw error;
    }
  }

  private constructor(
    private readonly configuration: NativeWorkerConfiguration,
    private readonly profileCleanup?: NativeProfileCleanup,
  ) {
    if (
      (configuration.env.EDH_NVIDIA_EGL_PROFILE ?? process.env.EDH_NVIDIA_EGL_PROFILE) === '1' &&
      !this.profileCleanup
    )
      throw new Error('Native worker NVIDIA profiles require a trusted cleanup binding.');
    this.child = spawn(configuration.command[0], configuration.command.slice(1), {
      cwd: configuration.cwd,
      env: { ...process.env, ...configuration.env, ...this.profileCleanup?.workerEnvironment },
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    this.exited = new Promise<void>((resolve) => {
      this.child.once('exit', () => resolve());
      this.child.once('error', () => {
        if (this.child.pid === undefined) resolve();
      });
    });
    const channel = this.child.stdio[configuration.transportFd ?? 3] as Readable;
    if (!this.child.stdin || !channel)
      throw new Error('Native worker transport pipes are unavailable.');
    this.child.stdin.on('error', (error) => this.disconnect(error));
    if ((configuration.transportFd ?? 3) !== 1)
      this.child.stdout?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
    this.child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
    const lines = createInterface({ input: channel, crlfDelay: Infinity });
    let linesClosed = false;
    lines.on('close', () => {
      linesClosed = true;
    });
    lines.on('line', (line) => {
      lines.pause();
      this.processing = this.processing
        .then(() => this.receive(line))
        .catch((error: unknown) => {
          this.disconnect(error instanceof Error ? error : new Error(String(error)));
        })
        .finally(() => {
          if (!linesClosed) lines.resume();
        });
    });
    channel.on('end', () => {
      void this.processing.finally(() =>
        this.disconnect(new Error('Native worker channel closed; device state is unknown.')),
      );
    });
    channel.on('close', () => {
      void this.processing.finally(() =>
        this.disconnect(new Error('Native worker channel closed; device state is unknown.')),
      );
    });
    channel.on('error', (error) => this.disconnect(error));
    this.child.on('error', (error) => this.disconnect(error));
    this.child.on('exit', (code, signal) => {
      void this.processing.finally(() =>
        this.disconnect(
          new Error(
            `Native worker exited (${String(code)}, ${String(signal)}); device state is unknown.`,
          ),
        ),
      );
    });
  }

  setListener(listener: ((publication: WorkerPublication) => Promise<void>) | undefined): void {
    this.listener = listener;
  }

  setFrameListener(
    listener: ((publication: WorkerFramePublication) => Promise<void>) | undefined,
  ): void {
    this.frameListener = listener;
  }

  setPolicyListener(listener: ((publication: unknown) => void) | undefined): void {
    this.policyListener = listener;
  }

  setFaultListener(
    listener: ((error: Error, publication?: BackendFault) => void) | undefined,
    admission?: (publication: unknown) => BackendFault,
  ): void {
    this.faultListener = listener;
    this.faultAdmission = admission;
  }

  get disconnected(): boolean {
    return this.fault !== undefined;
  }

  assertConnected(): void {
    if (this.fault) throw this.fault;
  }

  private disconnect(error: Error, publication?: BackendFault): void {
    if (!publication && this.closeAcknowledged && this.pending.size === 0) return;
    if (this.fault) return;
    this.fault = error;
    process.stderr.write(`Native worker transport failure: ${error.message}\n`);
    this.child.stdin?.end();
    for (const item of this.pending.values()) {
      item.cleanup();
      item.reject(error);
    }
    this.pending.clear();
    void this.terminate().catch((terminationError: unknown) => {
      process.stderr.write(`Native worker termination failure: ${String(terminationError)}\n`);
    });
    this.faultListener?.(error, publication);
  }

  private terminate(): Promise<void> {
    return (this.termination ??= (async () => {
      const alive = (): boolean => {
        if (this.child.pid === undefined) return false;
        if (process.platform === 'win32')
          return this.child.exitCode === null && this.child.signalCode === null;
        try {
          process.kill(-this.child.pid, 0);
          return true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
          throw error;
        }
      };
      const signal = (name: NodeJS.Signals): void => {
        if (!alive()) return;
        if (process.platform === 'win32') this.child.kill(name);
        else {
          try {
            process.kill(-this.child.pid!, name);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
          }
        }
      };
      const released = async (): Promise<void> => {
        const deadline = AbortSignal.timeout(15000);
        await waitFor(this.exited, deadline);
        while (alive()) await delay(50, undefined, { signal: deadline });
      };
      let terminationError: unknown;
      try {
        try {
          await released();
        } catch (gracefulError) {
          signal('SIGTERM');
          try {
            await released();
          } catch (termError) {
            signal('SIGKILL');
            let releaseError: unknown;
            try {
              await released();
            } catch (error) {
              releaseError = error;
            }
            throw new AggregateError(
              [gracefulError, termError, ...(releaseError ? [releaseError] : [])],
              'Native worker required forced process termination; device state is unknown.',
            );
          }
          throw new Error('Native worker exceeded its graceful exit deadline.', {
            cause: gracefulError,
          });
        }
      } catch (error) {
        terminationError = error;
      }
      let profileError: unknown;
      if (!alive() && this.profileCleanup) {
        try {
          await this.profileCleanup.release();
        } catch (error) {
          profileError = error;
        }
      }
      if (terminationError && profileError)
        throw new AggregateError(
          [terminationError, profileError],
          'Native worker process and NVIDIA profile release failed.',
        );
      if (terminationError) throw terminationError;
      if (profileError) throw profileError;
    })());
  }

  private async receive(line: string): Promise<void> {
    if (Buffer.byteLength(line) > 32 * 1024 * 1024)
      throw new Error('Native worker response exceeds the transport bound.');
    const message = object(JSON.parse(line));
    if (this.fault) throw new Error('Native worker published after a transport fault.');
    if (message.event === 'fault') {
      if (!this.faultAdmission) throw new Error('Native worker fault has no admitted task port.');
      const publication = this.faultAdmission(message.data);
      process.stderr.write(`Native worker fault: ${JSON.stringify(message.data)}\n`);
      this.disconnect(
        new Error(`Native worker ${publication.type}: ${publication.message}`),
        publication,
      );
      return;
    }
    if (message.event === 'policy') {
      if (!this.policyListener) throw new Error('Policy event has no admitted task port.');
      this.policyListener(message.data);
      return;
    }
    if (message.event === 'update') {
      const publication = object(message.data) as unknown as WorkerPublication;
      if (!this.listener) throw new Error('Native worker published outside an active task port.');
      await this.listener(publication);
      return;
    }
    if (message.event === 'frame') {
      const publication = object(message.data) as unknown as WorkerFramePublication;
      if (!this.frameListener) throw new Error('Native frame has no admitted session task.');
      await this.frameListener(publication);
      return;
    }
    const response = responseSchema.parse(message);
    if (!Object.hasOwn(response, 'error') && !Object.hasOwn(response, 'result'))
      throw new Error('Native worker response has no outcome.');
    const pending = this.pending.get(response.id);
    if (!pending) throw new Error('Native worker returned an unknown request ID.');
    this.pending.delete(response.id);
    pending.cleanup();
    if ('error' in response) {
      pending.reject(new Error(`Native worker ${response.error.type}: ${response.error.message}`));
    } else {
      if (pending.operation === 'close') this.closeAcknowledged = true;
      pending.resolve(response.result);
    }
  }

  request(
    operation: string,
    args: JsonObject = {},
    options: { signal?: AbortSignal | undefined; timeoutMs?: number } = {},
  ): Promise<unknown> {
    this.assertConnected();
    options.signal?.throwIfAborted();
    const timeoutMs =
      options.timeoutMs ??
      (operation === 'initialize'
        ? (this.configuration.initializeTimeoutMs ?? 180000)
        : operation === 'close'
          ? (this.configuration.closeTimeoutMs ?? 60000)
          : 60000);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 1800000)
      throw new Error('Native worker request timeout is invalid.');
    const id = randomUUID();
    const encoded = JSON.stringify(requestSchema.parse({ id, op: operation, args }));
    if (Buffer.byteLength(encoded) > 32 * 1024 * 1024)
      throw new Error('Native worker request exceeds the transport bound.');
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        if (['capture', 'check', 'measure_object', 'inspect_simulator'].includes(operation)) {
          reject(new Error(`Native worker ${operation} request cancelled.`));
          options.signal?.removeEventListener('abort', onAbort);
          return;
        }
        this.disconnect(new Error('Native worker request cancelled; device state is unknown.'));
      };
      const timer = setTimeout(
        () =>
          this.disconnect(
            new Error(`Native worker ${operation} timed out; device state is unknown.`),
          ),
        timeoutMs,
      );
      const cleanup = () => {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
      };
      this.pending.set(id, { operation, resolve, reject, cleanup });
      options.signal?.addEventListener('abort', onAbort, { once: true });
      this.child.stdin!.write(`${encoded}\n`, (error) => {
        if (error) this.disconnect(error);
      });
    });
  }

  close(): Promise<void> {
    return (this.closing ??= this.closeOwned());
  }

  private async closeOwned(): Promise<void> {
    const existingFault = this.fault;
    let requestError: unknown;
    if (!this.fault) {
      try {
        await this.request('close');
      } catch (error) {
        requestError = error;
      }
    }
    this.child.stdin?.end();
    let terminationError: unknown;
    try {
      await this.terminate();
    } catch (error) {
      terminationError = error;
    }
    const errors = [...new Set([existingFault, requestError, terminationError].filter(Boolean))];
    if (errors.length)
      throw new AggregateError(errors, 'Native worker process release was unclean.');
    if (!this.closeAcknowledged || this.child.exitCode !== 0)
      throw new Error(
        'Native worker did not confirm clean process release; device state is unknown.',
      );
  }
}
