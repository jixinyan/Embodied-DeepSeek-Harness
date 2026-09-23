import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { isDeepStrictEqual } from 'node:util';
import type {
  ContractValidator,
  ExecutionStatus,
  SubgoalRequest,
  CheckResult,
  TaskScope,
} from '@edh/contracts';
import type { EmbodiedBackend, BackendFrame, BackendUpdate, SensorSample } from '@edh/execution';
import { parseTaskCatalog, type TaskCatalogDefinition, type TaskDefinition } from '@edh/tasks';
import type { DeploymentServices, SessionEnvironment } from './deployment.js';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Native worker returned a non-object message.');
  return value as JsonObject;
}

function string(value: unknown): string {
  if (typeof value !== 'string' || !value.length)
    throw new Error('Native worker omitted a string field.');
  return value;
}

export interface NativeWorkerConfiguration {
  readonly command: readonly [string, ...string[]];
  readonly transportFd?: 1 | 3;
  readonly onProcessStarted?: (pid: number) => void;
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
  readonly provider: 'robocasa' | 'robotwin' | 'behavior';
  readonly nativeTaskId: string;
  readonly sourceRoot?: string;
  readonly sceneConfiguration: Readonly<Record<string, unknown>>;
  readonly schemaPath: string;
  readonly policyId: string;
  readonly policyUri: string;
  readonly monitorEveryActions?: number;
  readonly observationTtlS?: number;
  readonly deviceTimeoutS?: number;
  readonly policyTimeoutS?: number;
  readonly catalog: TaskCatalogDefinition;
}

interface WorkerDescription {
  provider: string;
  native_task_id: string;
  supported_check_ids: string[];
  active_view_directions: string[];
  clock_id: string;
  policy_id: string;
  task_instruction?: string | null;
  scene_metadata?: JsonObject | null;
}

interface WorkerObservation {
  observation_id: string;
  observed_at: string;
  images: Record<string, string>;
}

interface WorkerPublication {
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

interface WorkerFramePublication {
  run_task_id: string;
  execution_id: string;
  task_scope: TaskScope;
  policy_request_id: string;
  segment_id: string;
  native_step_index: number;
  simulation_time_s: number;
  observation: WorkerObservation;
}

class NativeWorkerTransport {
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
  private fault?: Error;
  private closeAcknowledged = false;

