import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { BackendObjectMeasurement, BackendObjectMeasurementInput } from '@edh/execution';

const identity = z.string().min(1).max(128);
const digest = z
  .string()
  .length(64)
  .regex(/^[a-f0-9]{64}$/);
const camera = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$(?![\s\S])/);
const finite = z.number().finite();
const positive = finite.positive();
const integer = finite.int().safe();
const vector3 = z.tuple([finite, finite, finite]);
const vector4 = z.tuple([finite, finite, finite, finite]);
const providerSchema = z.enum(['robocasa', 'robotwin', 'behavior', 'robodojo']);
const worldFrames = {
  robocasa: 'robocasa.mujoco.world',
  robotwin: 'robotwin.sapien.world',
  behavior: 'behavior.omnigibson.world',
  robodojo: 'robodojo.isaac.world',
} as const;
const inputSchema = z
  .object({
    observationId: identity,
    camera,
    sourceImageSha256: digest,
    maskPngBase64: z
      .string()
      .min(1)
      .max(8 * 1024 * 1024)
      .base64(),
  })
  .strict();
const measurementSchema = z.object({
  provider: providerSchema,
  source: z.enum([
    'robocasa-native-rgbd',
    'robotwin-native-rgbd',
    'behavior-native-rgbd',
    'robodojo-native-rgbd',
  ]),
  measurement_kind: z.literal('simulator_metric_depth'),
  unit: z.literal('meter'),
  distance_frame: z.literal('camera_axial_depth'),
  centroid_kind: z.literal('mean_of_visible_valid_surface_points'),
  camera_frame: identity,
  world_frame: identity,
  coordinate_axes: z.tuple([z.literal('right'), z.literal('down'), z.literal('forward')]),
  observation_id: identity,
  measurement_capture_id: identity,
  camera,
  source_image_sha256: digest,
  mask_png_sha256: digest,
  measured_at: z
    .string()
    .min(1)
    .refine((value) => Number.isFinite(Date.parse(value))),
  simulation_time_s: finite.nonnegative(),
  width: integer.positive(),
  height: integer.positive(),
  selected_pixels: integer.positive(),
  valid_pixels: integer.positive(),
  invalid_pixels: integer.nonnegative(),
  valid_fraction: positive.max(1),
  median_axial_depth_m: positive,
  p10_axial_depth_m: positive,
  p90_axial_depth_m: positive,
  median_camera_range_m: positive,
  centroid_pixel: z.tuple([finite, finite]),
  centroid_camera_xyz: vector3,
  centroid_world_xyz: vector3,
  intrinsics: z.object({
    calibration_id: digest,
    fx: positive,
    fy: positive,
    cx: finite,
    cy: finite,
  }),
  intrinsic_matrix: z.tuple([vector3, vector3, vector3]),
  camera_to_world: z.tuple([vector4, vector4, vector4, vector4]),
  minimum_depth_m: positive,
  maximum_depth_m: positive,
});

export function admitObjectMeasurementInput(
  value: unknown,
): Readonly<BackendObjectMeasurementInput> {
  const input = inputSchema.parse(value);
  if (Buffer.from(input.maskPngBase64, 'base64').toString('base64') !== input.maskPngBase64)
    throw new Error('Native object measurement mask encoding is not canonical base64.');
  return Object.freeze(input);
}

