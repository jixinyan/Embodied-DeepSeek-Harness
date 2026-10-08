import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { startServer } from '../apps/server/src/index.ts';
import { waitFor } from '../apps/server/src/managed-services.ts';
import {
  createNativeWorkspaceFactory,
  readNativeWorkspaceConfiguration,
} from '../apps/server/src/native-workspace.mjs';
import { nativeDeploymentRoot } from '../apps/server/src/native-deployment.mjs';
import { nativeCampaignSchema } from './native-campaign.mjs';

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    owner: { type: 'string' },
    manifest: { type: 'string' },
    output: { type: 'string' },
  },
});
assert(values.config && values.owner && values.manifest && values.output);
assert.notEqual(process.platform, 'win32', 'Native campaign signal checks require POSIX.');
const configurationPath = resolve(values.config);
const ownerPath = resolve(values.owner);
const manifestPath = resolve(values.manifest);
const settings = await readNativeWorkspaceConfiguration({
  ...process.env,
  EDH_NATIVE_WORKSPACE_CONFIG: configurationPath,
});
const ownerSettings = await readNativeWorkspaceConfiguration({
  ...process.env,
  EDH_NATIVE_WORKSPACE_CONFIG: ownerPath,
});
const manifest = nativeCampaignSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
assert.equal(manifest.cases.length, 1);
const item = manifest.cases[0];
const profileBinding = settings.deployments
  .flatMap(({ id, settings }) =>
    Object.entries(settings.profiles).map(([profileId, profile]) => ({
      id: `${id}.${profileId}`,
      settings,
      profile,
      namespace: id,
    })),
  )
  .find((profile) => profile.id === item.profileId);
