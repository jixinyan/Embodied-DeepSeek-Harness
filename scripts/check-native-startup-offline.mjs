import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { watch } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readNativeWorkspaceConfiguration } from '../examples/deployments/native-workspace.mjs';
import { nativeDeploymentRoot } from '../examples/deployments/native-live.mjs';

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    output: { type: 'string' },
    provider: { type: 'string' },
  },
});
assert(values.config && values.output, 'Supply an actual --config and a new --output directory.');
const configurationPath = resolve(values.config);
const output = resolve(values.output);
assert(relative(resolve(nativeDeploymentRoot, '.local'), output).startsWith('work/'));
const settings = await readNativeWorkspaceConfiguration({
  ...process.env,
  EDH_NATIVE_WORKSPACE_CONFIG: configurationPath,
});
const configurationRoot = dirname(configurationPath);
const selected = values.provider
  ? settings.deployments.find(({ settings }) => settings.provider === values.provider)
  : undefined;
if (values.provider) assert(selected, 'Provider must occur in the configured native workspace.');
const entry = values.provider ?? 'native-workspace';
const deployment = selected
  ? Object.values(settings.configuration.deployments).find(
      ({ provider }) => provider === values.provider,
    )
  : undefined;
const originalDeployment = deployment
  ? JSON.parse(await readFile(resolve(configurationRoot, deployment.configuration), 'utf8'))
  : undefined;
