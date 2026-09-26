import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { CheckResult, EvidenceRef, ExecutionStatus, SubgoalRequest } from '@edh/contracts';

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
/** Upper application port. Physical transports and resource arbitration remain provider responsibilities. */
export interface EmbodiedBackend {
  readonly source: 'test_fixture' | 'simulation' | 'hardware';
  start(request: SubgoalRequest, options?: BackendCallOptions): Promise<ExecutionStatus>;
  /** Immediate local status projection; remote clients update it before notifying subscribers. */
  query(): ExecutionStatus | undefined;
  capture(options?: BackendCallOptions): SensorSample | Promise<SensorSample>;
  turnView(
    direction: 'left' | 'center' | 'right',
    options?: BackendCallOptions,
  ): Promise<SensorSample>;
  /** 已接受的暂停请求须等待设备在限定时间内确认停止。 */
  pause(options?: BackendCallOptions): Promise<void>;
  resume(ownerId: string, options: BackendResumeOptions): Promise<void>;
  stop(): Promise<void>;
  check(
    checkIds: readonly string[],
    options?: BackendCheckOptions,
  ): BackendCheckResult | Promise<BackendCheckResult>;
  subscribe(listener: (update: BackendUpdate) => void): () => void;
  subscribeFrames?(listener: (frame: BackendFrame) => void): () => void;
  close(): Promise<void>;
}
