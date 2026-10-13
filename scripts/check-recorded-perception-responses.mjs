import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import {
  admitSegmentationInput,
  admitDepthInput,
  readSegmentationResponse,
  readDepthResponse,
} from '@edh/perception';

const { values } = parseArgs({
  options: {
    captures: { type: 'string' },
    images: { type: 'string' },
    'uncalibrated-captures': { type: 'string' },
    output: { type: 'string' },
  },
});
assert(values.captures && values.images && values.output);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const child = relative(resolve(root, '.local/work'), output);
assert(child && !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = new Map();
const original = async (file) => {
  const path = resolve(file);
  const bytes = await readFile(path);
  const sha256 = hash(bytes);
  if (sources.has(path)) assert.equal(sources.get(path), sha256);
  sources.set(path, sha256);
  return bytes;
};
const json = async (file) => JSON.parse((await original(file)).toString('utf8'));
const implementationPaths = [
  'harness/agent-runtime/perception/src/model-responses.ts',
  'harness/agent-runtime/perception/src/request-inputs.ts',
  'harness/agent-runtime/perception/src/sam31-client.ts',
  'harness/agent-runtime/perception/src/yolo26-client.ts',
  'harness/agent-runtime/perception/src/results.ts',
  'harness/agent-runtime/perception/src/index.ts',
  'harness/physical-runtime/src/physical_harness/perception/sam31.py',
  'harness/physical-runtime/src/physical_harness/perception/yolo26_depth.py',
  'scripts/check-recorded-perception-responses.mjs',
];
const implementation = await Promise.all(
  implementationPaths.map(async (path) => ({
    path,
    sha256: hash(await readFile(resolve(root, path))),
  })),
);
await mkdir(output, { recursive: false });
const cases = [];
const responses = [];
const verify = (camera, kind, name, check) => {
  check();
  cases.push({ camera, kind, name, passed: true });
};
const rejectDerivative = (camera, kind, name, raw, input, reader, change) =>
  verify(camera, kind, name, () => {
    const derivative = structuredClone(raw);
    change(derivative);
    assert.throws(() => reader(derivative, input));
  });
const cancelled = (camera, kind, raw, input, reader) =>
  verify(camera, kind, 'cancelled-original-response', () => {
    const controller = new AbortController();
    const reason = new Error('Recorded perception inspection cancelled.');
    controller.abort(reason);
    assert.throws(
      () => reader(raw, { ...input, signal: controller.signal }),
      (error) => error === reason,
    );
  });

for (const entry of await readdir(resolve(values.captures), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const camera = entry.name;
  const directory = resolve(values.captures, camera);
  const image = await original(resolve(values.images, `${camera}.png`));
  const samDirectory = resolve(directory, 'sam');
  const report = await json(resolve(samDirectory, 'result.json'));
  assert.equal(report.source_image_sha256, hash(image));
  assert.equal(report.instance_count, report.instances.length);
  const overlay = await original(resolve(samDirectory, 'overlay.png'));
  assert.equal(report.overlay_sha256, hash(overlay));
  const masks = [];
  const raw = {
    ...report,
    overlay_png_base64: overlay.toString('base64'),
    instances: await Promise.all(
      report.instances.map(async (instance, index) => {
        const mask = await original(
          resolve(samDirectory, `mask-${String(index).padStart(2, '0')}.png`),
        );
        masks[index] = mask;
        return { ...instance, mask_png_base64: mask.toString('base64') };
      }),
    ),
  };
  const input = admitSegmentationInput({
    image,
    mediaType: 'image/png',
    textPrompt: report.prompt,
    signal: new AbortController().signal,
  });
  verify(camera, 'sam', 'original-response', () => {
    const decoded = readSegmentationResponse(raw, input);
    assert.deepEqual(decoded, {
      provider: report.model.provider,
      sourceRevision: report.model.source_revision,
      checkpointSha256: report.model.checkpoint_sha256,
      sessionAdapter: report.model.session_adapter,
      sessionId: report.session_id,
      sourceImageSha256: report.source_image_sha256,
      modelInputSha256: report.model_input.sha256,
      width: report.width,
      height: report.height,
      overlayPng: overlay,
      instances: report.instances.map((instance, index) => ({
        objectId: instance.object_id,
        score: instance.score,
        bboxXyxy: instance.bbox_xyxy,
        areaPixels: instance.area_pixels,
        maskPng: masks[index],
      })),
    });
    responses.push({
      camera,
      kind: 'sam',
      sessionId: decoded.sessionId,
      instances: decoded.instances.length,
    });
  });
  verify(camera, 'sam', 'detached-original-response', () => {
    const copy = structuredClone(raw);
    const decoded = readSegmentationResponse(copy, input);
    copy.model.source_revision = '0'.repeat(40);
    if (copy.instances.length) {
      copy.instances[0].bbox_xyxy[0]++;
      assert.deepEqual(decoded.instances[0].bboxXyxy, report.instances[0].bbox_xyxy);
    }
    assert.equal(decoded.sourceRevision, report.model.source_revision);
    assert.equal(hash(decoded.overlayPng), hash(overlay));
  });
  cancelled(camera, 'sam', raw, input, readSegmentationResponse);
  const samChanges = [
    ['foreign-source', (value) => (value.source_image_sha256 = '0'.repeat(64))],
    ['foreign-provider', (value) => (value.model.provider = 'invalid-provider')],
    ['invalid-revision', (value) => (value.model.source_revision = '0'.repeat(39))],
    ['invalid-checkpoint', (value) => (value.model.checkpoint_sha256 = '0'.repeat(63))],
    ['invalid-session', (value) => (value.session_id = '-'.repeat(36))],
    ['invalid-model-input', (value) => (value.model_input.sha256 = '0'.repeat(63))],
    ['invalid-conversion', (value) => (value.model_input.media_type = 'image/png')],
    ['zero-width', (value) => (value.width = 0)],
    ['fractional-height', (value) => (value.height += 0.5)],
    [
      'excessive-source-area',
      (value) => {
        value.width = value.height = 3000;
      },
    ],
    ['empty-overlay', (value) => (value.overlay_png_base64 = '')],
    ['noncanonical-overlay', (value) => (value.overlay_png_base64 += '\n')],
  ];
  if (raw.instances.length) {
    samChanges.push(
      ['duplicate-object', (value) => value.instances.push(structuredClone(value.instances[0]))],
      [
        'excessive-instances',
        (value) => {
          value.instances = Array.from({ length: 17 }, () => structuredClone(value.instances[0]));
        },
      ],
      ['nonfinite-score', (value) => (value.instances[0].score = NaN)],
      ['negative-object', (value) => (value.instances[0].object_id = -1)],
      ['fractional-object', (value) => (value.instances[0].object_id += 0.5)],
      ['empty-mask', (value) => (value.instances[0].mask_png_base64 = '')],
      ['noncanonical-mask', (value) => (value.instances[0].mask_png_base64 += '\n')],
      [
        'invalid-box',
        (value) => (value.instances[0].bbox_xyxy[2] = value.instances[0].bbox_xyxy[0]),
      ],
      ['outside-box', (value) => (value.instances[0].bbox_xyxy[2] = value.width + 1)],
      [
        'excessive-mask-area',
        (value) => {
          const [left, top, right, bottom] = value.instances[0].bbox_xyxy;
          value.instances[0].area_pixels = (right - left) * (bottom - top) + 1;
        },
      ],
    );
  }
  for (const [name, change] of samChanges)
    rejectDerivative(camera, 'sam', name, raw, input, readSegmentationResponse, change);

  for (const depthEntry of await readdir(directory, { withFileTypes: true })) {
    if (!depthEntry.isDirectory() || !/^yolo-\d+$/.test(depthEntry.name)) continue;
    const depthDirectory = resolve(directory, depthEntry.name);
    const depthReport = await json(resolve(depthDirectory, 'result.json'));
    const index = Number(depthEntry.name.slice('yolo-'.length));
    const mask = masks[index];
    assert(mask && depthReport.region.roi_xyxy === null);
    const intrinsics = await json(resolve(directory, 'intrinsics.json'));
    const request = admitDepthInput({
      image,
      mediaType: 'image/png',
      width: depthReport.width,
      height: depthReport.height,
      maskPng: mask,
      intrinsics: {
        calibrationId: intrinsics.calibration_id,
        fx: intrinsics.fx,
        fy: intrinsics.fy,
        cx: intrinsics.cx,
        cy: intrinsics.cy,
      },
      signal: new AbortController().signal,
    });
    const depth = await original(resolve(depthDirectory, 'depth.npy'));
    const depthOverlay = await original(resolve(depthDirectory, 'overlay.png'));
    assert.equal(depthReport.depth_npy_sha256, hash(depth));
    assert.equal(depthReport.overlay_png_sha256, hash(depthOverlay));
    const response = {
      ...depthReport,
      depth_npy_base64: depth.toString('base64'),
      overlay_png_base64: depthOverlay.toString('base64'),
    };
    const identity = `${camera}/${depthEntry.name}`;
    const decoded = readDepthResponse(response, request);
    verify(identity, 'yolo', 'original-response', () => {
      assert.deepEqual(decoded, {
        provider: depthReport.model.provider,
        sourceRevision: depthReport.model.source_revision,
        checkpointSha256: depthReport.model.checkpoint_sha256,
        sourceImageSha256: depthReport.source_image_sha256,
        width: depthReport.width,
        height: depthReport.height,
        unit: depthReport.unit,
        distanceFrame: depthReport.distance_frame,
        measurementKind: depthReport.measurement_kind,
        metricAccuracy: depthReport.metric_accuracy,
        scaleCalibration: depthReport.scale_calibration,
        uncertainty: depthReport.uncertainty,
        calibrationId: depthReport.calibration_id,
        maskPngSha256: depthReport.region.mask_png_sha256,
        roiXyxy: depthReport.region.roi_xyxy,
        selectedPixels: depthReport.statistics.selected_pixels,
        validPixels: depthReport.statistics.valid_pixels,
        invalidPixels: depthReport.statistics.invalid_pixels,
        validFraction: depthReport.statistics.valid_fraction,
        medianAxialDepthM: depthReport.statistics.median_axial_depth_m,
        p10AxialDepthM: depthReport.statistics.p10_axial_depth_m,
        p90AxialDepthM: depthReport.statistics.p90_axial_depth_m,
        medianCameraRangeM: depthReport.statistics.median_camera_range_m,
        depthNpy: depth,
        depthNpySha256: depthReport.depth_npy_sha256,
        overlayPng: depthOverlay,
      });
      responses.push({
        camera: identity,
        kind: 'yolo',
        maskPngSha256: decoded.maskPngSha256,
        medianCameraRangeM: decoded.medianCameraRangeM,
      });
    });
    cancelled(identity, 'yolo', response, request, readDepthResponse);
    const depthChanges = [
      ['foreign-provider', (value) => (value.model.provider = 'invalid-provider')],
      ['foreign-source', (value) => (value.source_image_sha256 = '0'.repeat(64))],
      ['foreign-width', (value) => value.width++],
      ['foreign-mask', (value) => (value.region.mask_png_sha256 = '0'.repeat(64))],
      ['foreign-calibration', (value) => (value.calibration_id += '-invalid')],
      ['foreign-region', (value) => (value.region.roi_xyxy = [0, 0, value.width, value.height])],
      ['invalid-unit', (value) => (value.unit = 'millimeter')],
      ['invalid-accuracy', (value) => (value.metric_accuracy = 'verified')],
      ['invalid-revision', (value) => (value.model.source_revision = '0'.repeat(39))],
      ['invalid-checkpoint', (value) => (value.model.checkpoint_sha256 = '0'.repeat(63))],
      ['invalid-count', (value) => (value.statistics.selected_pixels += 0.5)],
      [
        'excessive-pixels',
        (value) => (value.statistics.selected_pixels = value.width * value.height + 1),
      ],
      [
        'excessive-valid-count',
        (value) => (value.statistics.valid_pixels = value.statistics.selected_pixels + 1),
      ],
      ['invalid-invalid-count', (value) => value.statistics.invalid_pixels++],
      ['invalid-coverage', (value) => (value.statistics.valid_fraction = 0.5)],
      ['nonfinite-depth', (value) => (value.statistics.median_axial_depth_m = Infinity)],
      ['negative-depth', (value) => (value.statistics.p10_axial_depth_m = -1)],
      [
        'invalid-lower-quantile',
        (value) => (value.statistics.p10_axial_depth_m = value.statistics.median_axial_depth_m + 1),
      ],
      [
        'invalid-upper-quantile',
        (value) => (value.statistics.p90_axial_depth_m = value.statistics.median_axial_depth_m / 2),
      ],
      [
        'invalid-range',
        (value) =>
          (value.statistics.median_camera_range_m = value.statistics.median_axial_depth_m / 2),
      ],
      ['missing-range', (value) => (value.statistics.median_camera_range_m = null)],
      ['foreign-array-digest', (value) => (value.depth_npy_sha256 = '0'.repeat(64))],
      ['empty-array', (value) => (value.depth_npy_base64 = '')],
      ['noncanonical-array', (value) => (value.depth_npy_base64 += '\n')],
      ['empty-overlay', (value) => (value.overlay_png_base64 = '')],
      ['noncanonical-overlay', (value) => (value.overlay_png_base64 += '\n')],
    ];
    for (const [name, change] of depthChanges)
      rejectDerivative(identity, 'yolo', name, response, request, readDepthResponse, change);
    verify(identity, 'yolo', 'mask-region-capacity', () => {
      const roi = report.instances[index].bbox_xyxy;
      const derivative = structuredClone(response);
      derivative.region.roi_xyxy = roi;
      derivative.statistics.selected_pixels = (roi[2] - roi[0]) * (roi[3] - roi[1]) + 1;
      derivative.statistics.valid_pixels = derivative.statistics.selected_pixels;
      derivative.statistics.invalid_pixels = 0;
      derivative.statistics.valid_fraction = 1;
      assert.throws(() =>
        readDepthResponse(derivative, admitDepthInput({ ...request, roiXyxy: roi })),
      );
    });
    verify(identity, 'yolo', 'unmasked-region-capacity', () => {
      const derivative = structuredClone(response);
      derivative.region.mask_png_sha256 = null;
      const { maskPng, ...unmasked } = request;
      assert.throws(() => readDepthResponse(derivative, admitDepthInput(unmasked)));
    });
  }
}
if (values['uncalibrated-captures']) {
  const directory = resolve(values['uncalibrated-captures']);
  const phases = await json(resolve(directory, 'result.json'));
  for (const phase of phases) {
    assert(phase.phase === 'cold' || phase.phase === 'warm');
    const image = await original(resolve(values.images, 'robot0_agentview_left.png'));
    assert.equal(hash(image), phase.sourceImageSha256);
    for (const [index, instance] of phase.instances.entries()) {
      const metrics = instance.depth;
      const prefix = resolve(directory, `${phase.phase}-${index}`);
      const mask = await original(`${prefix}-mask.png`);
      const depth = await original(`${prefix}-depth.npy`);
      const overlay = await original(`${prefix}-depth.png`);
      assert.equal(hash(mask), metrics.maskPngSha256);
      assert.equal(hash(depth), metrics.depthNpySha256);
      const request = admitDepthInput({
        image,
        mediaType: 'image/png',
        width: metrics.width,
        height: metrics.height,
        roiXyxy: instance.bboxXyxy,
        maskPng: mask,
        signal: new AbortController().signal,
      });
      const response = {
        model: {
          provider: metrics.provider,
          source_revision: metrics.sourceRevision,
          checkpoint_sha256: metrics.checkpointSha256,
        },
        source_image_sha256: metrics.sourceImageSha256,
        width: metrics.width,
        height: metrics.height,
        unit: metrics.unit,
        distance_frame: metrics.distanceFrame,
        measurement_kind: metrics.measurementKind,
        metric_accuracy: metrics.metricAccuracy,
        scale_calibration: metrics.scaleCalibration,
        uncertainty: metrics.uncertainty,
        calibration_id: metrics.calibrationId,
        region: { roi_xyxy: metrics.roiXyxy, mask_png_sha256: metrics.maskPngSha256 },
        statistics: {
          selected_pixels: metrics.selectedPixels,
          valid_pixels: metrics.validPixels,
          invalid_pixels: metrics.invalidPixels,
          valid_fraction: metrics.validFraction,
          median_axial_depth_m: metrics.medianAxialDepthM,
          p10_axial_depth_m: metrics.p10AxialDepthM,
          p90_axial_depth_m: metrics.p90AxialDepthM,
          median_camera_range_m: metrics.medianCameraRangeM,
        },
        depth_npy_sha256: metrics.depthNpySha256,
        depth_npy_base64: depth.toString('base64'),
        overlay_png_base64: overlay.toString('base64'),
      };
      const identity = `robot0_agentview_left/${phase.phase}-${index}`;
      verify(identity, 'yolo', 'original-uncalibrated-response', () => {
        const { depthNpy, overlayPng, ...decoded } = readDepthResponse(response, request);
        assert.deepEqual(decoded, metrics);
        assert.deepEqual(depthNpy, depth);
        assert.deepEqual(overlayPng, overlay);
        responses.push({
          camera: identity,
          kind: 'yolo',
          maskPngSha256: decoded.maskPngSha256,
          medianCameraRangeM: decoded.medianCameraRangeM,
        });
      });
      verify(identity, 'yolo', 'detached-region', () => {
        const copy = structuredClone(response);
        const decoded = readDepthResponse(copy, request);
        copy.region.roi_xyxy[0]++;
        assert.deepEqual(decoded.roiXyxy, request.roiXyxy);
        assert.deepEqual(decoded.roiXyxy, instance.bboxXyxy);
        assert.notEqual(decoded.roiXyxy, request.roiXyxy);
      });
      cancelled(identity, 'yolo', response, request, readDepthResponse);
      for (const [name, change] of [
        ['foreign-region', (value) => value.region.roi_xyxy[0]++],
        ['missing-region', (value) => (value.region.roi_xyxy = null)],
        ['unexpected-calibration', (value) => (value.calibration_id = 'invalid-calibration')],
        [
          'unexpected-range',
          (value) => (value.statistics.median_camera_range_m = metrics.medianAxialDepthM),
        ],
      ])
        rejectDerivative(identity, 'yolo', name, response, request, readDepthResponse, change);
    }
  }
}
assert(responses.some((value) => value.kind === 'sam'));
assert(responses.some((value) => value.kind === 'yolo'));
for (const [path, sha256] of sources) assert.equal(hash(await readFile(path)), sha256);
for (const source of implementation)
  assert.equal(hash(await readFile(resolve(root, source.path))), source.sha256);
const report = {
  schemaVersion: 'edh.perception_response_cpu.v1',
  implementation,
  sources: Array.from(sources, ([path, sha256]) => ({ path, sha256 })),
  responses,
  cases,
  passed: true,
  originalSourcesUnchanged: true,
  modelCalls: 0,
  simulatorAllocations: 0,
  gpuJobs: 0,
  scope:
    'Original response metadata and saved binary outputs reassembled for production CPU admission; explicitly invalid derivatives and cancellation. No provider execution or physical task acceptance.',
};
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({ output, responses: responses.length, cases: cases.length, gpuJobs: 0 }),
);
