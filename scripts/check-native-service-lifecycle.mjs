import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { once } from 'node:events';
import {
  createNativeDeploymentFactory,
  nativeDeploymentRoot,
  readNativeDeploymentConfiguration,
} from '../apps/server/src/native-deployment.mjs';
import { startServer } from '../apps/server/src/index.ts';

const { values } = parseArgs({
  options: {
    provider: { type: 'string' },
    config: { type: 'string' },
    id: { type: 'string' },
    output: { type: 'string' },
    port: { type: 'string', default: '4365' },
    models: { type: 'string' },
    'close-held': { type: 'boolean', default: false },
  },
});
assert(values.provider && values.config && values.id && values.output);
const variables = {
  robotwin: 'EDH_ROBOTWIN_CONFIG',
  behavior: 'EDH_BEHAVIOR_CONFIG',
  robocasa: 'EDH_NATIVE_WORKER_CONFIG',
  robodojo: 'EDH_ROBODOJO_CONFIG',
};
assert(variables[values.provider]);
const output = resolve(values.output);
await mkdir(output, { recursive: false });
const settings = await readNativeDeploymentConfiguration(values.provider, {
  ...process.env,
  [variables[values.provider]]: resolve(values.config),
  ...(values.models ? { EDH_MODEL_CONFIG: resolve(values.models) } : {}),
});
assert(settings.managedServices[values.id], 'Select an actually configured managed service.');
let deployment;
const factory = createNativeDeploymentFactory(settings);
const server = await startServer({
  root: nativeDeploymentRoot,
  dataDirectory: resolve(output, 'console'),
  port: Number(values.port),
  deployment: async (services) => (deployment = await factory(services)),
});
const supervisor = deployment.serviceLifecycle;
const history = [];
const status = async (stage) => {
  const response = await fetch(`${server.url}/api/services`);
  assert(response.ok);
  const state = await response.json();
  assert(state.managed);
  const selected = state.services.find((service) => service.id === values.id);
  assert(selected);
  history.push({ stage, ...selected });
  await writeFile(resolve(output, 'lifecycle.json'), `${JSON.stringify(history, null, 2)}\n`);
  console.log(
    JSON.stringify({ stage, state: selected.state, leases: selected.leases, pid: selected.pid }),
  );
  return selected;
};
let first;
let second;
let final;
try {
  assert.equal((await status('initial')).state, 'idle');
  [first, second] = await Promise.all([
    supervisor.acquire([values.id], AbortSignal.timeout(3_600_000)),
    supervisor.acquire([values.id], AbortSignal.timeout(3_600_000)),
  ]);
  const shared = await status('shared-ready');
  assert.equal(shared.state, 'ready');
  assert.equal(shared.leases, 2);
  assert(shared.pid);
  process.kill(shared.pid, 0);
  await first.release();
  const retained = await status('first-released');
  assert.equal(retained.state, 'ready');
  assert.equal(retained.leases, 1);
  assert.equal(retained.pid, shared.pid);
  if (values['close-held']) {
    await server.close();
    assert(second.signal.aborted);
    assert.throws(() => process.kill(shared.pid, 0), { code: 'ESRCH' });
    assert(supervisor.inspect().every((service) => service.pid === null && service.leases === 0));
    await writeFile(
      resolve(output, 'closed-with-lease.json'),
      JSON.stringify(supervisor.inspect(), null, 2),
    );
    console.log(
      JSON.stringify({ managedService: values.id, output, serverClosedWithActiveLease: 'passed' }),
    );
  } else {
    await second.release();
    const stopped = await status('last-released');
    assert.equal(stopped.state, 'stopped');
    assert.equal(stopped.leases, 0);
    assert.equal(stopped.pid, null);
    assert.throws(() => process.kill(shared.pid, 0), { code: 'ESRCH' });
    final = await supervisor.acquire([values.id], AbortSignal.timeout(3_600_000));
    const restarted = await status('restarted');
    assert.equal(restarted.state, 'ready');
    assert.notEqual(restarted.pid, shared.pid);
    const interrupted = once(final.signal, 'abort', {
      signal: AbortSignal.timeout(settings.managedServices[values.id].shutdownTimeoutMs),
    });
    process.kill(restarted.pid, 'SIGTERM');
    await interrupted;
    const failed = await status('unexpected-exit');
    assert.equal(failed.state, 'failed');
    assert.match(failed.error, /exited unexpectedly/);
    await assert.rejects(supervisor.acquire([values.id], AbortSignal.timeout(1000)));
    await final.release();
    await status('failed-released');
  }
} finally {
  const results = await Promise.allSettled([
    first?.release(),
    second?.release(),
    final?.release(),
    server.close(),
  ]);
  const errors = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason);
  if (errors.length) throw new AggregateError(errors, 'Actual service acceptance cleanup failed.');
}
assert(supervisor.inspect().every((service) => service.pid === null && service.leases === 0));
console.log(
  JSON.stringify({
    managedService: values.id,
    output,
    sharedProcess: 'passed',
    ...(values['close-held']
      ? { serverClosedWithActiveLease: 'passed' }
      : { gracefulRelease: 'passed', restart: 'passed', unexpectedExit: 'passed' }),
    serverCleanup: 'passed',
    scope:
      'Actual configured foreground service process lifecycle; no model inference or physical task execution.',
  }),
);
