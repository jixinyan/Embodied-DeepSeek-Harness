import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ContractValidator } from '@edh/contracts';
import { assertObjectJsonSchema, validateJsonSchemaValue } from '@edh/tools';
import { modelToolContractSchema } from '../../apps/server/src/model-tool-schema.js';

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
