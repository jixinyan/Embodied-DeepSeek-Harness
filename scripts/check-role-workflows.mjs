import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ContractValidator } from '@edh/contracts';
import { FileTeamLoader } from '@edh/teams';
import { readModelConfiguration } from '@edh/models';
import {
  CORE_TOOLS,
  CORE_TOOL_PARAMETERS,
  CORE_TOOL_OPTIONAL_PARAMETERS,
  CORE_TOOL_DESCRIPTIONS,
  assertObjectJsonSchema,
} from '@edh/tools';
import { modelToolContractSchema } from '../apps/server/src/model-tool-schema.ts';

const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const configuration = await readModelConfiguration('examples/models/qwen38-vllm.yaml');
const loader = new FileTeamLoader({
  validator,
  builtinDirectory: resolve('harness/agent-runtime/agents/roles'),
  roleRoot: resolve('examples'),
  defaultModel: configuration.defaultModel,
  models: Object.keys(configuration.models),
  tools: CORE_TOOLS,
  providers: ['behavior', 'robotwin', 'robocasa', 'robodojo'],
});
const teams = [
  'behavior-live',
  'robotwin-live',
  'robotwin-perception',
  'robotwin-scene-analyst',
  'robocasa-live',
  'robocasa-sam-live',
  'robodojo-live',
];
const planner = await readFile('harness/agent-runtime/agents/roles/planner/WORKFLOW.md', 'utf8');
const verifier = await readFile('harness/agent-runtime/agents/roles/verifier/WORKFLOW.md', 'utf8');
for (const name of teams) {
  const team = await loader.inspect(resolve(`examples/teams/${name}.yaml`));
  assert(team.members[team.definition.bindings.decision_owner].instructions.endsWith(planner));
  assert(team.members[team.definition.bindings.final_verifier].instructions.endsWith(verifier));
  for (const [alias, member] of Object.entries(team.members)) {
    if (alias !== team.definition.bindings.decision_owner)
      assert(!member.instructions.includes(planner));
    if (alias !== team.definition.bindings.final_verifier)
      assert(!member.instructions.includes(verifier));
  }
}
const sceneTeam = await loader.inspect(resolve('examples/teams/robotwin-scene-analyst.yaml'));
assert.equal(sceneTeam.definition.learning_enabled, false);
assert.equal(sceneTeam.members.analyst.definition.role_id, 'robotwin-scene-analyst');
assert.deepEqual(sceneTeam.members.analyst.definition.tools, [
  'evidence.read',
  'context.request',
  'agent.report',
  'team.query',
  'team.ack_report',
]);
assert.equal(sceneTeam.members.analyst.outputSchema.reference, 'scene-assessment.json');
assert.equal(sceneTeam.members.analyst.outputSchema.schema.additionalProperties, false);
assert(sceneTeam.members.analyst.outputSchema.schema.required.includes('limitations'));
assert(sceneTeam.members.lead.definition.tools.includes('team.query'));
assert(sceneTeam.members.lead.definition.tools.includes('team.ack_report'));
assert.match(sceneTeam.members.analyst.instructions, /status=insufficient_context/);
assert.match(sceneTeam.members.analyst.instructions, /preceding successful report receipt/);
const plan = await modelToolContractSchema(validator, 'PlanDocument');
assert.deepEqual([...plan.required].sort(), Object.keys(plan.properties).sort());
assert.match(plan.properties.version.description, /minimum=1/);
assert.match(plan.properties.version.description, /maximum=9007199254740991/);
assert.equal(plan.properties.items.items.additionalProperties, false);
assert(plan.properties.items.items.properties.last_verdict_ref);
for (const [name, parameters] of Object.entries(CORE_TOOL_PARAMETERS)) {
  assert(CORE_TOOL_DESCRIPTIONS[name]?.trim(), `Missing tool description: ${name}`);
  const properties = name === 'planning.update' ? { ...parameters, plan } : parameters;
  assertObjectJsonSchema({
    type: 'object',
    properties,
    required: Object.keys(properties).filter(
      (key) => !CORE_TOOL_OPTIONAL_PARAMETERS[name]?.includes(key),
    ),
    additionalProperties: false,
  });
  for (const [field, schema] of Object.entries(properties)) {
    if (field === 'plan') continue;
    assert(schema.description || schema.enum, `Missing parameter guidance: ${name}.${field}`);
  }
}
console.log(
  JSON.stringify({
    configuredTeams: teams.length,
    describedCoreTools: Object.keys(CORE_TOOL_PARAMETERS).length,
    canonicalPlanProjection: 'passed',
    sceneAnalystOutputSchema: 'passed',
    scope: 'Authored role/schema checks; no model or simulation execution.',
  }),
);
