import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { ZodError } from 'zod';
import {
  admitSegmentationInput,
  admitDepthInput,
  Sam31HttpClient,
  Yolo26HttpClient,
} from '@edh/perception';

const { values } = parseArgs({
  options: {
    image: { type: 'string' },
    directory: { type: 'string' },
    intrinsics: { type: 'string' },
    prompt: { type: 'string' },
    output: { type: 'string' },
  },
});
assert(values.image && values.directory && values.intrinsics && values.prompt && values.output);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const child = relative(resolve(root, '.local/work'), output);
assert(child && !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = [];
const original = async (file) => {
  const path = resolve(file);
  const bytes = await readFile(path);
  sources.push({ path, sha256: hash(bytes) });
  return bytes;
};
const image = await original(values.image);
const directory = resolve(values.directory);
const phases = JSON.parse((await original(resolve(directory, 'result.json'))).toString('utf8'));
const calibration = JSON.parse((await original(values.intrinsics)).toString('utf8'));
const intrinsics = {
  calibrationId: calibration.calibration_id,
  fx: calibration.fx,
  fy: calibration.fy,
  cx: calibration.cx,
  cy: calibration.cy,
};
const implementation = await Promise.all(
  [
    'harness/agent-runtime/perception/src/request-inputs.ts',
    'harness/agent-runtime/perception/src/sam31-client.ts',
    'harness/agent-runtime/perception/src/yolo26-client.ts',
    'harness/agent-runtime/perception/src/index.ts',
    'harness/physical-runtime/src/physical_harness/perception/sam31.py',
    'harness/physical-runtime/src/physical_harness/perception/yolo26_depth.py',
    'scripts/check-perception-inputs-offline.mjs',
  ].map(async (path) => ({ path, sha256: hash(await readFile(resolve(root, path))) })),
);
await mkdir(output, { recursive: false });
const listener = createServer();
let connections = 0;
listener.on('connection', (socket) => {
  connections++;
  socket.destroy();
});
await new Promise((accept, reject) => {
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', accept);
});
const address = listener.address();
assert(address && typeof address !== 'string');
const endpoint = `http://127.0.0.1:${address.port}`;
const sam = new Sam31HttpClient(endpoint);
const yolo = new Yolo26HttpClient(endpoint);
const cases = [];
const originalRequests = [];
try {
  for (const phase of phases) {
    assert.equal(hash(image), phase.sourceImageSha256);
    const segmentation = {
      image,
      mediaType: 'image/png',
      textPrompt: values.prompt,
      signal: new AbortController().signal,
    };
    const admitted = admitSegmentationInput(segmentation);
    assert.notEqual(admitted.image, image);
    assert.equal(hash(admitted.image), phase.sourceImageSha256);
    assert(Object.isFrozen(admitted));
    for (const [name, input] of [
      ['empty-image', { ...segmentation, image: new Uint8Array() }],
      ['oversized-image', { ...segmentation, image: new Uint8Array(32 * 1024 * 1024 + 1) }],
      ['unsupported-media', { ...segmentation, mediaType: 'image/gif' }],
      ['empty-prompt', { ...segmentation, textPrompt: '' }],
      ['oversized-prompt', { ...segmentation, textPrompt: 'a'.repeat(1025) }],
      ['unicode-oversized-prompt', { ...segmentation, textPrompt: '🔎'.repeat(1025) }],
      ['unknown-field', { ...segmentation, extra: true }],
    ]) {
      assert.throws(() => admitSegmentationInput(input), ZodError);
      await assert.rejects(sam.segment(input), ZodError);
      cases.push({ phase: phase.phase, service: 'sam', name, result: 'rejected-before-request' });
    }
    assert.equal(
      admitSegmentationInput({ ...segmentation, textPrompt: '🔎'.repeat(1024) }).textPrompt,
      '🔎'.repeat(1024),
    );
    cases.push({
      phase: phase.phase,
      service: 'sam',
      name: 'unicode-prompt-bound',
      result: 'admitted',
    });
    for (const instance of phase.instances) {
      const mask = await original(
        resolve(directory, `${phase.phase}-${instance.objectId}-mask.png`),
      );
      assert.equal(hash(mask), instance.depth.maskPngSha256);
      const roi = [...instance.bboxXyxy];
      const input = {
        image,
        mediaType: 'image/png',
        width: instance.depth.width,
        height: instance.depth.height,
        maskPng: mask,
        roiXyxy: roi,
        signal: new AbortController().signal,
      };
      const accepted = admitDepthInput(input);
      assert.equal(hash(accepted.image), phase.sourceImageSha256);
      assert.equal(hash(accepted.maskPng), instance.depth.maskPngSha256);
      assert.notEqual(accepted.maskPng, mask);
      assert.notEqual(accepted.roiXyxy, roi);
      assert.deepEqual(accepted.roiXyxy, instance.depth.roiXyxy);
      assert(Object.isFrozen(accepted) && Object.isFrozen(accepted.roiXyxy));
      originalRequests.push({
        phase: phase.phase,
        objectId: instance.objectId,
        sourceImageSha256: hash(image),
        maskSha256: hash(mask),
        roiXyxy: accepted.roiXyxy,
      });
      for (const [name, derived] of [
        ['empty-mask', { ...input, maskPng: new Uint8Array() }],
        ['oversized-mask', { ...input, maskPng: new Uint8Array(32 * 1024 * 1024 + 1) }],
        ['mask-type', { ...input, maskPng: [0] }],
        ['negative-roi', { ...input, roiXyxy: [-1, 0, input.width, input.height] }],
        ['empty-roi', { ...input, roiXyxy: [0, 0, 0, input.height] }],
        ['outside-roi', { ...input, roiXyxy: [0, 0, input.width + 1, input.height] }],
        ['fractional-roi', { ...input, roiXyxy: [0.5, 0, input.width, input.height] }],
        ['short-roi', { ...input, roiXyxy: [0, 0, input.width] }],
        ['null-roi', { ...input, roiXyxy: null }],
        ['nonfinite-width', { ...input, width: Number.POSITIVE_INFINITY }],
        ['oversized-dimensions', { ...input, width: 4_000_001 }],
        ['unsupported-media', { ...input, mediaType: 'image/gif' }],
      ]) {
        const expected = ['empty-roi', 'outside-roi', 'oversized-dimensions'].includes(name)
          ? /Depth (ROI|source dimensions)/
          : (error) => error instanceof ZodError;
        assert.throws(() => admitDepthInput(derived), expected);
        await assert.rejects(yolo.estimate(derived), expected);
        cases.push({
          phase: phase.phase,
          service: 'yolo',
          objectId: instance.objectId,
          name,
          result: 'rejected-before-request',
        });
      }
      const calibrated = admitDepthInput({ ...input, intrinsics });
      assert.deepEqual(calibrated.intrinsics, intrinsics);
      assert(Object.isFrozen(calibrated.intrinsics));
      assert.notEqual(calibrated.intrinsics, intrinsics);
      for (const [name, invalid] of [
        ['null-intrinsics', null],
        ['intrinsics-type', []],
        [
          'missing-calibration',
          { fx: intrinsics.fx, fy: intrinsics.fy, cx: intrinsics.cx, cy: intrinsics.cy },
        ],
        ['empty-calibration', { ...intrinsics, calibrationId: '' }],
        ['oversized-calibration', { ...intrinsics, calibrationId: 'a'.repeat(129) }],
        ['unicode-oversized-calibration', { ...intrinsics, calibrationId: '🔎'.repeat(129) }],
        ['zero-focal-length', { ...intrinsics, fx: 0 }],
        ['negative-focal-length', { ...intrinsics, fy: -1 }],
        ['nan-focal-length', { ...intrinsics, fx: Number.NaN }],
        ['infinite-focal-length', { ...intrinsics, fy: Number.POSITIVE_INFINITY }],
        ['nan-principal-point', { ...intrinsics, cx: Number.NaN }],
        ['infinite-principal-point', { ...intrinsics, cy: Number.POSITIVE_INFINITY }],
        ['unknown-intrinsics-field', { ...intrinsics, extra: true }],
      ]) {
        const derived = { ...input, intrinsics: invalid };
        assert.throws(() => admitDepthInput(derived), ZodError);
        await assert.rejects(yolo.estimate(derived), ZodError);
        cases.push({
          phase: phase.phase,
          service: 'yolo',
          objectId: instance.objectId,
          name,
          result: 'rejected-before-request',
        });
      }
      assert.equal(
        admitDepthInput({
          ...input,
          intrinsics: { ...intrinsics, calibrationId: '🔎'.repeat(128) },
        }).intrinsics.calibrationId,
        '🔎'.repeat(128),
      );
      cases.push({
        phase: phase.phase,
        service: 'yolo',
        objectId: instance.objectId,
        name: 'unicode-calibration-bound',
        result: 'admitted',
      });
      const callerCalibration = { ...intrinsics };
      const calibratedSnapshot = admitDepthInput({ ...input, intrinsics: callerCalibration });
      callerCalibration.fx += 1;
      assert.deepEqual(calibratedSnapshot.intrinsics, intrinsics);
      cases.push({
        phase: phase.phase,
        service: 'yolo',
        objectId: instance.objectId,
        name: 'detached-calibration',
        result: 'preserved',
      });
      const cancelled = new AbortController();
      const cancelledReason = new Error('Caller cancelled original depth request.');
      cancelled.abort(cancelledReason);
      const cancelledInput = { ...input, signal: cancelled.signal };
      assert.throws(
        () => admitDepthInput(cancelledInput),
        (error) => error === cancelledReason,
      );
      await assert.rejects(yolo.estimate(cancelledInput), (error) => error === cancelledReason);
      cases.push({
        phase: phase.phase,
        service: 'yolo',
        objectId: instance.objectId,
        name: 'pre-cancelled',
        result: 'rejected-before-request',
      });
      const imageInput = {
        ...input,
        image: Uint8Array.from(image),
        maskPng: Uint8Array.from(mask),
      };
      const detached = admitDepthInput(imageInput);
      imageInput.image[0] ^= 255;
      imageInput.maskPng[0] ^= 255;
      roi[0] += 1;
      assert.equal(hash(detached.image), phase.sourceImageSha256);
      assert.equal(hash(detached.maskPng), instance.depth.maskPngSha256);
      assert.deepEqual(detached.roiXyxy, instance.depth.roiXyxy);
      cases.push({
        phase: phase.phase,
        service: 'yolo',
        objectId: instance.objectId,
        name: 'detached-request',
        result: 'preserved',
      });
    }
    const aborted = new AbortController();
    const reason = new Error('Caller cancelled original perception request.');
    aborted.abort(reason);
    assert.throws(
      () => admitSegmentationInput({ ...segmentation, signal: aborted.signal }),
      (error) => error === reason,
    );
    await assert.rejects(
      sam.segment({ ...segmentation, signal: aborted.signal }),
      (error) => error === reason,
    );
    cases.push({
      phase: phase.phase,
      service: 'sam',
      name: 'pre-cancelled',
      result: 'rejected-before-request',
    });
  }
  assert.equal(connections, 0);
} finally {
  await new Promise((accept, reject) =>
    listener.close((error) => (error ? reject(error) : accept())),
  );
}
assert.equal(listener.listening, false);
for (const source of [...sources, ...implementation])
  assert.equal(hash(await readFile(resolve(root, source.path))), source.sha256);
const report = {
  sources,
  implementation,
  cases,
  originalRequests,
  originalFilesUnchanged: true,
  listenerClosed: true,
  connections,
  gpuJobs: 0,
  modelCalls: 0,
  environmentAllocations: 0,
  scope:
    'Original recorded image/mask/ROI request admission and declared invalid derivatives through actual clients; zero network connections and native allocations.',
};
await writeFile(resolve(output, 'acceptance.json'), JSON.stringify(report, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    output,
    cases: cases.length,
    originalRequests: originalRequests.length,
    connections,
  }),
);
