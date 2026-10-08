import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { waitFor } from '../apps/server/src/managed-services.ts';

const { values } = parseArgs({
  options: { config: { type: 'string' }, output: { type: 'string' } },
});
assert(values.config && values.output, 'Supply an original --config and a new --output directory.');
assert.notEqual(process.platform, 'win32', 'CPU process-group diagnostics require POSIX.');
const root = resolve(import.meta.dirname, '..');
const configuration = resolve(values.config);
const output = resolve(values.output);
const childPath = relative(resolve(root, '.local/work'), output);
assert(
  childPath && !isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`),
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = await Promise.all(
  [configuration, resolve(root, 'scripts/run-cpu-release-campaign.mjs'), import.meta.filename].map(
    async (path) => ({ path, sha256: hash(await readFile(path)) }),
  ),
);
await mkdir(output, { recursive: false, mode: 0o700 });
const cases = [];
for (const signals of [['SIGTERM'], ['SIGINT'], ['SIGTERM', 'SIGINT', 'SIGTERM']]) {
  const name = signals.length === 1 ? signals[0].toLowerCase() : 'repeated-signals';
  const directory = resolve(output, name);
  let stdout = '';
  let stderr = '';
  const child = spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      resolve(root, 'scripts/run-cpu-release-campaign.mjs'),
      '--config',
      configuration,
      '--output',
      directory,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        CUDA_VISIBLE_DEVICES: '',
        EDH_NVIDIA_EGL_PROFILE: '0',
        TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.runtime.json'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout.setEncoding('utf8').on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.setEncoding('utf8').on('data', (chunk) => {
    stderr += chunk;
  });
  let exited;
  let processError;
  const closed = new Promise((accept) => {
    child.once('error', (error) => {
      processError = error;
    });
    child.once('close', (code, signal) => {
      exited = { code, signal };
      accept(exited);
    });
  });
  const deadline = AbortSignal.timeout(120_000);
  try {
    while (!stdout.includes('{"component":"source","state":"running"}')) {
      if (processError) throw processError;
      assert.equal(exited, undefined, 'The actual source diagnostic must start.');
      await delay(10, undefined, { signal: deadline });
    }
    for (const signal of signals) {
      assert(child.kill(signal));
      await delay(20, undefined, { signal: deadline });
    }
    const exit = await waitFor(closed, deadline);
    if (processError) throw processError;
    assert.equal(exit.code, 1);
    assert.equal(exit.signal, null);
    assert(stdout.includes('"activeDiagnosticWillDrain":true'));
    assert(stdout.includes('{"component":"source","state":"passed"}'));
    assert(!stdout.includes('"component":"worker-transport"'));
    assert(stderr.includes(`CPU campaign interrupted by ${signals[0]}.`));
    const interruption = JSON.parse(
      await readFile(resolve(directory, 'interruption.json'), 'utf8'),
    );
    assert.deepEqual(interruption.signals, signals);
    assert.deepEqual(interruption.completed, ['source']);
    assert.equal(interruption.finalAcceptancePublished, false);
    const completed = JSON.parse(await readFile(resolve(directory, 'completed.json'), 'utf8'));
    assert.deepEqual(
      completed.map((entry) => entry.id),
      ['source'],
    );
    const receiptBytes = await readFile(resolve(directory, 'source.process.json'));
    assert.equal(hash(receiptBytes), completed[0].processSha256);
    const receipt = JSON.parse(receiptBytes.toString('utf8'));
    assert.equal(receipt.exitCode, 0);
    assert.equal(receipt.signal, null);
    assert.equal(receipt.processGroupReleased, true);
    assert(receipt.pid > 0 && child.pid > 0);
    assert.throws(() => process.kill(-receipt.pid, 0), { code: 'ESRCH' });
    assert.throws(() => process.kill(child.pid, 0), { code: 'ESRCH' });
    await assert.rejects(access(resolve(directory, 'acceptance.json')), { code: 'ENOENT' });
    await assert.rejects(access(resolve(directory, 'worker-transport.stdout.txt')), {
      code: 'ENOENT',
    });
    const sourceOutput = await readFile(resolve(directory, 'source.stdout.txt'), 'utf8');
    assert(sourceOutput.includes('Verified 128 pinned DSH source files, 25 module bindings'));
    cases.push({ name, signals, exit, diagnostic: receipt, nextComponentNotStarted: true });
  } finally {
    if (!exited) {
      child.kill('SIGTERM');
      await waitFor(closed, AbortSignal.timeout(120_000));
    }
    await writeFile(resolve(directory, 'campaign.stdout.txt'), stdout, { flag: 'wx', mode: 0o600 });
    await writeFile(resolve(directory, 'campaign.stderr.txt'), stderr, { flag: 'wx', mode: 0o600 });
  }
}
for (const source of sources) assert.equal(hash(await readFile(source.path)), source.sha256);
const result = {
  sources,
  cases,
  gpuJobs: 0,
  modelCalls: 0,
  environmentAllocations: 0,
  scope: 'Actual configured source checks, campaign signals and POSIX process-group release.',
};
await writeFile(resolve(output, 'acceptance.json'), JSON.stringify(result, null, 2) + '\n', {
  flag: 'wx',
  mode: 0o600,
});
console.log(JSON.stringify({ output, cases: cases.length, state: 'passed' }));
