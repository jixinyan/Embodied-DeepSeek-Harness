import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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
};
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
  const before = await backend.capture();
  assert.equal(before.images?.length, 3);
  assert.equal(before.evidence.task_scope.task_id, firstRunId);
  const started = await backend.start(firstRequest);
  assert.equal(started.task_scope.task_id, firstRunId);
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
  unsubscribe();
  await backend.close();
  const secondRunId = randomUUID();
  const second = await environment.createTaskBackend(taskId, {
    signal: new AbortController().signal,
    runId: secondRunId,
    task: configuration.worker.catalog.tasks[taskId],
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
  await second.close();
  const report = {
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
    learnedPolicySucceeded: false,
  };
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${outputPath}\n`);
} finally {
  await environment.close();
  await context.fiber.dispose();
}
