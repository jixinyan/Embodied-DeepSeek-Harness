import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { NativeWorkerTransport } from '../apps/server/src/native-worker-transport.ts';

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    python: { type: 'string' },
    output: { type: 'string' },
  },
});
assert(values.config && values.output);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const childPath = relative(resolve(root, '.local/work'), output);
assert(
  childPath && !isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`),
);
await mkdir(output, { recursive: false });
const configurationPath = resolve(values.config);
const original = JSON.parse(await readFile(configurationPath, 'utf8')).worker;
assert(original && original.profileCleanup === undefined);
const sourcePaths = [
  configurationPath,
  resolve(root, 'apps/server/src/native-worker.ts'),
  resolve(root, 'apps/server/src/native-worker-configuration.ts'),
  resolve(root, 'apps/server/src/native-worker-transport.ts'),
  resolve(root, 'harness/physical-runtime/src/physical_harness/execution/worker.py'),
  resolve(root, 'harness/physical-runtime/src/physical_harness/execution/worker_transport.py'),
  resolve(root, 'scripts/check-worker-client-offline.mjs'),
];
const sources = await Promise.all(
  sourcePaths.map(async (path) => ({
    path,
    sha256: createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
  })),
);
const cases = [];

function requireProcessAbsent(processId) {
  assert(Number.isSafeInteger(processId) && processId > 0);
  assert.throws(
    () => process.kill(processId, 0),
    (error) => error.code === 'ESRCH',
  );
  if (process.platform !== 'win32')
    assert.throws(
      () => process.kill(-processId, 0),
      (error) => error.code === 'ESRCH',
    );
}

function workerConfiguration(onProcessStarted, command) {
  return {
    ...original,
    command: command ?? [
      resolve(values.python ?? resolve(root, '.venv/bin/python')),
      '-m',
      'physical_harness.execution.worker',
    ],
    cwd: root,
    env: {
      PYTHONPATH: resolve(root, 'harness/physical-runtime/src'),
      PYTHONDONTWRITEBYTECODE: '1',
      CUDA_VISIBLE_DEVICES: '',
      EDH_NVIDIA_EGL_PROFILE: '0',
    },
    transportFd: 3,
    closeTimeoutMs: 10000,
    onProcessStarted,
  };
}

async function inspect(name, action, command, onProcessStarted) {
  let processId;
  let forcedTermination = false;
  const transport = await NativeWorkerTransport.create(
    workerConfiguration(async (pid) => {
      assert.equal(processId, undefined);
      processId = pid;
      await onProcessStarted?.(pid);
    }, command),
  );
  const watchdog = setTimeout(() => {
    forcedTermination = true;
    if (processId !== undefined) process.kill(processId, 'SIGKILL');
  }, 40000);
  const started = performance.now();
  let record;
  let closeError;
  try {
    record = await action(transport, () => processId);
  } finally {
    const closing = transport.close();
    assert.equal(transport.close(), closing);
    try {
      await closing;
    } catch (error) {
      closeError = error;
    } finally {
      clearTimeout(watchdog);
    }
  }
  assert.equal(forcedTermination, false);
  if (processId !== undefined) {
    requireProcessAbsent(processId);
  }
  assert.equal(Boolean(closeError), record.expectCloseError);
  if (closeError) assert(closeError instanceof AggregateError);
  cases.push({
    name,
    processId: processId ?? null,
    elapsedMs: performance.now() - started,
    ...record,
    closeError: closeError?.message ?? null,
    childProcessAbsent: true,
    processGroupAbsent: process.platform !== 'win32',
    forcedTermination,
  });
}

const startupRecord = resolve(output, 'startup-record.json');
await inspect(
  'async-startup-record',
  async (transport, processId) => {
    assert.deepEqual(JSON.parse(await readFile(startupRecord, 'utf8')), { pid: processId() });
    const receipt = await transport.request('close');
    assert.deepEqual(receipt, { closed: true });
    return { startupRecordPublished: true, receipt, expectCloseError: false };
  },
  undefined,
  async (pid) => {
    await writeFile(startupRecord, `${JSON.stringify({ pid })}\n`, { flag: 'wx' });
  },
);

await inspect('operation-errors-and-batch', async (transport) => {
  const errors = await Promise.allSettled(
    Array.from({ length: 20 }, () => transport.request('unknown')),
  );
  for (const outcome of errors) {
    assert.equal(outcome.status, 'rejected');
    assert.match(
      outcome.reason.message,
      /^Native worker ValueError: Unknown native worker operation\.$/,
    );
  }
  assert.equal(transport.disconnected, false);
  for (const timeoutMs of [0, -1, 1.5, 1800001, NaN])
    assert.throws(() => transport.request('close', {}, { timeoutMs }), /timeout is invalid/);
  assert.throws(
    () => transport.request('unknown', { payload: 'x'.repeat(32 * 1024 * 1024) }),
    /request exceeds the transport bound/,
  );
  const receipt = await transport.request('close');
  assert.deepEqual(receipt, { closed: true });
  return { operationErrors: errors.length, receipt, expectCloseError: false };
});

await inspect('finite-json-request-admission', async (transport) => {
  const invalidArguments = [
    { value: JSON.parse('1e400') },
    { value: JSON.parse('-1e400') },
    { nested: [0, { value: Number.POSITIVE_INFINITY }] },
    { value: NaN },
    { value: undefined },
    { value: 1n },
    { value: JSON.stringify },
    { value: new Date('2026-10-08T00:00:00Z') },
    { value: new Map([['value', 1]]) },
    { value: new Set([1]) },
    { value: new Uint8Array([1]) },
    { value: Symbol('native-request') },
  ];
  for (const args of invalidArguments)
    assert.throws(transport.request.bind(transport, 'unknown', args), (error) => {
      assert.equal(error.name, 'ZodError');
      assert(error.issues.every((issue) => issue.path[0] === 'args'));
      return true;
    });
  const invalidOperations = ['', '   ', 'x'.repeat(65), null, 1, [], {}];
  for (const operation of invalidOperations)
    assert.throws(transport.request.bind(transport, operation), (error) => {
      assert.equal(error.name, 'ZodError');
      assert(error.issues.every((issue) => issue.path[0] === 'op'));
      return true;
    });
  assert.equal(transport.disconnected, false);
  const admissible = {
    scalars: [null, true, false, 0, -1, 0.5, 'native'],
    nested: { arrays: [[1, 2], {}], empty: [] },
  };
  await assert.rejects(
    transport.request('unknown', admissible),
    /^Error: Native worker ValueError: Unknown native worker operation\.$/,
  );
  assert.equal(transport.disconnected, false);
  const receipt = await transport.request('close');
  assert.deepEqual(receipt, { closed: true });
  return {
    rejectedArguments: invalidArguments.length,
    rejectedOperations: invalidOperations.length,
    transportRemainsConnected: true,
    originalOperationErrorPreserved: true,
    receipt,
    expectCloseError: false,
  };
});

await inspect('cancelled-read-drains-original-response', async (transport) => {
  const signal = new AbortController();
  const request = transport.request('capture', {}, { signal: signal.signal });
  const rejected = assert.rejects(request, /Native worker capture request cancelled/);
  signal.abort();
  await rejected;
  assert.equal(transport.disconnected, false);
  await assert.rejects(transport.request('unknown'), /Unknown native worker operation/);
  const receipt = await transport.request('close');
  assert.deepEqual(receipt, { closed: true });
  assert.equal(transport.disconnected, false);
  return { cancelledRead: true, receipt, expectCloseError: false };
});

await inspect('actual-request-deadline', async (transport) => {
  await assert.rejects(
    transport.request('unknown', {}, { timeoutMs: 1 }),
    /Native worker unknown timed out; device state is unknown/,
  );
  assert.equal(transport.disconnected, true);
  assert.throws(() => transport.request('close'), /timed out/);
  return { deadlineMs: 1, deviceState: 'unknown', expectCloseError: true };
});

await inspect('actual-child-termination', async (transport, processId) => {
  await assert.rejects(transport.request('unknown'), /Unknown native worker operation/);
  const results = Promise.allSettled([transport.request('capture'), transport.request('unknown')]);
  process.kill(processId(), 'SIGTERM');
  const outcomes = await results;
  for (const outcome of outcomes) {
    assert.equal(outcome.status, 'rejected');
    assert(outcome.reason instanceof Error);
  }
  assert.equal(transport.disconnected, true);
  return {
    signal: 'SIGTERM',
    requestErrors: outcomes.map((outcome) => outcome.reason.message),
    deviceState: 'unknown',
    expectCloseError: true,
  };
});

const missingExecutable = resolve(output, 'uninstalled-worker-python');
assert.equal(existsSync(missingExecutable), false);
await inspect(
  'actual-missing-executable',
  async (transport, processId) => {
    await assert.rejects(transport.request('close'), (error) => error.code === 'ENOENT');
    assert.equal(processId(), undefined);
    assert.equal(transport.disconnected, true);
    return { spawnError: 'ENOENT', deviceState: 'unknown', expectCloseError: true };
  },
  [missingExecutable, '-m', 'physical_harness.execution.worker'],
);

for (const asynchronous of [false, true]) {
  const name = asynchronous ? 'async-startup-file-error' : 'startup-file-error';
  const missingRecord = resolve(output, `${name}.json`);
  assert.equal(existsSync(missingRecord), false);
  let processId;
  let observedError;
  const started = performance.now();
  await assert.rejects(
    NativeWorkerTransport.create(
      workerConfiguration((pid) => {
        assert.equal(processId, undefined);
        processId = pid;
        if (asynchronous) return readFile(missingRecord).then(() => {});
        readFileSync(missingRecord);
      }),
    ),
    (error) => {
      assert.equal(error.code, 'ENOENT');
      assert.equal(error.path, missingRecord);
      observedError = { code: error.code, message: error.message };
      requireProcessAbsent(processId);
      return true;
    },
  );
  cases.push({
    name,
    processId,
    elapsedMs: performance.now() - started,
    observedError,
    childProcessAbsent: true,
    processGroupAbsent: process.platform !== 'win32',
    forcedTermination: false,
    releaseCompletedBeforeRejection: true,
    initializeRequested: false,
  });
}

for (const source of sources)
  assert.equal(
    createHash('sha256')
      .update(await readFile(source.path))
      .digest('hex'),
    source.sha256,
  );
await writeFile(
  resolve(output, 'acceptance.json'),
  `${JSON.stringify(
    {
      schemaVersion: 'edh.worker_client_cpu.v1',
      recordedAt: new Date().toISOString(),
      cases,
      sources,
      sourceHashesUnchanged: true,
      environmentAllocationPerformed: false,
      modelInferencePerformed: false,
      physicalControlPerformed: false,
      cudaVisibleDevices: '',
    },
    null,
    2,
  )}\n`,
  { flag: 'wx' },
);
process.stdout.write(`${resolve(output, 'acceptance.json')}\n`);
