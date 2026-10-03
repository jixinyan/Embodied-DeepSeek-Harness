import { createHash } from 'node:crypto';
import { contextManagementOptions, type ContextManagementOptions } from '@edh/memory';
import {
  resolvePhysicalRuntimeProfile,
  validatePhysicalProviderBindings,
  type PhysicalProfileValidators,
  type EmbodiedBackend,
  type PhysicalRuntimeProfile,
  type ResolvedPhysicalRuntimeProfile,
} from '@edh/execution';
import type { ContractValidator } from '@edh/contracts';
import { parseTaskDefinition, type TaskDefinition, type TaskCatalogDefinition } from '@edh/tasks';
import type { ApplicationOptions } from './application.js';
import type { DeploymentRetentionFactory } from './deployment-retention.js';
import { CORE_TOOLS } from './application.js';
import type { ModelBinding } from './runtime.js';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { SegmentationEngine, DepthEngine, DepthCameraIntrinsics } from '@edh/perception';
import {
  defaultSessionHistory,
  sessionHistoryOptions,
  type SessionHistoryOptions,
} from '@edh/storage';

export interface DeploymentServices {
  readonly images: AttachmentStore;
}

/** One environment allocation, retained across independent task backends. */
export interface SessionEnvironment {
  describeTasks?(options: {
    signal: AbortSignal;
  }): TaskCatalogDefinition | Promise<TaskCatalogDefinition>;
  /** Fresh task control scope; closing this port must not destroy the environment. */
  createTaskBackend(
    taskId: string,
    options: {
      signal: AbortSignal;
      runId: string;
      task?: TaskDefinition;
      catalogRevision?: string;
    },
  ): Promise<EmbodiedBackend> | EmbodiedBackend;
  /** Stop/release the environment, even after a task-port cleanup error. */
  close(): Promise<void>;
}
export interface LaunchProfile {
  readonly source?: EmbodiedBackend['source'];
  readonly label: string;
  readonly environment: string;
  readonly embodiment: string;
  readonly policy: string;
  readonly executionMode?: 'policy' | 'direct' | 'hybrid';
  readonly checkpoint: string;
  /** Default for roles without an explicit model binding. */
  readonly defaultModel: string;
  readonly tasks: readonly string[];
  readonly taskSource?: 'deployment' | 'environment';
  readonly physicalProfile?: PhysicalRuntimeProfile;
  readonly physicalProviders?: PhysicalProfileValidators;
  readonly createEnvironment: (options: {
    signal: AbortSignal;
    services: DeploymentServices;
    profile?: ResolvedPhysicalRuntimeProfile;
  }) => SessionEnvironment | Promise<SessionEnvironment>;
}
export interface TaskPreset extends TaskDefinition {
  /** A fresh backend per admitted run. Startup preflight never calls this factory. */
  readonly createBackend: (options: {
    signal: AbortSignal;
    services: DeploymentServices;
    profile?: ResolvedPhysicalRuntimeProfile;
  }) => EmbodiedBackend | Promise<EmbodiedBackend>;
}
/** Trusted deployment composition; executable factories and credentials are never served over HTTP. */
export interface ServerDeployment {
  readonly id: string;
  /** Version of executable bindings; bump when factory/adapter behavior changes. */
  readonly version: string;
  readonly source: EmbodiedBackend['source'];
  readonly description: string;
  readonly teamFile: string;
  readonly roleRoot: string;
  readonly defaultModel: string;
  readonly models: Readonly<
    Record<
      string,
      {
        readonly provider: string;
        readonly model: string;
        readonly reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
      }
    >
  >;
  readonly adapters: readonly ModelBinding[];
  readonly modelConfigurationDigest?: string;
  readonly tasks: Readonly<Record<string, TaskPreset>>;
  readonly additionalTools?: ApplicationOptions['additionalTools'];
  readonly segmentation?: SegmentationEngine;
  readonly depth?: DepthEngine;
  readonly enableObjectMeasurement?: boolean;
  readonly depthIntrinsicsByCamera?: Readonly<Record<string, DepthCameraIntrinsics>>;
  readonly providers?: readonly string[];
  readonly contextManagement?: ContextManagementOptions;
  readonly sessionHistory?: SessionHistoryOptions;
  readonly storageRetention?: DeploymentRetentionFactory;
  readonly assignmentLifetimeMs?: number;
  /** Optional version-pinned simulation/embodiment/policy stack. */
  readonly physicalProfile?: PhysicalRuntimeProfile;
  readonly physicalProviders?: PhysicalProfileValidators;
  readonly launchProfiles?: Readonly<Record<string, LaunchProfile>>;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
const validId = (id: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(id);

/** Snapshot metadata before task admission; keep callable DSH adapters/factories private. */
export function prepareDeployment(input: ServerDeployment, validator: ContractValidator) {
  if (!validId(input.id) || !input.version?.trim() || !input.description?.trim())
    throw new Error('Deployment requires an ID, version and description.');
  if (!['test_fixture', 'simulation', 'hardware'].includes(input.source))
    throw new Error('Invalid deployment evidence source.');
  if (
    input.assignmentLifetimeMs !== undefined &&
    (!Number.isSafeInteger(input.assignmentLifetimeMs) ||
      input.assignmentLifetimeMs < 1_000 ||
      input.assignmentLifetimeMs > 86_400_000)
  )
    throw new Error('Assignment lifetime must be between one second and one day.');
  if (
    input.modelConfigurationDigest !== undefined &&
    (input.modelConfigurationDigest.length !== 64 ||
      !/^[a-f0-9]{64}$/.test(input.modelConfigurationDigest))
  )
    throw new Error('Invalid model configuration digest.');
  const models = freeze(structuredClone(input.models));
  const providers = new Set<string>();
  const adapters = input.adapters.map((binding) => {
    if (!binding.providers.length) throw new Error('Adapter requires at least one provider.');
    for (const provider of binding.providers) {
      if (!provider || providers.has(provider))
        throw new Error('Duplicate or empty model provider.');
      providers.add(provider);
    }
    return { providers: [...binding.providers], adapter: binding.adapter };
  });
  if (!Object.hasOwn(models, input.defaultModel)) throw new Error('Unknown default model binding.');
  for (const [id, model] of Object.entries(models))
    if (!validId(id) || !model.model?.trim() || !providers.has(model.provider))
      throw new Error(`Model binding has no registered adapter: ${id}`);
  const additionalTools = Object.freeze({ ...input.additionalTools });
  for (const [id, factory] of Object.entries(additionalTools))
    if (!validId(id) || CORE_TOOLS.includes(id) || typeof factory !== 'function')
      throw new Error(`Invalid or reserved tool binding: ${id}`);
  const tasks: Record<string, TaskPreset> = Object.create(null);
  const taskMetadata: Record<string, Omit<TaskPreset, 'createBackend'>> = Object.create(null);
  if (
    !Object.keys(input.tasks).length &&
    !Object.values(input.launchProfiles ?? {}).some(
      (profile) => profile.taskSource === 'environment',
    )
  )
    throw new Error('Deployment requires tasks or an environment task catalog.');
  for (const [id, task] of Object.entries(input.tasks)) {
    if (
      !validId(id) ||
      !task.label?.trim() ||
      !task.instruction?.trim() ||
      typeof task.createBackend !== 'function'
    )
      throw new Error(`Invalid task preset: ${id}`);
    const { createBackend, ...metadata } = task;
    const data = freeze(parseTaskDefinition(metadata, validator));
    taskMetadata[id] = data;
    tasks[id] = Object.freeze({ ...data, createBackend });
  }
  const physicalProfile =
    input.physicalProfile === undefined
      ? undefined
      : resolvePhysicalRuntimeProfile(input.physicalProfile, validator);
  if (physicalProfile) validatePhysicalProviderBindings(physicalProfile, input.physicalProviders);
  const launchProfiles: Record<
    string,
    LaunchProfile & { physicalProfile?: ResolvedPhysicalRuntimeProfile }
  > = Object.create(null);
  const launchMetadata: Record<
    string,
    Omit<LaunchProfile, 'createEnvironment' | 'physicalProviders'>
  > = Object.create(null);
  for (const [id, profile] of Object.entries(input.launchProfiles ?? {})) {
    if (
      !validId(id) ||
      !profile ||
      (profile.source !== undefined &&
        !['test_fixture', 'simulation', 'hardware'].includes(profile.source)) ||
      [
        profile.label,
        profile.environment,
        profile.embodiment,
        profile.policy,
        profile.checkpoint,
      ].some((value) => typeof value !== 'string' || !value.trim()) ||
      !Object.hasOwn(models, profile.defaultModel) ||
      (profile.executionMode !== undefined &&
        !['policy', 'direct', 'hybrid'].includes(profile.executionMode)) ||
      typeof profile.createEnvironment !== 'function' ||
      !Array.isArray(profile.tasks) ||
      (profile.taskSource !== undefined &&
        !['deployment', 'environment'].includes(profile.taskSource)) ||
      (profile.taskSource === 'environment' ? profile.tasks.length !== 0 : !profile.tasks.length) ||
      new Set(profile.tasks).size !== profile.tasks.length ||
      profile.tasks.some((id) => !Object.hasOwn(tasks, id))
    )
      throw new Error(`Invalid launch profile: ${id}`);
    const resolved =
      profile.physicalProfile === undefined
        ? undefined
        : resolvePhysicalRuntimeProfile(profile.physicalProfile, validator);
    if (resolved) validatePhysicalProviderBindings(resolved, profile.physicalProviders);
    // Whitelist public metadata: executable factories and credentials stay private.
    const data = freeze(
      structuredClone({
        source: profile.source ?? input.source,
        label: profile.label,
        environment: profile.environment,
        embodiment: profile.embodiment,
        policy: profile.policy,
        executionMode: profile.executionMode ?? 'policy',
        checkpoint: profile.checkpoint,
        defaultModel: profile.defaultModel,
        tasks: [...profile.tasks],
        taskSource: profile.taskSource ?? 'deployment',
        ...(resolved ? { physicalProfile: resolved } : {}),
      }),
    );
    launchMetadata[id] = data;
    launchProfiles[id] = Object.freeze({ ...data, createEnvironment: profile.createEnvironment });
  }
  const contextManagement =
    input.contextManagement === undefined
      ? undefined
      : contextManagementOptions(input.contextManagement);
  const sessionHistory = Object.freeze(
    sessionHistoryOptions(input.sessionHistory ?? defaultSessionHistory),
  );
  const metadata = freeze({
    id: input.id,
    version: input.version,
    source: input.source,
    description: input.description,
    defaultModel: input.defaultModel,
    sessionHistory,
    ...(input.assignmentLifetimeMs === undefined
      ? {}
      : { assignmentLifetimeMs: input.assignmentLifetimeMs }),
    ...(contextManagement === undefined ? {} : { contextManagement }),
    ...(physicalProfile === undefined ? {} : { physicalProfile }),
    models,
    ...(input.modelConfigurationDigest === undefined
      ? {}
      : { modelConfigurationDigest: input.modelConfigurationDigest }),
    launchProfiles: launchMetadata,
    tasks: taskMetadata,
    tools: [
      ...CORE_TOOLS.filter((tool) =>
        tool === 'perception.segment_objects'
          ? input.segmentation
          : tool === 'perception.estimate_depth'
            ? input.depth
            : tool === 'perception.measure_object'
              ? input.enableObjectMeasurement === true
              : true,
      ),
      ...Object.keys(additionalTools),
    ],
    providers: [...(input.providers ?? [])],
  });
  return Object.freeze({
    metadata,
    tasks: Object.freeze(tasks),
    launchProfiles: Object.freeze(launchProfiles),
    adapters,
    additionalTools,
    segmentation: input.segmentation,
    depth: input.depth,
    depthIntrinsicsByCamera: input.depthIntrinsicsByCamera,
    sessionHistory,
    storageRetention: input.storageRetention,
    ...(input.assignmentLifetimeMs === undefined
      ? {}
      : { assignmentLifetimeMs: input.assignmentLifetimeMs }),
    ...(contextManagement === undefined ? {} : { contextManagement }),
    ...(physicalProfile === undefined ? {} : { physicalProfile }),
    teamFile: input.teamFile,
    roleRoot: input.roleRoot,
    digest: createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),
  });
}
