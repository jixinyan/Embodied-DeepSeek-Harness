import { createHash } from 'node:crypto';
import type { EmbodiedBackend } from '@edh/execution';
import type { ContractValidator, SuccessCheck } from '@edh/contracts';
import { TaskGoals, type GoalBinding } from '@edh/tasks';
import type { ApplicationOptions } from './application.js';
import { CORE_TOOLS } from './application.js';
import type { ModelBinding } from './runtime.js';

export interface TaskPreset {
  readonly label: string;
  readonly instruction: string;
  readonly goal: GoalBinding;
  readonly allowedSubgoalChecks?: readonly SuccessCheck[];
  readonly predefinedGoals?: readonly GoalBinding[];
  /** A fresh backend per admitted run. Startup preflight never calls this factory. */
  readonly createBackend: (options: {
    signal: AbortSignal;
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
  readonly models: Readonly<Record<string, { readonly provider: string; readonly model: string }>>;
  readonly adapters: readonly ModelBinding[];
  readonly tasks: Readonly<Record<string, TaskPreset>>;
  readonly additionalTools?: ApplicationOptions['additionalTools'];
  readonly providers?: readonly string[];
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
  if (!Object.keys(input.tasks).length) throw new Error('Deployment requires at least one task.');
  for (const [id, task] of Object.entries(input.tasks)) {
    if (
      !validId(id) ||
      !task.label?.trim() ||
      !task.instruction?.trim() ||
      typeof task.createBackend !== 'function'
    )
      throw new Error(`Invalid task preset: ${id}`);
    const { createBackend, ...metadata } = task;
    const data = freeze(structuredClone(metadata));
    new TaskGoals(validator, data.goal, data.allowedSubgoalChecks, data.predefinedGoals);
    for (const goal of [data.goal, ...(data.predefinedGoals ?? [])]) {
      if (
        !validId(goal.id) ||
        !goal.configuration?.trim() ||
        !Number.isInteger(goal.budget.max_control_steps) ||
        goal.budget.max_control_steps < 1 ||
        !Number.isFinite(goal.budget.max_wall_time_s) ||
        goal.budget.max_wall_time_s <= 0
      )
        throw new Error(`Invalid goal or execution budget in task: ${id}`);
    }
    taskMetadata[id] = data;
    tasks[id] = Object.freeze({ ...data, createBackend });
  }
  const metadata = freeze({
    id: input.id,
    version: input.version,
    source: input.source,
    description: input.description,
    defaultModel: input.defaultModel,
    models,
    tasks: taskMetadata,
    tools: [...CORE_TOOLS, ...Object.keys(additionalTools)],
    providers: [...(input.providers ?? [])],
  });
  return Object.freeze({
    metadata,
    tasks: Object.freeze(tasks),
    adapters,
    additionalTools,
    teamFile: input.teamFile,
    roleRoot: input.roleRoot,
    digest: createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),
  });
}
