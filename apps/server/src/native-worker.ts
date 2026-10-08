import { createHash, randomUUID } from 'node:crypto';
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
  type BackendFault,
  type BackendCallOptions,
  type BackendReviewOptions,
  type BackendInspectionResult,
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
import {
  validateNativeWorkerConfiguration,
  type NativeWorkerConfiguration,
} from './native-worker-configuration.js';
import {
  NativeWorkerTransport,
  type WorkerObservation,
  type WorkerPublication,
  type WorkerFramePublication,
} from './native-worker-transport.js';
import { NativeProfileCleanup } from './native-profile-cleanup.js';

export type { NativeWorkerConfiguration } from './native-worker-configuration.js';

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

interface WorkerDescription {
  provider: string;
  native_task_id: string;
  supported_check_ids: string[];
  active_view_directions: string[];
  rotation_axes: string[];
  clock_id: string;
  policy_id: string;
  policy_checkpoint_sha256?: string;
  execution_mode: 'policy' | 'direct' | 'hybrid';
  task_instruction?: string | null;
  scene_metadata?: JsonObject | null;
  supports_object_measurement: boolean;
  supports_simulator_inspection: boolean;
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
  provider: string,
): BackendObjectMeasurement {
  const result = object(value);
  const intrinsics = object(result.intrinsics);
  const worldFrames = {
    robocasa: 'robocasa.mujoco.world',
    robotwin: 'robotwin.sapien.world',
    behavior: 'behavior.omnigibson.world',
    robodojo: 'robodojo.isaac.world',
  } as const;
  if (!(provider in worldFrames)) throw new Error('Native metric provider is unsupported.');
  const metricProvider = provider as BackendObjectMeasurement['provider'];
  const source = `${metricProvider}-native-rgbd` as BackendObjectMeasurement['source'];
  if (
    result.provider !== metricProvider ||
    result.source !== source ||
    result.measurement_kind !== 'simulator_metric_depth' ||
    result.unit !== 'meter' ||
    result.distance_frame !== 'camera_axial_depth' ||
    result.centroid_kind !== 'mean_of_visible_valid_surface_points' ||
    result.observation_id !== input.observationId ||
    result.camera !== input.camera ||
    result.camera_frame !== `${metricProvider}.${input.camera}.optical` ||
    result.world_frame !== worldFrames[metricProvider] ||
    result.source_image_sha256 !== input.sourceImageSha256 ||
    result.mask_png_sha256 !==
      createHash('sha256').update(Buffer.from(input.maskPngBase64, 'base64')).digest('hex') ||
    !isDeepStrictEqual(result.coordinate_axes, ['right', 'down', 'forward'])
  )
    throw new Error('Native object measurement source or coordinate identity is invalid.');
  const measurement: BackendObjectMeasurement = {
    provider: metricProvider,
    source,
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

class NativeTaskBackend implements EmbodiedBackend {
  readonly source = 'simulation';
  readonly inspectSimulator?: (
    checkIds: readonly string[],
    options: BackendReviewOptions,
  ) => Promise<BackendInspectionResult>;
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
  private readonly faultListeners = new Set<(fault: BackendFault) => void>();
  private activeRequest?: SubgoalRequest;
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
    readonly simulatorInspectionCheckIds: readonly string[] | undefined,
    private readonly timeouts: Readonly<{
      observationTtlS: number;
      deviceTimeoutS: number;
      policyTimeoutS: number;
    }>,
    readonly toolTimeoutMs: number,
    private readonly onClose: () => void,
  ) {
    if (simulatorInspectionCheckIds)
      this.inspectSimulator = (checkIds, options) => this.inspectNative(checkIds, options);
    if (supportsObjectMeasurement) {
      if (!['robocasa', 'robotwin', 'behavior', 'robodojo'].includes(this.provider))
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
        return objectMeasurement(result.measurement, input, this.provider);
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
    this.transport.setFaultListener(
      (error, publication) => {
        if (this.closed) throw new Error('Native worker fault arrived after task close.');
        const status = this.status;
        if (!publication && !status) return;
        const fault = publication ?? {
          executionId: status!.execution_id,
          taskScope: structuredClone(status!.task_scope),
          type: error.name,
          message: error.message,
        };
        for (const listener of this.faultListeners) listener(structuredClone(fault));
      },
      (publication) => {
        const fields = object(publication);
        const scope = this.validator.parse('TaskScope', fields.task_scope) as TaskScope;
        const executionId = string(fields.execution_id);
        const type = string(fields.type);
        const message = string(fields.message);
        const request = this.activeRequest;
        const requestScope = request && {
          task_id: request.task_id,
          goal_id: request.goal_id,
          attempt_id: request.attempt_id,
          ...(request.recovery_id ? { recovery_id: request.recovery_id } : {}),
        };
        if (
          this.closed ||
          !request ||
          !isDeepStrictEqual(scope, requestScope) ||
          scope.task_id !== this.runId ||
          type.length > 128 ||
          message.length > 8000 ||
          executionId.length > 128 ||
          Object.keys(fields).some(
            (key) => !['execution_id', 'task_scope', 'type', 'message'].includes(key),
          ) ||
          (this.status &&
            isDeepStrictEqual(this.status.task_scope, scope) &&
            executionId !== this.status.execution_id)
        )
          throw new Error('Native worker fault differs from its admitted active execution.');
        return { executionId, taskScope: scope, type, message };
      },
    );
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
    this.activeRequest = structuredClone(request);
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

  async captureReview(
    options: import('@edh/execution').BackendReviewOptions,
  ): Promise<SensorSample | undefined> {
    options.signal?.throwIfAborted();
    const result = object(
      await this.transport.request(
        'capture_review',
        {
          run_task_id: this.runId,
          execution_id: options.executionId,
          control_generation: options.controlGeneration,
          task_scope: options.taskScope,
        },
        { signal: options.signal },
      ),
    );
    options.signal?.throwIfAborted();
    if (result.review_available === false) return undefined;
    if (
      result.review_available !== true ||
      result.run_task_id !== this.runId ||
      result.execution_id !== options.executionId ||
      result.control_generation !== options.controlGeneration ||
      !isDeepStrictEqual(result.task_scope, options.taskScope)
    )
      throw new Error('Native review capture belongs to another execution generation or scope.');
    const sample = await this.sample(
      result.observation as WorkerObservation,
      undefined,
      undefined,
      undefined,
      options.taskScope,
    );
    const current = this.query();
    if (
      !current ||
      current.state !== 'running' ||
      current.execution_id !== options.executionId ||
      current.control_generation !== options.controlGeneration ||
      !isDeepStrictEqual(current.task_scope, options.taskScope)
    )
      return undefined;
    return sample;
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

  async end(options: import('@edh/execution').BackendEndOptions): Promise<void> {
    options.signal?.throwIfAborted();
    const result = object(
      await this.transport.request(
        'end',
        {
          execution_id: options.executionId,
          owner_id: options.ownerId,
          owner_assignment_id: options.ownerAssignmentId,
          task_scope: options.taskScope,
        },
        { signal: options.signal },
      ),
    );
    const status = this.validator.parse('ExecutionStatus', result.status);
    if (
      status.execution_id !== options.executionId ||
      !isDeepStrictEqual(status.task_scope, options.taskScope) ||
      status.state !== 'ended' ||
      !status.device_confirmed ||
      !isDeepStrictEqual(this.status, status)
    )
      throw new Error(
        'Native terminal review receipt differs from its published confirmed boundary.',
      );
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

  private async inspectNative(
    checkIds: readonly string[],
    options: BackendReviewOptions,
  ): Promise<BackendInspectionResult> {
    options.signal?.throwIfAborted();
    const current = () => {
      const status = this.status;
      if (
        this.closed ||
        !status ||
        status.execution_id !== options.executionId ||
        status.control_generation !== options.controlGeneration ||
        !isDeepStrictEqual(status.task_scope, options.taskScope)
      )
        throw new Error('Simulator inspection scope or generation changed.');
      return status;
    };
    current();
    if (
      !this.simulatorInspectionCheckIds ||
      !checkIds.length ||
      checkIds.length > 32 ||
      new Set(checkIds).size !== checkIds.length ||
      checkIds.some((id) => !this.simulatorInspectionCheckIds!.includes(id))
    )
      throw new Error('Simulator inspection check is absent from the advertised catalog.');
    const result = object(
      await this.transport.request(
        'inspect_simulator',
        {
          run_task_id: this.runId,
          execution_id: options.executionId,
          control_generation: options.controlGeneration,
          task_scope: options.taskScope,
          check_ids: [...checkIds],
        },
        { signal: options.signal },
      ),
    );
    options.signal?.throwIfAborted();
    const status = current();
    if (
      result.run_task_id !== this.runId ||
      result.execution_id !== options.executionId ||
      result.control_generation !== options.controlGeneration ||
      !isDeepStrictEqual(result.task_scope, options.taskScope) ||
      result.source !== 'robodojo-native-conditions' ||
      !Number.isSafeInteger(result.control_steps) ||
      Number(result.control_steps) < 0 ||
      !Number.isSafeInteger(result.raw_sim_steps) ||
      Number(result.raw_sim_steps) < 0 ||
      !Array.isArray(result.facts) ||
      result.facts.length !== checkIds.length
    )
      throw new Error('Native simulator inspection receipt is invalid.');
    const sample = await this.sample(result.observation as WorkerObservation, status);
    options.signal?.throwIfAborted();
    current();
    sample.visualization = {
      ...sample.visualization,
      inspectionSource: 'robodojo-native-conditions',
      inspectionControlGeneration: options.controlGeneration,
      inspectionControlSteps: Number(result.control_steps),
      inspectionRawSimSteps: Number(result.raw_sim_steps),
    };
    const facts = result.facts.map((item, index) => {
      const fact = object(item);
      if (fact.check_id !== checkIds[index])
        throw new Error('Native simulator inspection returned a different check.');
      return this.validator.parse('CheckResult', {
        check_id: fact.check_id,
        value: fact.value,
        evidence_refs: [sample.evidence.id],
        ...(fact.reason == null ? {} : { reason: string(fact.reason) }),
      }) as CheckResult;
    });
    return {
      source: 'robodojo-native-conditions',
      executionId: options.executionId,
      controlGeneration: options.controlGeneration,
      taskScope: structuredClone(options.taskScope),
      controlSteps: Number(result.control_steps),
      rawSimSteps: Number(result.raw_sim_steps),
      sample,
      facts,
    };
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
  subscribeFaults(listener: (fault: BackendFault) => void): () => void {
    this.faultListeners.add(listener);
    return () => this.faultListeners.delete(listener);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    await this.transport.request('close_task');
    this.closed = true;
    this.transport.setListener(undefined);
    this.transport.setFrameListener(undefined);
    this.transport.setPolicyListener(undefined);
    this.transport.setFaultListener(undefined);
    this.onClose();
  }
}

export async function createNativeWorkerEnvironment(
  configuration: NativeWorkerConfiguration,
  services: DeploymentServices,
  validator: ContractValidator,
): Promise<SessionEnvironment> {
  configuration = validateNativeWorkerConfiguration(configuration, validator);
  const timeouts = {
    observationTtlS: configuration.observationTtlS ?? 30,
    deviceTimeoutS: configuration.deviceTimeoutS ?? 30,
    policyTimeoutS: configuration.policyTimeoutS ?? 30,
  };
  const toolTimeoutMs = configuration.toolTimeoutMs ?? 120_000;
  const transportWriteTimeoutS = configuration.transportWriteTimeoutS ?? 30;
  const policyMaxActionsPerInference = configuration.policyMaxActionsPerInference ?? 512;
  const profileCleanup = configuration.profileCleanup
    ? new NativeProfileCleanup(configuration.profileCleanup)
    : undefined;
  await profileCleanup?.prepare();
  const transport = await NativeWorkerTransport.create(configuration, profileCleanup);
  try {
    const description = object(
      await transport.request('initialize', {
        provider: configuration.provider,
        native_task_id: configuration.nativeTaskId,
        policy_uri: configuration.policyUri,
        policy_id: configuration.policyId,
        ...(configuration.policyCheckpointSha256
          ? { policy_checkpoint_sha256: configuration.policyCheckpointSha256 }
          : {}),
        transport_write_timeout_s: transportWriteTimeoutS,
        execution_mode: configuration.executionMode ?? 'policy',
        scene_configuration: configuration.sceneConfiguration,
        schema_path: configuration.schemaPath,
        policy_max_actions_per_inference: policyMaxActionsPerInference,
        monitor_every_actions: configuration.monitorEveryActions ?? 1,
        publish_running_images: configuration.publishRunningImages ?? false,
        enable_simulator_inspection: configuration.enableSimulatorInspection ?? false,
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
      description.policy_checkpoint_sha256 !== configuration.policyCheckpointSha256 ||
      description.execution_mode !== (configuration.executionMode ?? 'policy')
    )
      throw new Error('Native worker initialized a different provider or task.');
    if (
      description.supports_simulator_inspection !==
      (configuration.enableSimulatorInspection ?? false)
    )
      throw new Error('Native worker simulator inspection admission differs from configuration.');
    if (
      typeof description.supports_object_measurement !== 'boolean' ||
      !description.supports_object_measurement
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
          configuration.enableSimulatorInspection
            ? Object.freeze([
                ...new Set(
                  [
                    ...('all' in resolvedCatalog.tasks[taskId]!.goal.successContract
                      ? resolvedCatalog.tasks[taskId]!.goal.successContract.all
                      : resolvedCatalog.tasks[taskId]!.goal.successContract.any),
                    ...(resolvedCatalog.tasks[taskId]!.predefinedGoals ?? []).flatMap((goal) =>
                      'all' in goal.successContract
                        ? goal.successContract.all
                        : goal.successContract.any,
                    ),
                    ...(resolvedCatalog.tasks[taskId]!.allowedSubgoalChecks ?? []),
                  ].map((check) => check.check_id),
                ),
              ])
            : undefined,
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
