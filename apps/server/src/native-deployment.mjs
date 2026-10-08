import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { z } from 'zod';
import { ContractValidator } from '@edh/contracts';
import {
  createConfiguredModels,
  OpenAICompatibleAdapter,
  readModelConfiguration,
} from '@edh/models';
import { Sam31HttpClient, Yolo26HttpClient } from '@edh/perception';
import { serveGptPolicy, requestPolicyProposal } from '@edh/execution';
import { FileTeamLoader } from '@edh/teams';
import { CORE_TOOLS } from '@edh/tools';
import { parseTaskCatalog } from '@edh/tasks';
import { runConsoleProcess } from './console-process.ts';
import {
  createDshHost,
  createNativeWorkerEnvironment,
  ManagedServices,
  managedServiceConfigurations,
  nativeWorkspaceRetention,
  nativePlannerReview,
  nativeWorkerConfigurationSchema,
  nativePolicyEndpointSchema,
  plannerReviewSchema,
  startServer,
} from './index.ts';

export const nativeDeploymentRoot = fileURLToPath(new URL('../../../', import.meta.url));
const nonblank = z.string().trim().min(1);
const profileSchema = z
  .object({
    id: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/)
      .optional(),
    label: nonblank.optional(),
    environment: nonblank.optional(),
  })
  .strict();
const defaults = {
  robotwin: {
    variable: 'EDH_ROBOTWIN_CONFIG',
    port: 4323,
    nativeTaskId: 'adjust_bottle',
    profileId: 'robotwin-adjust-bottle',
    label: 'RoboTwin Adjust Bottle',
    environment: 'RoboTwin native adjust_bottle',
    embodiment: 'aloha-agilex',
    version: 'robotwin-bf44be51-pi05-e49e2ab6',
    title: 'RoboTwin',
  },
  behavior: {
    variable: 'EDH_BEHAVIOR_CONFIG',
    port: 4334,
    nativeTaskId: 'picking_up_trash',
    profileId: 'behavior-picking-up-trash',
    label: 'BEHAVIOR Picking Up Trash',
    environment: 'BEHAVIOR-1K native picking_up_trash',
    embodiment: 'behavior.r1pro',
    version: 'behavior-b1979916-gr00t-300db814',
    title: 'BEHAVIOR',
  },
  robocasa: {
    variable: 'EDH_NATIVE_WORKER_CONFIG',
    port: 4318,
    nativeTaskId: 'OpenCabinet',
    profileId: 'robocasa-open-cabinet',
    label: 'RoboCasa OpenCabinet',
    environment: 'RoboCasa 1.0.1 native OpenCabinet',
    embodiment: 'PandaOmron',
    version: 'robocasa-1.0.1-gr00t-n1.6',
    title: 'RoboCasa',
  },
  robodojo: {
    variable: 'EDH_ROBODOJO_CONFIG',
    port: 4318,
    embodiment: 'Dual ARX X5',
    version: 'robodojo-dsh-policy-v2',
    title: 'RoboDojo',
  },
};
const contextManagement = {
  compaction: { thresholdRatio: 0.7, retainRatio: 0.15, headroomTokens: 4096, maxTokens: 8192 },
  visualHistory: { maxImages: 12 },
};

