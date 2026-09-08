import type {
  InvocationBrief,
  ExecutionStatus,
  SubgoalRequest,
  VerificationResult,
} from '@edh/contracts';
import type { SensorSample } from '@edh/execution';
export interface RunEvent {
  sequence: number;
  at: string;
  type: string;
  detail: Record<string, unknown>;
}
export interface RunAssignment {
  id: string;
  member: string;
  sessionId: string;
  brief: InvocationBrief;
  status: string;
  model: string;
  tools: string[];
}
export interface RunState {
  id: string;
  instruction: string;
  scenario: string;
  source: 'test_fixture' | 'simulation' | 'hardware';
  state:
    | 'running'
    | 'paused'
    | 'verifying'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
    | 'interrupted'
    | 'unknown';
  createdAt: string;
  updatedAt: string;
  teamDigest: string;
  teamId: string;
  decisionAssignmentId: string;
  attempt: number;
  recoveryId: string | null;
  retryChanges: string[];
  assignments: Record<string, RunAssignment>;
  events: RunEvent[];
  executions: ExecutionStatus[];
  requests: SubgoalRequest[];
  verdicts: VerificationResult[];
  latestSensor: SensorSample | null;
  agentSeen: Record<string, SensorSample>;
  skillIds: string[];
  error: string | null;
}
