import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { BackendObjectMeasurement, SensorSample } from '@edh/execution';
import type { SegmentationInstance, SegmentationOutput, DepthOutput } from './model-responses.js';

export interface SegmentationResultInput {
  source: SensorSample;
  reference: ImageAttachmentRef;
  prediction: Omit<SegmentationOutput, 'overlayPng' | 'instances'> & {
    instances: readonly Omit<SegmentationInstance, 'maskPng'>[];
  };
  textPrompt: string;
  overlay: ImageAttachmentRef;
  maskRefs: readonly ImageAttachmentRef[];
  resultId: string;
  overlayEvidenceId: string;
  maskEvidenceId: string;
  createdAt: string;
}

export function segmentationResult(input: SegmentationResultInput) {
  const {
    source,
    reference,
    prediction,
    textPrompt,
    overlay,
    maskRefs,
    resultId,
    overlayEvidenceId,
    maskEvidenceId,
    createdAt,
  } = input;
  const evidence = {
    source: prediction.provider,
    created_at: createdAt,
    visibility: 'agent' as const,
    task_scope: source.evidence.task_scope,
    observed_at: source.evidence.observed_at,
    clock_id: source.evidence.clock_id,
  };
  const visualization = {
    resultId,
    sourceEvidenceId: source.evidence.id,
    sourceAttachmentId: reference.attachmentId,
    sourceImageSha256: prediction.sourceImageSha256,
    textPrompt,
    sourceRevision: prediction.sourceRevision,
    checkpointSha256: prediction.checkpointSha256,
    sessionAdapter: prediction.sessionAdapter,
    modelInputSha256: prediction.modelInputSha256,
    modelSessionId: prediction.sessionId,
  };
  const samples: SensorSample[] = [
    {
      evidence: { ...evidence, id: overlayEvidenceId, kind: 'image' },
      sequence: source.sequence,
      source: source.source,
      description: 'SAM 3.1 predicted segmentation overlay.',
      visualization: { ...visualization },
      images: [overlay],
    },
    {
      evidence: { ...evidence, id: maskEvidenceId, kind: 'mask' },
      sequence: source.sequence,
      source: source.source,
      description: 'SAM 3.1 predicted object masks.',
      visualization: { ...visualization },
      images: [...new Map(maskRefs.map((mask) => [mask.attachmentId, mask])).values()],
    },
  ];
  return {
    samples,
    result: {
      resultId,
      sourceEvidenceId: source.evidence.id,
      sourceAttachmentId: reference.attachmentId,
      camera: reference.name ?? null,
      observedAt: source.evidence.observed_at,
      overlayEvidenceId,
      maskEvidenceId,
      provider: prediction.provider,
      sourceRevision: prediction.sourceRevision,
      checkpointSha256: prediction.checkpointSha256,
      sessionAdapter: prediction.sessionAdapter,
      sourceImageSha256: prediction.sourceImageSha256,
      modelInputSha256: prediction.modelInputSha256,
      modelInputConversion: 'Pillow RGB JPEG quality 100, subsampling 0',
      width: prediction.width,
      height: prediction.height,
      instances: prediction.instances.map((instance, index) => ({
        sessionObjectId: instance.objectId,
        score: instance.score,
        bboxXyxy: instance.bboxXyxy,
        areaPixels: instance.areaPixels,
        maskAttachmentId: maskRefs[index]!.attachmentId,
      })),
    },
  };
}

export interface EstimatedDepthResultInput {
  source: SensorSample;
  reference: ImageAttachmentRef;
  mask: SensorSample;
  maskReference: ImageAttachmentRef;
  metrics: Omit<DepthOutput, 'depthNpy' | 'overlayPng'>;
  overlay: ImageAttachmentRef;
  resultId: string;
  overlayEvidenceId: string;
  createdAt: string;
}

