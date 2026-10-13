import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseDocument, stringify } from 'yaml';
import { ContractValidator } from '@edh/contracts';
import { FileTeamLoader } from '@edh/teams';
import { readModelConfiguration } from '@edh/models';
import { readRoleDocument } from '../harness/agent-runtime/teams/src/role-document.js';
import {
  CORE_TOOLS,
  CORE_TOOL_PARAMETERS,
  CORE_TOOL_OPTIONAL_PARAMETERS,
  CORE_TOOL_DESCRIPTIONS,
  assertObjectJsonSchema,
  modelToolContractSchema,
  assertToolBindings,
  nativeToolName,
} from '@edh/tools';

const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const inventory = JSON.parse(
  await readFile('harness/agent-runtime/tools/definitions/planned-tools.json', 'utf8'),
);
assert.equal(new Set(inventory.tools.map((tool) => tool.id)).size, inventory.tools.length);
assert.deepEqual(
  inventory.tools
    .filter((tool) => tool.status !== 'not_implemented')
    .map((tool) => tool.id)
    .sort(),
  [...CORE_TOOLS].sort(),
  'Implemented inventory must match the production tool definitions.',
);
const configuration = await readModelConfiguration('examples/models/qwen38-vllm.yaml');
const loadOptions = {
  validator,
  builtinDirectory: resolve('harness/agent-runtime/agents/roles'),
  roleRoot: resolve('examples'),
  defaultModel: configuration.defaultModel,
  models: Object.keys(configuration.models),
  tools: CORE_TOOLS,
  providers: ['behavior', 'robotwin', 'robocasa', 'robodojo'],
};
const loader = new FileTeamLoader(loadOptions);
const toolBindingChecks = [];
for (const [name, bindings] of [
  [
    'core-and-distinct-extensions',
    [...CORE_TOOLS, 'source.inspect', 'source__read', 'constructor', 'toString'],
  ],
  ['identifier-length-boundary', ['a'.repeat(80)]],
]) {
  assertToolBindings(bindings);
  toolBindingChecks.push({ name, rejected: false });
}
const invalidToolBindings = [
  ...CORE_TOOLS.map((logical) => [
    `core-alias:${logical}`,
    [...CORE_TOOLS, nativeToolName(logical)],
  ]),
  ['custom-name-collision', [...CORE_TOOLS, 'scene.describe', 'scene__describe']],
  ['duplicate-logical-id', [...CORE_TOOLS, 'source.inspect', 'source.inspect']],
  ['dsh-reserved-name', [...CORE_TOOLS, 'run_code']],
  ...['', 'source/read', 'source inspect', 'source.inspect\n', 'a'.repeat(81)].map(
    (logical, index) => [`invalid-logical-id:${index}`, [...CORE_TOOLS, logical]],
  ),
];
for (const [name, bindings] of invalidToolBindings) {
  assert.throws(() => assertToolBindings(bindings), /Tool bindings|Invalid logical|reserved/);
  await assert.rejects(
    new FileTeamLoader({ ...loadOptions, tools: bindings }).inspect(
      resolve('examples/teams/robotwin-live.yaml'),
    ),
    /Tool bindings|Invalid logical|reserved/,
  );
  toolBindingChecks.push({ name, rejected: true });
}
const teams = [
  'behavior-live',
  'behavior-grounded',
  'robotwin-live',
  'robotwin-grounded',
  'robotwin-perception',
  'robotwin-scene-analyst',
  'robocasa-live',
  'robocasa-sam-live',
  'robodojo-live',
  'robodojo-grounded',
];
const planner = await readFile('harness/agent-runtime/agents/roles/planner/WORKFLOW.md', 'utf8');
const verifier = await readFile('harness/agent-runtime/agents/roles/verifier/WORKFLOW.md', 'utf8');
const authoredTeams = [];
for (const name of teams) {
  const team = await loader.inspect(resolve(`examples/teams/${name}.yaml`));
  const { teamRunId, ...snapshot } = team;
  assert(teamRunId);
  authoredTeams.push({ name, ...snapshot });
  assert(team.members[team.definition.bindings.decision_owner].instructions.endsWith(planner));
  assert(team.members[team.definition.bindings.final_verifier].instructions.endsWith(verifier));
  if (name.endsWith('-grounded')) {
    const owner = team.members[team.definition.bindings.decision_owner];
    assert(owner.definition.tools.includes('perception.segment_objects'));
    assert(owner.definition.tools.includes('perception.measure_object'));
    assert.match(owner.instructions, /planning.read.planWrite/);
    assert.equal(team.definition.learning_enabled, false);
  }
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

const roleSource = await readFile('examples/roles/robotwin-planner.md', 'utf8');
const roleDocument = readRoleDocument(roleSource, 'examples/roles/robotwin-planner.md');
const roleDefinition = validator.parse(
  'RoleDefinition',
  parseDocument(roleDocument.frontmatter, { uniqueKeys: true }).toJS({ maxAliasCount: 0 }),
);
const sourceTeam = await loader.inspect(resolve('examples/teams/robotwin-live.yaml'));
await mkdir('.local/work', { recursive: true });
const roleDirectory = await mkdtemp(resolve('.local/work/role-documents-'));
const documentLoader = new FileTeamLoader({ ...loadOptions, roleRoot: roleDirectory });
const documentChecks = [];
const documentInputs = [];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const renderRole = (metadata, body) => `---\n${stringify(metadata)}---\n${body}\n`;
const roleVariants = [
  ['authored-source', roleSource, roleDocument.instructions],
  ['crlf', roleSource.replaceAll('\n', '\r\n'), roleDocument.instructions.replaceAll('\n', '\r\n')],
  [
    'cr-body',
    `---\n${roleDocument.frontmatter}\n---\n${roleDocument.instructions.replaceAll('\n', '\r')}`,
    roleDocument.instructions.replaceAll('\n', '\r'),
  ],
  ['bom', `\uFEFF${roleSource}`, roleDocument.instructions],
  [
    'bom-crlf',
    `\uFEFF${roleSource.replaceAll('\n', '\r\n')}`,
    roleDocument.instructions.replaceAll('\n', '\r\n'),
  ],
  [
    'unicode-frontmatter',
    `---\n# 🐳\n${roleDocument.frontmatter}\n---\n${roleDocument.instructions}`,
    roleDocument.instructions,
  ],
  [
    'fence-whitespace',
    `--- \t\n${roleDocument.frontmatter}\n---\t \n${roleDocument.instructions}`,
    roleDocument.instructions,
  ],
  [
    'unicode-body',
    renderRole(roleDefinition, `${roleDocument.instructions}\n\nCamera label: 🐳`),
    `${roleDocument.instructions}\n\nCamera label: 🐳`,
  ],
  [
    'markdown-body',
    renderRole(
      roleDefinition,
      `${roleDocument.instructions}\n\n---\n\n\`\`\`yaml\nrole_id: planner\n\`\`\``,
    ),
    `${roleDocument.instructions}\n\n---\n\n\`\`\`yaml\nrole_id: planner\n\`\`\``,
  ],
];
for (const [name, markdown, instructions] of roleVariants) {
  const roleFile = resolve(roleDirectory, `${name}.md`);
  const teamFile = resolve(roleDirectory, `${name}.yaml`);
  await writeFile(roleFile, markdown, { flag: 'wx' });
  await writeFile(
    teamFile,
    stringify({
      ...sourceTeam.definition,
      members: { ...sourceTeam.definition.members, lead: roleFile },
    }),
    { flag: 'wx' },
  );
  const team = await documentLoader.inspect(teamFile);
  assert.deepEqual(team.roles, sourceTeam.roles);
  assert.equal(team.members.lead.model, sourceTeam.members.lead.model);
  assert.equal(team.members.lead.instructions, `${instructions}\n\n${planner}`);
  for (const alias of ['verifier', 'evolver'])
    assert.deepEqual(team.members[alias], sourceTeam.members[alias]);
  assert(Object.isFrozen(team));
  assert(Object.isFrozen(team.members.lead.definition.tools));
  documentChecks.push({ name, rejected: false });
  documentInputs.push({ roleFile, roleSha256: sha256(markdown), teamFile });
}
const invalidDocuments = [
  ['missing-frontmatter', roleDocument.instructions, /YAML frontmatter/],
  ['missing-closing-fence', `---\n${roleDocument.frontmatter}`, /YAML frontmatter/],
  ['missing-body', `---\n${roleDocument.frontmatter}\n---`, /nonblank instructions/],
  ['blank-body', renderRole(roleDefinition, ' \t\n\t'), /nonblank instructions/],
  ['preceding-content', `Role instructions\n\n${roleSource}`, /YAML frontmatter/],
  ['fenced-document', `\`\`\`markdown\n${roleSource}\n\`\`\``, /YAML frontmatter/],
  [
    'duplicate-yaml-key',
    `---\n${roleDocument.frontmatter}\nrole_id: planner\n---\n${roleDocument.instructions}`,
    /Map keys must be unique/,
  ],
  ['invalid-yaml', `---\ntools: [\n---\n${roleDocument.instructions}`, /Flow sequence/],
  ['cr-metadata', roleSource.replaceAll('\n', '\r'), /Nested mappings/],
  [
    'yaml-alias',
    `---\n${roleDocument.frontmatter}\nmodel: &binding local\noutput_schema: *binding\n---\n${roleDocument.instructions}`,
    /alias count/,
  ],
  ['null-metadata', renderRole(null, roleDocument.instructions), /RoleDefinition/],
  ['array-metadata', renderRole([roleDefinition], roleDocument.instructions), /RoleDefinition/],
  [
    'unknown-field',
    renderRole({ ...roleDefinition, unknownField: true }, roleDocument.instructions),
    /RoleDefinition/,
  ],
  [
    'unknown-model',
    renderRole({ ...roleDefinition, model: 'unavailable-binding' }, roleDocument.instructions),
    /Unknown model binding/,
  ],
  [
    'unknown-tool',
    renderRole(
      { ...roleDefinition, tools: [...roleDefinition.tools, 'unavailable.tool'] },
      roleDocument.instructions,
    ),
    /Unavailable tool/,
  ],
  [
    'duplicate-tool',
    renderRole(
      { ...roleDefinition, tools: [...roleDefinition.tools, roleDefinition.tools[0]] },
      roleDocument.instructions,
    ),
    /Duplicate tool binding/,
  ],
];
for (const [name, markdown, expected] of invalidDocuments) {
  const roleFile = resolve(roleDirectory, `${name}.md`);
  const teamFile = resolve(roleDirectory, `${name}.yaml`);
  await writeFile(roleFile, markdown, { flag: 'wx' });
  await writeFile(
    teamFile,
    stringify({
      ...sourceTeam.definition,
      members: { ...sourceTeam.definition.members, lead: roleFile },
    }),
    { flag: 'wx' },
  );
  await assert.rejects(documentLoader.inspect(teamFile), expected);
  documentChecks.push({ name, rejected: true });
  documentInputs.push({ roleFile, roleSha256: sha256(markdown), teamFile });
}
for (const input of documentInputs) input.teamSha256 = sha256(await readFile(input.teamFile));
const documentSources = [];
for (const file of [
  'scripts/check-role-workflows.mjs',
  'harness/agent-runtime/teams/src/role-document.ts',
  'harness/agent-runtime/teams/src/loader.ts',
  'harness/agent-runtime/teams/package.json',
  'harness/contracts/schema/physical.schema.json',
  'examples/models/qwen38-vllm.yaml',
  'examples/roles/robotwin-planner.md',
  'harness/agent-runtime/agents/roles/planner/WORKFLOW.md',
  'harness/agent-runtime/agents/roles/verifier/WORKFLOW.md',
  'pnpm-lock.yaml',
])
  documentSources.push({ path: resolve(file), sha256: sha256(await readFile(file)) });
await writeFile(
  resolve(roleDirectory, 'document-checks.json'),
  `${JSON.stringify({ schemaVersion: 'edh.role_documents_cpu.v1', sources: documentSources, authoredTeams, inputs: documentInputs, checks: documentChecks, scope: 'Actual FileTeamLoader and authored-role derivatives; no model or simulator allocation.' }, null, 2)}\n`,
  { flag: 'wx' },
);
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
    toolBindingChecks: toolBindingChecks.length,
    roleDocumentChecks: documentChecks.length,
    roleDocumentDirectory: roleDirectory,
    scope: 'Authored role/schema checks; no model or simulation execution.',
  }),
);
