import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ContractValidator } from '@edh/contracts';
import { readModelConfiguration } from '@edh/models';
import { admitDepthIntrinsicsByCamera } from '@edh/perception';
import { FileTeamLoader } from '@edh/teams';
import { CORE_TOOLS } from '@edh/tools';
import { parseTaskCatalog } from '@edh/tasks';
import { GPT_CONTROL_MODES, MAX_GPT_DEMONSTRATION_IMAGES } from '@edh/execution';
import {
  managedServiceConfigurations,
  nativePlannerReview,
  nativeWorkerConfigurationSchema,
  nativePolicyEndpointSchema,
  plannerReviewSchema,
} from './index.ts';

export const nativeDeploymentRoot = fileURLToPath(new URL('../../../', import.meta.url));
const nonblank = z.string().trim().min(1);
const demonstrationSchema = z
  .object({
    textFile: nonblank,
    imageFiles: z.array(nonblank).max(MAX_GPT_DEMONSTRATION_IMAGES).optional(),
  })
  .strict();
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
export const contextManagement = {
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
  const depthIntrinsicsByCamera = admitDepthIntrinsicsByCamera(
    config.depthIntrinsicsByCamera === undefined ? {} : config.depthIntrinsicsByCamera,
  );
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
      z.number().int().min(0).max(65535).optional().parse(entry.policyGatewayPort);
      const binding = modelConfiguration.models[entry.policyModel ?? defaultModel];
      if (!binding || binding.model !== 'gpt-6-astra')
        throw new Error('RoboDojo GPT policy requires the selected GPT-6 Astra binding.');
      if (mode === 'hybrid' && !entry.lowerPolicyUri)
        throw new Error('Hybrid requires an identified learned-policy endpoint.');
      if (mode === 'hybrid') nativePolicyEndpointSchema.parse(entry.lowerPolicyUri);
      nativePolicyEndpointSchema.optional().parse(entry.workerPolicyUri);
      const controlMode =
        z.enum(GPT_CONTROL_MODES).optional().parse(worker.sceneConfiguration.control_mode) ??
        '0-shot';
      const demonstration = demonstrationSchema.optional().parse(entry.demonstration);
      if (controlMode !== '0-shot' && !demonstration)
        throw new Error('One-shot profile requires demonstration textFile.');
      if (controlMode === 'visual-1-shot' && !demonstration.imageFiles?.length)
        throw new Error('Visual one-shot profile requires demonstration imageFiles.');
    }
    profiles[id] = {
      worker,
      entry,
      checkpoint,
      checkpointSha256,
      plannerModel,
      mode,
      serviceIds,
      depthIntrinsicsByCamera:
        entry.depthIntrinsicsByCamera === undefined
          ? depthIntrinsicsByCamera
          : admitDepthIntrinsicsByCamera(entry.depthIntrinsicsByCamera),
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
    depthIntrinsicsByCamera,
    baseURL: environment.EDH_MODEL_BASE_URL,
    model: environment.EDH_MODEL,
  };
}
