import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContractValidator } from '@edh/contracts';
import { OpenAICompatibleAdapter } from '@edh/models';
import { startServer, createNativeWorkerEnvironment } from '../../apps/server/src/index.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workerConfigPath = process.env.EDH_NATIVE_WORKER_CONFIG;
const baseURL = process.env.EDH_MODEL_BASE_URL;
const model = process.env.EDH_MODEL;
const checkpoint = process.env.EDH_POLICY_CHECKPOINT_LABEL;
const dataDirectory = process.env.EDH_DATA_DIRECTORY;
const port = Number(process.env.EDH_CONSOLE_PORT ?? 4318);
if (!workerConfigPath || !baseURL || !model || !checkpoint || !dataDirectory)
  throw new Error('Native worker, model, checkpoint and data directory configuration is required.');
if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
  throw new Error('Console port must be a valid TCP port.');
const configured = JSON.parse(await readFile(workerConfigPath, 'utf8'));
const worker = configured.worker;
if (!worker || worker.provider !== 'robocasa')
  throw new Error('The live RoboCasa deployment requires a RoboCasa native worker.');
const validator = new ContractValidator(
  JSON.parse(
    await readFile(resolve(root, 'harness/contracts/schema/physical.schema.json'), 'utf8'),
  ),
);
const contextManagement = {
  compaction: { thresholdRatio: 0.7, retainRatio: 0.15, headroomTokens: 4096, maxTokens: 8192 },
  visualHistory: { maxImages: 12 },
};
const server = await startServer({
  root,
  port,
  dataDirectory,
  deployment: ({ images }) => ({
    id: 'robocasa-live',
    version: 'robocasa-1.0.1-gr00t-n1.6',
    source: 'simulation',
    description: 'RoboCasa native scene with GR00T policy and a live vision-language model',
    teamFile: resolve(root, 'examples/teams/robocasa-live.yaml'),
    roleRoot: resolve(root, 'examples'),
    defaultModel: 'brain',
    models: { brain: { provider: 'local-vlm', model } },
    adapters: [
      {
        providers: ['local-vlm'],
        adapter: new OpenAICompatibleAdapter({
          baseURL,
          models: [
            {
              id: model,
              inputModalities: ['text', 'image'],
              contextWindow: 32768,
              maxTokens: 2048,
            },
          ],
          timeoutMs: 180_000,
          resolveImage: (ref, signal) =>
            images.readImageRequest(
              ref,
              { maxPixels: 1024 * 1024, maxBytes: 2 * 1024 * 1024 },
              signal,
            ),
        }),
      },
    ],
    contextManagement,
    assignmentLifetimeMs: 900_000,
    tasks: {},
    launchProfiles: {
      'robocasa-open-cabinet': {
        source: 'simulation',
        label: 'RoboCasa OpenCabinet',
        environment: 'RoboCasa 1.0.1 native OpenCabinet',
        embodiment: 'PandaOmron',
        policy: worker.policyId,
        checkpoint,
        defaultModel: 'brain',
        tasks: [],
        taskSource: 'environment',
        createEnvironment: ({ signal, services }) => {
          signal.throwIfAborted();
          return createNativeWorkerEnvironment(worker, services, validator);
        },
      },
    },
  }),
});
process.stdout.write(`${server.url}\n`);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void server.close().then(
      () => process.exit(0),
      (error) => {
        process.stderr.write(`${String(error)}\n`);
        process.exit(1);
      },
    );
  });