export async function readNativeDeploymentConfiguration(provider, environment = process.env) {
  const selected = defaults[provider];
  if (!selected) throw new Error('Unknown native deployment provider.');
  const file = environment[selected.variable];
  if (!file) throw new Error(`${selected.variable} is required.`);
  const config = JSON.parse(await readFile(resolve(file), 'utf8'));
  if (!config || typeof config !== 'object' || Array.isArray(config))
    throw new Error('Native deployment configuration must be a JSON object.');
  const managedServices = managedServiceConfigurations.parse(config.managedServices ?? {});
  const serviceIdsSchema = z
    .array(nonblank)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      'Managed service identities must be unique.',
    );
  const commonServiceIds = serviceIdsSchema.parse(config.serviceIds ?? []);
  const validator = new ContractValidator(
    JSON.parse(
      await readFile(
        resolve(nativeDeploymentRoot, 'harness/contracts/schema/physical.schema.json'),
        'utf8',
      ),
    ),
  );
  const modelPath = environment.EDH_MODEL_CONFIG ?? config.modelConfiguration;
  const modelConfiguration = modelPath
    ? await readModelConfiguration(resolve(modelPath))
    : undefined;
  if (
    !modelConfiguration &&
    (provider !== 'robocasa' || !environment.EDH_MODEL_BASE_URL || !environment.EDH_MODEL)
  )
    throw new Error('A configured native DSH model endpoint is required.');
  const modelAliases = modelConfiguration ? Object.keys(modelConfiguration.models) : ['brain'];
  const defaultModel = modelConfiguration?.defaultModel ?? 'brain';
  const dataDirectory = nonblank.parse(
    provider === 'robocasa'
      ? (environment.EDH_DATA_DIRECTORY ?? config.dataDirectory)
      : config.dataDirectory,
  );
  const segmentationURL =
    provider === 'robocasa'
      ? (environment.EDH_SAM31_BASE_URL ?? config.segmentationURL)
      : config.segmentationURL;
  z.string().url().optional().parse(segmentationURL);
  z.string().url().optional().parse(config.depthURL);
  const teamFile = resolve(
    nativeDeploymentRoot,
    nonblank.optional().parse(config.teamFile) ??
      (provider === 'robotwin' && segmentationURL && config.depthURL
        ? 'examples/teams/robotwin-perception.yaml'
        : provider === 'robocasa' && segmentationURL
          ? 'examples/teams/robocasa-sam-live.yaml'
          : segmentationURL
            ? `examples/teams/${provider}-grounded.yaml`
            : `examples/teams/${provider}-live.yaml`),
  );
  const roleRoot = resolve(
    nativeDeploymentRoot,
    nonblank.optional().parse(config.roleRoot) ?? 'examples',
  );
  const entries =
    provider === 'robodojo'
      ? z.record(nonblank, z.record(z.string(), z.unknown())).parse(config.profiles)
      : { single: config };
  if (!Object.keys(entries).length)
    throw new Error('Native deployment requires at least one profile.');
  const profiles = {};
  for (const [entryId, entry] of Object.entries(entries)) {
    const worker = nativeWorkerConfigurationSchema.parse(
      provider === 'behavior'
        ? { initializeTimeoutMs: 600_000, closeTimeoutMs: 900_000, ...entry.worker }
        : entry.worker,
    );
    if (worker.provider !== provider)
      throw new Error('Native profile provider differs from deployment.');
    if (worker.enableSimulatorInspection && provider !== 'robodojo')
      throw new Error('Simulator inspection requires the implemented RoboDojo provider.');
    const catalog = parseTaskCatalog(worker.catalog, validator);
    if (
      Object.keys(catalog.tasks).length !== 1 ||
      !Object.hasOwn(catalog.tasks, worker.nativeTaskId)
    )
      throw new Error('Native worker requires one catalog task matching nativeTaskId.');
    worker.catalog = catalog;
    const metadata = profileSchema.parse(entry.profile ?? {});
    const legacy = worker.nativeTaskId === selected.nativeTaskId;
    const id =
      metadata.id ??
      (provider === 'robodojo'
        ? entryId
        : legacy
          ? selected.profileId
          : `${provider}-${worker.nativeTaskId.replace(/[^A-Za-z0-9.-]/g, '-').toLowerCase()}`);
    profileSchema.parse({ id });
    if (Object.hasOwn(profiles, id)) throw new Error('Duplicate native launch profile identity.');
    const checkpoint = nonblank.parse(
      provider === 'robocasa'
        ? (environment.EDH_POLICY_CHECKPOINT_LABEL ?? entry.checkpoint)
        : entry.checkpoint,
    );
    const checkpointSha256 = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional()
      .parse(
        entry.checkpointSha256 === undefined
          ? worker.policyCheckpointSha256
          : entry.checkpointSha256,
      );
    if (
      worker.policyCheckpointSha256 !== undefined &&
      worker.policyCheckpointSha256 !== checkpointSha256
    )
      throw new Error('Native profile and Worker checkpoint identities differ.');
    const plannerModel = nonblank.parse(entry.plannerModel ?? defaultModel);
    if (!modelAliases.includes(plannerModel))
      throw new Error('Unknown native Planner model binding.');
    const mode = worker.executionMode ?? 'policy';
    if (mode === 'direct' && checkpointSha256 !== undefined)
      throw new Error('Direct model execution does not select a learned-policy checkpoint digest.');
    if (mode === 'policy' && checkpointSha256 !== undefined)
      worker.policyCheckpointSha256 = checkpointSha256;
    const serviceIds = serviceIdsSchema.parse([
      ...commonServiceIds,
      ...(provider === 'robodojo' ? serviceIdsSchema.parse(entry.serviceIds ?? []) : []),
    ]);
    for (const id of serviceIds)
      if (!Object.hasOwn(managedServices, id))
        throw new Error(`Unknown configured managed service: ${id}`);
    if ((provider !== 'robodojo' || mode === 'policy') && !worker.policyUri)
      throw new Error('A native learned-policy endpoint is required.');
    if (provider === 'robodojo' && mode === 'policy') {
      if ((worker.sceneConfiguration.source ?? 'student') !== 'student')
        throw new Error('RoboDojo learned-policy execution requires the student control source.');
      const teacherFields = [
        'teacher_model',
        'teacher_model_provider',
        'context_version',
        'prompt_sha256',
      ];
      if (teacherFields.some((field) => Object.hasOwn(worker.sceneConfiguration, field)))
        throw new Error(
          'RoboDojo learned-policy metadata must identify its selected student execution.',
        );
    }
    if (provider === 'robodojo' && mode !== 'policy') {
      const binding = modelConfiguration.models[entry.policyModel ?? defaultModel];
      if (!binding || binding.model !== 'gpt-6-astra')
        throw new Error('RoboDojo GPT policy requires the selected GPT-6 Astra binding.');
      if (mode === 'hybrid' && !entry.lowerPolicyUri)
        throw new Error('Hybrid requires an identified learned-policy endpoint.');
      if (mode === 'hybrid') nativePolicyEndpointSchema.parse(entry.lowerPolicyUri);
      if (entry.workerPolicyUri) nativePolicyEndpointSchema.parse(entry.workerPolicyUri);
      if (
        (worker.sceneConfiguration.control_mode ?? '0-shot') !== '0-shot' &&
        !entry.demonstration?.textFile
      )
        throw new Error('One-shot profile requires demonstration textFile.');
    }
    profiles[id] = {
      worker,
      entry,
      checkpoint,
      checkpointSha256,
      plannerModel,
      mode,
      serviceIds,
      plannerReview: plannerReviewSchema.parse(
        entry.plannerReview ?? config.plannerReview ?? nativePlannerReview,
      ),
      label:
        metadata.label ??
        entry.label ??
        (legacy ? selected.label : `${selected.title} ${worker.nativeTaskId}`),
      environment:
        metadata.environment ??
        (legacy ? selected.environment : `${selected.title} / ${worker.nativeTaskId}`),
    };
    nonblank.parse(profiles[id].label);
    nonblank.parse(profiles[id].environment);
  }
  for (const model of new Set([
    defaultModel,
    ...Object.values(profiles).map((profile) => profile.plannerModel),
  ])) {
    const team = await new FileTeamLoader({
      validator,
      builtinDirectory: resolve(nativeDeploymentRoot, 'harness/agent-runtime/agents/roles'),
      roleRoot,
      defaultModel: model,
      models: modelAliases,
      tools: CORE_TOOLS,
      providers: [provider],
    }).inspect(teamFile);
    if (team.definition.entrypoint !== team.definition.bindings.decision_owner)
      throw new Error('Native Team entrypoint must be its decision owner.');
    if (modelConfiguration) {
      for (const member of [
        team.definition.bindings.decision_owner,
        team.definition.bindings.final_verifier,
      ]) {
        const binding = modelConfiguration.models[team.members[member].model];
        if (!binding.inputModalities.includes('image'))
          throw new Error(`Native visual role requires an image-capable model: ${member}`);
      }
    }
  }
  const boundServices = new Set(Object.values(profiles).flatMap((profile) => profile.serviceIds));
  for (const id of Object.keys(managedServices))
    if (!boundServices.has(id))
      throw new Error(`Managed service has no launch profile binding: ${id}`);
  const port = Number(
    provider === 'robocasa'
      ? (environment.EDH_CONSOLE_PORT ?? config.consolePort ?? selected.port)
      : (config.consolePort ?? selected.port),
  );
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
    throw new Error('Console port must be a valid TCP port.');
  return {
    provider,
    selected,
    config,
    validator,
    modelConfiguration,
    defaultModel,
    profiles,
    managedServices,
    teamFile,
    roleRoot,
    dataDirectory: resolve(dataDirectory),
    port,
    segmentationURL,
    baseURL: environment.EDH_MODEL_BASE_URL,
    model: environment.EDH_MODEL,
  };
}

