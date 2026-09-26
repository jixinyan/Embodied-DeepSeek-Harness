import type { InvocationBrief, AgentReport, ExecutionStatus, SubgoalRequest } from '@edh/contracts';
import type { RunVerdict } from './verdict-history.js';
import type { SensorSample } from '@edh/execution';
import type { TaskContextSummary } from './task-context.js';
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
  brief?: InvocationBrief;
  detailsStored?: boolean;
  verificationContextStored?: boolean;
  callerAssignmentId?: string;
  lastObservationId?: string;
  todoCount?: number;
  status: string;
  model: string;
  tools: string[];
  todos?: { content: string; status: 'pending' | 'in_progress' | 'completed' }[];
  report?: AgentReport;
  reportVersion?: number;
  todoSequence?: number;
  todoTurn?: number;
  turn?: number;
  step?: number;
}
export interface UserClarification {
  format: 'edh.clarification.v1';
  id: string;
  runId: string;
  assignmentId: string;
  callId: string;
  goalId: string;
  attemptId: string;
  question: string;
  reason: string;
  options: string[];
  createdAt: string;
  updatedAt: string;
  state: 'pending' | 'answered' | 'cancelled' | 'interrupted';
  response: { requestId: string; text: string } | null;
  delivery: 'none' | 'queued' | 'settled' | 'failed' | 'interrupted';
  error: string | null;
}
export interface RunState {
  id: string;
  instruction: string;
  taskContext?: TaskContextSummary[];
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
  activeGoalId?: string;
  finalGoalId?: string;
  activeRecoveryId?: string | null;
  recoveryId: string | null;
  retryChanges: string[];
  assignments: Record<string, RunAssignment>;
  events: RunEvent[];
  /** Published ordinary events; a restart annotation is stored separately. */
  eventCount?: number;
  executions: ExecutionStatus[];
  requests: SubgoalRequest[];
  verdicts: RunVerdict[];
  latestSensor: SensorSample | null;
  latestOperatorFrame?: { eventSequence: number; sample: SensorSample } | null;
  agentSeen: Record<string, SensorSample>;
  agentStreams?: Record<
    string,
    { attemptId: string; revision: number; text: string; reasoning: string; status: string }
  >;
  skillIds: string[];
  error: string | null;
  clarification?: UserClarification | null;
}
