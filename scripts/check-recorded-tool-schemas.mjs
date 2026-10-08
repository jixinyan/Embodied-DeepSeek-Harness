import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { ContractValidator } from '@edh/contracts';
import {
  assertObjectJsonSchema,
  coreModelToolParameters,
  CORE_TOOL_PARAMETERS,
  modelToolContractSchema,
  validateJsonSchemaValue,
} from '@edh/tools';

const { values } = parseArgs({
  options: {
    requests: { type: 'string' },
    descriptions: { type: 'string' },
    output: { type: 'string' },
  },
});
assert(values.requests && values.descriptions && values.output);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const childPath = relative(resolve(root, '.local/work'), output);
assert(
  childPath && !isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`),
);
await mkdir(output, { recursive: false });
const directory = resolve(values.requests);
const descriptionsPath = resolve(values.descriptions);
const schemaPath = resolve(root, 'harness/contracts/schema/physical.schema.json');
const descriptionBytes = await readFile(descriptionsPath);
const descriptions = JSON.parse(descriptionBytes.toString('utf8')).descriptions;
assert(descriptions && typeof descriptions === 'object' && !Array.isArray(descriptions));
const schemaBytes = await readFile(schemaPath);
const validator = new ContractValidator(JSON.parse(schemaBytes.toString('utf8')));
const planSchema = await modelToolContractSchema(validator, 'PlanDocument');
const originalCore = structuredClone(CORE_TOOL_PARAMETERS);
const originalPlan = structuredClone(planSchema);
const sources = [];
const implementationSources = await Promise.all(
  [
    'harness/agent-runtime/tools/src/model-schema.ts',
    'harness/agent-runtime/tools/src/core-inputs.ts',
    'scripts/check-recorded-tool-schemas.mjs',
  ].map(async (name) => {
    const path = resolve(root, name);
    return {
      path,
      sha256: createHash('sha256')
        .update(await readFile(path))
        .digest('hex'),
    };
  }),
);
let plannerRequests = 0;
let verifierRequests = 0;
let otherRoleRequests = 0;
let checkedSchemas = 0;
let planningSchemas = 0;
let independentParameterChecks = 0;
const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
assert(names.length > 0);

for (const name of names) {
  const path = resolve(directory, name);
  const bytes = await readFile(path);
  const request = JSON.parse(bytes.toString('utf8'));
  assert(typeof request.model === 'string' && request.model.trim());
  assert(Array.isArray(request.messages));
  const tools = request.tools ?? [];
  assert(Array.isArray(tools));
  const functions = tools.map((tool) => {
    assert.equal(tool.type, 'function');
    assert(tool.function && typeof tool.function === 'object');
    return tool.function;
  });
  const system = request.messages
    .filter((message) => message.role === 'system')
    .map((message) => JSON.stringify(message.content))
    .join('\n');
  const planner = functions.some((tool) => tool.name === 'execution__start');
  const verifier = functions.some((tool) => tool.name === 'verification__submit');
  assert(
    !(planner && verifier),
    'Original request combines decision and formal-verdict authority.',
  );
  if (planner) {
    assert(system.includes('# Decision-owner workflow'));
    assert(!system.includes('# Formal-verifier workflow'));
    plannerRequests++;
  } else if (verifier) {
    assert(system.includes('# Formal-verifier workflow'));
    assert(!system.includes('# Decision-owner workflow'));
    verifierRequests++;
  } else {
    otherRoleRequests++;
  }
  assert.equal(new Set(functions.map((tool) => tool.name)).size, functions.length);
  for (const tool of functions) {
    assertObjectJsonSchema(tool.parameters);
    const logical = tool.name.replaceAll('__', '.');
    if (logical !== 'todo_write') {
      assert.equal(tool.parameters.additionalProperties, false);
      assert.equal(tool.description, descriptions[logical]);
    }
    if (logical === 'planning.update') {
      const parameters = coreModelToolParameters(logical, { planSchema });
      const independent = coreModelToolParameters(logical, { planSchema });
      assert.deepEqual(parameters, independent);
      const currentPlan = parameters.properties.plan;
      const recordedPlan = tool.parameters.properties.plan;
      assert.equal(recordedPlan.type, currentPlan.type);
      assert.equal(recordedPlan.additionalProperties, currentPlan.additionalProperties);
      assert.deepEqual(recordedPlan.required, currentPlan.required);
      assert.deepEqual(
        recordedPlan.properties.schema_version,
        currentPlan.properties.schema_version,
      );
      assert.deepEqual(recordedPlan.properties.version, currentPlan.properties.version);
      assert.deepEqual(recordedPlan.properties.items, currentPlan.properties.items);
      parameters.properties.expectedVersion.description = 'Assignment-local annotation';
      parameters.properties.plan.properties.items.description = 'Assignment-local plan annotation';
      assert.deepEqual(coreModelToolParameters(logical, { planSchema }), independent);
      assert.deepEqual(planSchema, originalPlan);
      assert.deepEqual(CORE_TOOL_PARAMETERS, originalCore);
      independentParameterChecks++;
      planningSchemas++;
    }
    if (logical === 'execution.query' && !planner) {
      const current = coreModelToolParameters(logical);
      assert.deepEqual(validateJsonSchemaValue(current, {}), []);
      assert(validateJsonSchemaValue(current, { completeTurn: true }).length > 0);
    }
    checkedSchemas++;
  }
  sources.push({
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    model: request.model,
    toolCount: functions.length,
    responsibility: planner ? 'planner' : verifier ? 'verifier' : 'other',
  });
}
assert(plannerRequests > 0 && verifierRequests > 0 && planningSchemas > 0);
for (const source of [...sources, ...implementationSources])
  assert.equal(
    createHash('sha256')
      .update(await readFile(source.path))
      .digest('hex'),
    source.sha256,
  );
assert.deepEqual(await readFile(descriptionsPath), descriptionBytes);
assert.deepEqual(await readFile(schemaPath), schemaBytes);
await writeFile(
  resolve(output, 'acceptance.json'),
  `${JSON.stringify(
    {
      schemaVersion: 'edh.recorded_tool_schemas_cpu.v1',
      recordedAt: new Date().toISOString(),
      sources,
      implementationSources,
      descriptionSource: {
        path: descriptionsPath,
        sha256: createHash('sha256').update(descriptionBytes).digest('hex'),
      },
      schemaSha256: createHash('sha256').update(schemaBytes).digest('hex'),
      plannerRequests,
      verifierRequests,
      otherRoleRequests,
      checkedSchemas,
      planningSchemas,
      independentParameterChecks,
      originalSourceHashesUnchanged: true,
      environmentAllocationPerformed: false,
      modelInferencePerformed: false,
      physicalControlPerformed: false,
    },
    null,
    2,
  )}\n`,
  { flag: 'wx' },
);
process.stdout.write(`${resolve(output, 'acceptance.json')}\n`);
