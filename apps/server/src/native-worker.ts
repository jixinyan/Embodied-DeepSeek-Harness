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
import {
  readPolicyEvent,
  type BackendPolicyEvent,
  type BackendCallOptions,
  type BackendObjectMeasurementInput,
  type BackendObjectMeasurement,
  type BackendRotationResult,
  type BackendRotationMotion,
  type EmbodiedBackend,
  type BackendFrame,
  type BackendUpdate,
  type SensorSample,
} from '@edh/execution';
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
  readonly provider: 'robocasa' | 'robotwin' | 'behavior' | 'robodojo';
  readonly nativeTaskId: string;
  readonly sourceRoot?: string;
  readonly sceneConfiguration: Readonly<Record<string, unknown>>;
  readonly schemaPath: string;
  readonly policyId: string;
  readonly policyUri: string;
  /** `policy` for learned action chunks, `direct` or `hybrid` for GPT-backed gateways. */
  readonly executionMode?: 'policy' | 'direct' | 'hybrid';
  readonly policyMaxActionsPerInference?: number;
  readonly monitorEveryActions?: number;
  readonly publishRunningImages?: boolean;
  readonly recordSimulationFrames?: boolean;
  readonly simulationVideoDirectory?: string;
  readonly observationTtlS?: number;
  readonly deviceTimeoutS?: number;
  readonly policyTimeoutS?: number;
  readonly toolTimeoutMs?: number;
  readonly transportWriteTimeoutS?: number;
  readonly initializeTimeoutMs?: number;
  readonly closeTimeoutMs?: number;
  readonly catalog: TaskCatalogDefinition;
}

interface WorkerDescription {
  provider: string;
  native_task_id: string;
  supported_check_ids: string[];
  active_view_directions: string[];
  rotation_axes: string[];
  clock_id: string;
  policy_id: string;
  execution_mode: 'policy' | 'direct' | 'hybrid';
  task_instruction?: string | null;
  scene_metadata?: JsonObject | null;
  supports_object_measurement: boolean;
}

function metricNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('Native object measurement omitted a finite numeric field.');
  return value;
}

function metricVector(value: unknown, size: number): number[] {
  if (!Array.isArray(value) || value.length !== size)
    throw new Error('Native object measurement returned an invalid vector.');
  return value.map(metricNumber);
}

function metricMatrix(value: unknown, size: number): number[][] {
  if (!Array.isArray(value) || value.length !== size)
    throw new Error('Native object measurement returned an invalid matrix.');
  return value.map((row) => metricVector(row, size));
}

