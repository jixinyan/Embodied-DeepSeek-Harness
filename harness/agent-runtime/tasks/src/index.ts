// Runtime exports and interfaces for future deployment boundaries.
import type { RecoveryRecord, SubgoalRequest, TaskScope, VerificationResult } from '@edh/contracts';
export interface PlannerDecision {
  readonly ownerAgentId: string;
  readonly scope: TaskScope;
  readonly action: 'resume' | 'retry' | 'replan' | 'finish' | 'abandon';
  readonly evidenceRefs: readonly string[];
  readonly newSubgoal?: SubgoalRequest;
}
export interface TaskCoordinator {
  decide(decision: PlannerDecision): Promise<void>;
  receiveVerdict(verdict: VerificationResult): Promise<void>;
  recovery(recoveryId: string): Promise<RecoveryRecord>;
}

export type { RunState, RunEvent, RunAssignment, UserClarification } from './run-state.js';

export { TaskGoals, type GoalBinding } from './goals.js';

export { RunHistory, type RunEventPage } from './history.js';
export { AssignmentHistory, type AssignmentDetails } from './assignment-history.js';
export { RecoveryHistory, type RecoveryTrace, type RecoveryPage } from './recovery-history.js';
export { VerdictHistory, type RunVerdict, type VerdictSummary } from './verdict-history.js';
export { taskContextSummary, type TaskContextSummary } from './task-context.js';
