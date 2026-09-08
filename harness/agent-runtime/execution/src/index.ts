// Architecture contract only. No runtime implementation.
import type { ExecutionStatus, SubgoalRequest, TaskScope } from '@edh/contracts';
export interface ExecutionRequest {
  readonly scope: TaskScope;
  readonly decisionOwnerId: string;
  readonly idempotencyKey: string;
  readonly subgoal: SubgoalRequest;
}
export interface ExecutionClient {
  submit(request: ExecutionRequest): Promise<{ readonly executionId: string }>;
  query(executionId: string): Promise<ExecutionStatus>;
  pause(executionId: string, requesterId: string): Promise<void>;
  resume(executionId: string, decisionOwnerId: string): Promise<void>;
  stop(executionId: string, reason: string): Promise<void>;
  events(executionId: string): AsyncIterable<ExecutionStatus>;
}
export interface ResourceLease {
  readonly id: string;
  readonly executionId: string;
  readonly resources: readonly string[];
}
export interface ResourceCoordinator {
  acquire(executionId: string, resources: readonly string[]): Promise<ResourceLease>;
  release(lease: ResourceLease, stopConfirmationRef: string): Promise<void>;
}

export type { EmbodiedBackend, SensorSample, BackendUpdate } from './backend-port.js';
