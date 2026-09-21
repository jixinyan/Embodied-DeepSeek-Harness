export { VerificationContexts, type VerificationContextRecord } from './contexts.js';
export { VerificationBoundaries } from './boundaries.js';
import type { TaskScope, VerificationResult } from '@edh/contracts';
export interface MonitorFeedback {
  readonly scope: TaskScope;
  readonly verifierId: string;
  readonly kind: 'progress' | 'deviation' | 'possibly_complete' | 'insufficient_evidence';
  readonly observationRefs: readonly string[];
}
export interface VerificationRequest {
  readonly scope: TaskScope;
  readonly verifierId: string;
  readonly boundaryEventId: string;
  readonly invocationBriefRef: string;
}
export interface VerificationCoordinator {
  request(request: VerificationRequest): Promise<void>;
  feedback(feedback: MonitorFeedback): Promise<void>;
  submit(result: VerificationResult): Promise<void>;
}
