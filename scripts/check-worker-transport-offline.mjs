import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    python: { type: 'string' },
    output: { type: 'string' },
  },
});
assert(
  values.output,
  'Usage: check-worker-transport-offline.mjs --output .local/work/<new-directory> [--python PATH]',
);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const childPath = relative(resolve(root, '.local/work'), output);
assert(
  childPath && !isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`),
);
await mkdir(output, { recursive: false });
const python = resolve(values.python ?? resolve(root, '.venv/bin/python'));
const sourcePaths = [
  'harness/physical-runtime/src/physical_harness/execution/worker.py',
  'harness/physical-runtime/src/physical_harness/execution/worker_transport.py',
  'harness/physical-runtime/src/physical_harness/execution/policy_records.py',
  'harness/physical-runtime/src/physical_harness/execution/native_device.py',
  'scripts/check-worker-transport-offline.mjs',
];
const sources = await Promise.all(
  sourcePaths.map(async (path) => ({
    path,
    sha256: createHash('sha256')
      .update(await readFile(resolve(root, path)))
      .digest('hex'),
  })),
);
const cases = [];

function worker(name, diagnostic = false) {
  const started = performance.now();
  const environment = {
    ...process.env,
    PYTHONPATH: resolve(root, 'harness/physical-runtime/src'),
    PYTHONDONTWRITEBYTECODE: '1',
    CUDA_VISIBLE_DEVICES: '',
  };
  delete environment.EDH_WORKER_TRACE_AFTER_S;
  if (diagnostic) environment.EDH_WORKER_TRACE_AFTER_S = '1';
  const child = spawn(python, ['-m', 'physical_harness.execution.worker'], {
    cwd: root,
    env: environment,
    stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
  });
  const responses = [];
  const responseWaiters = [];
  let stdout = '';
  let stderr = '';
  let stdinError;
  let parseError;
  const channel = createInterface({ input: child.stdio[3], crlfDelay: Infinity });
  channel.on('line', (line) => {
    try {
      responses.push(JSON.parse(line));
      for (const notify of responseWaiters.splice(0)) notify();
    } catch (error) {
      parseError = error;
    }
  });
  child.stdout.on('data', (data) => {
    stdout += data.toString('utf8');
  });
  child.stderr.on('data', (data) => {
    stderr += data.toString('utf8');
  });
  child.stdin.on('error', (error) => {
    stdinError = error;
  });
  const exited = new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolveExit({ code, signal }));
  });
  const timeout = globalThis.setTimeout(() => {
    child.kill('SIGKILL');
  }, 10000);

  async function send(payload) {
    return await new Promise((resolveWrite) => {
      child.stdin.write(payload, (error) => resolveWrite(error?.code ?? null));
    });
  }

  async function waitResponses(count) {
    while (responses.length < count) {
      const remaining = 9000 - (performance.now() - started);
      assert(remaining > 0, `${name}: response deadline expired`);
      const changed = new Promise((resolveChanged) => responseWaiters.push(resolveChanged));
      const deadline = new AbortController();
      try {
        const state = await Promise.race([
          changed.then(() => 'response'),
          exited.then(() => 'exit'),
          delay(remaining, undefined, { signal: deadline.signal }).then(() => 'timeout'),
        ]);
        assert.equal(state, 'response', `${name}: worker exited or timed out before all responses`);
      } finally {
        deadline.abort();
      }
    }
  }

  async function finish() {
    try {
      const result = await exited;
      assert.equal(result.signal, null, `${name}: worker required forced termination`);
      assert.equal(stdout, '', `${name}: protocol output reached stdout`);
      assert.equal(parseError, undefined, `${name}: invalid JSON protocol output`);
      assert(
        !/Task exception was never retrieved|Future exception was never retrieved|ResourceWarning/.test(
          stderr,
        ),
      );
      await writeFile(resolve(output, `${name}.stderr.txt`), stderr, { flag: 'wx' });
      return {
        name,
        pid: child.pid,
        ...result,
        elapsedMs: performance.now() - started,
        responses,
        stdinError: stdinError?.code ?? null,
        stderr,
      };
    } finally {
      globalThis.clearTimeout(timeout);
      channel.close();
      child.stdin.destroy();
    }
  }

  return { child, send, waitResponses, finish };
}

async function reject(name, payload, pattern) {
  const instance = worker(name);
  const writeError = await instance.send(payload);
  const result = await instance.finish();
  assert.notEqual(result.code, 0, `${name}: invalid request was accepted`);
  assert.match(result.stderr, pattern);
  assert.equal(result.responses.length, 0);
  const { stderr, ...record } = result;
  cases.push({ ...record, writeError, stdinHeldOpenUntilExit: true });
}

const normal = worker('normal');
assert.equal(
  await normal.send(`${JSON.stringify({ id: 'close-1', op: 'close', args: {} })}\n`),
  null,
);
await normal.waitResponses(1);
assert.deepEqual(normal.child.spawnargs.slice(-2), ['-m', 'physical_harness.execution.worker']);
await normal.send(`${JSON.stringify({ id: 'capture-1', op: 'capture', args: {} })}\n`);
await normal.waitResponses(2);
await normal.send(`${JSON.stringify({ id: 'unknown-1', op: 'unknown', args: {} })}\n`);
await normal.waitResponses(3);
await normal.send(`${JSON.stringify({ id: 'arguments-1', op: 'close', args: [] })}\n`);
await normal.waitResponses(4);
const batch = Array.from({ length: 20 }, (_, index) => ({
  id: `batch-${index}`,
  op: 'close',
  args: {},
}));
await normal.send(batch.map((request) => `${JSON.stringify(request)}\n`).join(''));
await normal.waitResponses(24);
normal.child.stdin.end();
const normalResult = await normal.finish();
assert.equal(normalResult.code, 0);
assert.deepEqual(normalResult.responses[0], { id: 'close-1', result: { closed: true } });
assert.deepEqual(normalResult.responses[1], {
  id: 'capture-1',
  error: {
    type: 'ValueError',
    message: 'Capture requires the current session task identity.',
  },
});
assert.deepEqual(normalResult.responses[2], {
  id: 'unknown-1',
  error: {
    type: 'ValueError',
    message: 'Unknown native worker operation.',
  },
});
assert.deepEqual(normalResult.responses[3], {
  id: 'arguments-1',
  error: {
    type: 'ValueError',
    message: 'Expected a JSON object.',
  },
});
for (const request of batch) {
  assert.deepEqual(
    normalResult.responses.find((response) => response.id === request.id),
    {
      id: request.id,
      result: { closed: true },
    },
  );
}
const { stderr: normalStderr, ...normalRecord } = normalResult;
assert.equal(normalStderr, '');
cases.push(normalRecord);

const diagnostic = worker('diagnostic', true);
await diagnostic.send('{"id":"diagnostic-ready","op":"close","args":{}}\n');
await diagnostic.waitResponses(1);
await delay(1200);
diagnostic.child.stdin.end();
const diagnosticResult = await diagnostic.finish();
assert.equal(diagnosticResult.code, 0);
assert.match(diagnosticResult.stderr, /Worker coroutine/);
const { stderr: diagnosticStderr, ...diagnosticRecord } = diagnosticResult;
cases.push(diagnosticRecord);

const boundary = worker('exact-byte-boundary');
const message = Buffer.from('{"id":"byte-boundary","op":"close","args":{}}');
await boundary.send(
  Buffer.concat([message, Buffer.alloc(32 * 1024 * 1024 - message.length, ' '), Buffer.from('\n')]),
);
await boundary.waitResponses(1);
boundary.child.stdin.end();
const boundaryResult = await boundary.finish();
assert.equal(boundaryResult.code, 0);
assert.deepEqual(boundaryResult.responses, [{ id: 'byte-boundary', result: { closed: true } }]);
const { stderr: boundaryStderr, ...boundaryRecord } = boundaryResult;
assert.equal(boundaryStderr, '');
cases.push(boundaryRecord);

await reject('malformed-json', '{\n', /JSONDecodeError/);
await reject(
  'nonfinite-json',
  '{"id":"nan","op":"close","args":{"value":NaN}}\n',
  /nonfinite JSON constant/,
);
await reject('invalid-utf8', Buffer.from([255, 10]), /UnicodeDecodeError/);
await reject('missing-identity', '{"op":"close"}\n', /Invalid native worker request envelope/);
await reject('nonobject-envelope', '[]\n', /Invalid native worker request envelope/);
await reject(
  'blank-identity',
  '{"id":" ","op":"close"}\n',
  /Invalid native worker request identity/,
);
await reject(
  'unexpected-field',
  '{"id":"extra","op":"close","extra":true}\n',
  /Invalid native worker request envelope/,
);
const duplicate = `${JSON.stringify({ id: 'duplicate', op: 'close', args: {} })}\n`;
await reject('active-duplicate', duplicate + duplicate, /request identity is already active/);
await reject(
  'oversized-line',
  Buffer.alloc(32 * 1024 * 1024 + 3, ' '),
  /Separator is not found, and chunk exceed the limit|exceeds the transport bound/,
);

const disconnected = worker('output-disconnected');
await once(disconnected.child, 'spawn');
disconnected.child.stdio[3].destroy();
await disconnected.send('{"id":"closed-output","op":"close","args":{}}\n');
const disconnectedResult = await disconnected.finish();
assert.notEqual(disconnectedResult.code, 0);
assert.match(disconnectedResult.stderr, /BrokenPipeError|ConnectionResetError/);
const { stderr: disconnectedStderr, ...disconnectedRecord } = disconnectedResult;
cases.push({ ...disconnectedRecord, stdinHeldOpenUntilExit: true });

for (const source of sources) {
  assert.equal(
    createHash('sha256')
      .update(await readFile(resolve(root, source.path)))
      .digest('hex'),
    source.sha256,
  );
}
const report = {
  schemaVersion: 'edh.worker_transport_cpu.v1',
  recordedAt: new Date().toISOString(),
  python,
  sources,
  cases,
  sourceHashesUnchanged: true,
  nativeWorkerProcesses: cases.length,
  environmentAllocationPerformed: false,
  modelInferencePerformed: false,
  physicalControlPerformed: false,
  cudaVisibleDevices: '',
};
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(report, null, 2)}\n`, {
  flag: 'wx',
});
process.stdout.write(`${resolve(output, 'acceptance.json')}\n`);
