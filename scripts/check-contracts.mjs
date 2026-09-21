import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { ContractValidator } from '../harness/contracts/src/validation.ts';
import { CORE_TOOLS } from '../harness/agent-runtime/tools/src/core-inputs.ts';
import { parse } from 'yaml';
const json = async (p) => JSON.parse(await readFile(p, 'utf8'));
const yaml = async (p) => parse(await readFile(p, 'utf8'));
const schema = await json('harness/contracts/schema/physical.schema.json');
const contracts = new ContractValidator(schema);
function validator(name) {
  return (value) => contracts.issues(name, value).length === 0;
}
function valid(name, value, source) {
  const issues = contracts.issues(name, value);
  assert.equal(issues.length, 0, `${source}: ${JSON.stringify(issues)}`);
}
let count = 0;
for (const file of await readdir('tests/fixtures')) {
  if (!file.endsWith('.json')) continue;
  const data = await json(`tests/fixtures/${file}`);
  valid(data.contract, data.value, file);
  count++;
}
const teamPath = 'examples/teams/household.yaml';
const team = await yaml(teamPath);
valid('TeamDefinition', team, teamPath);
assert(Object.hasOwn(team.members, team.entrypoint), 'Entrypoint is not a member');
for (const [binding, member] of Object.entries(team.bindings))
  assert(Object.hasOwn(team.members, member), `Unknown member for ${binding}`);
const builtins = await json('harness/agent-runtime/agents/roles/builtins.json');
const inventory = await json('harness/agent-runtime/tools/definitions/planned-tools.json');
const toolIds = new Set(inventory.tools.map((t) => t.id));
assert.equal(toolIds.size, inventory.tools.length, 'Duplicate logical tool ID');
assert.deepEqual(
  inventory.tools
    .filter((tool) => tool.status !== 'not_implemented')
    .map((tool) => tool.id)
    .sort(),
  [...CORE_TOOLS].sort(),
  'Implemented tool inventory must match the native upper tool pack.',
);
for (const [member, reference] of Object.entries(team.members)) {
  let rolePath;
  if (reference.startsWith('builtin:')) {
    const key = reference.slice('builtin:'.length);
    assert(Object.hasOwn(builtins, key), `Unknown built-in: ${key}`);
    rolePath = path.join('harness/agent-runtime/agents/roles', builtins[key]);
  } else rolePath = path.resolve(path.dirname(teamPath), reference);
  const roleText = await readFile(rolePath, 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n/.exec(roleText);
  assert(match, `Missing role frontmatter: ${member}`);
  const role = parse(match[1]);
  valid('RoleDefinition', role, rolePath);
  for (const id of role.tools) assert(toolIds.has(id), `${member}: undeclared planned tool ${id}`);
}
const toolPath = 'examples/tools/sam-segmentation.yaml';
const tool = await yaml(toolPath);
valid('ToolDefinition', tool, toolPath);
for (const reference of [tool.input_schema, tool.output_schema]) {
  const name = /^builtin:(.+)\.v1$/.exec(reference)?.[1];
  assert(name && Object.hasOwn(schema.$defs, name), `Unknown tool schema: ${reference}`);
}
assert.equal(team.tool_bindings[tool.tool_id], tool.executor.provider);
const deployment = await yaml('examples/deployments/behavior.yaml');
assert.equal(deployment.status, 'not_implemented');
assert(Object.hasOwn(deployment.providers, tool.executor.provider));
await readFile(path.resolve('examples/deployments', deployment.team));
valid(
  'SkillMetadata',
  await json('examples/skills/recovery-check/metadata.json'),
  'skill metadata',
);
// Ensure the structural checks actually reject key malformed wire objects.
const missingContext = structuredClone((await json('tests/fixtures/invocation.json')).value);
delete missingContext.objective;
assert.equal(validator('InvocationBrief')(missingContext), false, 'Missing objective accepted');
const ambiguousSender = structuredClone((await json('tests/fixtures/message.json')).value);
ambiguousSender.sender.agent_id = 'pretend_agent';
assert.equal(validator('MessageEnvelope')(ambiguousSender), false, 'Ambiguous sender accepted');
const invalidBudget = structuredClone((await json('tests/fixtures/subgoal.json')).value);
invalidBudget.budget.max_control_steps = 0;
assert.equal(validator('SubgoalRequest')(invalidBudget), false, 'Zero budget accepted');
const missingCriterion = structuredClone(invalidBudget.success_contract);
delete missingCriterion.all;
assert.equal(validator('SuccessContract')(missingCriterion), false, 'Missing criterion accepted');
console.log(`Validated ${count} wire fixtures, roles/team/tool references and rejection cases.`);
console.log(
  'Structural checks only: no runtime authorization, model compatibility or task semantics verified.',
);
