import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { ContractValidator } from '@edh/contracts';
import { createConfiguredModels, readModelConfiguration } from '@edh/models';
import { Sam31HttpClient, Yolo26HttpClient } from '@edh/perception';
import { startServer, createNativeWorkerEnvironment } from '../../apps/server/src/index.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const configurationPath = process.env.EDH_ROBOTWIN_CONFIG;
if (!configurationPath) throw new Error('EDH_ROBOTWIN_CONFIG is required.');
const config = JSON.parse(await readFile(configurationPath, 'utf8'));
const worker = config.worker;
if (!worker || worker.provider !== 'robotwin' || worker.nativeTaskId !== 'adjust_bottle')
  throw new Error('The RoboTwin deployment requires the native adjust_bottle worker.');
if (!config.dataDirectory || !config.modelConfiguration || !config.checkpoint)
  throw new Error('RoboTwin dataDirectory, modelConfiguration and checkpoint are required.');
if (Boolean(config.segmentationURL) !== Boolean(config.depthURL))
  throw new Error('The grounded perception team requires both SAM 3.1 and YOLO26 endpoints.');
const dispatcher = new EnvHttpProxyAgent();
setGlobalDispatcher(dispatcher);
const validator = new ContractValidator(
  JSON.parse(
    await readFile(resolve(root, 'harness/contracts/schema/physical.schema.json'), 'utf8'),
  ),
);
const modelConfiguration = await readModelConfiguration(resolve(config.modelConfiguration));
const server = await startServer({
  root,
  port: config.consolePort ?? 4323,
  dataDirectory: resolve(config.dataDirectory),
  deployment: ({ images }) => ({
    id: 'robotwin-live',
    version: 'robotwin-bf44be51-pi05-e49e2ab6',
    source: 'simulation',
    description: 'Native RoboTwin adjust_bottle with Pi0.5 and independent DSH role Sessions',
    teamFile: resolve(
      root,
      config.segmentationURL
        ? 'examples/teams/robotwin-perception.yaml'
        : 'examples/teams/robotwin-live.yaml',
    ),
    roleRoot: resolve(root, 'examples'),
    ...createConfiguredModels(modelConfiguration, { images }),
    ...(config.segmentationURL
      ? {
          segmentation: new Sam31HttpClient(config.segmentationURL),
          depth: new Yolo26HttpClient(config.depthURL),
          depthIntrinsicsByCamera: config.depthIntrinsicsByCamera ?? {},
        }
      : {}),
    assignmentLifetimeMs: 3_600_000,
    providers: ['robotwin'],
    contextManagement: {
      compaction: { thresholdRatio: 0.7, retainRatio: 0.15, headroomTokens: 4096, maxTokens: 8192 },
      visualHistory: { maxImages: 12 },
    },
    tasks: {},
    launchProfiles: {
      'robotwin-adjust-bottle': {
        source: 'simulation',
        label: 'RoboTwin Adjust Bottle',
        environment: 'RoboTwin native adjust_bottle',
        embodiment: 'aloha-agilex',
        executionMode: 'policy',
        policy: worker.policyId,
        checkpoint: config.checkpoint,
        defaultModel: modelConfiguration.defaultModel,
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
    void server
      .close()
      .then(() => dispatcher.close())
      .then(
        () => process.exit(0),
        (error) => {
          console.error(error);
          process.exit(1);
        },
      );
  });