assert(profileBinding);
assert(item.tasks.every((task) => task.taskId === profileBinding.profile.worker.nativeTaskId));
assert.equal(profileBinding.profile.serviceIds.length, 1);
const serviceId = profileBinding.profile.serviceIds[0];
const service = profileBinding.settings.managedServices[serviceId];
assert.equal(service.readiness.type, 'http_json');
const endpoint = new URL(service.readiness.url);
assert.equal(endpoint.hostname, '127.0.0.1');
assert.equal(endpoint.protocol, 'http:');
assert.equal(endpoint.pathname, '/api/config');
assert(endpoint.port);
const output = resolve(values.output);
const childPath = relative(resolve(nativeDeploymentRoot, '.local/work'), output);
assert(
  childPath && !isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`),
);
const configurationSources = (path, settings) => [
  path,
  resolve(dirname(path), settings.configuration.modelConfiguration),
  ...Object.values(settings.configuration.deployments).map((entry) =>
    resolve(dirname(path), entry.configuration),
  ),
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = await Promise.all(
  [
    ...new Set([
      ...configurationSources(configurationPath, settings),
      ...configurationSources(ownerPath, ownerSettings),
      manifestPath,
      import.meta.filename,
      ...[
        'scripts/run-native-release-campaign.mjs',
        'scripts/run-live-acceptance.mjs',
        'scripts/native-campaign.mjs',
        'apps/server/src/native-deployment.mjs',
        'apps/server/src/native-workspace.mjs',
        'apps/server/src/managed-services.ts',
      ].map((path) => resolve(nativeDeploymentRoot, path)),
    ]),
  ].map(async (path) => ({ path, sha256: hash(await readFile(path)) })),
);
await mkdir(output, { recursive: false, mode: 0o700 });
const environment = {
  ...process.env,
  CUDA_VISIBLE_DEVICES: '',
  EDH_NVIDIA_EGL_PROFILE: '0',
  TSX_TSCONFIG_PATH: resolve(nativeDeploymentRoot, 'tsconfig.runtime.json'),
};
const runReadiness = () =>
  new Promise((accept, reject) => {
    const child = spawn(
      process.execPath,
      [
        '--import',
        'tsx',
        'scripts/check-native-workspace-readiness.mjs',
        '--config',
        configurationPath,
        '--output',
        resolve(output, 'readiness'),
      ],
      { cwd: nativeDeploymentRoot, env: environment, stdio: ['ignore', 'inherit', 'inherit'] },
    );
    child.once('error', reject);
    child.once('close', (code, signal) => {
      assert.equal(code, 0);
      assert.equal(signal, null);
      accept();
    });
  });
await runReadiness();
const owner = await startServer({
  root: nativeDeploymentRoot,
  dataDirectory: resolve(output, 'owner'),
  port: Number(endpoint.port),
  deployment: createNativeWorkspaceFactory(ownerSettings),
});
assert.equal(new URL(owner.url).origin, endpoint.origin);
const cases = [];
try {
  for (const signals of [[], ['SIGTERM'], ['SIGINT'], ['SIGTERM', 'SIGINT', 'SIGTERM']]) {
    const name =
      signals.length === 0
        ? 'admission-failure'
        : signals.length === 1
          ? signals[0].toLowerCase()
          : 'repeated-signals';
    const directory = resolve(output, name);
    await mkdir(directory);
    let campaign;
    let campaignExit;
    let driverPid;
    let driverSuspended = false;
    let admissionObserved = false;
    let stdout = '';
    let stderr = '';
    let failure;
    const factory = createNativeWorkspaceFactory(settings);
    const server = await startServer({
      root: nativeDeploymentRoot,
      dataDirectory: resolve(directory, 'console'),
      port: 0,
      deployment: async (services) => {
        const deployment = await factory(services);
        const selected = deployment.launchProfiles[item.profileId];
        assert(selected);
        return {
          ...deployment,
          launchProfiles: {
            ...deployment.launchProfiles,
            [item.profileId]: {
              ...selected,
              async createEnvironment(options) {
                assert(campaign && driverPid && !admissionObserved);
                admissionObserved = true;
                if (signals.length) {
                  process.kill(driverPid, 'SIGSTOP');
                  driverSuspended = true;
                  try {
                    for (const signal of signals) {
                      assert(campaign.kill(signal));
                      await delay(30);
                      assert.equal(campaign.exitCode, null);
                      assert.equal(campaign.signalCode, null);
                    }
                  } finally {
                    process.kill(driverPid, 'SIGCONT');
                    driverSuspended = false;
                  }
                }
                return selected.createEnvironment(options);
              },
            },
          },
        };
      },
    });
    try {
      campaign = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/run-native-release-campaign.mjs',
          '--manifest',
          manifestPath,
          '--readiness',
          resolve(output, 'readiness/readiness.json'),
          '--output',
          resolve(directory, 'campaign'),
          '--url',
          server.url,
        ],
        { cwd: nativeDeploymentRoot, env: environment, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      campaign.stdout.setEncoding('utf8').on('data', (chunk) => {
        stdout += chunk;
      });
      campaign.stderr.setEncoding('utf8').on('data', (chunk) => {
        stderr += chunk;
      });
      const lines = createInterface({ input: campaign.stdout });
      lines.on('line', (line) => {
        const event = JSON.parse(line);
        if (event.case === item.id && event.state === 'running') {
          assert.equal(driverPid, undefined);
          assert(event.driverPid > 0);
          driverPid = event.driverPid;
        }
      });
      campaignExit = new Promise((accept, reject) => {
        campaign.once('error', reject);
        campaign.once('close', (code, signal) => {
          lines.close();
          accept({ code, signal });
        });
      });
      const exit = await waitFor(campaignExit, AbortSignal.timeout(60_000));
      assert.equal(exit.code, 1);
      assert.equal(exit.signal, null);
      assert(admissionObserved && driverPid > 0 && !driverSuspended);
      const taskDirectory = resolve(directory, 'campaign', item.id);
      const closed = JSON.parse(await readFile(resolve(taskDirectory, 'closed.json'), 'utf8'));
      const admitted = JSON.parse(
        await readFile(resolve(taskDirectory, 'session-request.json'), 'utf8'),
      );
      assert.equal(closed.requestId, admitted.requestId);
      assert.equal(closed.profileId, item.profileId);
      assert.equal(closed.resources, 'released');
      assert.equal(closed.state, 'closed');
      assert.equal(closed.taskHistory.count, 0);
      const cleanup = JSON.parse(
        await readFile(resolve(directory, 'campaign', `${item.id}-cleanup.json`), 'utf8'),
      );
      assert.equal(cleanup.ownedActiveSession, false);
      const driverExit = JSON.parse(
        await readFile(resolve(directory, 'campaign', `${item.id}-exit.json`), 'utf8'),
      );
      assert.equal(driverExit.code, 1);
      assert.equal(driverExit.signal, null);
      const api = async (path) => {
        const response = await fetch(new URL(path, server.url), {
          signal: AbortSignal.timeout(3000),
        });
        assert.equal(response.status, 200);
        return response.json();
      };
      assert.equal((await api('/api/sessions')).activeId, null);
      const services = (await api('/api/services')).services;
      const selectedService = services.find(
        (service) => service.id === `${profileBinding.namespace}.${serviceId}`,
      );
      assert.equal(selectedService.state, 'failed');
      assert.equal(
        selectedService.error,
        `Managed service endpoint is already occupied: ${serviceId}`,
      );
      assert(services.every((service) => service.pid === null && service.leases === 0));
      assert.throws(() => process.kill(driverPid, 0), { code: 'ESRCH' });
      assert.throws(() => process.kill(campaign.pid, 0), { code: 'ESRCH' });
      await assert.rejects(
        access(resolve(directory, 'campaign/campaign-workflow-acceptance.json')),
        { code: 'ENOENT' },
      );
      const driverLog = await readFile(resolve(directory, 'campaign', `${item.id}.log`), 'utf8');
      assert(driverLog.includes('Managed service endpoint is already occupied'));
      cases.push({
        name,
        signals,
        sessionId: closed.id,
        campaignPid: campaign.pid,
        driverPid,
        exit,
        driverExit,
        resources: closed.resources,
        taskAdmissions: 0,
        managedProcessesStarted: 0,
      });
    } catch (error) {
      failure = error;
    } finally {
      const errors = [];
      if (driverSuspended) {
        process.kill(driverPid, 'SIGCONT');
        driverSuspended = false;
      }
      if (campaign?.exitCode === null && campaign.signalCode === null) campaign.kill('SIGTERM');
      for (const action of [
        () => campaignExit && waitFor(campaignExit, AbortSignal.timeout(60_000)),
        async () => {
          if (!driverPid) return;
          const deadline = AbortSignal.timeout(60_000);
          for (;;) {
            try {
              process.kill(driverPid, 0);
            } catch (error) {
              if (error.code !== 'ESRCH') throw error;
              return;
            }
            await delay(50, undefined, { signal: deadline });
          }
        },
        () => writeFile(resolve(directory, 'stdout.txt'), stdout, { flag: 'wx' }),
        () => writeFile(resolve(directory, 'stderr.txt'), stderr, { flag: 'wx' }),
        () => server.close(),
      ]) {
        try {
          await action();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length)
        throw new AggregateError(
          [...(failure === undefined ? [] : [failure]), ...errors],
          'Native campaign diagnostic cleanup failed.',
        );
    }
    if (failure !== undefined) throw failure;
    await assert.rejects(access(resolve(directory, 'console/writer.lock')), { code: 'ENOENT' });
    await assert.rejects(
      fetch(new URL('/api/config', server.url), { signal: AbortSignal.timeout(3000) }),
    );
  }
} finally {
  await owner.close();
}
await assert.rejects(access(resolve(output, 'owner/writer.lock')), { code: 'ENOENT' });
await assert.rejects(
  fetch(new URL('/api/config', owner.url), { signal: AbortSignal.timeout(3000) }),
);
for (const source of sources) assert.equal(hash(await readFile(source.path)), source.sha256);
const result = {
  sources,
  cases,
  writerReleased: true,
  listenersClosed: true,
  gpuJobs: 0,
  modelCalls: 0,
  environmentAllocations: 0,
  scope:
    'Actual native campaign and Console admission, repeated OS signals, original service ownership failure and released Session/process resources.',
};
await writeFile(resolve(output, 'acceptance.json'), JSON.stringify(result, null, 2) + '\n', {
  flag: 'wx',
  mode: 0o600,
});
console.log(JSON.stringify({ output, cases: cases.length, state: 'passed' }));
