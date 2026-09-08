import type { CheckResult, EvidenceRef, ExecutionStatus, SubgoalRequest } from '@edh/contracts';

export interface SensorSample {
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
/** Upper application port. Physical transports and resource arbitration remain provider responsibilities. */
export interface EmbodiedBackend {
  readonly source: 'test_fixture' | 'simulation' | 'hardware';
  start(request: SubgoalRequest): Promise<ExecutionStatus>;
  query(): ExecutionStatus | undefined;
  capture(): SensorSample;
  turnView(direction: 'left' | 'center' | 'right'): Promise<SensorSample>;
  pause(): Promise<void>;
  resume(ownerId: string): Promise<void>;
  stop(): Promise<void>;
  check(checkIds: readonly string[]): { sample: SensorSample; facts: CheckResult[] };
  subscribe(listener: (update: BackendUpdate) => void): () => void;
  close(): Promise<void>;
}
