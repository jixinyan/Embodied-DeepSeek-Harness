// Architecture contract only. No runtime implementation.
import type { Observation } from '@edh/contracts';
export interface ViewRequest {
  readonly intent: string;
  readonly assignmentId: string;
  readonly authorizationRef: string;
  readonly embodimentId: string;
}
export interface ViewResult {
  readonly observation: Observation;
  readonly achievedPoseRef: string;
  readonly resourcesUsed: readonly string[];
}
export interface ActiveObservation {
  request(view: ViewRequest): Promise<ViewResult>;
}
