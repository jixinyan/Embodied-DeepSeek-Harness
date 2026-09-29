import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { ContractValidator } from '@edh/contracts';
import { createConfiguredModels, readModelConfiguration } from '@edh/models';
import { serveGptPolicy, requestPolicyProposal } from '@edh/execution';
import {
  createDshHost,
  startServer,
  createNativeWorkerEnvironment,
} from '../../apps/server/src/index.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const configurationPath = process.env.EDH_ROBODOJO_CONFIG;
if (!configurationPath) throw new Error('EDH_ROBODOJO_CONFIG is required.');
const config = JSON.parse(await readFile(configurationPath, 'utf8'));
const dispatcher = new EnvHttpProxyAgent();
setGlobalDispatcher(dispatcher);
const validator = new ContractValidator(
  JSON.parse(
    await readFile(resolve(root, 'harness/contracts/schema/physical.schema.json'), 'utf8'),
  ),
);
const modelConfiguration = await readModelConfiguration(resolve(config.modelConfiguration));
const policyInstructions = await readFile(
  resolve(root, 'examples/policies/robodojo-astra.md'),
  'utf8',
);
if (!config.profiles || !Object.keys(config.profiles).length || !config.dataDirectory)
  throw new Error('RoboDojo profiles and dataDirectory are required.');
const gateways = [];
const hosts = [];
let auditWrites = Promise.resolve();
let auditFailure;
let closing = false;
let server;
const auditDirectory = resolve(config.dataDirectory, 'policy-audits');
await mkdir(auditDirectory, { recursive: true });
const audit = (record) => {
  if (auditFailure) throw auditFailure;
  auditWrites = auditWrites.then(() =>
    appendFile(resolve(auditDirectory, 'events.jsonl'), `${JSON.stringify(record)}\n`),
  );
  auditWrites.catch((error) => {
    auditFailure = error;
    void shutdown().catch(console.error);
  });
};
async function shutdown() {
  if (closing) return;
  closing = true;
  await server?.close();
  for (const gateway of gateways) await gateway.close();
  for (const host of hosts) await host.fiber.dispose();
  await auditWrites;
  await dispatcher.close();
}
server = await startServer({
  root,
  port: config.consolePort ?? 4318,
  dataDirectory: resolve(config.dataDirectory),
  deployment: async ({ images }) => {
    const models = createConfiguredModels(modelConfiguration, { images });
    const launchProfiles = {};
    const host = await createDshHost(models.adapters, {
      compaction: { thresholdRatio: 0.7, retainRatio: 0.15, headroomTokens: 4096, maxTokens: 8192 },
      visualHistory: { maxImages: 12 },
    });
    hosts.push(host);
    for (const [id, entry] of Object.entries(config.profiles)) {
      const worker = entry.worker;
      if (!worker || worker.provider !== 'robodojo')
        throw new Error('Profiles require a RoboDojo worker.');
      const mode = worker.executionMode ?? 'policy';
      if (!['policy', 'direct', 'hybrid'].includes(mode))
        throw new Error('Unknown RoboDojo execution mode.');
      if (mode !== 'policy') {
        const binding = models.models[entry.policyModel ?? models.defaultModel];
        if (!binding || binding.model !== 'gpt-6-astra')
          throw new Error('RoboDojo GPT policy requires the selected GPT-6 Astra binding.');
        if (mode === 'hybrid' && !entry.lowerPolicyUri)
          throw new Error('Hybrid requires an identified learned-policy endpoint.');
        const controlMode = worker.sceneConfiguration.control_mode ?? '0-shot';
        let demonstration;
        if (controlMode !== '0-shot') {
          if (!entry.demonstration?.textFile)
            throw new Error('One-shot profile requires demonstration textFile.');
          const text = await readFile(resolve(entry.demonstration.textFile), 'utf8');
          const frames = entry.demonstration.imageFiles ?? [];
          const admitted = await images.saveImages(
            await Promise.all(
              frames.map(async (file) => ({
                mediaType: 'image/png',
                data: new Uint8Array(await readFile(resolve(file))),
              })),
            ),
          );
          demonstration = { text, images: admitted };
        }
        const gateway = await serveGptPolicy(host, validator, {
          port: 0,
          images,
          modes: [mode],
          onError: (error) => console.error(error),
          policy: {
            provider: binding.provider,
            model: binding.model,
            controlMode,
            reasoningEffort: binding.reasoningEffort ?? 'xhigh',
            instructions: policyInstructions,
            timeoutMs: 300_000,
            maxModelSteps: 24,
            audit,
            ...(demonstration ? { demonstration } : {}),
            ...(mode === 'hybrid'
              ? {
                  propose: (request, signal) =>
                    requestPolicyProposal(entry.lowerPolicyUri, request, validator, signal),
                }
              : {}),
          },
        });
        gateways.push(gateway);
        worker.policyUri = `ws://127.0.0.1:${gateway.port}`;
      }
      launchProfiles[id] = {
        source: 'simulation',
        label: entry.label,
        environment: `RoboDojo / ${worker.nativeTaskId}`,
        embodiment: 'Dual ARX X5',
        executionMode: mode,
        policy: worker.policyId,
        checkpoint: entry.checkpoint,
        defaultModel: entry.plannerModel ?? models.defaultModel,
        tasks: [],
        taskSource: 'environment',
        createEnvironment: ({ signal, services }) => {
          signal.throwIfAborted();
          return createNativeWorkerEnvironment(worker, services, validator);
        },
      };
    }
    return {
      id: 'robodojo-live',
      version: 'robodojo-dsh-policy-v2',
      source: 'simulation',
      description: 'RoboDojo with learned, Astra direct and Astra-supervised hybrid execution',
      teamFile: resolve(root, 'examples/teams/robodojo-live.yaml'),
      roleRoot: resolve(root, 'examples'),
      ...models,
      tasks: {},
      launchProfiles,
      assignmentLifetimeMs: 3_600_000,
      providers: ['robodojo'],
      contextManagement: {
        compaction: {
          thresholdRatio: 0.7,
          retainRatio: 0.15,
          headroomTokens: 4096,
          maxTokens: 8192,
        },
        visualHistory: { maxImages: 12 },
      },
    };
  },
});
process.stdout.write(`${server.url}\n`);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void shutdown().then(
      () => process.exit(0),
      (error) => {
        console.error(error);
        process.exit(1);
      },
    );
  });
