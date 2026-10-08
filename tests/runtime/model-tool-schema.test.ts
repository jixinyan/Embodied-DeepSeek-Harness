import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ContractValidator } from '@edh/contracts';
import {
  assertObjectJsonSchema,
  coreModelToolParameters,
  CORE_TOOL_PARAMETERS,
  modelToolContractSchema,
  validateJsonSchemaValue,
} from '@edh/tools';

test('PlanDocument tool parameters expose required nested criteria', async () => {
  const schema = JSON.parse(
    await readFile('harness/contracts/schema/physical.schema.json', 'utf8'),
  );
  const validator = new ContractValidator(schema);
  const plan = await modelToolContractSchema(validator, 'PlanDocument');
  assertObjectJsonSchema(plan);
  const properties = plan.properties as Record<string, Record<string, unknown>>;
  assert.equal(properties.schema_version?.const, 'physical.plan.v1');
  const item = (properties.items?.items ?? {}) as Record<string, unknown>;
  assert.deepEqual(item.required, [
    'goal_id',
    'description',
    'status',
    'dependencies',
    'success_contract',
  ]);
  const itemProperties = item.properties as Record<string, Record<string, unknown>>;
  assert.deepEqual(itemProperties.status?.enum, [
    'planned',
    'active',
    'waiting',
    'done',
    'abandoned',
  ]);
  assert.equal(Object.hasOwn(itemProperties.success_contract ?? {}, '$ref'), false);
  const wire = JSON.parse(await readFile('tests/contracts/wire-cases.json', 'utf8'));
  assert.deepEqual(validateJsonSchemaValue(plan, wire.bases.plan.value), []);
});

test('assignment parameter edits preserve canonical and caller-owned schemas', async () => {
  const validator = new ContractValidator(
    JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
  );
  const planSchema = await modelToolContractSchema(validator, 'PlanDocument');
  const originalPlan = structuredClone(planSchema);
  const originalCore = structuredClone(CORE_TOOL_PARAMETERS);
  const parameters = coreModelToolParameters('planning.update', { planSchema });
  const independent = coreModelToolParameters('planning.update', { planSchema });
  const originalParameters = structuredClone(independent);
  const properties = parameters.properties as Record<string, Record<string, unknown>>;
  properties.expectedVersion!.description = 'Assignment-local annotation';
  const planProperties = properties.plan!.properties as Record<string, Record<string, unknown>>;
  planProperties.items!.description = 'Assignment-local plan annotation';
  assert.deepEqual(planSchema, originalPlan);
  assert.deepEqual(CORE_TOOL_PARAMETERS, originalCore);
  assert.deepEqual(independent, originalParameters);
  assert.deepEqual(coreModelToolParameters('planning.update', { planSchema }), originalParameters);
});

test('execution query parameters retain decision-owner turn authority', () => {
  const planner = coreModelToolParameters('execution.query', { executionTurnCompletion: true });
  const verifier = coreModelToolParameters('execution.query');
  assertObjectJsonSchema(planner);
  assertObjectJsonSchema(verifier);
  assert.deepEqual(validateJsonSchemaValue(planner, { completeTurn: true }), []);
  assert(validateJsonSchemaValue(verifier, { completeTurn: true }).length > 0);
  assert.deepEqual(validateJsonSchemaValue(verifier, {}), []);
  assert.deepEqual(validateJsonSchemaValue(planner, {}), []);
});
