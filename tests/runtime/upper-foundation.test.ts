import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { LocalStore } from '@edh/storage';
import { FileTeamLoader } from '@edh/teams';
import { ContractValidator } from '@edh/contracts';

test('local domain store enforces CAS, single writer, detached reads and torn-tail recovery', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'edh-store-'));
  try {
    let store = new LocalStore(directory);
    assert.throws(() => new LocalStore(directory), /locked/);
    assert.equal(store.put('plan:one', { items: ['first'] }, 0), 1);
    assert.throws(() => store.put('plan:one', {}, 0), /Version conflict/);
    store.get<{ items: string[] }>('plan:one')!.value.items.push('mutation');
    assert.deepEqual(store.get('plan:one')!.value, { items: ['first'] });
    store.close();
    await appendFile(resolve(directory, 'records.jsonl'), '{"torn":');
    store = new LocalStore(directory);
    assert.equal(store.get('plan:one')!.version, 1);
    store.put('plan:one', { items: ['second'] }, 1);
    store.close();
    const contents = await readFile(resolve(directory, 'records.jsonl'), 'utf8');
    await writeFile(resolve(directory, 'records.jsonl'), contents.replace('second', 'tampered'));
    assert.throws(() => new LocalStore(directory), /corruption/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('team loading freezes explicit role context and rejects unavailable bindings and duplicate YAML keys', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'edh-team-'));
  const validator = new ContractValidator(
    JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
  );
  const definition = `schema_version: physical.team.v1\nteam_id: test-team\nentrypoint: lead\nlearning_enabled: false\nmembers:\n  lead: role.md\n  check: role.md\nbindings:\n  decision_owner: lead\n  final_verifier: check\ntool_bindings: {}\n`;
  const path = resolve(directory, 'team.yaml');
  const options = {
    validator,
    builtinDirectory: resolve('harness/agent-runtime/agents/roles'),
    roleRoot: directory,
    defaultModel: 'fixture',
    models: ['fixture'],
    tools: ['perception.capture'],
    providers: [],
  };
  try {
    await writeFile(path, definition);
    await writeFile(
      resolve(directory, 'role.md'),
      '---\nrole_id: observer\ndescription: Observe explicitly supplied evidence.\ntools: [perception.capture]\n---\nFresh role instructions.\n',
    );
    const team = await new FileTeamLoader(options).inspect(path);
    assert.equal(team.members.lead!.instructions, 'Fresh role instructions.');
    assert(Object.isFrozen(team.members.lead!.definition.tools));
    await assert.rejects(
      new FileTeamLoader({ ...options, tools: [] }).inspect(path),
      /Unavailable tool/,
    );
    await writeFile(path, definition + 'team_id: duplicate\n');
    await assert.rejects(new FileTeamLoader(options).inspect(path), /unique/);
    await writeFile(path, definition.replace('role.md', '../escape.md'));
    await writeFile(resolve(directory, '../escape.md'), '');
    await assert.rejects(new FileTeamLoader(options).inspect(path), /escapes/);
    await rm(resolve(directory, '../escape.md'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