  constructor(configuration: NativeWorkerConfiguration) {
    this.child = spawn(configuration.command[0], configuration.command.slice(1), {
      cwd: configuration.cwd,
      env: { ...process.env, ...configuration.env },
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
    });
    if (this.child.pid !== undefined) configuration.onProcessStarted?.(this.child.pid);
    const channel = this.child.stdio[configuration.transportFd ?? 3] as Readable;
    if (!this.child.stdin || !channel)
      throw new Error('Native worker transport pipes are unavailable.');
    if ((configuration.transportFd ?? 3) !== 1)
      this.child.stdout?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
    this.child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
    const lines = createInterface({ input: channel, crlfDelay: Infinity });
    lines.on('line', (line) => {
      lines.pause();
      this.processing = this.processing
        .then(() => this.receive(line))
        .catch((error: unknown) => {
          this.disconnect(error instanceof Error ? error : new Error(String(error)));
        })
        .finally(() => lines.resume());
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

  get disconnected(): boolean {
    return this.fault !== undefined;
  }

  assertConnected(): void {
    if (this.fault) throw this.fault;
  }

  private disconnect(error: Error): void {
    if (this.closeAcknowledged && this.pending.size === 0) return;
    if (this.fault) return;
    this.fault = error;
    this.child.stdin?.end();
    for (const item of this.pending.values()) {
      item.cleanup();
      item.reject(error);
    }
    this.pending.clear();
    const timer = setTimeout(() => {
      if (this.child.exitCode === null && this.child.signalCode === null)
        this.child.kill('SIGTERM');
    }, 15000);
    timer.unref();
  }

  private async receive(line: string): Promise<void> {
    if (Buffer.byteLength(line) > 32 * 1024 * 1024)
      throw new Error('Native worker response exceeds the transport bound.');
    const message = object(JSON.parse(line));
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
    const id = string(message.id);
    const pending = this.pending.get(id);
    if (!pending) throw new Error('Native worker returned an unknown request ID.');
    this.pending.delete(id);
    pending.cleanup();
    if (message.error !== undefined) {
      const detail = object(message.error);
      pending.reject(new Error(`Native worker ${string(detail.type)}: ${string(detail.message)}`));
    } else {
      if (pending.operation === 'close') this.closeAcknowledged = true;
      pending.resolve(message.result);
    }
  }

  request(
    operation: string,
    args: JsonObject = {},
    options: { signal?: AbortSignal | undefined; timeoutMs?: number } = {},
  ): Promise<unknown> {
    this.assertConnected();
    options.signal?.throwIfAborted();
    const timeoutMs = options.timeoutMs ?? (operation === 'initialize' ? 180000 : 60000);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300000)
      throw new Error('Native worker request timeout is invalid.');
    const id = randomUUID();
    const encoded = JSON.stringify({ id, op: operation, args });
    if (Buffer.byteLength(encoded) > 32 * 1024 * 1024)
      throw new Error('Native worker request exceeds the transport bound.');
    return new Promise((resolve, reject) => {
      const onAbort = () =>
        this.disconnect(new Error('Native worker request cancelled; device state is unknown.'));
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

  async close(): Promise<void> {
    const existingFault = this.fault;
    let requestError: unknown;
    if (!this.fault) {
      try {
        await this.request('close', {}, { timeoutMs: 60000 });
      } catch (error) {
        requestError = error;
      }
    }
    this.child.stdin?.end();
    await new Promise<void>((resolve, reject) => {
      if (this.child.exitCode !== null || this.child.signalCode !== null) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        this.child.kill('SIGTERM');
        reject(new Error('Native worker did not exit after close; device state is unknown.'));
      }, 15000);
      this.child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    if (existingFault) throw existingFault;
    if (requestError) throw requestError;
    if (!this.closeAcknowledged || this.child.exitCode !== 0)
      throw new Error(
        'Native worker did not confirm clean process release; device state is unknown.',
      );
  }
}

class NativeTaskBackend implements EmbodiedBackend {
  readonly source = 'simulation';
  private status?: ExecutionStatus;
  private sequence = 0;
  private closed = false;
  private readonly listeners = new Set<(update: BackendUpdate) => void>();
  private readonly frameListeners = new Set<(frame: BackendFrame) => void>();

  constructor(
    private readonly transport: NativeWorkerTransport,
    private readonly images: DeploymentServices['images'],
    private readonly validator: ContractValidator,
    private readonly provider: string,
    private readonly catalogTaskId: string,
    private readonly runId: string,
    private readonly nativeTaskId: string,
    private readonly clockId: string,
    private readonly activeViews: readonly string[],
    private readonly timeouts: Readonly<{
      observationTtlS: number;
      deviceTimeoutS: number;
      policyTimeoutS: number;
    }>,
    private readonly onClose: () => void,
  ) {
    this.transport.setListener((publication) => this.publish(publication));
    this.transport.setFrameListener((publication) => this.publishFrame(publication));
  }

  private async sample(
    observation: WorkerObservation,
    status?: ExecutionStatus,
    diagnostic?: string,
    control?: WorkerPublication['control'],
    scope?: TaskScope,
    visibility: 'agent' | 'debug_only' = 'agent',
    uncertainActions = 0,
    evidenceId?: string,
  ): Promise<SensorSample> {
    const fields = object(observation);
    const frames = object(fields.images);
    const refs = [];
    for (const [camera, encoded] of Object.entries(frames)) {
      if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(camera) || typeof encoded !== 'string')
        throw new Error('Native camera frame metadata is invalid.');
      const bytes = Buffer.from(encoded, 'base64');
      if (!bytes.length || bytes.length > 1024 * 1024 || bytes.toString('base64') !== encoded)
        throw new Error('Native camera frame encoding is invalid.');
      refs.push(
        await this.images.saveImage({ data: bytes, mediaType: 'image/png', name: `${camera}.png` }),
      );
    }
    if (!refs.length || refs.length > 8)
      throw new Error('Native observation has no bounded camera frames.');
    if (
      control &&
      (!Array.isArray(control.action) ||
        !control.action.length ||
        control.action.length > 128 ||
        control.action.some((value) => typeof value !== 'number' || !Number.isFinite(value)) ||
        !Number.isSafeInteger(control.raw_sim_steps) ||
        control.raw_sim_steps < 0 ||
        !Number.isSafeInteger(control.executed_actions) ||
        control.executed_actions < 0 ||
        typeof control.action_completed !== 'boolean')
    )
      throw new Error('Native control receipt metadata is invalid.');
    const sample: SensorSample = {
      sequence: ++this.sequence,
      source: 'simulation',
      description: diagnostic
        ? `${this.provider} camera capture; ${diagnostic}`
        : `${this.provider} camera capture`,
      visualization: {
        provider: this.provider,
        catalogTaskId: this.catalogTaskId,
        runId: this.runId,
        observationId: string(fields.observation_id),
        uncertainActions,
        ...(status
          ? { executionId: status.execution_id, rawSimSteps: status.raw_sim_steps ?? 0 }
          : {}),
        ...(control
          ? {
              policyRequestId: string(control.request_id),
              segmentId: string(control.segment_id),
              actionValues: JSON.stringify(control.action),
              actionCompleted: control.action_completed,
              nativeRawSimSteps: control.raw_sim_steps,
            }
          : {}),
      },
      images: refs,
      evidence: {
        id: evidenceId ?? string(fields.observation_id),
        kind: 'image',
        source: `${this.provider}.camera`,
        created_at: string(fields.observed_at),
        visibility,
        task_scope: scope ?? status?.task_scope ?? { task_id: this.runId },
        observed_at: string(fields.observed_at),
        clock_id: status?.clock_id ?? this.clockId,
      },
    };
    this.validator.parse('EvidenceRef', sample.evidence);
    return sample;
  }

  private async publish(publication: WorkerPublication): Promise<void> {
    if (this.closed) throw new Error('Native task port received an update after close.');
    const fields = object(publication);
    const uncertainActions = fields.uncertain_actions;
    if (
      typeof uncertainActions !== 'number' ||
      !Number.isSafeInteger(uncertainActions) ||
      uncertainActions < 0
    )
      throw new Error('Native worker uncertain action count is invalid.');
    const status = this.validator.parse('ExecutionStatus', fields.status) as ExecutionStatus;
    if (status.task_scope.task_id !== this.runId)
      throw new Error('Native update belongs to another session task.');
    if (this.status) {
      if (
        status.execution_id === this.status.execution_id &&
        status.state_version <= this.status.state_version
      )
        throw new Error('Native worker replayed an execution update.');
      if (
        status.execution_id !== this.status.execution_id &&
        (this.status.state !== 'ended' ||
          !this.status.device_confirmed ||
          status.state_version !== 1)
      )
        throw new Error('Native worker changed execution without a confirmed task boundary.');
    }
    const sample = await this.sample(
      fields.observation as WorkerObservation,
      status,
      typeof fields.diagnostic === 'string' ? fields.diagnostic : undefined,
      fields.control as WorkerPublication['control'],
      undefined,
      'agent',
      uncertainActions,
    );
    this.status = structuredClone(status);
    for (const listener of this.listeners) listener({ status: structuredClone(status), sample });
  }

  private async publishFrame(publication: WorkerFramePublication): Promise<void> {
    if (this.closed || !this.frameListeners.size || !this.status)
      throw new Error('Native frame arrived without an active run subscriber.');
    const fields = object(publication) as unknown as WorkerFramePublication;
    const scope = this.validator.parse('TaskScope', fields.task_scope) as TaskScope;
    if (
      fields.run_task_id !== this.runId ||
      scope.task_id !== this.runId ||
      !isDeepStrictEqual(scope, this.status.task_scope) ||
      fields.execution_id !== this.status.execution_id
    )
      throw new Error('Native frame belongs to another run or execution.');
    if (
      !Number.isSafeInteger(fields.native_step_index) ||
      fields.native_step_index < 1 ||
      typeof fields.simulation_time_s !== 'number' ||
      !Number.isFinite(fields.simulation_time_s) ||
      fields.simulation_time_s < 0
    )
      throw new Error('Native frame step index or simulation time is invalid.');
    const sample = await this.sample(
      fields.observation as WorkerObservation,
      undefined,
      undefined,
      undefined,
      scope,
      'debug_only',
      0,
      `frame:${string(object(fields.observation).observation_id)}`,
    );
    const frame: BackendFrame = {
      sample: {
        ...sample,
        visualization: {
          ...sample.visualization,
          executionId: string(fields.execution_id),
          policyRequestId: string(fields.policy_request_id),
          segmentId: string(fields.segment_id),
          nativeStepIndex: fields.native_step_index,
          simulationTimeS: fields.simulation_time_s,
        },
      },
      runId: this.runId,
      executionId: string(fields.execution_id),
      policyRequestId: string(fields.policy_request_id),
      segmentId: string(fields.segment_id),
      nativeStepIndex: fields.native_step_index,
      simulationTimeS: fields.simulation_time_s,
    };
    for (const listener of this.frameListeners) listener(frame);
  }

  async start(
    request: SubgoalRequest,
    options?: { signal?: AbortSignal },
  ): Promise<ExecutionStatus> {
    options?.signal?.throwIfAborted();
    if (
      this.closed ||
      request.task_id !== this.runId ||
      (this.status && (this.status.state !== 'ended' || !this.status.device_confirmed))
    )
      throw new Error('Native task port cannot start this execution.');
    this.validator.parse('SubgoalRequest', request);
    const result = object(
      await this.transport.request(
        'start',
        {
          request: structuredClone(request),
          native_task_id: this.nativeTaskId,
          observation_ttl_s: this.timeouts.observationTtlS,
          device_timeout_s: this.timeouts.deviceTimeoutS,
          policy_timeout_s: this.timeouts.policyTimeoutS,
        },
        { signal: options?.signal },
      ),
    );
    options?.signal?.throwIfAborted();
    const status = this.validator.parse('ExecutionStatus', result.status) as ExecutionStatus;
    if (this.query()?.execution_id !== status.execution_id)
      throw new Error('Native worker did not publish the started execution.');
    return status;
  }

  query(): ExecutionStatus | undefined {
    this.transport.assertConnected();
    return this.status ? structuredClone(this.status) : undefined;
  }

  async capture(options?: { signal?: AbortSignal }): Promise<SensorSample> {
    options?.signal?.throwIfAborted();
    const result = object(
      await this.transport.request(
        'capture',
        { run_task_id: this.runId },
        { signal: options?.signal },
      ),
    );
    options?.signal?.throwIfAborted();
    if (result.run_task_id !== this.runId)
      throw new Error('Native capture belongs to another session task.');
    return this.sample(result.observation as WorkerObservation);
  }

  async turnView(
    direction: 'left' | 'center' | 'right',
    options?: { signal?: AbortSignal },
  ): Promise<SensorSample> {
    if (!this.activeViews.includes(direction))
      throw new Error('Native provider does not support this active view.');
    options?.signal?.throwIfAborted();
    const result = object(
      await this.transport.request('turn_view', { direction }, { signal: options?.signal }),
    );
    options?.signal?.throwIfAborted();
    if (result.run_task_id !== this.runId)
      throw new Error('Native active view belongs to another session task.');
    return this.sample(result.observation as WorkerObservation);
  }

  async pause(): Promise<void> {
    if (!this.status) throw new Error('Native execution has not started.');
    await this.transport.request('pause', { execution_id: this.status.execution_id });
  }

  async resume(
    ownerId: string,
    options: { executionId: string; boundaryId: string; stateVersion: number },
  ): Promise<void> {
    await this.transport.request('resume', {
      owner_id: ownerId,
      execution_id: options.executionId,
      boundary_id: options.boundaryId,
      state_version: options.stateVersion,
    });
  }

  async stop(): Promise<void> {
    if (!this.status) return;
    await this.transport.request('stop', { execution_id: this.status.execution_id });
  }

  async check(
    checkIds: readonly string[],
    options?: { executionId: string; boundaryId: string; signal?: AbortSignal },
  ): Promise<{ sample: SensorSample; facts: CheckResult[] }> {
    if (!options) throw new Error('Native checks require an execution boundary.');
    options.signal?.throwIfAborted();
    const result = object(
      await this.transport.request(
        'check',
        {
          execution_id: options.executionId,
          boundary_id: options.boundaryId,
          check_ids: [...checkIds],
        },
        { signal: options.signal },
      ),
    );
    options.signal?.throwIfAborted();
    const sample = await this.sample(result.observation as WorkerObservation, this.status);
    const facts = (result.facts as unknown[]).map((item) => {
      const fact = object(item);
      const mapped: CheckResult = {
        check_id: string(fact.check_id),
        value: fact.value as boolean | null,
        evidence_refs: [sample.evidence.id],
        ...(fact.reason === null ? {} : { reason: string(fact.reason) }),
      };
      return this.validator.parse('CheckResult', mapped) as CheckResult;
    });
    return { sample, facts };
  }

  subscribe(listener: (update: BackendUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeFrames(listener: (frame: BackendFrame) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    await this.transport.request('close_task');
    this.closed = true;
    this.transport.setListener(undefined);
    this.transport.setFrameListener(undefined);
    this.onClose();
  }
}

export async function createNativeWorkerEnvironment(
  configuration: NativeWorkerConfiguration,
  services: DeploymentServices,
  validator: ContractValidator,
): Promise<SessionEnvironment> {
  parseTaskCatalog(configuration.catalog, validator);
  if (Object.keys(configuration.catalog.tasks).length !== 1)
    throw new Error('Native session must bind exactly one catalog task.');
  const timeouts = {
    observationTtlS: configuration.observationTtlS ?? 30,
    deviceTimeoutS: configuration.deviceTimeoutS ?? 30,
    policyTimeoutS: configuration.policyTimeoutS ?? 30,
  };
  if (Object.values(timeouts).some((value) => !Number.isFinite(value) || value <= 0 || value > 300))
    throw new Error('Native policy and device timeouts must be positive and at most 300 seconds.');
  const transport = new NativeWorkerTransport(configuration);
  try {
    const description = object(
      await transport.request('initialize', {
        provider: configuration.provider,
        native_task_id: configuration.nativeTaskId,
        policy_uri: configuration.policyUri,
        policy_id: configuration.policyId,
        scene_configuration: configuration.sceneConfiguration,
        schema_path: configuration.schemaPath,
        monitor_every_actions: configuration.monitorEveryActions ?? 1,
        ...(configuration.sourceRoot ? { source_root: configuration.sourceRoot } : {}),
      }),
    ) as unknown as WorkerDescription;
    if (
      description.provider !== configuration.provider ||
      description.native_task_id !== configuration.nativeTaskId ||
      description.policy_id !== configuration.policyId
    )
      throw new Error('Native worker initialized a different provider or task.');
    const nativeInstruction = description.task_instruction;
    const sceneMetadata = description.scene_metadata;
    if (
      typeof nativeInstruction !== 'string' ||
      !nativeInstruction.trim() ||
      nativeInstruction.length > 4000 ||
      !sceneMetadata ||
      typeof sceneMetadata !== 'object' ||
      Array.isArray(sceneMetadata)
    )
      throw new Error('Native task instruction or scene metadata is unavailable.');
    const resolvedCatalog: TaskCatalogDefinition = {
      revision: `${configuration.catalog.revision}-${createHash('sha256')
        .update(JSON.stringify(sceneMetadata))
        .digest('hex')
        .slice(0, 16)}`,
      tasks: Object.fromEntries(
        Object.entries(configuration.catalog.tasks).map(([id, task]) => [
          id,
          {
            ...task,
            instruction: nativeInstruction,
            goal: { ...task.goal, configuration: JSON.stringify(sceneMetadata) },
          },
        ]),
      ),
    };
    parseTaskCatalog(resolvedCatalog, validator);
    const checks = new Set(description.supported_check_ids);
    for (const task of Object.values(resolvedCatalog.tasks)) {
      for (const goal of [task.goal, ...(task.predefinedGoals ?? [])]) {
        const success =
          'all' in goal.successContract ? goal.successContract.all : goal.successContract.any;
        if (success.some((check) => !checks.has(check.check_id)))
          throw new Error('Session task catalog names an unsupported native check.');
      }
      if (task.allowedSubgoalChecks?.some((check) => !checks.has(check.check_id)))
        throw new Error('Session task catalog allows an unsupported native subgoal check.');
    }
    let active: NativeTaskBackend | undefined;
    return {
      describeTasks: () => structuredClone(resolvedCatalog),
      async createTaskBackend(
        taskId: string,
        options: { signal: AbortSignal; runId: string; task?: TaskDefinition },
      ) {
        options.signal.throwIfAborted();
        if (
          active ||
          !Object.hasOwn(resolvedCatalog.tasks, taskId) ||
          (options.task !== undefined &&
            !isDeepStrictEqual(options.task, resolvedCatalog.tasks[taskId]))
        )
          throw new Error('Native session task is unavailable.');
        await transport.request(
          'open_task',
          {
            catalog_task_id: taskId,
            run_task_id: options.runId,
            native_task_id: configuration.nativeTaskId,
          },
          { signal: options.signal },
        );
        active = new NativeTaskBackend(
          transport,
          services.images,
          validator,
          configuration.provider,
          taskId,
          options.runId,
          configuration.nativeTaskId,
          description.clock_id,
          description.active_view_directions,
          timeouts,
          () => {
            active = undefined;
          },
        );
        return active;
      },
      async close() {
        let taskError: unknown;
        try {
          await active?.close();
        } catch (error) {
          taskError = error;
        }
        try {
          await transport.close();
        } catch (error) {
          if (taskError)
            throw new AggregateError([taskError, error], 'Native session cleanup failed.');
          throw error;
        }
        if (taskError) throw taskError;
      },
    };
  } catch (error) {
    try {
      await transport.close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Native session initialization and cleanup failed.',
      );
    }
    throw error;
  }
}
