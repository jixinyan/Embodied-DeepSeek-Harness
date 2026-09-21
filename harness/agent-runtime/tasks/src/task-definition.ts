import { z } from 'zod';
import type { ContractValidator, SuccessCheck } from '@edh/contracts';
import { TaskGoals, type GoalBinding } from './goals.js';
import { parseGoalBinding } from './goal-binding.js';

export interface TaskDefinition {
  readonly label: string;
  readonly instruction: string;
  readonly goal: GoalBinding;
  readonly allowedSubgoalChecks?: readonly SuccessCheck[];
  readonly predefinedGoals?: readonly GoalBinding[];
}
export interface TaskCatalogDefinition {
  readonly revision: string;
  readonly tasks: Readonly<Record<string, TaskDefinition>>;
}
const text = z.string().refine((value) => value.trim().length > 0, 'Expected nonblank text.');
const definitionSchema = z
  .object({
    label: text,
    instruction: text.max(4000),
    goal: z.unknown(),
    allowedSubgoalChecks: z.array(z.unknown()).optional(),
    predefinedGoals: z.array(z.unknown()).optional(),
  })
  .strict();
const catalogSchema = z
  .object({
    revision: text,
    tasks: z.record(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$(?![\s\S])/), z.unknown()),
  })
  .strict();

export function parseTaskDefinition(value: unknown, validator: ContractValidator): TaskDefinition {
  const input = definitionSchema.parse(value);
  const definition: TaskDefinition = {
    label: input.label,
    instruction: input.instruction,
    goal: parseGoalBinding(input.goal, validator),
    ...(input.allowedSubgoalChecks === undefined
      ? {}
      : {
          allowedSubgoalChecks: input.allowedSubgoalChecks.map((check) =>
            structuredClone(validator.parse('SuccessCheck', check)),
          ),
        }),
    ...(input.predefinedGoals === undefined
      ? {}
      : {
          predefinedGoals: input.predefinedGoals.map((goal) => parseGoalBinding(goal, validator)),
        }),
  };
  new TaskGoals(
    validator,
    definition.goal,
    definition.allowedSubgoalChecks,
    definition.predefinedGoals,
  );
  return definition;
}

export function parseTaskCatalog(
  value: unknown,
  validator: ContractValidator,
): TaskCatalogDefinition {
  const input = catalogSchema.parse(value);
  if (!Object.keys(input.tasks).length) throw new Error('Task catalog requires at least one task.');
  return {
    revision: input.revision,
    tasks: Object.fromEntries(
      Object.entries(input.tasks).map(([id, task]) => [id, parseTaskDefinition(task, validator)]),
    ),
  };
}
