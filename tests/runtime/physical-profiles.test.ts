import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  resolveExecutionMode,
  resolvePhysicalRuntimeProfile,
  validatePhysicalProviderBindings,
} from '@edh/execution';
import { FileTeamLoader } from '@edh/teams';
import { fixtureProfile, profileValidator } from './profile-fixture.js';

test('profiles freeze full declared mappings and require installed provider validation', async () => {
  const input = fixtureProfile();
  const profile = resolvePhysicalRuntimeProfile(input, await profileValidator());
  input.policy.observationMapping.image = 'changed';
  assert.equal(profile.policy.observationMapping.image, 'front-rgb');
  assert(Object.isFrozen(profile.policy.actionSpec.channels[0]));
  assert.throws(() => validatePhysicalProviderBindings(profile, undefined), /registered/);
  const seen: string[] = [];
  validatePhysicalProviderBindings(profile, {
    simulations: {
      'fixture-sim': (p) => {
        seen.push(p.simulation.id);
      },
    },
    policies: {
      'fixture-policy': (p) => {
        seen.push(p.policy.actionTransform);
      },
    },
  });
  assert.deepEqual(seen, ['cpu-scene', 'fixture-identity-v1']);
});

test('policy profiles accept Litchi execution aliases and reject conflicting mode keys', () => {
  assert.equal(
    resolveExecutionMode({ policy: { config: { evaluation_method: 'gpt_only' } } }),
    'direct',
  );
  assert.equal(
    resolveExecutionMode({ policy: { config: { evaluation_method: 'pi05_plus_gpt' } } }),
    'hybrid',
  );
  assert.throws(
    () =>
      resolveExecutionMode({
        policy: { config: { execution_mode: 'direct', evaluation_method: 'pi05_plus_gpt' } },
      }),
    /conflicts/,
  );
});

test('profile preflight rejects malformed, placeholder and mismatched action/observation metadata', async () => {
  const validator = await profileValidator();
  const invalid: unknown[] = [null, {}, { ...fixtureProfile(), unknown: true }];
  for (const mutate of [
    (p) => {
      p.policy.checkpointRef = 'REQUIRED';
    },
    (p) => {
      p.policy.supportedEmbodiments = ['other'];
    },
    (p) => {
      p.simulation.supportedEmbodiments = ['other'];
    },
    (p) => {
      p.embodiment.actionSpec.embodiment_id = 'other';
    },
    (p) => {
      p.policy.actionSpec.frequency_hz = 20;
    },
    (p) => {
      p.policy.actionSpec.coordinate_frame = 'world';
    },
    (p) => {
      p.policy.actionSpec.channels[0]!.unit = 'meter';
    },
    (p) => {
      p.policy.observationMapping.image = 'missing-camera';
    },
    (p) => {
      p.policy.normalizationRef = '';
    },
    (p) => {
      p.policy.revision = 'main';
    },
    (p) => {
      p.embodiment.actionSpec.channels[0]!.minimum = 2;
    },
    (p) => {
      p.embodiment.actionSpec.frequency_hz = Number.NaN;
    },
  ] as ((p: ReturnType<typeof fixtureProfile>) => void)[]) {
    const input = fixtureProfile();
    mutate(input);
    invalid.push(input);
  }
  for (const input of invalid) assert.throws(() => resolvePhysicalRuntimeProfile(input, validator));
  const taskOnly = {
    ...fixtureProfile(),
    policy: { ...fixtureProfile().policy, acceptedInstruction: 'task' },
  };
  assert.throws(() => resolvePhysicalRuntimeProfile(taskOnly, validator), /acceptedInstruction/);
});

test('role prompt additions are scoped by member, hashed once and reject unknown member aliases', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'edh-profile-team-'));
  try {
    await writeFile(
      resolve(directory, 'team.yaml'),
      'schema_version: physical.team.v1\nteam_id: profile-team\nentrypoint: planner\nlearning_enabled: false\nmembers:\n  planner: role.md\n  verifier: role.md\nbindings:\n  decision_owner: planner\n  final_verifier: verifier\ntool_bindings: {}\n',
    );
    await writeFile(
      resolve(directory, 'role.md'),
      '---\nrole_id: planner\ndescription: Fixture role\ntools: []\n---\nBase instructions.\n',
    );
    const options = {
      validator: await profileValidator(),
      builtinDirectory: resolve('harness/agent-runtime/agents/roles'),
      roleRoot: directory,
      defaultModel: 'fixture',
      models: ['fixture'],
      tools: [],
      providers: [],
    };
    const before = await new FileTeamLoader(options).inspect(resolve(directory, 'team.yaml'));
    const selected = {
      ...options,
      promptContext: 'Fixed-arm fixture.',
      rolePromptAdditions: { planner: 'No navigation.' },
    };
    const after = await new FileTeamLoader(selected).inspect(resolve(directory, 'team.yaml'));
    assert.equal(after.members.planner!.instructions.match(/No navigation\./g)?.length, 1);
    assert.doesNotMatch(after.members.verifier!.instructions, /No navigation/);
    assert.match(after.members.verifier!.instructions, /Fixed-arm fixture/);
    assert.notEqual(before.sourceDigest, after.sourceDigest);
    assert.equal(
      after.sourceDigest,
      (await new FileTeamLoader(selected).inspect(resolve(directory, 'team.yaml'))).sourceDigest,
    );
    await assert.rejects(
      new FileTeamLoader({ ...options, rolePromptAdditions: { unknown: 'typo' } }).inspect(
        resolve(directory, 'team.yaml'),
      ),
      /Unknown prompt member/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
