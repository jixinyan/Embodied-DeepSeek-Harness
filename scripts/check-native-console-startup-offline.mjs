import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { ManagedServices } from '../apps/server/src/managed-services.ts';
import { readNativeWorkspaceConfiguration } from '../apps/server/src/native-workspace.mjs';
import { nativeDeploymentRoot as root } from '../apps/server/src/native-deployment.mjs';

const { values } = parseArgs({
  options: { workspace: { type: 'string' }, output: { type: 'string' } },
});
assert(values.workspace && values.output, 'Supply an actual --workspace and a new --output.');
assert.notEqual(process.platform, 'win32', 'This diagnostic requires POSIX process groups.');
const configurationPath = resolve(values.workspace);
const settings = await readNativeWorkspaceConfiguration({
  ...process.env,
  EDH_NATIVE_WORKSPACE_CONFIG: configurationPath,
});
const output = resolve(values.output);
const childPath = relative(resolve(root, '.local/work'), output);
assert(
  childPath && !isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`),
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = await Promise.all(
  [
    configurationPath,
    resolve(dirname(configurationPath), settings.configuration.modelConfiguration),
    ...Object.values(settings.configuration.deployments).map((entry) =>
      resolve(dirname(configurationPath), entry.configuration),
    ),
    ...[
      'package.json',
      'apps/server/src/http-server.ts',
      'apps/server/src/index.ts',
      'apps/server/src/console-process.ts',
      'apps/server/src/managed-services.ts',
      'apps/server/src/native-workspace.mjs',
      'apps/server/src/native-deployment.mjs',
      'apps/server/src/native-deployment-configuration.mjs',
      'apps/server/src/native-policy-environment.mjs',
      'harness/agent-runtime/teams/src/loader.ts',
      'harness/agent-runtime/teams/src/role-document.ts',
      'examples/deployments/native-workspace.mjs',
      'scripts/check-native-console-startup-offline.mjs',
    ].map((path) => resolve(root, path)),
  ].map(async (path) => ({ path, sha256: hash(await readFile(path)) })),
);
await mkdir(output, { recursive: false, mode: 0o700 });
const cases = [];
for (const entry of ['start', 'demo']) {
  const directory = resolve(output, entry);
  await mkdir(directory);
  const dataDirectory = resolve(directory, 'workspace');
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((accept, reject) =>
    socket.close((error) => (error ? reject(error) : accept())),
  );
  const configuration = {
    ...settings.configuration,
    modelConfiguration: resolve(
      dirname(configurationPath),
      settings.configuration.modelConfiguration,
    ),
    deployments: Object.fromEntries(
      Object.entries(settings.configuration.deployments).map(([id, binding]) => [
        id,
        { ...binding, configuration: resolve(dirname(configurationPath), binding.configuration) },
      ]),
    ),
    dataDirectory,
    consolePort: port,
  };
  const file = resolve(directory, 'workspace.json');
  await writeFile(file, `${JSON.stringify(configuration, null, 2)}\n`, { flag: 'wx' });
  const url = `http://127.0.0.1:${port}`;
  const supervisor = new ManagedServices({
    console: {
      label: `Configured EDH ${entry} entry`,
      command: ['pnpm', entry],
      cwd: root,
      env: {
        CUDA_VISIBLE_DEVICES: '',
        TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.runtime.json'),
        EDH_NATIVE_WORKSPACE_CONFIG: file,
      },
      readiness: {
        type: 'http_json',
        url: `${url}/api/config`,
        schema: {
          type: 'object',
          required: ['deploymentId'],
          properties: { deploymentId: { const: 'native-workspace' } },
        },
      },
      startupTimeoutMs: 30000,
      probeTimeoutMs: 1000,
      probeIntervalMs: 100,
      shutdownTimeoutMs: 15000,
    },
  });
  let pid;
  let metadata;
  try {
    const lease = await supervisor.acquire(['console'], AbortSignal.timeout(30000));
    pid = supervisor.inspect()[0].pid;
    assert(Number.isInteger(pid));
    const get = async (path) => {
      const response = await fetch(`${url}${path}`, { signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200);
      return response.json();
    };
    metadata = await get('/api/config');
    assert.equal(metadata.mode, 'simulation');
    assert.equal(metadata.deploymentId, 'native-workspace');
    const expected = settings.deployments.flatMap(({ id, settings }) =>
      Object.keys(settings.profiles).map((profile) => `${id}.${profile}`),
    );
    assert.deepEqual(Object.keys(metadata.launchProfiles).sort(), expected.sort());
    for (const { id, settings: deployment } of settings.deployments)
      for (const [name, selected] of Object.entries(deployment.profiles)) {
        const profile = metadata.launchProfiles[`${id}.${name}`];
        assert.equal(profile.source, 'simulation');
        assert.equal(profile.taskSource, 'environment');
        assert.deepEqual(profile.tasks, []);
        assert.equal(profile.checkpoint, selected.checkpoint);
        assert.equal(profile.checkpointSha256, selected.checkpointSha256);
        assert.equal(profile.policy, selected.worker.policyId);
        assert.equal(profile.executionMode, selected.mode);
        assert.equal(profile.defaultModel, selected.plannerModel);
      }
    const sessions = await get('/api/sessions');
    assert.equal(sessions.activeId, null);
    assert.equal(sessions.sessions.length, 0);
    const services = await get('/api/services');
    for (const service of services.services) {
      assert.equal(service.state, 'idle');
      assert.equal(service.leases, 0);
      assert.equal(service.pid, null);
    }
    await writeFile(resolve(directory, 'configuration.json'), JSON.stringify(metadata, null, 2));
    await writeFile(resolve(directory, 'services.json'), JSON.stringify(services, null, 2));
    await lease.release();
    assert.equal(supervisor.inspect()[0].state, 'stopped');
  } finally {
    await supervisor.close();
  }
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  assert.throws(() => process.kill(-pid, 0), { code: 'ESRCH' });
  await assert.rejects(access(resolve(dataDirectory, 'writer.lock')), { code: 'ENOENT' });
  await assert.rejects(fetch(`${url}/api/config`, { signal: AbortSignal.timeout(3000) }));
  cases.push({
    entry,
    pid,
    deploymentDigest: metadata.deploymentDigest,
    profileCount: Object.keys(metadata.launchProfiles).length,
    journalSha256: hash(await readFile(resolve(dataDirectory, 'records.jsonl'))),
    processReleased: true,
    processGroupReleased: true,
    writerReleased: true,
    listenerClosed: true,
    modelInferencePerformed: false,
    nativeEnvironmentAllocated: false,
    managedProviderProcessesStarted: false,
  });
}
for (const source of sources) assert.equal(hash(await readFile(source.path)), source.sha256);
const result = { schemaVersion: 'edh.native_console_startup_cpu.v1', sources, cases };
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ caseCount: cases.length, sourceCount: sources.length, output }));
