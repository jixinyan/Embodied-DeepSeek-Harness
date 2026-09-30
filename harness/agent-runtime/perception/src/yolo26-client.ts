import { createHash } from 'node:crypto';
import type { ImageMediaType } from '@deepseek-ai/dsh-attachment';

export interface DepthCameraIntrinsics {
  calibrationId: string;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
}

export interface DepthInput {
  image: Uint8Array;
  mediaType: ImageMediaType;
  width: number;
  height: number;
  maskPng?: Uint8Array;
  roiXyxy?: readonly [number, number, number, number];
  intrinsics?: DepthCameraIntrinsics;
  signal: AbortSignal;
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

export interface DepthEngine {
  readonly timeoutMs?: number;
  estimate(input: DepthInput): Promise<DepthOutput>;
}

const sha256 = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function binary(value: unknown): Uint8Array {
  if (typeof value !== 'string' || value.length > 44_739_244)
    throw new Error('Depth service binary encoding exceeds its limit.');
  const bytes = Buffer.from(value, 'base64');
  if (
    !bytes.byteLength ||
    bytes.byteLength > 32 * 1024 * 1024 ||
    bytes.toString('base64') !== value
  )
    throw new Error('Depth service binary encoding is invalid.');
  return bytes;
}

function parseOutput(value: unknown, input: DepthInput): DepthOutput {
  if (!object(value) || !object(value.model) || !object(value.region) || !object(value.statistics))
    throw new Error('Depth service returned invalid metadata.');
  const model = value.model;
  const region = value.region;
  const stats = value.statistics;
  const expectedRoi = input.roiXyxy ?? null;
  const expectedMask = input.maskPng ? sha256(input.maskPng) : null;
  if (
    model.provider !== 'ultralytics-yolo26-depth' ||
    typeof model.source_revision !== 'string' ||
    !/^[a-f0-9]{40}$/.test(model.source_revision) ||
    !digest(model.checkpoint_sha256) ||
    value.source_image_sha256 !== sha256(input.image) ||
    value.width !== input.width ||
    value.height !== input.height ||
    value.unit !== 'meter' ||
    value.distance_frame !== 'camera_axial_depth' ||
    value.measurement_kind !== 'monocular_prediction' ||
    value.metric_accuracy !== 'unverified_for_source_camera' ||
    value.scale_calibration !== 'checkpoint_global_calibration' ||
    value.uncertainty !== 'not_provided_by_model' ||
    value.calibration_id !== (input.intrinsics?.calibrationId ?? null) ||
    region.mask_png_sha256 !== expectedMask ||
    JSON.stringify(region.roi_xyxy) !== JSON.stringify(expectedRoi) ||
    !integer(stats.selected_pixels) ||
    stats.selected_pixels < 1 ||
    stats.selected_pixels > input.width * input.height ||
    !integer(stats.valid_pixels) ||
    stats.valid_pixels < 1 ||
    stats.valid_pixels > stats.selected_pixels ||
    stats.invalid_pixels !== stats.selected_pixels - stats.valid_pixels ||
    stats.valid_fraction !== stats.valid_pixels / stats.selected_pixels ||
    !positive(stats.median_axial_depth_m) ||
    !positive(stats.p10_axial_depth_m) ||
    !positive(stats.p90_axial_depth_m) ||
    stats.p10_axial_depth_m > stats.median_axial_depth_m ||
    stats.median_axial_depth_m > stats.p90_axial_depth_m ||
    (input.intrinsics
      ? !positive(stats.median_camera_range_m)
      : stats.median_camera_range_m !== null) ||
    !digest(value.depth_npy_sha256)
  )
    throw new Error('Depth service returned inconsistent source, calibration or statistics.');
  const depthNpy = binary(value.depth_npy_base64);
  if (sha256(depthNpy) !== value.depth_npy_sha256)
    throw new Error('Depth array differs from its declared digest.');
  return {
    provider: model.provider,
    sourceRevision: model.source_revision,
    checkpointSha256: model.checkpoint_sha256,
    sourceImageSha256: value.source_image_sha256,
    width: input.width,
    height: input.height,
    unit: value.unit,
    distanceFrame: value.distance_frame,
    measurementKind: value.measurement_kind,
    metricAccuracy: value.metric_accuracy,
    scaleCalibration: value.scale_calibration,
    uncertainty: value.uncertainty,
    calibrationId: input.intrinsics?.calibrationId ?? null,
    maskPngSha256: expectedMask,
    roiXyxy: expectedRoi,
    selectedPixels: stats.selected_pixels,
    validPixels: stats.valid_pixels,
    invalidPixels: stats.invalid_pixels as number,
    validFraction: stats.valid_fraction as number,
    medianAxialDepthM: stats.median_axial_depth_m,
    p10AxialDepthM: stats.p10_axial_depth_m,
    p90AxialDepthM: stats.p90_axial_depth_m,
    medianCameraRangeM: stats.median_camera_range_m as number | null,
    depthNpy,
    depthNpySha256: value.depth_npy_sha256,
    overlayPng: binary(value.overlay_png_base64),
  };
}

export class Yolo26HttpClient implements DepthEngine {
  private readonly endpoint: URL;
  readonly timeoutMs: number;

  constructor(address: string, timeoutMs = 600_000) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000)
      throw new Error('YOLO26 tool timeout must contain 1 to 600000 milliseconds.');
    this.timeoutMs = timeoutMs;
    const endpoint = new URL('/depth', address);
    if (
      endpoint.protocol !== 'http:' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    )
      throw new Error('YOLO26 endpoint must use loopback HTTP.');
    this.endpoint = endpoint;
  }

  async estimate(input: DepthInput): Promise<DepthOutput> {
    input.signal.throwIfAborted();
    if (
      !input.image.byteLength ||
      input.image.byteLength > 32 * 1024 * 1024 ||
      !integer(input.width) ||
      !integer(input.height) ||
      input.width < 1 ||
      input.height < 1 ||
      input.width * input.height > 4_000_000
    )
      throw new Error('Depth source image exceeds its input bounds.');
    const intrinsics = input.intrinsics;
    if (
      intrinsics &&
      (!intrinsics.calibrationId ||
        intrinsics.calibrationId.length > 128 ||
        !positive(intrinsics.fx) ||
        !positive(intrinsics.fy) ||
        !Number.isFinite(intrinsics.cx) ||
        !Number.isFinite(intrinsics.cy))
    )
      throw new Error('Depth camera intrinsics are invalid.');
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        image_base64: Buffer.from(input.image).toString('base64'),
        image_mime_type: input.mediaType,
        mask_png_base64: input.maskPng ? Buffer.from(input.maskPng).toString('base64') : null,
        roi_xyxy: input.roiXyxy ?? null,
        intrinsics: intrinsics
          ? {
              calibration_id: intrinsics.calibrationId,
              fx: intrinsics.fx,
              fy: intrinsics.fy,
              cx: intrinsics.cx,
              cy: intrinsics.cy,
            }
          : null,
      }),
      signal: AbortSignal.any([input.signal, AbortSignal.timeout(this.timeoutMs)]),
    });
    if (!response.ok) throw new Error(`YOLO26 service returned HTTP ${response.status}.`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('YOLO26 response has no body.');
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      received += part.value.byteLength;
      if (received > 64 * 1024 * 1024) {
        await reader.cancel();
        throw new Error('YOLO26 response exceeds 64 MiB.');
      }
      chunks.push(part.value);
    }
    return parseOutput(JSON.parse(Buffer.concat(chunks).toString('utf8')), input);
  }
}
