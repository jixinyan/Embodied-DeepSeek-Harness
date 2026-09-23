import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { Context } from '@deepseek-ai/cordis';
import { ContractValidator, type SubgoalRequest } from '@edh/contracts';
import { LocalImageStore } from '@edh/storage';
import {
  createNativeWorkerEnvironment,
  type NativeWorkerConfiguration,
} from '../apps/server/src/native-worker.js';

const configurationPath = process.argv[2];
const outputPath = process.argv[3];
if (!configurationPath || !outputPath)
  throw new Error('Usage: check-robocasa-worker.ts <deployment-config.json> <result.json>');
const configuration = JSON.parse(await readFile(configurationPath, 'utf8')) as {
  worker: NativeWorkerConfiguration;
  imageDirectory: string;
  request: SubgoalRequest;
  runPolicyActions?: boolean;
};
const startedAt = new Date().toISOString();
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceChanges = execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim();
const schema = JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8'));
const validator = new ContractValidator(schema);
validator.parse('SubgoalRequest', configuration.request);
const context = new Context();
await mkdir(configuration.imageDirectory, { recursive: true });
await context.plugin(LocalImageStore, { directory: configuration.imageDirectory });
const images = context.attachments as LocalImageStore;
const environment = await createNativeWorkerEnvironment(
  configuration.worker,
  { images },
  validator,
);
const taskId = configuration.request.task_id;
const firstRunId = randomUUID();
const firstRequest = { ...configuration.request, task_id: firstRunId };
const updates: Array<Record<string, unknown>> = [];
const frames: Array<Record<string, unknown>> = [];
const failures: unknown[] = [];
try {
  const backend = await environment.createTaskBackend(taskId, {
    signal: new AbortController().signal,
    runId: firstRunId,
    task: configuration.worker.catalog.tasks[taskId],
  });
  const unsubscribe = backend.subscribe((update) => {
    updates.push({
      status: update.status,
      observationId: update.sample.evidence.id,
      observedAt: update.sample.evidence.observed_at,
      imageIds: update.sample.images?.map((image) => image.attachmentId),
      diagnostic: update.sample.description,
      visualization: update.sample.visualization,
    });
  });
  const unsubscribeFrames = backend.subscribeFrames?.((frame) => {
    frames.push({
      runId: frame.runId,
      executionId: frame.executionId,
      policyRequestId: frame.policyRequestId,
      segmentId: frame.segmentId,
      nativeStepIndex: frame.nativeStepIndex,
      simulationTimeS: frame.simulationTimeS,
      observationId: frame.sample.evidence.id,
      observedAt: frame.sample.evidence.observed_at,
      imageIds: frame.sample.images?.map((image) => image.attachmentId),
    });
  });
  const before = await backend.capture();
  assert.equal(before.images?.length, 3);
  assert.equal(before.evidence.task_scope.task_id, firstRunId);
  const started = await backend.start(firstRequest);
  assert.equal(started.task_scope.task_id, firstRunId);
  if (configuration.runPolicyActions) {
    const deadline = Date.now() + 170000;
    while ((backend.query()?.control_steps ?? 0) === 0 && backend.query()?.state !== 'ended') {
      if (Date.now() >= deadline)
        throw new Error('Real policy produced no control receipt before the acceptance deadline.');
      await setTimeout(500);
    }
    assert.ok((backend.query()?.control_steps ?? 0) > 0, 'Real policy produced no native action.');
    assert.ok(frames.length > 0, 'Real policy action has no retained native camera frame.');
  }
  await backend.pause();
  const stopped = backend.query();
  assert.ok(stopped && stopped.device_confirmed && ['paused', 'ended'].includes(stopped.state));
  const checked = await backend.check(['task_success'], {
    executionId: stopped.execution_id,
    boundaryId: stopped.boundary_event_id!,
  });
  assert.equal(checked.facts.length, 1);
  assert.equal(checked.facts[0]?.check_id, 'task_success');
  await backend.stop();
  const terminal = backend.query();
  assert.equal(terminal?.state, 'ended');
  await assert.rejects(backend.start(firstRequest), /already admitted/);
  await assert.rejects(
    backend.start({ ...firstRequest, instruction: `${firstRequest.instruction} again` }),
    /reused for a different native request/,
  );
  unsubscribeFrames?.();
  unsubscribe();
  await backend.close();
  const secondRunId = randomUUID();
  const second = await environment.createTaskBackend(taskId, {
    signal: new AbortController().signal,
    runId: secondRunId,
    task: configuration.worker.catalog.tasks[taskId],
  });
  const unsubscribeSecondFrames = second.subscribeFrames?.((frame) => {
    frames.push({
      runId: frame.runId,
      executionId: frame.executionId,
      policyRequestId: frame.policyRequestId,
      segmentId: frame.segmentId,
      nativeStepIndex: frame.nativeStepIndex,
      simulationTimeS: frame.simulationTimeS,
      observationId: frame.sample.evidence.id,
      observedAt: frame.sample.evidence.observed_at,
      imageIds: frame.sample.images?.map((image) => image.attachmentId),
    });
  });
  const nextCapture = await second.capture();
  assert.equal(nextCapture.images?.length, 3);
  assert.equal(nextCapture.evidence.task_scope.task_id, secondRunId);
  const secondRequest: SubgoalRequest = {
    ...firstRequest,
    task_id: secondRunId,
    attempt_id: 'native-worker-attempt-2',
    idempotency_key: randomUUID(),
  };
  const nextStarted = await second.start(secondRequest);
  assert.notEqual(nextStarted.execution_id, started.execution_id);
  await second.stop();
  assert.equal(second.query()?.state, 'ended');
  unsubscribeSecondFrames?.();
  await second.close();
  const report = {
    startedAt,
    completedAt: new Date().toISOString(),
    sourceRevision,
    sourceChanges,
    exitStatus: 'passed',
    provider: configuration.worker.provider,
    nativeTaskId: configuration.worker.nativeTaskId,
    policyId: configuration.worker.policyId,
    beforeExecution: {
      observationId: before.evidence.id,
      observedAt: before.evidence.observed_at,
      images: before.images,
    },
    firstExecution: started.execution_id,
    confirmedBoundary: stopped.boundary_event_id,
    nativeCheck: checked.facts,
    firstTerminal: terminal,
    secondExecution: nextStarted.execution_id,
    secondCapture: nextCapture.evidence.id,
    updates,
    frames,
    learnedPolicyActionsExecuted: terminal?.control_steps ?? 0,
  };
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${outputPath}\n`);
} catch (error) {
  failures.push(error);
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await writeFile(
    resolve(dirname(outputPath), 'failure.json'),
    `${JSON.stringify(
      {
        startedAt,
        completedAt: new Date().toISOString(),
        sourceRevision,
        sourceChanges,
        exitStatus: 'failed',
        error: error instanceof Error ? error.stack : String(error),
        updates,
        frames,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  try {
    await environment.close();
  } catch (error) {
    failures.push(error);
  }
  try {
    await context.fiber.dispose();
  } catch (error) {
    failures.push(error);
  }
  if (failures.length) throw new AggregateError(failures, 'Native worker acceptance failed.');
}
