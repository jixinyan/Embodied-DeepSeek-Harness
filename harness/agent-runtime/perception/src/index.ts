import type { Observation, SegmentationRequest, SegmentationResult } from '@edh/contracts';
export interface PerceptionProvider {
  capture(sensorId: string): Promise<Observation>;
  segment(request: SegmentationRequest): Promise<SegmentationResult>;
}

export {
  admitSensorSample,
  sensorImages,
  validateImageAttachmentReference,
} from './sensor-sample.js';
export { SensorSamples } from './sensor-samples.js';
