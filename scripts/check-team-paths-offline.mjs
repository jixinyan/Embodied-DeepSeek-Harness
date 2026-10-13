import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readlink, realpath, symlink, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { parseDocument, stringify } from 'yaml';
import { ContractValidator } from '@edh/contracts';
import { FileTeamLoader } from '@edh/teams';
import { readModelConfiguration } from '@edh/models';
import { CORE_TOOLS } from '@edh/tools';
import { readRoleDocument } from '../harness/agent-runtime/teams/src/role-document.js';

const { values } = parseArgs({
  options: { output: { type: 'string' }, 'source-revision': { type: 'string' } },
});
assert(values.output, 'Supply a new --output directory.');
const root = resolve(import.meta.dirname, '..');
const requestedOutput = resolve(values.output);
const output = resolve(await realpath(dirname(requestedOutput)), basename(requestedOutput));
const child = relative(await realpath(resolve(root, '.local/work')), output);
assert(child && !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceNames = [
  'scripts/check-team-paths-offline.mjs',
  'harness/agent-runtime/teams/src/loader.ts',
  'harness/agent-runtime/teams/src/role-document.ts',
  'harness/agent-runtime/teams/package.json',
  'harness/agent-runtime/tools/src/tool-names.ts',
  'harness/agent-runtime/tools/src/dsh/tools/json-schema.ts',
  'harness/contracts/src/validation.ts',
  'harness/contracts/schema/physical.schema.json',
  'harness/agent-runtime/agents/roles/builtins.json',
  'harness/agent-runtime/agents/roles/planner/ROLE.md',
  'harness/agent-runtime/agents/roles/planner/WORKFLOW.md',
  'harness/agent-runtime/agents/roles/verifier/ROLE.md',
  'harness/agent-runtime/agents/roles/verifier/WORKFLOW.md',
  'harness/agent-runtime/agents/roles/evolver/ROLE.md',
  'examples/models/qwen38-vllm.yaml',
  'examples/teams/robotwin-scene-analyst.yaml',
  'examples/roles/robotwin-scene-planner.md',
  'examples/roles/robotwin-scene-analyst.md',
  'examples/roles/scene-assessment.json',
  'pnpm-lock.yaml',
];
const sources = await Promise.all(
  sourceNames.map(async (relativePath) => ({
    path: resolve(root, relativePath),
    relativePath,
    sha256: hash(await readFile(resolve(root, relativePath))),
  })),
);
const sourceRevision = values['source-revision']
  ? execFileSync(
      'git',
      ['rev-parse', '--verify', '--end-of-options', `${values['source-revision']}^{commit}`],
      { cwd: root, encoding: 'utf8' },
    ).trim()
  : null;
if (sourceRevision)
  for (const source of sources)
    assert.equal(
      hash(
        execFileSync('git', ['show', `${sourceRevision}:${source.relativePath}`], { cwd: root }),
      ),
      source.sha256,
      `Committed source differs: ${source.relativePath}`,
    );
const parseYaml = (source) => {
  const document = parseDocument(source, { uniqueKeys: true });
  assert.equal(document.errors.length, 0);
  return document.toJS({ maxAliasCount: 0 });
};
const validator = new ContractValidator(
  JSON.parse(
    await readFile(resolve(root, 'harness/contracts/schema/physical.schema.json'), 'utf8'),
  ),
);
const model = await readModelConfiguration(resolve(root, 'examples/models/qwen38-vllm.yaml'));
const builtinDirectory = resolve(root, 'harness/agent-runtime/agents/roles');
const options = {
  validator,
  builtinDirectory,
  roleRoot: resolve(root, 'examples'),
  defaultModel: model.defaultModel,
  models: Object.keys(model.models),
  tools: CORE_TOOLS,
  providers: ['behavior', 'robotwin', 'robocasa', 'robodojo'],
};
const teamSource = await readFile(
  resolve(root, 'examples/teams/robotwin-scene-analyst.yaml'),
  'utf8',
);
const authoredTeam = await new FileTeamLoader(options).inspect(
  resolve(root, 'examples/teams/robotwin-scene-analyst.yaml'),
);
const roleSource = await readFile(
  resolve(root, 'examples/roles/robotwin-scene-analyst.md'),
  'utf8',
);
const roleDocument = readRoleDocument(roleSource, 'examples/roles/robotwin-scene-analyst.md');
const roleMetadata = parseYaml(roleDocument.frontmatter);
const schemaBytes = await readFile(resolve(root, 'examples/roles/scene-assessment.json'));
const schema = JSON.parse(schemaBytes.toString('utf8'));
await mkdir(output, { recursive: false });
const roles = resolve(output, 'roles');
const sourceDirectory = resolve(roles, 'source');
const external = resolve(output, 'external');
const sibling = resolve(output, 'roles-sibling');
for (const directory of [sourceDirectory, external, sibling, resolve(output, 'teams')])
  await mkdir(directory, { recursive: true });
const inputs = [];
const links = [];
const save = async (file, bytes) => {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes, { flag: 'wx' });
  inputs.push({
    path: relative(output, file).split(sep).join('/'),
    sha256: hash(await readFile(file)),
  });
  return file;
};
const directoryLink = async (target, file) => {
  await symlink(target, file, process.platform === 'win32' ? 'junction' : 'dir');
  links.push({
    path: relative(output, file).split(sep).join('/'),
    target: await readlink(file),
    resolvedTarget: await realpath(file),
  });
  return file;
};
const plannerPath = await save(
  resolve(sourceDirectory, 'robotwin-scene-planner.md'),
  await readFile(resolve(root, 'examples/roles/robotwin-scene-planner.md')),
);
const analystPath = await save(resolve(sourceDirectory, 'robotwin-scene-analyst.md'), roleSource);
await save(resolve(sourceDirectory, 'scene-assessment.json'), schemaBytes);
for (const directory of [external, sibling]) {
  await save(resolve(directory, 'robotwin-scene-analyst.md'), roleSource);
  await save(resolve(directory, 'scene-assessment.json'), schemaBytes);
}
const internalLink = await directoryLink(sourceDirectory, resolve(roles, 'internal-link'));
const externalLink = await directoryLink(external, resolve(roles, 'external-link'));
const roleWithSchema = async (name, reference) =>
  save(
    resolve(roles, name, 'ROLE.md'),
    `---\n${stringify({ ...roleMetadata, output_schema: reference })}---\n\n${roleDocument.instructions}\n`,
  );
