import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DepthInput, SegmentationInput } from './request-inputs.js';

export interface SegmentationInstance {
  objectId: number;
  score: number;
  bboxXyxy: readonly [number, number, number, number];
  areaPixels: number;
  maskPng: Uint8Array;
}

export interface SegmentationOutput {
  provider: string;
  sourceRevision: string;
  checkpointSha256: string;
  sessionAdapter: string;
  sessionId: string;
  sourceImageSha256: string;
  modelInputSha256: string;
  width: number;
  height: number;
  overlayPng: Uint8Array;
  instances: readonly SegmentationInstance[];
}

export interface DepthOutput {
  provider: string;
  sourceRevision: string;
  checkpointSha256: string;
  sourceImageSha256: string;
  width: number;
  height: number;
  unit: 'meter';
  distanceFrame: 'camera_axial_depth';
  measurementKind: 'monocular_prediction';
  metricAccuracy: 'unverified_for_source_camera';
  scaleCalibration: 'checkpoint_global_calibration';
  uncertainty: 'not_provided_by_model';
  calibrationId: string | null;
  maskPngSha256: string | null;
  roiXyxy: readonly [number, number, number, number] | null;
  selectedPixels: number;
  validPixels: number;
  invalidPixels: number;
  validFraction: number;
  medianAxialDepthM: number;
  p10AxialDepthM: number;
  p90AxialDepthM: number;
  medianCameraRangeM: number | null;
  depthNpy: Uint8Array;
  depthNpySha256: string;
  overlayPng: Uint8Array;
}

const sha256 = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const digest = z
  .string()
  .length(64)
  .regex(/^[a-f0-9]+$/);
const revision = z
  .string()
  .length(40)
  .regex(/^[a-f0-9]+$/);
const integer = z.number().int().nonnegative().safe();
const dimension = integer.positive().max(65_536);
const box = z.tuple([integer, integer, integer, integer]);
const binary = z.string().min(1).max(44_739_244);
const positive = z.number().finite().positive();

const segmentationSchema = z.object({
  model: z.object({
    provider: z.literal('sam3.1-object-multiplex'),
    source_revision: revision,
    checkpoint_sha256: digest,
    session_adapter: z.literal('sam31-multiplex-init-state-v1'),
  }),
  session_id: z.uuid(),
  source_image_sha256: digest,
  model_input: z.object({
    media_type: z.literal('image/jpeg'),
    sha256: digest,
    conversion: z.literal('Pillow RGB JPEG quality 100, subsampling 0'),
  }),
  width: dimension,
  height: dimension,
  overlay_png_base64: binary,
  instances: z
    .array(
      z.object({
        object_id: integer.max(1_000_000),
        score: z.number().finite().min(0).max(1),
        bbox_xyxy: box,
        area_pixels: integer.positive(),
        mask_png_base64: binary,
      }),
    )
    .max(16),
});

const depthSchema = z.object({
  model: z.object({
    provider: z.literal('ultralytics-yolo26-depth'),
    source_revision: revision,
    checkpoint_sha256: digest,
  }),
  source_image_sha256: digest,
  width: integer.positive(),
  height: integer.positive(),
  unit: z.literal('meter'),
  distance_frame: z.literal('camera_axial_depth'),
  measurement_kind: z.literal('monocular_prediction'),
  metric_accuracy: z.literal('unverified_for_source_camera'),
  scale_calibration: z.literal('checkpoint_global_calibration'),
  uncertainty: z.literal('not_provided_by_model'),
  calibration_id: z.string().nullable(),
  region: z.object({ mask_png_sha256: digest.nullable(), roi_xyxy: box.nullable() }),
  statistics: z.object({
    selected_pixels: integer.positive(),
    valid_pixels: integer.positive(),
    invalid_pixels: integer,
    valid_fraction: z.number().finite().positive().max(1),
    median_axial_depth_m: positive,
    p10_axial_depth_m: positive,
    p90_axial_depth_m: positive,
    median_camera_range_m: positive.nullable(),
  }),
  depth_npy_sha256: digest,
  depth_npy_base64: binary,
  overlay_png_base64: binary,
});

function binaryBytes(value: string): Uint8Array {
  const bytes = Buffer.from(value, 'base64');
  if (
    !bytes.byteLength ||
    bytes.byteLength > 32 * 1024 * 1024 ||
    bytes.toString('base64') !== value
  )
    throw new Error('Perception response binary encoding is invalid.');
  return bytes;
}

