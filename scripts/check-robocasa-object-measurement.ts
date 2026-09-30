import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { Context } from '@deepseek-ai/cordis';
import { ContractValidator, type SubgoalRequest } from '@edh/contracts';
import { Sam31HttpClient } from '@edh/perception';
import { LocalImageStore } from '@edh/storage';
import {
  createNativeWorkerEnvironment,
  type NativeWorkerConfiguration,
} from '../apps/server/src/native-worker.js';

const [configurationPath, outputPath, samAddress] = process.argv.slice(2);
if (!configurationPath || !outputPath || !samAddress)
  throw new Error(
    'Usage: check-robocasa-object-measurement.ts <worker-config.json> <result.json> <sam-base-url>',
  );
const configuration = JSON.parse(await readFile(configurationPath, 'utf8')) as {
  worker: NativeWorkerConfiguration;
};
if (configuration.worker.provider !== 'robocasa')
  throw new Error('Checker requires native RoboCasa.');
const outputDirectory = dirname(resolve(outputPath));
await mkdir(outputDirectory, { recursive: true });
const context = new Context();
await context.plugin(LocalImageStore, { directory: resolve(outputDirectory, 'images') });
const images = context.attachments as LocalImageStore;
const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const sam = new Sam31HttpClient(samAddress);
const environment = await createNativeWorkerEnvironment(
  {
    ...configuration.worker,
    simulationVideoDirectory: resolve(outputDirectory, 'videos'),
  },
  { images },
  validator,
);
const startedAt = new Date().toISOString();
const report: Record<string, unknown> = {
  startedAt,
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceChanges: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
};
try {
  const task = environment.describeTasks().tasks.OpenCabinet;
  assert.ok(task);
  const runId = randomUUID();
  const backend = await environment.createTaskBackend('OpenCabinet', {
    signal: new AbortController().signal,
    runId,
    task,
  });
  assert.ok(backend.measureObject);
  const firstCapture = await backend.capture();
  const sample = await backend.capture();
  const camera = 'robot0_agentview_left';
  const ref = sample.images?.find((image) => image.name === `${camera}.png`);
  assert.ok(ref);
  const source = await images.readImage(ref);
  const sourceImageSha256 = createHash('sha256').update(source.data).digest('hex');
  const segmentation = await sam.segment({
    image: source.data,
    mediaType: ref.mediaType,
    textPrompt: 'cabinet',
    signal: new AbortController().signal,
  });
  assert.ok(segmentation.instances.length > 0);
  assert.equal(segmentation.sourceImageSha256, sourceImageSha256);
  await writeFile(resolve(outputDirectory, 'source.png'), source.data);
  const inputs = segmentation.instances.map((instance) => ({
    observationId: sample.evidence.id,
    camera,
    sourceImageSha256,
    maskPngBase64: Buffer.from(instance.maskPng).toString('base64'),
  }));
  for (const [index, instance] of segmentation.instances.entries())
    await writeFile(resolve(outputDirectory, `mask-${index}.png`), instance.maskPng);
  const measurements = [];
  for (const [index, input] of inputs.entries()) {
    const measurement = await backend.measureObject(input);
    assert.equal(measurement.selectedPixels, segmentation.instances[index]!.areaPixels);
    assert.ok(measurement.validPixels > 0);
    assert.ok(measurement.simulationTimeS >= 0);
    if (measurements.length)
      assert.equal(measurement.simulationTimeS, measurements[0]!.simulationTimeS);
    measurements.push(measurement);
  }
  const input = inputs[0]!;
  await assert.rejects(
    backend.measureObject({ ...input, observationId: firstCapture.evidence.id }),
    /latest explicit capture/,
  );
  const right = sample.images?.find((image) => image.name === 'robot0_agentview_right.png');
  assert.ok(right);
  const rightBytes = await images.readImage(right);
  await assert.rejects(
    backend.measureObject({
      ...input,
      sourceImageSha256: createHash('sha256').update(rightBytes.data).digest('hex'),
    }),
    /source image identity differs/,
  );
  const cancelled = new AbortController();
  let cancellationPublished = false;
  const cancelledRequest = backend
    .measureObject(input, { signal: cancelled.signal })
    .then((value) => {
      cancellationPublished = true;
      return value;
    });
  cancelled.abort();
  await assert.rejects(cancelledRequest, /cancelled/);
  await setTimeout(1000);
  assert.equal(cancellationPublished, false);
  const afterCancel = await backend.measureObject(input);
  assert.equal(afterCancel.sourceImageSha256, sourceImageSha256);
  assert.equal(afterCancel.simulationTimeS, measurements[0]!.simulationTimeS);
  const unchanged = await backend.capture();
  assert.deepEqual(unchanged.images, sample.images);
  const request: SubgoalRequest = {
    schema_version: 'physical.subgoal.v1',
    task_id: runId,
    team_run_id: randomUUID(),
    goal_id: task.goal.id,
    attempt_id: 'metric-measurement-native-control',
    instruction: task.instruction,
    entities: {},
    required_capabilities: ['object_manipulation'],
    success_contract: task.goal.successContract,
    budget: { max_control_steps: 16, max_wall_time_s: 180 },
    context_refs: [],
    decision_owner_id: 'metric-check-owner',
    owner_assignment_id: 'metric-check-assignment',
    idempotency_key: randomUUID(),
  };
  const started = await backend.start(request);
  await assert.rejects(backend.measureObject(input), /confirmed stopped device/);
  const deadline = Date.now() + 170_000;
  while ((backend.query()?.control_steps ?? 0) < 1 && backend.query()?.state !== 'ended') {
    if (Date.now() >= deadline)
      throw new Error('Native GR00T produced no control before measurement validation deadline.');
    await setTimeout(100);
  }
  assert.ok((backend.query()?.control_steps ?? 0) > 0);
  await backend.pause();
  const paused = backend.query();
  assert.ok(paused?.device_confirmed && ['paused', 'ended'].includes(paused.state));
  await assert.rejects(backend.measureObject(input), /latest explicit capture/);
  const stoppedCapture = await backend.capture();
  const stoppedRef = stoppedCapture.images?.find((image) => image.name === `${camera}.png`);
  assert.ok(stoppedRef);
  const stoppedSource = await images.readImage(stoppedRef);
  const stoppedSegmentation = await sam.segment({
    image: stoppedSource.data,
    mediaType: stoppedRef.mediaType,
    textPrompt: 'cabinet',
    signal: new AbortController().signal,
  });
  assert.ok(stoppedSegmentation.instances.length > 0);
  const stoppedMeasurement = await backend.measureObject({
    observationId: stoppedCapture.evidence.id,
    camera,
    sourceImageSha256: stoppedSegmentation.sourceImageSha256,
    maskPngBase64: Buffer.from(stoppedSegmentation.instances[0]!.maskPng).toString('base64'),
  });
  assert.equal(backend.query()?.control_steps, paused.control_steps);
  assert.ok(stoppedMeasurement.simulationTimeS > measurements[0]!.simulationTimeS);
  await backend.stop();
  await backend.close();
  const second = await environment.createTaskBackend('OpenCabinet', {
    signal: new AbortController().signal,
    runId: randomUUID(),
    task,
  });
  assert.ok(second.measureObject);
  await second.capture();
  await assert.rejects(second.measureObject(input), /latest explicit capture/);
  await second.close();
  Object.assign(report, {
    status: 'passed',
    sourceImageSha256,
    segmentation: {
      provider: segmentation.provider,
      sessionId: segmentation.sessionId,
      sourceRevision: segmentation.sourceRevision,
      checkpointSha256: segmentation.checkpointSha256,
    },
    measurements,
    cancellationPublished,
    afterCancel,
    executionId: started.execution_id,
    paused,
    stoppedMeasurement,
    crossSessionCaptureRejected: true,
  });
} finally {
  await environment.close();
  await context.fiber.dispose();
  Object.assign(report, { closedAt: new Date().toISOString(), resourcesReleased: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}
process.stdout.write(`${outputPath}\n`);
