import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContractValidator } from '@edh/contracts';
import {
  OpenAICompatibleAdapter,
  createConfiguredModels,
  readModelConfiguration,
} from '@edh/models';
import { Sam31HttpClient } from '@edh/perception';
import { startServer, createNativeWorkerEnvironment } from '../../apps/server/src/index.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workerConfigPath = process.env.EDH_NATIVE_WORKER_CONFIG;
const baseURL = process.env.EDH_MODEL_BASE_URL;
const model = process.env.EDH_MODEL;
const modelConfigurationPath = process.env.EDH_MODEL_CONFIG;
const checkpoint = process.env.EDH_POLICY_CHECKPOINT_LABEL;
const dataDirectory = process.env.EDH_DATA_DIRECTORY;
const segmentationURL = process.env.EDH_SAM31_BASE_URL;
const port = Number(process.env.EDH_CONSOLE_PORT ?? 4318);
if (
  !workerConfigPath ||
  (!modelConfigurationPath && (!baseURL || !model)) ||
  !checkpoint ||
  !dataDirectory
)
  throw new Error('Native worker, model, checkpoint and data directory configuration is required.');
if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
  throw new Error('Console port must be a valid TCP port.');
const configured = JSON.parse(await readFile(workerConfigPath, 'utf8'));
const modelConfiguration = modelConfigurationPath
  ? await readModelConfiguration(resolve(modelConfigurationPath))
  : undefined;
const worker = configured.worker;
if (!worker || worker.provider !== 'robocasa')
  throw new Error('The live RoboCasa deployment requires a RoboCasa native worker.');
const policyActionLimit = worker.policyMaxActionsPerInference;
if (
  policyActionLimit !== undefined &&
  (!Number.isSafeInteger(policyActionLimit) || policyActionLimit < 1 || policyActionLimit > 512)
)
  throw new Error('RoboCasa policy action limit must contain 1 to 512 control commands.');
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
  deployment: ({ images }) => {
    const models = modelConfiguration
      ? createConfiguredModels(modelConfiguration, { images })
      : {
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
                connectionMode: 'close-after-response',
                resolveImage: (ref, signal) =>
                  images.readImageRequest(
                    ref,
                    { maxPixels: 1024 * 1024, maxBytes: 2 * 1024 * 1024 },
                    signal,
                  ),
              }),
            },
          ],
        };
    return {
      id: 'robocasa-live',
      version: `robocasa-1.0.1-gr00t-n1.6${policyActionLimit === undefined ? '' : `-ac${policyActionLimit}`}${segmentationURL ? '-sam31' : ''}`,
      source: 'simulation',
      description: 'RoboCasa native scene with GR00T policy and a live vision-language model',
      teamFile: resolve(
        root,
        segmentationURL
          ? 'examples/teams/robocasa-sam-live.yaml'
          : 'examples/teams/robocasa-live.yaml',
      ),
      roleRoot: resolve(root, 'examples'),
      ...models,
      contextManagement,
      enableObjectMeasurement: Boolean(segmentationURL),
      ...(segmentationURL ? { segmentation: new Sam31HttpClient(segmentationURL) } : {}),
      assignmentLifetimeMs: 3_600_000,
      tasks: {},
      launchProfiles: {
        'robocasa-open-cabinet': {
          source: 'simulation',
          label: 'RoboCasa OpenCabinet',
          environment: 'RoboCasa 1.0.1 native OpenCabinet',
          embodiment: 'PandaOmron',
          policy: worker.policyId,
          checkpoint,
          defaultModel: models.defaultModel,
          tasks: [],
          taskSource: 'environment',
          createEnvironment: ({ signal, services }) => {
            signal.throwIfAborted();
            return createNativeWorkerEnvironment(worker, services, validator);
          },
        },
      },
    };
  },
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
