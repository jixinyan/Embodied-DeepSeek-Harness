import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { watch } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { parseArgs, promisify } from 'node:util';
import { ManagedServices, waitFor } from '../apps/server/src/managed-services.ts';
import { readNativeWorkspaceConfiguration } from '../examples/deployments/native-workspace.mjs';
import { nativeDeploymentRoot } from '../examples/deployments/native-live.mjs';

const { values } = parseArgs({
  options: { workspace: { type: 'string' }, output: { type: 'string' } },
});
assert(values.workspace && values.output, 'Supply an actual --workspace and a new --output.');
assert.notEqual(process.platform, 'win32', 'This diagnostic requires POSIX process groups.');
const configurationPath = resolve(values.workspace);
const configurationRoot = dirname(configurationPath);
const settings = await readNativeWorkspaceConfiguration({
  ...process.env,
  EDH_NATIVE_WORKSPACE_CONFIG: configurationPath,
});
const output = resolve(values.output);
const childPath = relative(resolve(nativeDeploymentRoot, '.local/work'), output);
assert(
  childPath && !isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`),
);
await mkdir(output, { recursive: false });
const sources = [
  configurationPath,
  resolve(configurationRoot, settings.configuration.modelConfiguration),
  ...Object.values(settings.configuration.deployments).map((entry) =>
    resolve(configurationRoot, entry.configuration),
  ),
  ...[
    'apps/server/src/managed-services.ts',
    'apps/server/src/console-process.ts',
    'examples/deployments/native-workspace.mjs',
    'examples/deployments/native-live.mjs',
    'scripts/check-service-startup-owner-offline.mjs',
  ].map((path) => resolve(nativeDeploymentRoot, path)),
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceHashes = await Promise.all(
  sources.map(async (path) => ({ path, sha256: hash(await readFile(path)) })),
);
const execute = promisify(execFile);
const results = [];
for (const mode of ['cancel-admission', 'close-during-startup', 'cancel-one-shared-admission']) {
  const directory = resolve(output, mode);
  const runtime = resolve(directory, 'runtime');
  await mkdir(runtime, { recursive: true });
  const endpoint = createServer();
  endpoint.listen(0, '127.0.0.1');
  await once(endpoint, 'listening');
  const port = endpoint.address().port;
  await new Promise((accept, reject) =>
    endpoint.close((error) => (error ? reject(error) : accept())),
  );
  const configuration = {
    ...settings.configuration,
    modelConfiguration: resolve(configurationRoot, settings.configuration.modelConfiguration),
    deployments: Object.fromEntries(
      Object.entries(settings.configuration.deployments).map(([id, entry]) => [
        id,
        { ...entry, configuration: resolve(configurationRoot, entry.configuration) },
      ]),
    ),
    dataDirectory: runtime,
    consolePort: port,
  };
  const file = resolve(directory, 'workspace.json');
  await writeFile(file, `${JSON.stringify(configuration, null, 2)}\n`, { flag: 'wx' });
  const url = `http://127.0.0.1:${port}`;
  const supervisor = new ManagedServices({
    console: {
      label: 'EDH configured native workspace Console',
      command: [process.execPath, '--import', 'tsx', 'examples/deployments/native-workspace.mjs'],
      cwd: nativeDeploymentRoot,
      env: {
        CUDA_VISIBLE_DEVICES: '',
        TSX_TSCONFIG_PATH: resolve(nativeDeploymentRoot, 'tsconfig.runtime.json'),
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
      probeIntervalMs: 5000,
      shutdownTimeoutMs: 15000,
    },
  });
  const deadline = AbortSignal.timeout(30000);
  const watcher = watch(runtime);
  const writerCreated = (async () => {
    for (;;) {
      const [, filename] = await once(watcher, 'change', { signal: deadline });
      if (filename === 'writer.lock') return;
    }
  })();
  const waitUntil = async (predicate) => {
    for (;;) {
      deadline.throwIfAborted();
      const state = supervisor.inspect()[0];
      if (predicate(state)) return state;
      assert.notEqual(state.state, 'failed', state.error);
      await nextTurn(undefined, { signal: deadline });
    }
  };
  const firstController = new AbortController();
  const pending = supervisor.acquire(['console'], firstController.signal).then(
    (lease) => ({ lease }),
    (error) => ({ error }),
  );
  const shared = mode === 'cancel-one-shared-admission';
  const other = shared
    ? supervisor.acquire(['console'], deadline).then(
        (lease) => ({ lease }),
        (error) => ({ error }),
      )
    : undefined;
  let pid;
  let suspended = false;
  let failure;
  let cleanup;
  let result;
  try {
    const spawned = await waitUntil((state) => state.pid !== null);
    assert.equal(spawned.state, 'starting');
    assert.equal(spawned.leases, shared ? 2 : 1);
    pid = spawned.pid;
    await waitFor(writerCreated, deadline);
    assert.equal(supervisor.inspect()[0].state, 'starting');
    process.kill(pid, 'SIGSTOP');
    suspended = true;
    const { stdout } = await execute('ps', ['-o', 'stat=', '-p', String(pid)], { timeout: 3000 });
    assert(stdout.trim().includes('T'), 'The actual owned child must be suspended.');
    const cancellation = new Error('Operator cancelled configured service admission.');
    if (mode === 'close-during-startup') cleanup = supervisor.close();
    else firstController.abort(cancellation);
    if (shared) {
      const cancelled = await waitFor(pending, deadline);
      assert.equal(cancelled.error, cancellation);
      const retained = supervisor.inspect()[0];
      assert.equal(retained.state, 'starting');
      assert.equal(retained.leases, 1);
      assert.equal(retained.pid, pid);
    } else {
      const stopping = await waitUntil((state) => state.state === 'stopping');
      assert.equal(stopping.pid, pid);
      assert.equal(stopping.leases, 0);
      process.kill(pid, 0);
    }
    process.kill(pid, 'SIGCONT');
    suspended = false;
    const completed = await waitFor(pending, deadline);
    assert(completed.error instanceof Error);
    if (mode === 'cancel-admission') assert.equal(completed.error, cancellation);
    if (cleanup) await waitFor(cleanup, deadline);
    if (shared) {
      const survivor = await waitFor(other, deadline);
      assert(survivor.lease && !survivor.lease.signal.aborted);
      const ready = supervisor.inspect()[0];
      assert.equal(ready.state, 'ready');
      assert.equal(ready.pid, pid);
      assert.equal(ready.leases, 1);
      const response = await fetch(`${url}/api/config`, { signal: deadline });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).deploymentId, 'native-workspace');
      await survivor.lease.release();
    }
    result = {
      mode,
      pid,
      actualSuspendedStartup: true,
      cancelledAdmissionRejected: true,
      sharedAdmissionRetained: shared,
      sharedConsoleReady: shared,
      originalCancellationPreserved: mode !== 'close-during-startup',
    };
  } catch (error) {
    failure = error;
  } finally {
    watcher.close();
    const errors = [];
    if (suspended) {
      try {
        process.kill(pid, 'SIGCONT');
      } catch (error) {
        errors.push(error);
      }
    }
    const closed = await Promise.allSettled([cleanup, supervisor.close()]);
    errors.push(
      ...closed.filter((entry) => entry.status === 'rejected').map((entry) => entry.reason),
    );
    if (errors.length)
      throw new AggregateError(
        [...(failure === undefined ? [] : [failure]), ...errors],
        'Configured service startup check and cleanup failed.',
      );
  }
  if (failure !== undefined) throw failure;
  assert(supervisor.inspect().every((entry) => entry.pid === null && entry.leases === 0));
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  assert.throws(() => process.kill(-pid, 0), { code: 'ESRCH' });
  await assert.rejects(access(resolve(runtime, 'writer.lock')), { code: 'ENOENT' });
  await assert.rejects(fetch(`${url}/api/config`, { signal: AbortSignal.timeout(1000) }));
  const reusable = createServer();
  reusable.listen(port, '127.0.0.1');
  await once(reusable, 'listening');
  await new Promise((accept, reject) =>
    reusable.close((error) => (error ? reject(error) : accept())),
  );
  result.ownedProcessGroupReleased = true;
  result.writerReleased = true;
  result.listenerReusable = true;
  result.final = supervisor.inspect();
  results.push(result);
}
for (const source of sourceHashes) assert.equal(hash(await readFile(source.path)), source.sha256);
const report = {
  sources: sourceHashes,
  cases: results,
  gpuJobs: 0,
  modelCalls: 0,
  policyCalls: 0,
  environmentAllocations: 0,
  scope: 'Actual configured Console processes and startup ownership; no native tasks or inference.',
};
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(report, null, 2)}\n`, {
  flag: 'wx',
});
console.log(JSON.stringify(report));