export function estimatedDepthResult(input: EstimatedDepthResultInput) {
  const {
    source,
    reference,
    mask,
    maskReference,
    metrics,
    overlay,
    resultId,
    overlayEvidenceId,
    createdAt,
  } = input;
  const sample: SensorSample = {
    evidence: {
      ...source.evidence,
      id: overlayEvidenceId,
      kind: 'image',
      source: metrics.provider,
      created_at: createdAt,
    },
    sequence: source.sequence,
    source: source.source,
    description:
      'YOLO26 monocular object depth estimate; source-camera metric accuracy is unverified.',
    visualization: {
      resultId,
      sourceEvidenceId: source.evidence.id,
      sourceAttachmentId: reference.attachmentId,
      maskEvidenceId: mask.evidence.id,
      maskAttachmentId: maskReference.attachmentId,
      provider: metrics.provider,
      sourceRevision: metrics.sourceRevision,
      checkpointSha256: metrics.checkpointSha256,
      measurementKind: metrics.measurementKind,
      metricAccuracy: metrics.metricAccuracy,
      unit: metrics.unit,
      depthNpySha256: metrics.depthNpySha256,
      validFraction: metrics.validFraction,
      medianAxialDepthM: metrics.medianAxialDepthM,
      p10AxialDepthM: metrics.p10AxialDepthM,
      p90AxialDepthM: metrics.p90AxialDepthM,
      ...(metrics.calibrationId ? { calibrationId: metrics.calibrationId } : {}),
      ...(metrics.medianCameraRangeM === null
        ? {}
        : { medianCameraRangeM: metrics.medianCameraRangeM }),
    },
    images: [overlay],
  };
  return {
    samples: [sample],
    result: {
      resultId,
      sourceEvidenceId: source.evidence.id,
      sourceAttachmentId: reference.attachmentId,
      maskEvidenceId: mask.evidence.id,
      maskAttachmentId: maskReference.attachmentId,
      camera: reference.name ?? null,
      observedAt: source.evidence.observed_at,
      overlayEvidenceId,
      ...metrics,
    },
  };
}

export interface MeasuredObjectResultInput {
  source: SensorSample;
  reference: ImageAttachmentRef;
  mask: SensorSample;
  maskReference: ImageAttachmentRef;
  measurement: BackendObjectMeasurement;
  resultId: string;
  measurementEvidenceId: string;
  createdAt: string;
}

export function measuredObjectResult(input: MeasuredObjectResultInput) {
  const {
    source,
    reference,
    mask,
    maskReference,
    measurement,
    resultId,
    measurementEvidenceId,
    createdAt,
  } = input;
  const sample: SensorSample = {
    evidence: {
      ...source.evidence,
      id: measurementEvidenceId,
      kind: 'depth',
      source: measurement.source,
      created_at: createdAt,
    },
    sequence: source.sequence,
    source: source.source,
    description: 'Same-frame simulator metric depth and visible surface centroid.',
    visualization: {
      resultId,
      sourceEvidenceId: source.evidence.id,
      sourceAttachmentId: reference.attachmentId,
      maskEvidenceId: mask.evidence.id,
      maskAttachmentId: maskReference.attachmentId,
      measurementKind: measurement.measurementKind,
      unit: measurement.unit,
      calibrationId: measurement.intrinsics.calibrationId,
      cameraFrame: measurement.cameraFrame,
      worldFrame: measurement.worldFrame,
      centroidKind: measurement.centroidKind,
      validFraction: measurement.validFraction,
      medianAxialDepthM: measurement.medianAxialDepthM,
      medianCameraRangeM: measurement.medianCameraRangeM,
      cameraX: measurement.centroidCameraXYZ[0],
      cameraY: measurement.centroidCameraXYZ[1],
      cameraZ: measurement.centroidCameraXYZ[2],
      worldX: measurement.centroidWorldXYZ[0],
      worldY: measurement.centroidWorldXYZ[1],
      worldZ: measurement.centroidWorldXYZ[2],
    },
    images: [],
  };
  return {
    samples: [sample],
    result: {
      resultId,
      measurementEvidenceId,
      sourceEvidenceId: source.evidence.id,
      sourceAttachmentId: reference.attachmentId,
      maskEvidenceId: mask.evidence.id,
      maskAttachmentId: maskReference.attachmentId,
      observedAt: source.evidence.observed_at,
      ...measurement,
    },
  };
}
