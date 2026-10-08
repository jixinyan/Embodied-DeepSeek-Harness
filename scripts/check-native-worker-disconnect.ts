import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { ContractValidator } from '@edh/contracts';
import { LocalImageStore } from '@edh/storage';
import {
  createNativeWorkerEnvironment,
  type NativeWorkerConfiguration,
} from '../apps/server/src/native-worker.js';

const configurationPath = process.argv[2];
const outputPath = process.argv[3];
if (!configurationPath || !outputPath)
  throw new Error(
    'Usage: check-native-worker-disconnect.ts <deployment-config.json> <result.json>',
  );
const configurationSource = await readFile(configurationPath);
const configuration = JSON.parse(configurationSource.toString('utf8')) as {
  worker: NativeWorkerConfiguration;
  imageDirectory: string;
};
const schema = JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8'));
const validator = new ContractValidator(schema);
const context = new Context();
await context.plugin(LocalImageStore, { directory: configuration.imageDirectory });
let processId = 0;
let publishStarted: (pid: number) => void;
const started = new Promise<number>((resolve) => {
  publishStarted = resolve;
});
const pending = createNativeWorkerEnvironment(
  {
    ...configuration.worker,
    onProcessStarted(pid) {
      processId = pid;
      publishStarted(pid);
    },
  },
  { images: context.attachments as LocalImageStore },
  validator,
);
const settled = pending.then(
  (environment) => ({ status: 'ready' as const, environment }),
  (error: unknown) => ({ status: 'failed' as const, error }),
);
try {
  await Promise.race([
    started,
    settled.then((outcome) => {
      if (outcome.status === 'failed') throw outcome.error;
      throw new Error('Native initialization completed before process-start observation.');
    }),
  ]);
  assert.ok(processId > 0);
  process.kill(processId, 'SIGTERM');
  const outcome = await settled;
  assert.equal(outcome.status, 'failed');
  if (outcome.status !== 'failed') throw new Error('Native initialization did not fail.');
  assert(outcome.error instanceof AggregateError);
  assert.equal(outcome.error.errors.length, 2);
  const [initializationError, releaseError] = outcome.error.errors;
  assert(initializationError instanceof Error);
  assert(releaseError instanceof AggregateError);
  assert(releaseError.errors.includes(initializationError));
  const failure = outcome.error.errors.map((item: unknown) => String(item)).join('; ');
  assert.equal(releaseError.message, 'Native worker process release was unclean.');
  assert.throws(
    () => process.kill(processId, 0),
    (error: NodeJS.ErrnoException) => error.code === 'ESRCH',
  );
  if (process.platform !== 'win32')
    assert.throws(
      () => process.kill(-processId, 0),
      (error: NodeJS.ErrnoException) => error.code === 'ESRCH',
    );
  const sources = await Promise.all(
    [
      resolve(configurationPath),
      resolve('scripts/check-native-worker-disconnect.ts'),
      resolve('apps/server/src/native-worker.ts'),
      resolve('apps/server/src/native-worker-configuration.ts'),
      resolve('apps/server/src/native-worker-transport.ts'),
    ].map(async (path) => ({
      path,
      sha256: createHash('sha256')
        .update(await readFile(path))
        .digest('hex'),
    })),
  );
  assert.equal(createHash('sha256').update(configurationSource).digest('hex'), sources[0]!.sha256);
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        transportProcessId: processId,
        pendingInitializationRejected: true,
        resourceReleaseConfirmed: false,
        deviceState: 'unknown',
        childProcessAbsent: true,
        processGroupAbsent: process.platform !== 'win32',
        interruptedAt: 'process-start-observation',
        sources,
        error: failure,
      },
      null,
      2,
    )}\n`,
    { flag: 'wx' },
  );
  process.stdout.write(`${outputPath}\n`);
} finally {
  try {
    const outcome = await settled;
    if (outcome.status === 'ready') await outcome.environment.close();
  } finally {
    await context.fiber.dispose();
  }
}
