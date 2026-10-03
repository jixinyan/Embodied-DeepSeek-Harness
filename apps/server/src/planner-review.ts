import { z } from 'zod';

export const plannerReviewSchema = z
  .object({
    enabled: z.boolean(),
    controlStepInterval: z.number().int().min(1).max(1_000_000),
    wallTimeIntervalMs: z.number().int().min(1_000).max(3_600_000),
  })
  .strict();

export type PlannerReviewPolicy = z.infer<typeof plannerReviewSchema>;

export const nativePlannerReview: Readonly<PlannerReviewPolicy> = Object.freeze({
  enabled: true,
  controlStepInterval: 32,
  wallTimeIntervalMs: 15_000,
});
