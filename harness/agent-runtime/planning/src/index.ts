// Architecture contract only. No runtime implementation.
import type { PlanDocument } from '@edh/contracts';
export interface PlanStore {
  read(taskId: string): Promise<PlanDocument | undefined>;
  update(plan: PlanDocument, expectedVersion: number): Promise<void>;
}

export { TaskPlans } from './workspace.js';
