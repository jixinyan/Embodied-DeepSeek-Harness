import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { ContractValidator } from '@edh/contracts';
import { createConfiguredModels, readModelConfiguration } from '@edh/models';
import { startServer, createNativeWorkerEnvironment } from '../../apps/server/src/index.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const configurationPath = process.env.EDH_BEHAVIOR_CONFIG;
if (!configurationPath) throw new Error('EDH_BEHAVIOR_CONFIG is required.');
const config = JSON.parse(await readFile(configurationPath, 'utf8'));
if (
  !config.worker ||
  config.worker.provider !== 'behavior' ||
  config.worker.nativeTaskId !== 'picking_up_trash'
)
  throw new Error('The BEHAVIOR deployment requires the native picking_up_trash worker.');
const worker = {
  initializeTimeoutMs: 600_000,
  closeTimeoutMs: 900_000,
  ...config.worker,
};
if (!config.dataDirectory || !config.modelConfiguration || !config.checkpoint)
  throw new Error('BEHAVIOR dataDirectory, modelConfiguration and checkpoint are required.');
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
  port: config.consolePort ?? 4334,
  dataDirectory: resolve(config.dataDirectory),
  deployment: ({ images }) => ({
    id: 'behavior-live',
    version: 'behavior-b1979916-gr00t-300db814',
    source: 'simulation',
    description: 'Native BEHAVIOR R1Pro with GR00T N1.6 and independent DSH role Sessions',
    teamFile: resolve(root, 'examples/teams/behavior-live.yaml'),
    roleRoot: resolve(root, 'examples'),
    ...createConfiguredModels(modelConfiguration, { images }),
    assignmentLifetimeMs: 3_600_000,
    providers: ['behavior'],
    contextManagement: {
      compaction: { thresholdRatio: 0.7, retainRatio: 0.15, headroomTokens: 4096, maxTokens: 8192 },
      visualHistory: { maxImages: 12 },
    },
    tasks: {},
    launchProfiles: {
      'behavior-picking-up-trash': {
        source: 'simulation',
        label: 'BEHAVIOR Picking Up Trash',
        environment: 'BEHAVIOR-1K native picking_up_trash',
        embodiment: 'behavior.r1pro',
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
