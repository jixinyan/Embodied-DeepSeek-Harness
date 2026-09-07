import type { ExecutionStatus, MessageEnvelope, VerificationResult } from '@edh/contracts';
/** Future UI projection; latest sensor and agent-visible evidence remain distinct. */
export interface ConsoleProjection {
  readonly source: 'fixture' | 'replay' | 'simulation' | 'hardware';
  readonly taskId: string;
  readonly executions: readonly ExecutionStatus[];
  readonly verifications: readonly VerificationResult[];
  readonly timeline: readonly MessageEnvelope[];
  readonly latestSensorRefs: readonly string[];
  readonly agentSeenRefs: readonly string[];
}
