import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { admitObjectMeasurementInput, readObjectMeasurement } from '@edh/perception';

const { values } = parseArgs({
  options: {
    record: { type: 'string', multiple: true },
    'require-provider': { type: 'string', multiple: true },
    output: { type: 'string' },
  },
});
assert(
  values.record?.length && values.output,
  'Supply original --record directories and a fresh --output directory.',
);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const child = relative(resolve(root, '.local/work'), output);
assert(child && !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = await Promise.all(
  [
    'harness/agent-runtime/perception/src/metric-measurement.ts',
    'harness/agent-runtime/perception/src/index.ts',
    'harness/agent-runtime/execution/src/backend-port.ts',
    'apps/server/src/native-worker.ts',
    'scripts/check-recorded-metric-measurement.mjs',
  ].map(async (path) => ({
    path: resolve(root, path),
    sha256: hash(await readFile(resolve(root, path))),
  })),
);
await mkdir(output, { recursive: false });
const records = [];
const providers = new Set();
let cases = 0;
for (const record of values.record) {
  const directory = resolve(record);
  const originalSources = await Promise.all(
    ['measurement.json', 'source.png', 'mask.png'].map(async (name) => {
      const path = resolve(directory, name);
      const bytes = await readFile(path);
      return { path, bytes, sha256: hash(bytes) };
    }),
  );
  const measurement = JSON.parse(originalSources[0].bytes.toString('utf8'));
  assert.equal(measurement.source_image_sha256, originalSources[1].sha256);
  assert.equal(measurement.mask_png_sha256, originalSources[2].sha256);
  const input = {
    observationId: measurement.observation_id,
    camera: measurement.camera,
    sourceImageSha256: originalSources[1].sha256,
    maskPngBase64: originalSources[2].bytes.toString('base64'),
  };
  const expectedInput = structuredClone(input);
  const admitted = admitObjectMeasurementInput(input);
  assert.deepEqual(admitted, expectedInput);
  assert(Object.isFrozen(admitted));
  input.observationId = `${input.observationId}-changed`;
  input.maskPngBase64 = '';
  assert.deepEqual(admitted, expectedInput);
  const original = structuredClone(measurement);
  const decoded = readObjectMeasurement(measurement, admitted, measurement.provider);
  assert.equal(decoded.observationId, original.observation_id);
  assert.equal(decoded.sourceImageSha256, originalSources[1].sha256);
  assert.equal(decoded.maskPngSha256, originalSources[2].sha256);
  assert.equal(decoded.intrinsics.calibrationId, original.intrinsics.calibration_id);
  assert.deepEqual(decoded.intrinsicMatrix, original.intrinsic_matrix);
  assert.deepEqual(decoded.cameraToWorld, original.camera_to_world);
  assert.deepEqual(decoded.centroidCameraXYZ, original.centroid_camera_xyz);
  assert.deepEqual(decoded.centroidWorldXYZ, original.centroid_world_xyz);
  const decodedBytes = JSON.stringify(decoded);
  measurement.centroid_camera_xyz[0] += 0.25;
  measurement.camera_to_world[0][3] += 0.25;
  measurement.intrinsics.fx += 1;
  assert.equal(JSON.stringify(decoded), decodedBytes);
  const checks = ['original-measurement', 'detached-request', 'detached-result'];
  const reject = (name, change, pattern) => {
    const derivative = structuredClone(original);
    change(derivative);
    assert.throws(() => readObjectMeasurement(derivative, admitted, original.provider), pattern);
    checks.push(name);
  };
  const statistics = /statistics are invalid/;
  const identity = /source or coordinate identity is invalid/;
  for (const [name, change, pattern] of [
    ['foreign-observation', (value) => (value.observation_id += '-foreign'), identity],
    [
      'foreign-image',
      (value) => (value.source_image_sha256 = hash('declared foreign RGB identity')),
      identity,
    ],
    [
      'foreign-mask',
      (value) => (value.mask_png_sha256 = hash('declared foreign mask identity')),
      identity,
    ],
    ['foreign-camera-frame', (value) => (value.camera_frame += '-foreign'), identity],
    ['foreign-world-frame', (value) => (value.world_frame += '-foreign'), identity],
    ['nonfinite-depth', (value) => (value.median_axial_depth_m = Infinity), /Invalid input/],
    ['fractional-pixel-count', (value) => (value.selected_pixels += 0.5), /Invalid input/],
    ['inconsistent-pixel-count', (value) => value.invalid_pixels++, statistics],
    ['inconsistent-coverage', (value) => (value.valid_fraction /= 2), statistics],
    ['oversized-capture', (value) => (value.width = 4_000_001), statistics],
    [
      'reversed-depth-quantiles',
      (value) => (value.p10_axial_depth_m = value.p90_axial_depth_m + 1),
      statistics,
    ],
    [
      'invalid-camera-range',
      (value) => (value.median_camera_range_m = value.median_axial_depth_m / 2),
      statistics,
    ],
    ['out-of-image-centroid', (value) => (value.centroid_pixel[0] = value.width), statistics],
    [
      'invalid-camera-centroid-depth',
      (value) => (value.centroid_camera_xyz[2] = value.minimum_depth_m),
      statistics,
    ],
    [
      'inconsistent-intrinsics',
      (value) => (value.intrinsics.fx += 1),
      /intrinsics are inconsistent/,
    ],
    [
      'invalid-intrinsic-row',
      (value) => (value.intrinsic_matrix[2][0] = 1),
      /intrinsics are inconsistent/,
    ],
    ['nonhomogeneous-transform', (value) => (value.camera_to_world[3][0] = 1), /not homogeneous/],
    ['nonrigid-transform', (value) => (value.camera_to_world[0][0] += 0.1), /not rigid/],
    [
      'inconsistent-world-centroid',
      (value) => (value.centroid_world_xyz[0] += 0.25),
      /centroids are inconsistent/,
    ],
    [
      'inconsistent-camera-centroid',
      (value) => (value.centroid_camera_xyz[0] += 0.25),
      /centroids are inconsistent/,
    ],
    ['invalid-measurement-time', (value) => (value.measured_at = 'invalid'), /Invalid input/],
  ])
    reject(name, change, pattern);
  reject(
    'singular-intrinsics',
    (value) => {
      value.intrinsic_matrix[0][1] = value.intrinsics.fx;
      value.intrinsic_matrix[1][0] = value.intrinsics.fy;
    },
    /intrinsics are singular/,
  );
  reject(
    'reflected-transform',
    (value) => {
      for (let row = 0; row < 3; row++) value.camera_to_world[row][0] *= -1;
    },
    /not a proper rotation/,
  );
  assert.throws(() => readObjectMeasurement(original, admitted, 'toString'), /Invalid option/);
  checks.push('unsupported-provider');
  for (const [name, derivative] of [
    [
      'invalid-source-digest',
      { ...expectedInput, sourceImageSha256: `${expectedInput.sourceImageSha256}\n` },
    ],
    ['invalid-camera-name', { ...expectedInput, camera: `${expectedInput.camera}\n` }],
    ['empty-mask', { ...expectedInput, maskPngBase64: '' }],
    [
      'invalid-mask-encoding',
      { ...expectedInput, maskPngBase64: `${expectedInput.maskPngBase64}\n` },
    ],
    ['foreign-input-field', { ...expectedInput, unrecognized: true }],
  ]) {
    assert.throws(() => admitObjectMeasurementInput(derivative));
    checks.push(name);
  }
  for (const source of originalSources)
    assert.equal(hash(await readFile(source.path)), source.sha256);
  providers.add(original.provider);
  cases += checks.length;
  records.push({
    directory,
    provider: original.provider,
    observationId: original.observation_id,
    sources: originalSources.map(({ path, sha256 }) => ({ path, sha256 })),
    decoded,
    decodedSha256: hash(decodedBytes),
    checks,
  });
}
for (const provider of values['require-provider'] ?? [])
  assert(providers.has(provider), `No original ${provider} measurement was checked.`);
for (const source of sources) assert.equal(hash(await readFile(source.path)), source.sha256);
const report = {
  schemaVersion: 'edh.metric_measurement_cpu.v1',
  sources,
  records,
  cases,
  providers: [...providers].sort(),
  originalSourcesUnchanged: true,
  gpuAllocations: 0,
  simulatorAllocations: 0,
  modelCalls: 0,
  physicalControls: 0,
  scope:
    'Production admission of original native RGB-D receipts and explicitly declared invalid derivatives; no new environment or model execution.',
};
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(report, null, 2)}\n`, {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    originals: records.length,
    providers: report.providers,
    cases,
    originalSourcesUnchanged: true,
    gpuAllocations: 0,
  }),
);