const snapshot = ({ teamRunId, ...loaded }) => {
  assert(teamRunId);
  return loaded;
};
const checks = [];
const check = async (name, analyst, { error, schemaReference, verifier, builtins } = {}) => {
  const definition = parseYaml(teamSource);
  definition.members.lead = plannerPath;
  definition.members.analyst = analyst;
  if (verifier) definition.members.verifier = verifier;
  const file = await save(resolve(output, 'teams', `${name}.yaml`), stringify(definition));
  const loader = new FileTeamLoader({
    ...options,
    roleRoot: roles,
    builtinDirectory: builtins ?? builtinDirectory,
  });
  if (error) {
    await assert.rejects(loader.inspect(file), error);
    checks.push({ name, rejected: true, teamFile: relative(output, file).split(sep).join('/') });
    return;
  }
  const loaded = await loader.inspect(file);
  assert.deepEqual(loaded.definition, definition);
  assert.deepEqual(loaded.members.lead, authoredTeam.members.lead);
  assert.deepEqual(loaded.members.verifier, authoredTeam.members.verifier);
  const reference = schemaReference ?? roleMetadata.output_schema;
  assert.deepEqual(loaded.members.analyst, {
    ...authoredTeam.members.analyst,
    definition: { ...authoredTeam.members.analyst.definition, output_schema: reference },
    outputSchema: { reference, schema },
  });
  assert.deepEqual(snapshot(await loader.inspect(file)), snapshot(loaded));
  assert(Object.isFrozen(loaded.members.analyst.outputSchema.schema));
  checks.push({
    name,
    rejected: false,
    teamFile: relative(output, file).split(sep).join('/'),
    team: snapshot(loaded),
  });
};
await check('authored-role-and-schema', analystPath);
await check('internal-directory-link', resolve(internalLink, 'robotwin-scene-analyst.md'));
await check(
  'nested-schema-reference',
  await roleWithSchema('nested', '../source/scene-assessment.json'),
  {
    schemaReference: '../source/scene-assessment.json',
  },
);
await check(
  'internal-schema-link',
  await roleWithSchema('schema-link', '../internal-link/scene-assessment.json'),
  {
    schemaReference: '../internal-link/scene-assessment.json',
  },
);
await check('absolute-outside-role', resolve(external, 'robotwin-scene-analyst.md'), {
  error: /Role escapes configured root/,
});
await check('relative-outside-role', '../external/robotwin-scene-analyst.md', {
  error: /Role escapes configured root/,
});
await check('sibling-prefix-role', resolve(sibling, 'robotwin-scene-analyst.md'), {
  error: /Role escapes configured root/,
});
await check('outside-directory-link', resolve(externalLink, 'robotwin-scene-analyst.md'), {
  error: /Role escapes configured root/,
});
for (const [name, reference] of [
  ['absolute-outside-schema', resolve(external, 'scene-assessment.json')],
  ['relative-outside-schema', '../../external/scene-assessment.json'],
  ['sibling-prefix-schema', '../../roles-sibling/scene-assessment.json'],
  ['outside-schema-link', '../external-link/scene-assessment.json'],
])
  await check(name, await roleWithSchema(name, reference), {
    error: /Role escapes configured root/,
  });