export function readObjectMeasurement(
  value: unknown,
  request: BackendObjectMeasurementInput,
  provider: string,
): BackendObjectMeasurement {
  const input = admitObjectMeasurementInput(request);
  const metricProvider = providerSchema.parse(provider);
  const result = measurementSchema.parse(value);
  const source = `${metricProvider}-native-rgbd` as BackendObjectMeasurement['source'];
  if (
    result.provider !== metricProvider ||
    result.source !== source ||
    result.observation_id !== input.observationId ||
    result.camera !== input.camera ||
    result.camera_frame !== `${metricProvider}.${input.camera}.optical` ||
    result.world_frame !== worldFrames[metricProvider] ||
    result.source_image_sha256 !== input.sourceImageSha256 ||
    result.mask_png_sha256 !==
      createHash('sha256').update(Buffer.from(input.maskPngBase64, 'base64')).digest('hex')
  )
    throw new Error('Native object measurement source or coordinate identity is invalid.');
  if (
    result.width * result.height > 4_000_000 ||
    result.selected_pixels > result.width * result.height ||
    result.valid_pixels + result.invalid_pixels !== result.selected_pixels ||
    result.valid_fraction !== result.valid_pixels / result.selected_pixels ||
    result.maximum_depth_m <= result.minimum_depth_m ||
    result.p10_axial_depth_m <= result.minimum_depth_m ||
    result.p10_axial_depth_m > result.median_axial_depth_m ||
    result.median_axial_depth_m > result.p90_axial_depth_m ||
    result.p90_axial_depth_m >= result.maximum_depth_m ||
    result.median_camera_range_m < result.median_axial_depth_m ||
    result.centroid_pixel[0] < 0 ||
    result.centroid_pixel[0] > result.width - 1 ||
    result.centroid_pixel[1] < 0 ||
    result.centroid_pixel[1] > result.height - 1 ||
    result.centroid_camera_xyz[2] <= result.minimum_depth_m ||
    result.centroid_camera_xyz[2] >= result.maximum_depth_m
  )
    throw new Error('Native object measurement statistics are invalid.');
  const intrinsic = result.intrinsic_matrix;
  if (
    intrinsic[0][0] !== result.intrinsics.fx ||
    intrinsic[1][1] !== result.intrinsics.fy ||
    intrinsic[0][2] !== result.intrinsics.cx ||
    intrinsic[1][2] !== result.intrinsics.cy ||
    intrinsic[2][0] !== 0 ||
    intrinsic[2][1] !== 0 ||
    intrinsic[2][2] !== 1
  )
    throw new Error('Native object measurement intrinsics are inconsistent.');
  const xScale = Math.max(Math.abs(intrinsic[0][0]), Math.abs(intrinsic[0][1]));
  const yScale = Math.max(Math.abs(intrinsic[1][0]), Math.abs(intrinsic[1][1]));
  if (
    (intrinsic[0][0] / xScale) * (intrinsic[1][1] / yScale) ===
    (intrinsic[0][1] / xScale) * (intrinsic[1][0] / yScale)
  )
    throw new Error('Native object measurement intrinsics are singular.');
  const transform = result.camera_to_world;
  if (
    transform[3][0] !== 0 ||
    transform[3][1] !== 0 ||
    transform[3][2] !== 0 ||
    transform[3][3] !== 1
  )
    throw new Error('Native object measurement transform is not homogeneous.');
  for (let a = 0; a < 3; a++)
    for (let b = 0; b < 3; b++) {
      const dot =
        transform[0][a]! * transform[0][b]! +
        transform[1][a]! * transform[1][b]! +
        transform[2][a]! * transform[2][b]!;
      if (!Number.isFinite(dot) || Math.abs(dot - (a === b ? 1 : 0)) > 1e-6)
        throw new Error('Native object measurement transform is not rigid.');
    }
  const determinant =
    transform[0][0] * (transform[1][1] * transform[2][2] - transform[1][2] * transform[2][1]) -
    transform[0][1] * (transform[1][0] * transform[2][2] - transform[1][2] * transform[2][0]) +
    transform[0][2] * (transform[1][0] * transform[2][1] - transform[1][1] * transform[2][0]);
  if (!Number.isFinite(determinant) || Math.abs(determinant - 1) > 1e-6)
    throw new Error('Native object measurement transform is not a proper rotation.');
  const accumulation = result.valid_pixels * Number.EPSILON;
  // float64 累积误差范围与原始 RGB-D 的 NumPy 验证保持一致。
  const bound = (8 * accumulation) / (1 - accumulation);
  for (let axis = 0; axis < 3; axis++) {
    const row = transform[axis]!;
    const projected =
      row[0] * result.centroid_camera_xyz[0] +
      row[1] * result.centroid_camera_xyz[1] +
      row[2] * result.centroid_camera_xyz[2] +
      row[3];
    const recorded = result.centroid_world_xyz[axis]!;
    const scale = Math.max(
      1,
      Math.abs(recorded),
      Math.abs(row[3]),
      ...result.centroid_camera_xyz.map(Math.abs),
    );
    if (!Number.isFinite(projected) || Math.abs(projected - recorded) > bound * scale)
      throw new Error('Native object measurement camera/world centroids are inconsistent.');
  }
  return {
    provider: metricProvider,
    source,
    measurementKind: result.measurement_kind,
    unit: result.unit,
    distanceFrame: result.distance_frame,
    centroidKind: result.centroid_kind,
    cameraFrame: result.camera_frame,
    worldFrame: result.world_frame,
    coordinateAxes: result.coordinate_axes,
    observationId: result.observation_id,
    measurementCaptureId: result.measurement_capture_id,
    camera: result.camera,
    sourceImageSha256: result.source_image_sha256,
    maskPngSha256: result.mask_png_sha256,
    measuredAt: result.measured_at,
    simulationTimeS: result.simulation_time_s,
    width: result.width,
    height: result.height,
    selectedPixels: result.selected_pixels,
    validPixels: result.valid_pixels,
    invalidPixels: result.invalid_pixels,
    validFraction: result.valid_fraction,
    medianAxialDepthM: result.median_axial_depth_m,
    p10AxialDepthM: result.p10_axial_depth_m,
    p90AxialDepthM: result.p90_axial_depth_m,
    medianCameraRangeM: result.median_camera_range_m,
    centroidPixel: result.centroid_pixel,
    centroidCameraXYZ: result.centroid_camera_xyz,
    centroidWorldXYZ: result.centroid_world_xyz,
    intrinsics: {
      calibrationId: result.intrinsics.calibration_id,
      fx: result.intrinsics.fx,
      fy: result.intrinsics.fy,
      cx: result.intrinsics.cx,
      cy: result.intrinsics.cy,
    },
    intrinsicMatrix: result.intrinsic_matrix,
    cameraToWorld: result.camera_to_world,
    minimumDepthM: result.minimum_depth_m,
    maximumDepthM: result.maximum_depth_m,
  };
}
