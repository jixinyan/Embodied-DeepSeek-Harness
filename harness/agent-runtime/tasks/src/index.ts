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

export type { RunState, RunEvent, RunAssignment } from './run-state.js';

export { TaskGoals, type GoalBinding } from './goals.js';

export { RunHistory } from './history.js';
