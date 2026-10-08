import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { startServer } from '../apps/server/src/index.ts';
import {
  createNativeWorkspaceFactory,
  readNativeWorkspaceConfiguration,
} from '../apps/server/src/native-workspace.mjs';
import { nativeDeploymentRoot } from '../apps/server/src/native-deployment.mjs';

const { values } = parseArgs({
  options: { config: { type: 'string' }, output: { type: 'string' } },
});
assert(values.config && values.output, 'Supply --config and a new --output directory.');
const configurationPath = resolve(values.config);
const output = resolve(values.output);
assert(relative(resolve(nativeDeploymentRoot, '.local'), output).startsWith('work/'));
await mkdir(output, { recursive: false });
const save = (name, value) =>
  writeFile(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`);
const settings = await readNativeWorkspaceConfiguration({
  ...process.env,
  EDH_NATIVE_WORKSPACE_CONFIG: configurationPath,
});
const sources = [
  configurationPath,
  resolve(dirname(configurationPath), settings.configuration.modelConfiguration),
  ...Object.values(settings.configuration.deployments).map((entry) =>
    resolve(dirname(configurationPath), entry.configuration),
  ),
];
const hashes = await Promise.all(
  sources.map(async (path) => ({
    path,
    sha256: createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
  })),
);
await save('configuration-sources.json', hashes);
const matrix = settings.deployments.flatMap(({ id, settings }) =>
  Object.entries(settings.profiles).map(([profileId, profile]) => ({
    profileId: `${id}.${profileId}`,
    provider: settings.provider,
    nativeTaskId: profile.worker.nativeTaskId,
    checkpoint: profile.checkpoint,
    policyId: profile.worker.policyId,
    executionMode: profile.mode,
    plannerModel: profile.plannerModel,
    teamFile: settings.teamFile,
    catalogRevision: profile.worker.catalog.revision,
    finalGoalId: profile.worker.catalog.tasks[profile.worker.nativeTaskId].goal.id,
    allowedSubgoalChecks:
      profile.worker.catalog.tasks[profile.worker.nativeTaskId].allowedSubgoalChecks ?? [],
    serviceIds: profile.serviceIds.map((service) => `${id}.${service}`),
  })),
);
const storeDirectory = resolve(output, 'workspace');
const server = await startServer({
  root: nativeDeploymentRoot,
  dataDirectory: storeDirectory,
  port: 0,
  deployment: createNativeWorkspaceFactory({ ...settings, dataDirectory: storeDirectory }),
});
let result;
try {
  const get = async (path) => {
    const response = await fetch(`${server.url}${path}`, { signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200);
    return response.json();
  };
  const configuration = await get('/api/config');
  await save('configuration.json', configuration);
  assert.equal(configuration.deploymentId, 'native-workspace');
  assert.deepEqual(
    Object.keys(configuration.launchProfiles).sort(),
    matrix.map((item) => item.profileId).sort(),
  );
  for (const item of matrix) {
    const profile = configuration.launchProfiles[item.profileId];
    assert.equal(profile.source, 'simulation');
    assert.equal(profile.taskSource, 'environment');
    assert.deepEqual(profile.tasks, []);
    assert.equal(profile.checkpoint, item.checkpoint);
    assert.equal(profile.policy, item.policyId);
    assert.equal(profile.executionMode, item.executionMode);
    assert.equal(profile.defaultModel, item.plannerModel);
    const team = configuration.launchTeams[item.profileId];
    assert(team && team.team.entrypoint === team.team.bindings.decision_owner);
    item.teamDigest = team.digest;
    item.members = Object.fromEntries(
      Object.entries(team.roles).map(([id, role]) => [
        id,
        {
          model: role.model,
          tools: role.definition.tools,
        },
      ]),
    );
  }
  const sessions = await get('/api/sessions');
  assert.equal(sessions.activeId, null);
  const services = await get('/api/services');
  await save('services.json', services);
  for (const service of services.services) {
    assert.equal(service.state, 'idle');
    assert.equal(service.leases, 0);
    assert.equal(service.pid, null);
  }
  result = {
    sourceCode: configuration.sourceCode,
    deploymentDigest: configuration.deploymentDigest,
    sources: hashes,
    profiles: matrix,
    nativeEnvironmentAllocated: false,
    modelInferencePerformed: false,
    managedProcessesStarted: false,
    scope:
      'Actual native factories, configured Teams and HTTP metadata; no GPU or simulator task execution.',
  };
} finally {
  await server.close();
}
await assert.rejects(access(resolve(storeDirectory, 'writer.lock')), { code: 'ENOENT' });
for (const source of hashes)
  assert.equal(
    createHash('sha256')
      .update(await readFile(source.path))
      .digest('hex'),
    source.sha256,
  );
await assert.rejects(fetch(`${server.url}/api/config`, { signal: AbortSignal.timeout(3000) }));
result.writerReleased = true;
result.listenerClosed = true;
await save('readiness.json', result);
console.log(
  JSON.stringify({
    profileCount: matrix.length,
    providers: [...new Set(matrix.map((item) => item.provider))],
    output,
    ...result,
  }),
);