for (const [name, contents, error] of [
  [
    'schema-byte-limit',
    Buffer.concat([schemaBytes, Buffer.alloc(64 * 1024 - schemaBytes.length, 32)]),
    null,
  ],
  [
    'schema-above-byte-limit',
    Buffer.concat([schemaBytes, Buffer.alloc(64 * 1024 + 1 - schemaBytes.length, 32)]),
    /exceeds 64 KiB/,
  ],
  ['invalid-schema-json', schemaBytes.subarray(0, schemaBytes.lastIndexOf(125)), SyntaxError],
  [
    'scalar-result-schema',
    JSON.stringify({ type: schema.properties.target.type }),
    /object-rooted/,
  ],
]) {
  await save(resolve(roles, name, 'result.json'), contents);
  await check(name, await roleWithSchema(name, 'result.json'), {
    error,
    schemaReference: 'result.json',
  });
}
await check(
  'unknown-builtin-schema',
  await roleWithSchema('unknown-schema', 'builtin:Unknown.v1'),
  {
    error: /Unsupported role result schema/,
  },
);
for (const name of ['constructor', 'toString', '__proto__', 'missing'])
  await check(`unknown-builtin-${name}`, analystPath, {
    verifier: `builtin:${name}`,
    error: /Unknown builtin role/,
  });
const copyBuiltins = async (directory) => {
  await cp(builtinDirectory, directory, { recursive: true });
  for (const name of ['verifier/ROLE.md', 'verifier/WORKFLOW.md']) {
    const file = resolve(directory, name);
    assert.deepEqual(await readFile(file), await readFile(resolve(builtinDirectory, name)));
    inputs.push({
      path: relative(output, file).split(sep).join('/'),
      sha256: hash(await readFile(file)),
    });
  }
};
const mappedBuiltins = resolve(output, 'mapped-builtins');
await copyBuiltins(mappedBuiltins);
const mappingPath = resolve(mappedBuiltins, 'builtins.json');
const mapping = JSON.parse(await readFile(mappingPath, 'utf8'));
mapping.constructor = mapping.verifier;
await writeFile(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`);
inputs.push({
  path: relative(output, mappingPath).split(sep).join('/'),
  sha256: hash(await readFile(mappingPath)),
});
await check('explicit-own-builtin-mapping', analystPath, {
  verifier: 'builtin:constructor',
  builtins: mappedBuiltins,
});
mapping.constructor = '../external/robotwin-scene-analyst.md';
const escapedBuiltins = resolve(output, 'escaped-builtins');
await copyBuiltins(escapedBuiltins);
const escapedMapping = resolve(escapedBuiltins, 'builtins.json');
await writeFile(escapedMapping, `${JSON.stringify(mapping, null, 2)}\n`);
inputs.push({
  path: relative(output, escapedMapping).split(sep).join('/'),
  sha256: hash(await readFile(escapedMapping)),
});
await check('outside-builtin-role', analystPath, {
  verifier: 'builtin:constructor',
  builtins: escapedBuiltins,
  error: /Role escapes configured root/,
});
for (const source of sources) assert.equal(hash(await readFile(source.path)), source.sha256);
for (const input of inputs)
  assert.equal(hash(await readFile(resolve(output, input.path))), input.sha256);
for (const link of links) {
  assert.equal(await readlink(resolve(output, link.path)), link.target);
  assert.equal(await realpath(resolve(output, link.path)), link.resolvedTarget);
}
await writeFile(
  resolve(output, 'acceptance.json'),
  `${JSON.stringify(
    {
      schemaVersion: 'edh.team_paths_cpu.v1',
      recordedAt: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
      sourceRevision,
      sources,
      inputs,
      links,
      checks,
      originalSourcesUnchanged: true,
      modelInferencePerformed: false,
      environmentAllocationPerformed: false,
      physicalControlPerformed: false,
      scope:
        'Actual FileTeamLoader, authored Team/Role/schema derivatives and native directory links.',
    },
    null,
    2,
  )}\n`,
  { flag: 'wx' },
);
console.log(
  JSON.stringify({
    checks: checks.length,
    sources: sources.length,
    inputs: inputs.length,
    platform: process.platform,
  }),
);