function objectMeasurement(
  value: unknown,
  input: BackendObjectMeasurementInput,
): BackendObjectMeasurement {
  const result = object(value);
  const intrinsics = object(result.intrinsics);
  if (
    result.provider !== 'robocasa' ||
    result.source !== 'robocasa-native-rgbd' ||
    result.measurement_kind !== 'simulator_metric_depth' ||
    result.unit !== 'meter' ||
    result.distance_frame !== 'camera_axial_depth' ||
    result.centroid_kind !== 'mean_of_visible_valid_surface_points' ||
    result.observation_id !== input.observationId ||
    result.camera !== input.camera ||
    result.camera_frame !== `robocasa.${input.camera}.optical` ||
    result.world_frame !== 'robocasa.mujoco.world' ||
    result.source_image_sha256 !== input.sourceImageSha256 ||
    result.mask_png_sha256 !==
      createHash('sha256').update(Buffer.from(input.maskPngBase64, 'base64')).digest('hex') ||
    !isDeepStrictEqual(result.coordinate_axes, ['right', 'down', 'forward'])
  )
    throw new Error('Native object measurement source or coordinate identity is invalid.');
  const measurement: BackendObjectMeasurement = {
    provider: 'robocasa',
    source: 'robocasa-native-rgbd',
    measurementKind: 'simulator_metric_depth',
    unit: 'meter',
    distanceFrame: 'camera_axial_depth',
    centroidKind: 'mean_of_visible_valid_surface_points',
    cameraFrame: string(result.camera_frame),
    worldFrame: string(result.world_frame),
    coordinateAxes: ['right', 'down', 'forward'],
    observationId: input.observationId,
    measurementCaptureId: string(result.measurement_capture_id),
    camera: input.camera,
    sourceImageSha256: input.sourceImageSha256,
    maskPngSha256: string(result.mask_png_sha256),
    measuredAt: string(result.measured_at),
    simulationTimeS: metricNumber(result.simulation_time_s),
    width: metricNumber(result.width),
    height: metricNumber(result.height),
    selectedPixels: metricNumber(result.selected_pixels),
    validPixels: metricNumber(result.valid_pixels),
    invalidPixels: metricNumber(result.invalid_pixels),
    validFraction: metricNumber(result.valid_fraction),
    medianAxialDepthM: metricNumber(result.median_axial_depth_m),
    p10AxialDepthM: metricNumber(result.p10_axial_depth_m),
    p90AxialDepthM: metricNumber(result.p90_axial_depth_m),
    medianCameraRangeM: metricNumber(result.median_camera_range_m),
    centroidPixel: metricVector(result.centroid_pixel, 2) as [number, number],
    centroidCameraXYZ: metricVector(result.centroid_camera_xyz, 3) as [number, number, number],
    centroidWorldXYZ: metricVector(result.centroid_world_xyz, 3) as [number, number, number],
    intrinsics: {
      calibrationId: string(intrinsics.calibration_id),
      fx: metricNumber(intrinsics.fx),
      fy: metricNumber(intrinsics.fy),
      cx: metricNumber(intrinsics.cx),
      cy: metricNumber(intrinsics.cy),
    },
    intrinsicMatrix: metricMatrix(result.intrinsic_matrix, 3),
    cameraToWorld: metricMatrix(result.camera_to_world, 4),
    minimumDepthM: metricNumber(result.minimum_depth_m),
    maximumDepthM: metricNumber(result.maximum_depth_m),
  };
  if (
    ![
      measurement.width,
      measurement.height,
      measurement.selectedPixels,
      measurement.validPixels,
      measurement.invalidPixels,
    ].every(Number.isSafeInteger) ||
    measurement.width < 1 ||
    measurement.height < 1 ||
    measurement.width * measurement.height > 4_000_000 ||
    measurement.selectedPixels < 1 ||
    measurement.selectedPixels > measurement.width * measurement.height ||
    measurement.validPixels < 1 ||
    measurement.invalidPixels < 0 ||
    measurement.validPixels + measurement.invalidPixels !== measurement.selectedPixels ||
    measurement.validFraction !== measurement.validPixels / measurement.selectedPixels ||
    measurement.simulationTimeS < 0 ||
    measurement.minimumDepthM <= 0 ||
    measurement.maximumDepthM <= measurement.minimumDepthM ||
    measurement.p10AxialDepthM <= measurement.minimumDepthM ||
    measurement.p10AxialDepthM > measurement.medianAxialDepthM ||
    measurement.medianAxialDepthM > measurement.p90AxialDepthM ||
    measurement.p90AxialDepthM >= measurement.maximumDepthM ||
    measurement.medianCameraRangeM < measurement.medianAxialDepthM ||
    measurement.intrinsics.fx <= 0 ||
    measurement.intrinsics.fy <= 0 ||
    !/^[a-f0-9]{64}$/.test(measurement.intrinsics.calibrationId) ||
    !Number.isFinite(Date.parse(measurement.measuredAt))
  )
    throw new Error('Native object measurement statistics are invalid.');
  return measurement;
}

interface WorkerObservation {
  observation_id: string;
  observed_at: string;
  images: Record<string, string>;
  images_omitted?: boolean;
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
  private policyListener: ((publication: unknown) => void) | undefined;
  private fault?: Error;
  private closeAcknowledged = false;