export function readSegmentationResponse(
  value: unknown,
  input: SegmentationInput,
): SegmentationOutput {
  input.signal.throwIfAborted();
  const parsed = segmentationSchema.parse(value);
  if (
    parsed.source_image_sha256 !== sha256(input.image) ||
    parsed.width * parsed.height > 4_000_000
  )
    throw new Error('Segmentation response differs from the admitted source image.');
  const instances = parsed.instances.map((raw): SegmentationInstance => {
    const [left, top, right, bottom] = raw.bbox_xyxy;
    if (
      left >= right ||
      top >= bottom ||
      right > parsed.width ||
      bottom > parsed.height ||
      raw.area_pixels > (right - left) * (bottom - top)
    )
      throw new Error('Segmentation response contains an inconsistent mask region.');
    return {
      objectId: raw.object_id,
      score: raw.score,
      bboxXyxy: raw.bbox_xyxy,
      areaPixels: raw.area_pixels,
      maskPng: binaryBytes(raw.mask_png_base64),
    };
  });
  if (new Set(instances.map((instance) => instance.objectId)).size !== instances.length)
    throw new Error('Segmentation response repeated a session object ID.');
  return {
    provider: parsed.model.provider,
    sourceRevision: parsed.model.source_revision,
    checkpointSha256: parsed.model.checkpoint_sha256,
    sessionAdapter: parsed.model.session_adapter,
    sessionId: parsed.session_id,
    sourceImageSha256: parsed.source_image_sha256,
    modelInputSha256: parsed.model_input.sha256,
    width: parsed.width,
    height: parsed.height,
    overlayPng: binaryBytes(parsed.overlay_png_base64),
    instances,
  };
}

export function readDepthResponse(value: unknown, input: DepthInput): DepthOutput {
  input.signal.throwIfAborted();
  const parsed = depthSchema.parse(value);
  const { region, statistics: stats } = parsed;
  const roi = input.roiXyxy ?? null;
  const regionPixels = roi ? (roi[2] - roi[0]) * (roi[3] - roi[1]) : input.width * input.height;
  if (
    parsed.source_image_sha256 !== sha256(input.image) ||
    parsed.width !== input.width ||
    parsed.height !== input.height ||
    parsed.calibration_id !== (input.intrinsics?.calibrationId ?? null) ||
    region.mask_png_sha256 !== (input.maskPng ? sha256(input.maskPng) : null) ||
    (roi === null
      ? region.roi_xyxy !== null
      : !region.roi_xyxy?.every((coordinate, index) => coordinate === roi[index])) ||
    stats.selected_pixels > regionPixels ||
    (!input.maskPng && stats.selected_pixels !== regionPixels) ||
    stats.valid_pixels > stats.selected_pixels ||
    stats.invalid_pixels !== stats.selected_pixels - stats.valid_pixels ||
    stats.valid_fraction !== stats.valid_pixels / stats.selected_pixels ||
    stats.p10_axial_depth_m > stats.median_axial_depth_m ||
    stats.median_axial_depth_m > stats.p90_axial_depth_m ||
    (input.intrinsics
      ? stats.median_camera_range_m === null ||
        stats.median_camera_range_m < stats.median_axial_depth_m
      : stats.median_camera_range_m !== null)
  )
    throw new Error('Depth response differs from the admitted source, region or calibration.');
  const depthNpy = binaryBytes(parsed.depth_npy_base64);
  if (sha256(depthNpy) !== parsed.depth_npy_sha256)
    throw new Error('Depth response array differs from its declared digest.');
  return {
    provider: parsed.model.provider,
    sourceRevision: parsed.model.source_revision,
    checkpointSha256: parsed.model.checkpoint_sha256,
    sourceImageSha256: parsed.source_image_sha256,
    width: parsed.width,
    height: parsed.height,
    unit: parsed.unit,
    distanceFrame: parsed.distance_frame,
    measurementKind: parsed.measurement_kind,
    metricAccuracy: parsed.metric_accuracy,
    scaleCalibration: parsed.scale_calibration,
    uncertainty: parsed.uncertainty,
    calibrationId: parsed.calibration_id,
    maskPngSha256: region.mask_png_sha256,
    roiXyxy: region.roi_xyxy,
    selectedPixels: stats.selected_pixels,
    validPixels: stats.valid_pixels,
    invalidPixels: stats.invalid_pixels,
    validFraction: stats.valid_fraction,
    medianAxialDepthM: stats.median_axial_depth_m,
    p10AxialDepthM: stats.p10_axial_depth_m,
    p90AxialDepthM: stats.p90_axial_depth_m,
    medianCameraRangeM: stats.median_camera_range_m,
    depthNpy,
    depthNpySha256: parsed.depth_npy_sha256,
    overlayPng: binaryBytes(parsed.overlay_png_base64),
  };
}
