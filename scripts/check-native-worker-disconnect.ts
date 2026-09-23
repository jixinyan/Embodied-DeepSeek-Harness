import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
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
const configuration = JSON.parse(await readFile(configurationPath, 'utf8')) as {
  worker: NativeWorkerConfiguration;
  imageDirectory: string;
};
const schema = JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8'));
const validator = new ContractValidator(schema);
const context = new Context();
await context.plugin(LocalImageStore, { directory: configuration.imageDirectory });
let processId = 0;
const pending = createNativeWorkerEnvironment(
  {
    ...configuration.worker,
    onProcessStarted(pid) {
      processId = pid;
    },
  },
  { images: context.attachments as LocalImageStore },
  validator,
);
try {
  assert.ok(processId > 0);
  let failure = '';
  const rejected = assert.rejects(pending, (error) => {
    if (!(error instanceof AggregateError)) return false;
    failure = error.errors.map((item: unknown) => String(item)).join('; ');
    return /device state is unknown/.test(failure);
  });
  await setTimeout(1000);
  process.kill(processId, 'SIGTERM');
  await rejected;
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        transportProcessId: processId,
        pendingInitializationRejected: true,
        resourceReleaseConfirmed: false,
        error: failure,
      },
      null,
      2,
    )}\n`,
  );
  process.stdout.write(`${outputPath}\n`);
} finally {
  await context.fiber.dispose();
}