  constructor(private readonly configuration: NativeWorkerConfiguration) {
    for (const timeout of [configuration.initializeTimeoutMs, configuration.closeTimeoutMs]) {
      if (
        timeout !== undefined &&
        (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 1800000)
      )
        throw new Error('Native worker lifecycle timeout is invalid.');
    }
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
    process.stderr.write(`Native worker transport failure: ${error.message}\n`);
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
    const encoded = JSON.stringify({ id, op: operation, args });
    if (Buffer.byteLength(encoded) > 32 * 1024 * 1024)
      throw new Error('Native worker request exceeds the transport bound.');
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        if (operation === 'capture' || operation === 'check' || operation === 'measure_object') {
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

  async close(): Promise<void> {
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
  readonly measureObject?: (
    input: BackendObjectMeasurementInput,
    options?: BackendCallOptions,
  ) => Promise<BackendObjectMeasurement>;
  private status?: ExecutionStatus;
  private sequence = 0;
  private closed = false;
  private readonly listeners = new Set<(update: BackendUpdate) => void>();
  private readonly frameListeners = new Set<(frame: BackendFrame) => void>();
  private readonly policyListeners = new Set<(event: BackendPolicyEvent) => void>();
  private lastFrameImages?: {
    observationId: string;
    observedAt: string;
    encodedImages: Record<string, string>;
    refs: NonNullable<SensorSample['images']>;
  };

  constructor(
    private readonly transport: NativeWorkerTransport,
    private readonly images: DeploymentServices['images'],
    private readonly validator: ContractValidator,
    private readonly provider: string,
    private readonly catalogTaskId: string,
    private readonly runId: string,
    private readonly nativeTaskId: string,
    private readonly clockId: string,
    readonly activeViewDirections: readonly ('left' | 'center' | 'right')[],
    readonly rotationAxes: readonly ('yaw' | 'pitch')[],
    supportsObjectMeasurement: boolean,
    private readonly timeouts: Readonly<{
      observationTtlS: number;
      deviceTimeoutS: number;
      policyTimeoutS: number;
    }>,
    readonly toolTimeoutMs: number,
    private readonly onClose: () => void,
  ) {
    if (supportsObjectMeasurement) {
      if (this.provider !== 'robocasa')
        throw new Error('Native provider advertised unsupported object measurement.');
      this.measureObject = async (input, options) => {
        options?.signal?.throwIfAborted();
        if (
          this.closed ||
          !input.observationId ||
          input.observationId.length > 128 ||
          !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(input.camera) ||
          !/^[a-f0-9]{64}$/.test(input.sourceImageSha256) ||
          !input.maskPngBase64 ||
          input.maskPngBase64.length > 8 * 1024 * 1024
        )
          throw new Error('Native object measurement input is invalid.');
        const result = object(
          await this.transport.request(
            'measure_object',
            {
              run_task_id: this.runId,
              observation_id: input.observationId,
              camera: input.camera,
              source_image_sha256: input.sourceImageSha256,
              mask_png_base64: input.maskPngBase64,
            },
            { signal: options?.signal },
          ),
        );
        options?.signal?.throwIfAborted();
        if (this.closed || result.run_task_id !== this.runId)
          throw new Error('Native object measurement belongs to another session task.');
        return objectMeasurement(result.measurement, input);
      };
    }
    this.transport.setListener((publication) => this.publish(publication));
    this.transport.setFrameListener((publication) => this.publishFrame(publication));
    this.transport.setPolicyListener((publication) => {
      const event = readPolicyEvent(publication, this.validator);
      if (
        this.closed ||
        !this.status ||
        event.taskScope.task_id !== this.runId ||
        event.executionId !== this.status.execution_id ||
        !isDeepStrictEqual(event.taskScope, this.status.task_scope)
      )
        throw new Error('Policy event belongs to another run or execution.');
      for (const listener of this.policyListeners) listener(event);
    });
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
    const observationId = string(fields.observation_id);
    const observedAt = string(fields.observed_at);
    const cached = this.lastFrameImages;
    let refs: NonNullable<SensorSample['images']>;
    const entries = Object.entries(object(fields.images));
    const imagesOmitted = fields.images_omitted === true;
    if (
      entries.length > 8 ||
      (!entries.length && !imagesOmitted) ||
      (imagesOmitted && (entries.length > 0 || !status || status.state !== 'running'))
    )
      throw new Error('Native observation has no bounded camera frames.');
    const reuseFrameImages =
      visibility === 'agent' &&
      cached?.observationId === observationId &&
      cached.observedAt === observedAt &&
      entries.length === Object.keys(cached.encodedImages).length &&
      entries.every(([camera, encoded]) => cached.encodedImages[camera] === encoded);
    if (reuseFrameImages) {
      refs = structuredClone(cached.refs);
    } else {
      const inputs = entries.map(([camera, encoded]) => {
        if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(camera) || typeof encoded !== 'string')
          throw new Error('Native camera frame metadata is invalid.');
        const bytes = Buffer.from(encoded, 'base64');
        if (!bytes.length || bytes.length > 1024 * 1024 || bytes.toString('base64') !== encoded)
          throw new Error('Native camera frame encoding is invalid.');
        return { data: bytes, mediaType: 'image/png' as const, name: `${camera}.png` };
      });
      refs = await this.images.saveImages(inputs);
      if (visibility === 'debug_only')
        this.lastFrameImages = {
          observationId,
          observedAt,
          encodedImages: Object.fromEntries(entries) as Record<string, string>,
          refs: structuredClone(refs),
        };
    }
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
      description: `${this.provider} ${imagesOmitted ? 'execution observation metadata' : 'camera capture'}${diagnostic ? `; ${diagnostic}` : ''}`,
      visualization: {
        provider: this.provider,
        catalogTaskId: this.catalogTaskId,
        runId: this.runId,
        observationId,
        uncertainActions,
        activeObservationSupported: this.activeViewDirections.length > 0,
        activeViewDirections: this.activeViewDirections.join(', '),
        rotationAxes: this.rotationAxes.join(', '),
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
        id:
          evidenceId ??
          (imagesOmitted ? `${observationId}:status:${status!.state_version}` : observationId),
        kind: imagesOmitted ? 'event' : 'image',
        source: `${this.provider}.${imagesOmitted ? 'execution' : 'camera'}`,
        created_at: observedAt,
        visibility,
        task_scope: scope ?? status?.task_scope ?? { task_id: this.runId },
        observed_at: observedAt,
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
    const observationId = string(object(fields.observation).observation_id);
    if (status.observation_refs.some((reference) => reference !== observationId))
      throw new Error('Native execution references an unpublished observation.');
    const publishedStatus = {
      ...status,
      observation_refs: status.observation_refs.map(() => sample.evidence.id),
    };
    this.status = structuredClone(publishedStatus);
    for (const listener of this.listeners)
      listener({ status: structuredClone(publishedStatus), sample });
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
    const published = this.query();
    if (!published || published.execution_id !== status.execution_id)
      throw new Error('Native worker did not publish the started execution.');
    return published;
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
    if (!this.activeViewDirections.includes(direction))
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

  async rotateView(
    yawDeg: number,
    pitchDeg: number,
    options?: BackendCallOptions,
  ): Promise<BackendRotationResult> {
    if (
      !Number.isFinite(yawDeg) ||
      !Number.isFinite(pitchDeg) ||
      Math.abs(yawDeg) > 90 ||
      Math.abs(pitchDeg) > 45 ||
      (!this.rotationAxes.includes('yaw') && yawDeg !== 0) ||
      (!this.rotationAxes.includes('pitch') && pitchDeg !== 0)
    )
      throw new Error('Requested rotation exceeds the device capability.');
    const result = object(
      await this.transport.request(
        'rotate_view',
        {
          run_task_id: this.runId,
          yaw_deg: yawDeg,
          pitch_deg: pitchDeg,
        },
        { signal: options?.signal },
      ),
    );
    options?.signal?.throwIfAborted();
    if (result.run_task_id !== this.runId)
      throw new Error('Native rotation belongs to another session task.');
    const motion = object(result.motion);
    for (const name of [
      'requested_yaw_deg',
      'requested_pitch_deg',
      'achieved_yaw_deg',
      'achieved_pitch_deg',
      'before_yaw_deg',
      'after_yaw_deg',
      'before_pitch_deg',
      'after_pitch_deg',
    ])
      metricNumber(motion[name]);
    for (const name of ['before_position', 'after_position']) {
      const position = motion[name];
      if (!Array.isArray(position) || position.length !== 3)
        throw new Error('Native rotation position is invalid.');
      position.forEach(metricNumber);
    }
    for (const name of ['control_steps', 'raw_sim_steps'])
      if (!Number.isSafeInteger(motion[name]) || (motion[name] as number) < 0)
        throw new Error('Native rotation counters are invalid.');
    if (
      motion.requested_yaw_deg !== yawDeg ||
      motion.requested_pitch_deg !== pitchDeg ||
      !['completed', 'stalled', 'budget_exhausted', 'cancelled', 'episode_terminated'].includes(
        string(motion.stop_reason),
      )
    )
      throw new Error('Native rotation receipt differs from its request.');
    return {
      sample: await this.sample(result.observation as WorkerObservation),
      motion: motion as unknown as BackendRotationMotion,
    };
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
  subscribePolicyEvents(listener: (event: BackendPolicyEvent) => void): () => void {
    this.policyListeners.add(listener);
    return () => this.policyListeners.delete(listener);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    await this.transport.request('close_task');
    this.closed = true;
    this.transport.setListener(undefined);
    this.transport.setFrameListener(undefined);
    this.transport.setPolicyListener(undefined);
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
  const toolTimeoutMs = configuration.toolTimeoutMs ?? 120_000;
  if (!Number.isSafeInteger(toolTimeoutMs) || toolTimeoutMs <= 60_000 || toolTimeoutMs > 1_800_000)
    throw new Error('Native tool timeout must exceed 60000 ms and be at most 1800000 ms.');
  const transportWriteTimeoutS = configuration.transportWriteTimeoutS ?? 30;
  if (
    !Number.isFinite(transportWriteTimeoutS) ||
    transportWriteTimeoutS <= 0 ||
    transportWriteTimeoutS > 60
  )
    throw new Error('Native transport write timeout must be positive and at most 60 seconds.');
  const policyMaxActionsPerInference = configuration.policyMaxActionsPerInference ?? 512;
  if (
    !Number.isSafeInteger(policyMaxActionsPerInference) ||
    policyMaxActionsPerInference < 1 ||
    policyMaxActionsPerInference > 512
  )
    throw new Error('Native policy action limit must contain 1 to 512 control commands.');
  const transport = new NativeWorkerTransport(configuration);
  try {
    const description = object(
      await transport.request('initialize', {
        provider: configuration.provider,
        native_task_id: configuration.nativeTaskId,
        policy_uri: configuration.policyUri,
        policy_id: configuration.policyId,
        transport_write_timeout_s: transportWriteTimeoutS,
        execution_mode: configuration.executionMode ?? 'policy',
        scene_configuration: configuration.sceneConfiguration,
        schema_path: configuration.schemaPath,
        policy_max_actions_per_inference: policyMaxActionsPerInference,
        monitor_every_actions: configuration.monitorEveryActions ?? 1,
        publish_running_images: configuration.publishRunningImages ?? false,
        record_simulation_frames: configuration.recordSimulationFrames ?? false,
        ...(configuration.simulationVideoDirectory
          ? { simulation_video_directory: configuration.simulationVideoDirectory }
          : {}),
        ...(configuration.sourceRoot ? { source_root: configuration.sourceRoot } : {}),
      }),
    ) as unknown as WorkerDescription;
    if (
      description.provider !== configuration.provider ||
      description.native_task_id !== configuration.nativeTaskId ||
      description.policy_id !== configuration.policyId ||
      description.execution_mode !== (configuration.executionMode ?? 'policy')
    )
      throw new Error('Native worker initialized a different provider or task.');
    if (
      typeof description.supports_object_measurement !== 'boolean' ||
      description.supports_object_measurement !== (configuration.provider === 'robocasa')
    )
      throw new Error('Native worker object measurement capability is invalid.');
    if (
      !Array.isArray(description.active_view_directions) ||
      description.active_view_directions.some(
        (direction) => !['left', 'center', 'right'].includes(direction),
      ) ||
      new Set(description.active_view_directions).size !== description.active_view_directions.length
    )
      throw new Error('Native worker active observation capability is invalid.');
    const activeViewDirections = Object.freeze([...description.active_view_directions] as (
      | 'left'
      | 'center'
      | 'right'
    )[]);
    if (
      !Array.isArray(description.rotation_axes) ||
      description.rotation_axes.some((axis) => !['yaw', 'pitch'].includes(axis)) ||
      new Set(description.rotation_axes).size !== description.rotation_axes.length
    )
      throw new Error('Native worker rotation capability is invalid.');
    const rotationAxes = Object.freeze([...description.rotation_axes] as ('yaw' | 'pitch')[]);
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
    const sceneRevision = createHash('sha256')
      .update(JSON.stringify(sceneMetadata))
      .digest('hex')
      .slice(0, 16);
    const actionLimitRevision =
      configuration.policyMaxActionsPerInference === undefined
        ? ''
        : `-ac${policyMaxActionsPerInference}`;
    const resolvedCatalog: TaskCatalogDefinition = {
      revision: `${configuration.catalog.revision}-${sceneRevision}${actionLimitRevision}`,
      tasks: Object.fromEntries(
        Object.entries(configuration.catalog.tasks).map(([id, task]) => [
          id,
          {
            ...task,
            instruction: nativeInstruction,
            goal: {
              ...task.goal,
              configuration: JSON.stringify({
                ...sceneMetadata,
                task_instruction: nativeInstruction,
              }),
            },
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
          activeViewDirections,
          rotationAxes,
          description.supports_object_measurement,
          timeouts,
          toolTimeoutMs,
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
