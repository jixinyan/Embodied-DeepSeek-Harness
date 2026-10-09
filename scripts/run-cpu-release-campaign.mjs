import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  accessSync,
  closeSync,
  constants,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';

const { values } = parseArgs({
  options: { config: { type: 'string' }, output: { type: 'string' } },
});
assert(values.config && values.output, 'Supply --config and a new --output directory.');
const root = resolve(import.meta.dirname, '..');
assert.notEqual(process.platform, 'win32', 'CPU process-group diagnostics require POSIX.');
const configurationPath = resolve(values.config);
const configuration = z
  .object({
    schemaVersion: z.literal('edh.cpu_release.v1'),
    packageManagerCommand: z.array(z.string().min(1)).min(1).max(16),
    python: z.string().min(1),
    workspace: z.string().min(1),
    workerConfiguration: z.string().min(1),
    policyRequest: z.string().min(1),
    transportRequest: z.string().min(1),
    policyTelemetry: z.string().min(1),
    journalDirectories: z.array(z.string().min(1)).min(1).max(8),
    checkpointAuditConfiguration: z.string().min(1).optional(),
  })
  .strict()
  .parse(JSON.parse(readFileSync(configurationPath, 'utf8')));
const path = (value) => resolve(dirname(configurationPath), value);
const requestedOutput = resolve(values.output);
const output = resolve(realpathSync(dirname(requestedOutput)), basename(requestedOutput));
const childPath = relative(resolve(root, '.local/work'), output);
assert(
  childPath && !isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`),
);
const python = path(configuration.python);
accessSync(python, constants.X_OK);
const workspace = path(configuration.workspace);
const worker = path(configuration.workerConfiguration);
const request = path(configuration.policyRequest);
const transportRequest = path(configuration.transportRequest);
const telemetry = path(configuration.policyTelemetry);
const journals = configuration.journalDirectories.map(path);
const checkpointAudit = configuration.checkpointAuditConfiguration
  ? path(configuration.checkpointAuditConfiguration)
  : undefined;
const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const inputs = [
  configurationPath,
  workspace,
  worker,
  request,
  transportRequest,
  telemetry,
  ...journals.map((directory) => resolve(directory, 'records.jsonl')),
  ...(checkpointAudit ? [checkpointAudit] : []),
];
const sources = [...new Set(inputs)].map((path) => ({ path, sha256: digest(path) }));
mkdirSync(output, { recursive: false, mode: 0o700 });
const environment = {
  ...process.env,
  CUDA_VISIBLE_DEVICES: '',
  EDH_NVIDIA_EGL_PROFILE: '0',
  EDH_PYTHON: python,
  PYTHONPATH: resolve(root, 'harness/physical-runtime/src'),
  PYTHONDONTWRITEBYTECODE: '1',
  TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.runtime.json'),
};
const [packageManager, ...packageManagerArguments] = configuration.packageManagerCommand;
const jobs = [
  { id: 'source', executable: packageManager, args: [...packageManagerArguments, 'check'] },
];
const add = (id, script, args) =>
  jobs.push({
    id,
    executable: script.endsWith('.py') ? python : process.execPath,
    args: [
      ...(script.endsWith('.py') ? [] : ['--import', 'tsx']),
      `scripts/${script}`,
      ...args,
      '--output',
      resolve(output, id),
    ],
  });
add('worker-transport', 'check-worker-transport-offline.mjs', ['--python', python]);
add('worker-client', 'check-worker-client-offline.mjs', ['--python', python, '--config', worker]);
add('scene-configuration', 'check-native-scene-configuration.mjs', ['--config', workspace]);
for (const [id, options] of [
  ['worker-host', []],
  ['worker-host-mutation', ['--mutate-caller']],
  ['worker-host-observer', ['--startup-file-error']],
  ['worker-host-async-observer', ['--startup-file-error', '--async-startup']],
])
  add(id, 'check-worker-host-offline.mjs', ['--python', python, '--config', worker, ...options]);
add('device-owner', 'check-native-device-owner-offline.py', []);
add('session-owner', 'check-native-session-owner-offline.py', []);
add('action-gate', 'check-action-gate-owner-offline.py', ['--request', request]);
add('rollout', 'check-rollout-failure-offline.py', ['--request', request]);
add('inference-owner', 'check-policy-owner-offline.py', ['--request', request]);
add('policy-client', 'check-policy-client-owner-offline.py', ['--request', request]);
add('policy-transport', 'check-policy-transport-offline.py', [
  '--request',
  transportRequest,
  '--telemetry',
  telemetry,
  '--schema',
  resolve(root, 'harness/contracts/schema/physical.schema.json'),
]);
add('policy-startup', 'check-policy-startup-offline.py', [
  '--request',
  request,
  '--python',
  python,
]);
add('perception-startup', 'check-perception-startup-offline.py', ['--python', python]);
add('service-startup', 'check-service-startup-owner-offline.mjs', ['--workspace', workspace]);
add('console-startup', 'check-native-startup-offline.mjs', ['--config', workspace]);
for (const provider of ['behavior', 'robocasa', 'robodojo', 'robotwin'])
  add(`console-startup-${provider}`, 'check-native-startup-offline.mjs', [
    '--config',
    workspace,
    '--provider',
    provider,
  ]);
const journalArgs = journals.flatMap((directory) => ['--data-directory', directory]);
add('context', 'check-recorded-context.mjs', journalArgs);
add('visual-context', 'check-recorded-visual-context.mjs', journalArgs);
add('readiness', 'check-native-workspace-readiness.mjs', ['--config', workspace]);
if (checkpointAudit) {
  add('policy-inputs', 'check-policy-inputs-offline.py', ['--configuration', checkpointAudit]);
  add('policy-outputs', 'check-policy-outputs-offline.py', ['--configuration', checkpointAudit]);
  add('gr00t-actions', 'check-gr00t-actions-offline.py', ['--configuration', checkpointAudit]);
  add('checkpoint-audit', 'check-checkpoint-audit-offline.py', [
    '--configuration',
    checkpointAudit,
  ]);
  add('checkpoint-profiles', 'check-checkpoint-profiles-offline.mjs', [
    '--workspace',
    workspace,
    '--identities',
    resolve(output, 'checkpoint-audit/acceptance.json'),
  ]);
}
const implementation = [
  'scripts/run-cpu-release-campaign.mjs',
  ...jobs.slice(1).map((job) => job.args.find((arg) => arg.startsWith('scripts/'))),
];
const implementationHashes = [...new Set(implementation)].map((path) => ({
  path,
  sha256: digest(resolve(root, path)),
}));
const completed = [];
const interruption = new AbortController();
const receivedSignals = [];
const onSignal = (signal) => {
  receivedSignals.push(signal);
  if (!interruption.signal.aborted) {
    interruption.abort(new Error(`CPU campaign interrupted by ${signal}.`));
    console.log(JSON.stringify({ state: 'closing', signal, activeDiagnosticWillDrain: true }));
  }
};
process.on('SIGINT', onSignal);
process.on('SIGTERM', onSignal);
try {
  for (const job of jobs) {
    interruption.signal.throwIfAborted();
    console.log(JSON.stringify({ component: job.id, state: 'running' }));
    const stdout = openSync(resolve(output, `${job.id}.stdout.txt`), 'wx', 0o600);
    let stderr;
    let result;
    const processReceipt = resolve(output, `${job.id}.process.json`);
    try {
      stderr = openSync(resolve(output, `${job.id}.stderr.txt`), 'wx', 0o600);
      const child = spawn(job.executable, job.args, {
        cwd: root,
        env: environment,
        stdio: ['ignore', stdout, stderr],
        detached: true,
      });
      let spawnError;
      result = await new Promise((accept) => {
        child.once('error', (error) => {
          spawnError = error;
        });
        child.once('close', (status, signal) => {
          accept({ status, signal, error: spawnError });
        });
      });
      const deadline = AbortSignal.timeout(10_000);
      let processGroupReleased = child.pid === undefined;
      while (!processGroupReleased) {
        try {
          process.kill(-child.pid, 0);
        } catch (error) {
          if (error.code !== 'ESRCH') throw error;
          processGroupReleased = true;
        }
        if (!processGroupReleased) await delay(50, undefined, { signal: deadline });
      }
      writeFileSync(
        processReceipt,
        JSON.stringify(
          {
            pid: child.pid ?? null,
            exitCode: result.status,
            signal: result.signal,
            processGroupReleased,
          },
          null,
          2,
        ) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
    } finally {
      closeSync(stdout);
      if (stderr !== undefined) closeSync(stderr);
    }
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(
        `CPU component ${job.id} exited (code=${result.status}, signal=${result.signal}); inspect its retained stdout/stderr.`,
      );
    for (const source of sources) assert.equal(digest(source.path), source.sha256);
    for (const source of implementationHashes)
      assert.equal(digest(resolve(root, source.path)), source.sha256);
    const report =
      job.id === 'source'
        ? null
        : resolve(output, job.id, job.id === 'readiness' ? 'readiness.json' : 'acceptance.json');
    if (report) JSON.parse(readFileSync(report, 'utf8'));
    completed.push({
      id: job.id,
      exitCode: result.status,
      signal: result.signal,
      report,
      reportSha256: report ? digest(report) : null,
      processReceipt,
      processSha256: digest(processReceipt),
    });
    writeFileSync(resolve(output, 'completed.json'), JSON.stringify(completed, null, 2) + '\n', {
      mode: 0o600,
    });
    console.log(JSON.stringify({ component: job.id, state: 'passed' }));
  }
  interruption.signal.throwIfAborted();
  const report = {
    schemaVersion: 'edh.cpu_release_acceptance.v1',
    sources,
    implementation: implementationHashes,
    completed,
    cudaVisibleDevices: '',
    originalInputsUnchanged: true,
    ownedProcessGroupsReleased: true,
    scope:
      'Source checks, actual CPU process/thread/socket boundaries, original journal inspection and configured readiness. Loaded-model and physical-task acceptance use the native campaign.',
  };
  writeFileSync(resolve(output, 'acceptance.json'), JSON.stringify(report, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(JSON.stringify({ output, components: completed.length, state: 'passed' }));
} finally {
  process.off('SIGINT', onSignal);
  process.off('SIGTERM', onSignal);
  if (receivedSignals.length)
    writeFileSync(
      resolve(output, 'interruption.json'),
      JSON.stringify(
        {
          signals: receivedSignals,
          completed: completed.map((component) => component.id),
          finalAcceptancePublished: false,
          scope: 'The current CPU diagnostic drains before interrupted campaign admission stops.',
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
}