async function openNativeEnvironment(settings, profile, models, services, signal) {
  signal.throwIfAborted();
  if (settings.provider !== 'robodojo' || profile.mode === 'policy')
    return createNativeWorkerEnvironment(profile.worker, services, settings.validator);
  let host;
  let gateway;
  let environment;
  let closing;
  let auditWrites = Promise.resolve();
  let auditFailure;
  const close = () => {
    if (closing) return closing;
    closing = (async () => {
      const errors = [];
      for (const action of [
        () => environment?.close(),
        () => gateway?.close(),
        () => host?.fiber.dispose(),
        () => auditWrites,
      ]) {
        try {
          await action();
        } catch (error) {
          errors.push(error);
        }
      }
      if (auditFailure && !errors.includes(auditFailure)) errors.push(auditFailure);
      if (errors.length)
        throw new AggregateError(errors, 'Native policy/environment cleanup failed.');
    })();
    return closing;
  };
  try {
    const auditDirectory = resolve(settings.dataDirectory, 'policy-audits');
    await mkdir(auditDirectory, { recursive: true });
    const audit = (record) => {
      if (auditFailure) throw auditFailure;
      auditWrites = auditWrites.then(() =>
        appendFile(resolve(auditDirectory, 'events.jsonl'), `${JSON.stringify(record)}\n`),
      );
      auditWrites.catch((error) => {
        auditFailure = error;
        void close().catch(console.error);
      });
    };
    host = await createDshHost(models.adapters, contextManagement);
    signal.throwIfAborted();
    const binding = models.models[profile.entry.policyModel ?? models.defaultModel];
    const controlMode = profile.worker.sceneConfiguration.control_mode ?? '0-shot';
    let demonstration;
    if (controlMode !== '0-shot') {
      const declared = profile.entry.demonstration;
      const text = await readFile(resolve(declared.textFile), 'utf8');
      const images = await services.images.saveImages(
        await Promise.all(
          (declared.imageFiles ?? []).map(async (file) => ({
            mediaType: 'image/png',
            data: new Uint8Array(await readFile(resolve(file))),
          })),
        ),
      );
      demonstration = { text, images };
    }
    gateway = await serveGptPolicy(host, settings.validator, {
      port: profile.entry.policyGatewayPort ?? 0,
      images: services.images,
      modes: [profile.mode],
      onError: (error) => console.error(error),
      policy: {
        provider: binding.provider,
        model: binding.model,
        controlMode,
        reasoningEffort: binding.reasoningEffort ?? 'xhigh',
        instructions: await readFile(
          resolve(nativeDeploymentRoot, 'examples/policies/robodojo-astra.md'),
          'utf8',
        ),
        timeoutMs: 300_000,
        maxModelSteps: 24,
        audit,
        ...(demonstration ? { demonstration } : {}),
        ...(profile.mode === 'hybrid'
          ? {
              propose: (request, signal) =>
                requestPolicyProposal(
                  profile.entry.lowerPolicyUri,
                  profile.checkpointSha256 === undefined
                    ? request
                    : { ...request, checkpoint_sha256: profile.checkpointSha256 },
                  settings.validator,
                  signal,
                ),
            }
          : {}),
      },
    });
    signal.throwIfAborted();
    environment = await createNativeWorkerEnvironment(
      {
        ...profile.worker,
        policyUri: profile.entry.workerPolicyUri ?? `ws://127.0.0.1:${gateway.port}`,
      },
      services,
      settings.validator,
    );
    signal.throwIfAborted();
    return {
      describeTasks: (options) => environment.describeTasks(options),
      createTaskBackend: (taskId, options) => environment.createTaskBackend(taskId, options),
      close,
    };
  } catch (error) {
    try {
      await close();
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        'Native environment allocation and cleanup failed.',
      );
    }
    throw error;
  }
}

