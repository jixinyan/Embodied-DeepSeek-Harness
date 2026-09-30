import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type {
  CheckResult,
  EvidenceRef,
  ExecutionStatus,
  SubgoalRequest,
  TaskScope,
} from '@edh/contracts';

export interface SensorSample {
  /** Admitted immutable images; bytes stay in the deployment attachment store. */
  images?: readonly ImageAttachmentRef[];
  evidence: EvidenceRef;
  sequence: number;
  source: 'test_fixture' | 'simulation' | 'hardware';
  description: string;
  visualization: Record<string, string | number | boolean>;
}
export interface BackendUpdate {
  status: ExecutionStatus;
  sample: SensorSample;
}
export interface BackendFrame {
  sample: SensorSample;
  runId: string;
  executionId: string;
  policyRequestId: string;
  segmentId: string;
  nativeStepIndex: number;
  simulationTimeS: number;
}
export interface BackendPolicyEvent {
  requestId: string;
  executionId: string;
  taskScope: TaskScope;
  generation: number;
  observationId: string;
  sessionId: string;
  sequence: number;
  at: string;
  type: string;
  data: Record<string, unknown>;
}
export interface BackendCallOptions {
  /** Native DSH cancellation; providers must forward it to cooperative remote work. */
  signal?: AbortSignal;
}
export interface BackendResumeOptions extends BackendCallOptions {
  /** Resume only this confirmed and formally checked control boundary. */
  executionId: string;
  boundaryId: string;
  stateVersion: number;
}
export interface BackendCheckOptions extends BackendCallOptions {
  /** Reject the request if the worker no longer owns this stopped boundary. */
  executionId: string;
  boundaryId: string;
}
export interface BackendCheckResult {
  sample: SensorSample;
  facts: CheckResult[];
}
export interface BackendObjectMeasurementInput {
  observationId: string;
  camera: string;
  sourceImageSha256: string;
  maskPngBase64: string;
}
export interface BackendObjectMeasurement {
  provider: 'robocasa';
  source: 'robocasa-native-rgbd';
  measurementKind: 'simulator_metric_depth';
  unit: 'meter';
  distanceFrame: 'camera_axial_depth';
  centroidKind: 'mean_of_visible_valid_surface_points';
  cameraFrame: string;
  worldFrame: string;
  coordinateAxes: readonly ['right', 'down', 'forward'];
  observationId: string;
  measurementCaptureId: string;
  camera: string;
  sourceImageSha256: string;
  maskPngSha256: string;
  measuredAt: string;
  simulationTimeS: number;
  width: number;
  height: number;
  selectedPixels: number;
  validPixels: number;
  invalidPixels: number;
  validFraction: number;
  medianAxialDepthM: number;
  p10AxialDepthM: number;
  p90AxialDepthM: number;
  medianCameraRangeM: number;
  centroidPixel: readonly [number, number];
  centroidCameraXYZ: readonly [number, number, number];
  centroidWorldXYZ: readonly [number, number, number];
  intrinsics: { calibrationId: string; fx: number; fy: number; cx: number; cy: number };
  intrinsicMatrix: readonly (readonly number[])[];
  cameraToWorld: readonly (readonly number[])[];
  minimumDepthM: number;
  maximumDepthM: number;
}
/** Upper application port. Physical transports and resource arbitration remain provider responsibilities. */
export interface EmbodiedBackend {
  readonly source: 'test_fixture' | 'simulation' | 'hardware';
  start(request: SubgoalRequest, options?: BackendCallOptions): Promise<ExecutionStatus>;
  /** Immediate local status projection; remote clients update it before notifying subscribers. */
  query(): ExecutionStatus | undefined;
  capture(options?: BackendCallOptions): SensorSample | Promise<SensorSample>;
  measureObject?(
    input: BackendObjectMeasurementInput,
    options?: BackendCallOptions,
  ): Promise<BackendObjectMeasurement>;
  turnView(
    direction: 'left' | 'center' | 'right',
    options?: BackendCallOptions,
  ): Promise<SensorSample>;
  pause(options?: BackendCallOptions): Promise<void>;
  resume(ownerId: string, options: BackendResumeOptions): Promise<void>;
  stop(): Promise<void>;
  check(
    checkIds: readonly string[],
    options?: BackendCheckOptions,
  ): BackendCheckResult | Promise<BackendCheckResult>;
  subscribe(listener: (update: BackendUpdate) => void): () => void;
  subscribeFrames?(listener: (frame: BackendFrame) => void): () => void;
  subscribePolicyEvents?(listener: (event: BackendPolicyEvent) => void): () => void;
  close(): Promise<void>;
}