const providerVariables = {
  behavior: 'EDH_BEHAVIOR_CONFIG',
  robocasa: 'EDH_NATIVE_WORKER_CONFIG',
  robodojo: 'EDH_ROBODOJO_CONFIG',
  robotwin: 'EDH_ROBOTWIN_CONFIG',
};
const sources = [
  configurationPath,
  resolve(configurationRoot, settings.configuration.modelConfiguration),
  ...Object.values(settings.configuration.deployments).map((entry) =>
    resolve(configurationRoot, entry.configuration),
  ),
  resolve(nativeDeploymentRoot, 'apps/server/src/console-process.ts'),
  resolve(nativeDeploymentRoot, 'examples/deployments/native-workspace.mjs'),
  resolve(nativeDeploymentRoot, 'examples/deployments/native-live.mjs'),
  resolve(nativeDeploymentRoot, 'scripts/check-native-startup-offline.mjs'),
  ...(selected ? [resolve(nativeDeploymentRoot, `examples/deployments/${entry}-live.mjs`)] : []),
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hashes = await Promise.all(
  sources.map(async (path) => ({ path, sha256: hash(await readFile(path)) })),
);
await mkdir(output, { recursive: false });
const results = [];
const cases = [
  { name: 'writer-lock-sigterm', trigger: 'writer-lock', signals: ['SIGTERM'] },
  { name: 'writer-lock-sigint', trigger: 'writer-lock', signals: ['SIGINT'] },
  {
    name: 'writer-lock-repeated',
    trigger: 'writer-lock',
    signals: ['SIGTERM', 'SIGINT', 'SIGTERM'],
  },
  { name: 'ready-sigterm', trigger: 'http-ready', signals: ['SIGTERM'] },
  { name: 'ready-repeated', trigger: 'http-ready', signals: ['SIGINT', 'SIGTERM', 'SIGINT'] },
];
for (const item of cases) {
  const directory = resolve(output, item.name);
  const runtime = resolve(directory, 'runtime');
  await mkdir(runtime, { recursive: true });
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
  const url = `http://127.0.0.1:${port}`;
  const modelConfiguration = resolve(configurationRoot, settings.configuration.modelConfiguration);
  const privateConfiguration = selected
    ? { ...originalDeployment, modelConfiguration, dataDirectory: runtime, consolePort: port }
    : {
        ...settings.configuration,
        modelConfiguration,
        dataDirectory: runtime,
        consolePort: port,
        deployments: Object.fromEntries(
          Object.entries(settings.configuration.deployments).map(([id, entry]) => [
            id,
            { ...entry, configuration: resolve(configurationRoot, entry.configuration) },
          ]),
        ),
      };
  const file = resolve(directory, selected ? 'deployment.json' : 'workspace.json');
  await writeFile(file, `${JSON.stringify(privateConfiguration, null, 2)}\n`, { flag: 'wx' });
  const watcher = watch(runtime);
  const deadline = AbortSignal.timeout(30000);
  const lockCreated = (async () => {
    for (;;) {
      const [, filename] = await once(watcher, 'change', { signal: deadline });
      if (filename === 'writer.lock') return;
    }
  })();
  const ready = Promise.withResolvers();
  let stdout = '';
  let stderr = '';
  const child = spawn(
    process.execPath,
    [
      'node_modules/tsx/dist/cli.mjs',
      '--tsconfig',
      'tsconfig.runtime.json',
      `examples/deployments/${selected ? `${entry}-live` : entry}.mjs`,
    ],
    {
      cwd: nativeDeploymentRoot,
      env: {
        ...process.env,
        [selected ? providerVariables[entry] : 'EDH_NATIVE_WORKSPACE_CONFIG']: file,
        EDH_MODEL_CONFIG: modelConfiguration,
        EDH_DATA_DIRECTORY: runtime,
        EDH_CONSOLE_PORT: String(port),
        CUDA_VISIBLE_DEVICES: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    if (stdout.includes(url)) ready.resolve();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const closed = once(child, 'close', { signal: deadline });
  const waitFor = (milestone) =>
    Promise.race([
      milestone,
      closed.then(() => {
        throw new Error('Native CLI closed before reaching its requested startup boundary.');
      }),
    ]);
  let owner;
  let urlObservedBeforeSignal;
  let metadata;
  let outcome;
  try {
    await waitFor(lockCreated);
    if (item.trigger === 'http-ready') {
      await waitFor(ready.promise);
      const response = await fetch(`${url}/api/config`, { signal: deadline });
      assert.equal(response.status, 200);
      metadata = await response.json();
      assert.equal(metadata.deploymentId, selected ? `${entry}-live` : 'native-workspace');
    }
    owner = JSON.parse(await readFile(resolve(runtime, 'writer.lock'), 'utf8'));
    assert(Number.isSafeInteger(owner) && owner > 0);
    urlObservedBeforeSignal = stdout.includes(url);
    if (item.trigger === 'http-ready') assert.equal(urlObservedBeforeSignal, true);
    for (const signal of item.signals) process.kill(owner, signal);
    outcome = await closed;
  } finally {
    watcher.close();
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
  await writeFile(resolve(directory, 'stdout.txt'), stdout);
  await writeFile(resolve(directory, 'stderr.txt'), stderr);
  if (metadata)
    await writeFile(
      resolve(directory, 'configuration.json'),
      `${JSON.stringify(metadata, null, 2)}\n`,
    );
  assert.deepEqual(outcome, [0, null]);
  await assert.rejects(access(resolve(runtime, 'writer.lock')), { code: 'ENOENT' });
  await assert.rejects(fetch(`${url}/api/config`, { signal: AbortSignal.timeout(3000) }));
  assert.throws(() => process.kill(owner, 0), { code: 'ESRCH' });
  assert.throws(() => process.kill(child.pid, 0), { code: 'ESRCH' });
  assert(!/unhandled|unobserved/i.test(stderr));
  const result = {
    ...item,
    owner,
    childPid: child.pid,
    urlObservedBeforeSignal,
    urlObservedBeforeExit: stdout.includes(url),
    exitCode: 0,
    writerReleased: true,
    listenerClosed: true,
    ownedProcessesAbsent: true,
  };
  results.push(result);
  await writeFile(resolve(directory, 'acceptance.json'), `${JSON.stringify(result, null, 2)}\n`);
}
for (const source of hashes) assert.equal(hash(await readFile(source.path)), source.sha256);
await writeFile(
  resolve(output, 'acceptance.json'),
  `${JSON.stringify(
    {
      entry,
      sources: hashes,
      results,
      modelCalls: 0,
      policyCalls: 0,
      environmentAllocations: 0,
      scope:
        'Actual configured native CLI, signals and process/HTTP/journal ownership; no task execution.',
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(
  `${JSON.stringify({ output, cases: results.length, resourcesReleased: true })}\n`,
);