export function createNativeDeploymentFactory(settings) {
  return async (services) => {
    const models = settings.modelConfiguration
      ? createConfiguredModels(settings.modelConfiguration, services)
      : {
          defaultModel: 'brain',
          models: { brain: { provider: 'local-vlm', model: settings.model } },
          adapters: [
            {
              providers: ['local-vlm'],
              adapter: new OpenAICompatibleAdapter({
                baseURL: settings.baseURL,
                models: [
                  {
                    id: settings.model,
                    inputModalities: ['text', 'image'],
                    contextWindow: 32768,
                    maxTokens: 2048,
                  },
                ],
                timeoutMs: 180_000,
                connectionMode: 'close-after-response',
                resolveImage: (ref, signal) =>
                  services.images.readImageRequest(
                    ref,
                    { maxPixels: 1024 * 1024, maxBytes: 2 * 1024 * 1024 },
                    signal,
                  ),
              }),
            },
          ],
        };
    const serviceLifecycle = new ManagedServices(settings.managedServices);
    const launchProfiles = Object.fromEntries(
      Object.entries(settings.profiles).map(([id, profile]) => [
        id,
        {
          teamFile: settings.teamFile,
          roleRoot: settings.roleRoot,
          source: 'simulation',
          label: profile.label,
          plannerReview: profile.plannerReview,
          environment: profile.environment,
          embodiment: settings.selected.embodiment,
          executionMode: profile.mode,
          policy: profile.worker.policyId,
          checkpoint: profile.checkpoint,
          ...(profile.checkpointSha256 === undefined
            ? {}
            : { checkpointSha256: profile.checkpointSha256 }),
          defaultModel: profile.plannerModel,
          tasks: [],
          taskSource: 'environment',
          createEnvironment: async ({ signal, services }) => {
            const lease = await serviceLifecycle.acquire(profile.serviceIds, signal);
            let environment;
            let closing;
            const close = () =>
              (closing ??= (async () => {
                lease.signal.removeEventListener('abort', interrupted);
                const errors = [];
                for (const action of [() => environment?.close(), () => lease.release()]) {
                  try {
                    await action();
                  } catch (error) {
                    errors.push(error);
                  }
                }
                if (errors.length)
                  throw new AggregateError(
                    errors,
                    'Native environment and managed service release failed.',
                  );
              })());
            const interrupted = () => {
              void close().catch(console.error);
            };
            try {
              environment = await openNativeEnvironment(
                settings,
                profile,
                models,
                services,
                AbortSignal.any([signal, lease.signal]),
              );
              lease.signal.addEventListener('abort', interrupted, { once: true });
              signal.throwIfAborted();
              lease.signal.throwIfAborted();
              return {
                describeTasks: (options) => {
                  lease.signal.throwIfAborted();
                  return environment.describeTasks(options);
                },
                createTaskBackend: (taskId, options) => {
                  lease.signal.throwIfAborted();
                  return environment.createTaskBackend(taskId, {
                    ...options,
                    signal: AbortSignal.any([options.signal, lease.signal]),
                  });
                },
                close,
              };
            } catch (error) {
              try {
                await close();
              } catch (cleanup) {
                throw new AggregateError(
                  [error, cleanup],
                  'Native allocation and service release failed.',
                );
              }
              throw error;
            }
          },
        },
      ]),
    );
    return {
      id: `${settings.provider}-live`,
      version: `${settings.selected.version}-factory-v5`,
      source: 'simulation',
      description: `Native ${settings.selected.title} with independent DSH role Sessions`,
      teamFile: settings.teamFile,
      roleRoot: settings.roleRoot,
      storageRetention: nativeWorkspaceRetention,
      serviceLifecycle,
      serviceConfigurationDigest: createHash('sha256')
        .update(
          JSON.stringify({
            definitions: settings.managedServices,
            bindings: Object.fromEntries(
              Object.entries(settings.profiles).map(([id, profile]) => [id, profile.serviceIds]),
            ),
          }),
        )
        .digest('hex'),
      ...models,
      tasks: {},
      launchProfiles,
      assignmentLifetimeMs: 3_600_000,
      providers: [settings.provider],
      contextManagement,
      ...(settings.segmentationURL
        ? { segmentation: new Sam31HttpClient(settings.segmentationURL) }
        : {}),
      ...(settings.config.depthURL
        ? {
            depth: new Yolo26HttpClient(settings.config.depthURL),
            depthIntrinsicsByCamera: settings.config.depthIntrinsicsByCamera ?? {},
          }
        : {}),
      enableObjectMeasurement: Boolean(settings.segmentationURL),
    };
  };
}

export function isNativeDeploymentEntry(moduleUrl) {
  return Boolean(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(moduleUrl));
}

export async function runNativeDeployment(settings) {
  const dispatcher = new EnvHttpProxyAgent();
  setGlobalDispatcher(dispatcher);
  return runConsoleProcess({
    start: () =>
      startServer({
        root: nativeDeploymentRoot,
        dataDirectory: settings.dataDirectory,
        port: settings.port,
        deployment: createNativeDeploymentFactory(settings),
      }),
    dispose: () => dispatcher.close(),
  });
}
