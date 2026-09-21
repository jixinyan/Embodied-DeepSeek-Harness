import { z } from 'zod';
import type { Budget, ContractValidator, SuccessContract } from '@edh/contracts';

export interface GoalBinding {
  id: string;
  configuration: string;
  successContract: SuccessContract;
  entities: Record<string, string>;
  capabilities: string[];
  taskSemantics: string[];
  budget: Budget;
}

const text = z.string().refine((value) => value.trim().length > 0, 'Expected nonblank text.');
const goalBindingSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/),
    configuration: text,
    successContract: z.unknown(),
    entities: z.record(text, text),
    capabilities: z.array(text),
    taskSemantics: z.array(text),
    budget: z.unknown(),
  })
  .strict();

export function parseGoalBinding(value: unknown, validator: ContractValidator): GoalBinding {
  const fields = goalBindingSchema.parse(value);
  const successContract = validator.parse('SuccessContract', fields.successContract);
  const budget = validator.parse('Budget', fields.budget);
  return structuredClone({ ...fields, successContract, budget });
}
