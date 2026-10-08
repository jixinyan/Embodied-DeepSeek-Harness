import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { access, mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { startServer } from '../apps/server/src/index.ts';
import {
  createNativeDeploymentFactory,
  nativeDeploymentRoot,
  readNativeDeploymentConfiguration,
} from '../apps/server/src/native-deployment.mjs';
import {
  createNativeWorkspaceFactory,
  readNativeWorkspaceConfiguration,
} from '../apps/server/src/native-workspace.mjs';

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    workspace: { type: 'string' },
    provider: { type: 'string' },
    profile: { type: 'string' },
    service: { type: 'string' },
    models: { type: 'string' },
    output: { type: 'string' },
    interrupt: { type: 'boolean', default: false },
  },
});
assert(values.config && values.workspace && values.provider && values.profile && values.service);
assert(values.models && values.output);
const variables = {
  robotwin: 'EDH_ROBOTWIN_CONFIG',
  behavior: 'EDH_BEHAVIOR_CONFIG',
  robocasa: 'EDH_NATIVE_WORKER_CONFIG',
  robodojo: 'EDH_ROBODOJO_CONFIG',
};
assert(Object.hasOwn(variables, values.provider));
const settings = await readNativeDeploymentConfiguration(values.provider, {
  ...process.env,
  [variables[values.provider]]: resolve(values.config),
  EDH_MODEL_CONFIG: resolve(values.models),
});
const profile = settings.profiles[values.profile];
assert(profile);
assert.deepEqual(profile.serviceIds, [values.service]);
const service = settings.managedServices[values.service];
assert.equal(service.readiness.type, 'http_json');
const readiness = new URL(service.readiness.url);
assert.equal(readiness.protocol, 'http:');
assert.equal(readiness.hostname, '127.0.0.1');
assert(readiness.port && readiness.pathname === '/api/config');
const workspace = await readNativeWorkspaceConfiguration({
  ...process.env,
  EDH_NATIVE_WORKSPACE_CONFIG: resolve(values.workspace),
});
const output = resolve(values.output);
const childPath = relative(resolve(nativeDeploymentRoot, '.local/work'), output);
assert(
  childPath && !isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`),
);
await mkdir(output, { recursive: false });
const sources = await Promise.all(
  [values.config, values.workspace, values.models].map(async (path) => ({
    path: resolve(path),
    sha256: createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
  })),
);
let owner;
let server;
let child;
let childExit;
let log;
let interrupted = false;
let result;
try {
  owner = await startServer({
    root: nativeDeploymentRoot,
    dataDirectory: resolve(output, 'owner'),
    port: Number(readiness.port),
    deployment: createNativeWorkspaceFactory(workspace),
  });
  assert.equal(new URL(owner.url).origin, readiness.origin);
  const factory = createNativeDeploymentFactory(settings);
  server = await startServer({
    root: nativeDeploymentRoot,
    dataDirectory: resolve(output, 'console'),
    port: 0,
    deployment: async (services) => {
      const deployment = await factory(services);
      if (!values.interrupt) return deployment;
      const selected = deployment.launchProfiles[values.profile];
      return {
        ...deployment,
        launchProfiles: {
          ...deployment.launchProfiles,
          [values.profile]: {
            ...selected,
            createEnvironment(options) {
              assert(child && !interrupted);
              interrupted = child.kill('SIGTERM');
              assert(interrupted);
              return selected.createEnvironment(options);
            },
          },
        },
      };
    },
  });
  log = await open(resolve(output, 'driver.log'), 'wx');
  child = spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      resolve(nativeDeploymentRoot, 'scripts/run-live-acceptance.mjs'),
      '--url',
      server.url,
      '--profile',
      values.profile,
      '--task',
      profile.worker.nativeTaskId,
      '--output',
      resolve(output, 'driver'),
      '--timeout-ms',
      '30000',
    ],
    {
      cwd: nativeDeploymentRoot,
      env: {
        ...process.env,
        TSX_TSCONFIG_PATH: resolve(nativeDeploymentRoot, 'tsconfig.runtime.json'),
      },
      stdio: ['ignore', log.fd, log.fd],
    },
  );
  childExit = once(child, 'close');
  const [code, signal] = await once(child, 'close', { signal: AbortSignal.timeout(30_000) });
  assert.notEqual(code, 0);
  assert.equal(signal, null);
  assert.equal(interrupted, values.interrupt);
  const get = async (path) => {
    const response = await fetch(new URL(path, server.url), { signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, 200);
    return response.json();
  };
  const listing = await get('/api/sessions');
  assert.equal(listing.activeId, null);
  const closed = JSON.parse(await readFile(resolve(output, 'driver/closed.json'), 'utf8'));
  const admission = JSON.parse(
    await readFile(resolve(output, 'driver/session-request.json'), 'utf8'),
  );
  assert.equal(closed.requestId, admission.requestId);
  assert.equal(closed.profileId, values.profile);
  assert.equal(closed.state, 'closed');
  assert.equal(closed.resources, 'released');
  assert.equal(closed.taskHistory.count, 0);
  const services = await get('/api/services');
  const selected = services.services.find((item) => item.id === values.service);
  assert(selected && selected.state === 'failed');
  assert.equal(selected.error, `Managed service endpoint is already occupied: ${values.service}`);
  assert(services.services.every((item) => item.pid === null && item.leases === 0));
  assert.equal((await (await fetch(new URL('/api/sessions', owner.url))).json()).activeId, null);
  result = {
    sources,
    profileId: values.profile,
    sessionId: closed.id,
    actualServiceOwnershipConflict: 'passed',
    ...(interrupted ? { admissionInterruption: 'passed' } : {}),
    driverExit: { code, signal },
    resources: 'released',
    nativeEnvironmentAllocated: false,
    modelInferencePerformed: false,
    physicalControlsPerformed: false,
    scope:
      'Production native admission, actual Console endpoint ownership and driver cleanup; no simulator or model acceptance.',
  };
} finally {
  if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  const results = await Promise.allSettled([
    childExit,
    log?.close(),
    server?.close(),
    owner?.close(),
  ]);
  const errors = results.filter((item) => item.status === 'rejected').map((item) => item.reason);
  if (errors.length) throw new AggregateError(errors, 'Offline native admission cleanup failed.');
}
for (const directory of ['console', 'owner'])
  await assert.rejects(access(resolve(output, directory, 'writer.lock')), { code: 'ENOENT' });
for (const source of sources)
  assert.equal(
    createHash('sha256')
      .update(await readFile(source.path))
      .digest('hex'),
    source.sha256,
  );
for (const endpoint of [server.url, owner.url])
  await assert.rejects(
    fetch(new URL('/api/config', endpoint), { signal: AbortSignal.timeout(3000) }),
  );
result.writerReleased = true;
result.listenersClosed = true;
result.sourceFilesUnchanged = true;
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
