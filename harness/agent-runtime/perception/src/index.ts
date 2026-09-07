// Architecture contract only. No runtime implementation.
import type { Observation, SegmentationRequest, SegmentationResult } from '@edh/contracts';
export interface PerceptionProvider {
  capture(sensorId: string): Promise<Observation>;
  segment(request: SegmentationRequest): Promise<SegmentationResult>;
}
