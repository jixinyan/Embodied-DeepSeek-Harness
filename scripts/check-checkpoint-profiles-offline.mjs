import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { ContractValidator } from '@edh/contracts';
import { prepareDeployment } from '../apps/server/src/deployment.ts';
import { startServer } from '../apps/server/src/index.ts';
import {
  nativeDeploymentRoot,
  readNativeDeploymentConfiguration,
} from '../apps/server/src/native-deployment.mjs';
import {
  createNativeWorkspaceFactory,
  readNativeWorkspaceConfiguration,
} from '../apps/server/src/native-workspace.mjs';

const { values } = parseArgs({
  options: {
    workspace: { type: 'string' },
    identities: { type: 'string' },
    output: { type: 'string' },
  },
});
assert(values.workspace && values.identities && values.output);
const output = resolve(values.output);
const child = relative(resolve(nativeDeploymentRoot, '.local/work'), output);
assert(child && !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
await mkdir(output, { recursive: false });
const sources = {};
const original = async (file) => {
  const path = resolve(file);
  const bytes = await readFile(path);
  sources[path] = createHash('sha256').update(bytes).digest('hex');
  return JSON.parse(bytes);
};
const workspace = resolve(values.workspace);
const directory = dirname(workspace);
const settings = await readNativeWorkspaceConfiguration({
  ...process.env,
  EDH_NATIVE_WORKSPACE_CONFIG: workspace,
});
await original(workspace);
const identityReport = await original(values.identities);
assert.equal(identityReport.originalFilesUnchanged, true);
assert.equal(identityReport.gpuJobs, 0);
const digests = identityReport.referenceDigests;
assert.deepEqual(Object.keys(digests).sort(), ['behavior', 'robocasa', 'robodojo', 'robotwin']);
const variables = {
  behavior: 'EDH_BEHAVIOR_CONFIG',
  robocasa: 'EDH_NATIVE_WORKER_CONFIG',
  robodojo: 'EDH_ROBODOJO_CONFIG',
  robotwin: 'EDH_ROBOTWIN_CONFIG',
};
const cases = [];
for (const { id, settings: deployment } of settings.deployments) {
  const provider = deployment.provider;
  const entry = settings.configuration.deployments[id];
  const document = await original(resolve(directory, entry.configuration));
  for (const [name, invalid] of [
    ['non-digest', 'invalid'],
    ['uppercase', 'A'.repeat(64)],
    ['non-string', 12],
    ['null', null],
  ]) {
    const copy = structuredClone(document);
    if (provider === 'robodojo')
      for (const profile of Object.values(copy.profiles)) profile.checkpointSha256 = invalid;
    else copy.checkpointSha256 = invalid;
    const path = resolve(output, `${id}.${name}.invalid-configuration.json`);
    await writeFile(path, `${JSON.stringify(copy, null, 2)}\n`, { flag: 'wx' });
    await assert.rejects(
      readNativeDeploymentConfiguration(provider, {
        ...process.env,
        [variables[provider]]: path,
        EDH_MODEL_CONFIG: resolve(directory, settings.configuration.modelConfiguration),
      }),
      (error) => error.name === 'ZodError',
    );
    cases.push({ name: `${id}.${name}`, result: 'rejected', environmentAllocated: false });
  }
  const selected = structuredClone(document);
  if (provider === 'robodojo')
    for (const profile of Object.values(selected.profiles))
      profile.checkpointSha256 = digests[provider];
  else selected.checkpointSha256 = digests[provider];
  const selectedPath = resolve(output, `${id}.selected-configuration.json`);
  await writeFile(selectedPath, `${JSON.stringify(selected, null, 2)}\n`, { flag: 'wx' });
  const admitted = await readNativeDeploymentConfiguration(provider, {
    ...process.env,
    [variables[provider]]: selectedPath,
    EDH_MODEL_CONFIG: resolve(directory, settings.configuration.modelConfiguration),
  });
  const readCopy = async (copy, name) => {
    const path = resolve(output, `${id}.${name}.configuration.json`);
    await writeFile(path, `${JSON.stringify(copy, null, 2)}\n`, { flag: 'wx' });
    return readNativeDeploymentConfiguration(provider, {
      ...process.env,
      [variables[provider]]: path,
      EDH_MODEL_CONFIG: resolve(directory, settings.configuration.modelConfiguration),
    });
  };
  const entries = (copy) => (provider === 'robodojo' ? Object.values(copy.profiles) : [copy]);
  const malformedWorker = structuredClone(selected);
  for (const profile of entries(malformedWorker)) profile.worker.policyCheckpointSha256 = 'invalid';
  await assert.rejects(
    readCopy(malformedWorker, 'invalid-worker-digest'),
    (error) => error.name === 'ZodError',
  );
  cases.push({ name: `${id}.invalid-worker-digest`, result: 'rejected' });
  const conflict = structuredClone(selected);
  for (const profile of entries(conflict)) profile.worker.policyCheckpointSha256 = '0'.repeat(64);
  await assert.rejects(readCopy(conflict, 'conflicting-worker-digest'), {
    message: 'Native profile and Worker checkpoint identities differ.',
  });
  cases.push({ name: `${id}.conflicting-worker-digest`, result: 'rejected' });
  const inherited = structuredClone(selected);
  for (const profile of entries(inherited)) {
    delete profile.checkpointSha256;
    profile.worker.policyCheckpointSha256 = digests[provider];
  }
  const inheritedSettings = await readCopy(inherited, 'worker-digest-selection');
  for (const profile of Object.values(inheritedSettings.profiles))
    assert.equal(profile.checkpointSha256, digests[provider]);
  cases.push({ name: `${id}.worker-digest-selection`, result: 'passed' });
  assert.deepEqual(Object.keys(admitted.profiles), Object.keys(deployment.profiles));
  for (const profile of Object.values(admitted.profiles)) {
    assert.equal(profile.checkpointSha256, digests[provider]);
    assert.equal(profile.worker.policyCheckpointSha256, digests[provider]);
  }
  deployment.profiles = admitted.profiles;
}
const schema = resolve(nativeDeploymentRoot, 'harness/contracts/schema/physical.schema.json');
const validator = new ContractValidator(await original(schema));
const store = resolve(output, 'workspace');
let prepared;
const factory = createNativeWorkspaceFactory({ ...settings, dataDirectory: store });
const server = await startServer({
  root: nativeDeploymentRoot,
  dataDirectory: store,
  port: 0,
  deployment: async (services) => {
    const deployment = await factory(services);
    for (const [id, profile] of Object.entries(deployment.launchProfiles)) {
      assert.throws(
        () =>
          prepareDeployment(
            {
              ...deployment,
              launchProfiles: {
                ...deployment.launchProfiles,
                [id]: { ...profile, checkpointSha256: 'invalid' },
              },
            },
            validator,
          ),
        { message: `Invalid launch profile: ${id}` },
      );
      cases.push({ name: `${id}.prepared-digest-admission`, result: 'rejected' });
    }
    prepared = prepareDeployment(deployment, validator);
    return deployment;
  },
});
let configuration;
try {
  const response = await fetch(`${server.url}/api/config`, { signal: AbortSignal.timeout(3000) });
  assert.equal(response.status, 200);
  configuration = await response.json();
  for (const { id, settings: deployment } of settings.deployments)
    for (const [profileId, profile] of Object.entries(deployment.profiles)) {
      const key = `${id}.${profileId}`;
      const metadata = configuration.launchProfiles[key];
      assert.equal(metadata.checkpointSha256, digests[deployment.provider]);
      assert.equal(metadata.checkpoint, profile.checkpoint);
      assert.equal(metadata.policy, profile.worker.policyId);
      assert.equal(
        prepared.metadata.launchProfiles[key].checkpointSha256,
        metadata.checkpointSha256,
      );
      assert(Object.isFrozen(prepared.metadata.launchProfiles[key]));
      cases.push({
        name: `${key}.http-selection`,
        result: 'passed',
        checkpointSha256: metadata.checkpointSha256,
      });
    }
  const sessions = await (await fetch(`${server.url}/api/sessions`)).json();
  assert.equal(sessions.activeId, null);
  const services = await (await fetch(`${server.url}/api/services`)).json();
  assert(
    services.services.every(
      (service) => service.state === 'idle' && service.pid === null && service.leases === 0,
    ),
  );
} finally {
  await server.close();
}
await assert.rejects(access(resolve(store, 'writer.lock')), { code: 'ENOENT' });
await assert.rejects(fetch(`${server.url}/api/config`, { signal: AbortSignal.timeout(3000) }));
for (const [path, digest] of Object.entries(sources))
  assert.equal(
    createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
    digest,
  );
for (const file of [
  'apps/server/src/deployment.ts',
  'apps/server/src/native-deployment.mjs',
  'apps/server/src/native-workspace.mjs',
  'apps/server/src/native-worker-configuration.ts',
  'apps/server/src/native-worker.ts',
  'harness/agent-runtime/execution/src/gpt-policy-server.ts',
  'scripts/check-checkpoint-profiles-offline.mjs',
]) {
  const path = resolve(nativeDeploymentRoot, file);
  sources[path] = createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}
const report = {
  sources,
  cases,
  launchProfiles: configuration.launchProfiles,
  originalFilesUnchanged: true,
  writerReleased: true,
  listenerClosed: true,
  gpuJobs: 0,
  modelCalls: 0,
  environmentAllocations: 0,
  controls: 0,
  scope:
    'Actual native factories and HTTP metadata with original reference identities; explicit invalid configuration derivatives; no Session, model or simulator allocation.',
};
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(report, null, 2)}\n`, {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    profiles: Object.keys(configuration.launchProfiles).length,
    cases: cases.length,
    state: 'passed',
    gpuJobs: 0,
  }),
);
