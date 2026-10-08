import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { Context } from '@deepseek-ai/cordis';
import { ContractValidator } from '@edh/contracts';
import { LocalImageStore } from '@edh/storage';
import { createNativeWorkerEnvironment } from '../apps/server/src/native-worker.ts';
import { validateNativeWorkerConfiguration } from '../apps/server/src/native-worker-configuration.ts';

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    python: { type: 'string' },
    output: { type: 'string' },
    'mutate-caller': { type: 'boolean', default: false },
    'startup-file-error': { type: 'boolean', default: false },
    'async-startup': { type: 'boolean', default: false },
  },
});
assert(values.config && values.output);
assert(!values['async-startup'] || values['startup-file-error']);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const childPath = relative(resolve(root, '.local/work'), output);
assert(
  childPath && !isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`),
);
const configurationPath = resolve(values.config);
const configurationSource = await readFile(configurationPath);
const original = JSON.parse(configurationSource).worker;
assert(original && ['behavior', 'robotwin'].includes(original.provider));
assert.equal(original.profileCleanup, undefined);
const schemaPath = resolve(root, 'harness/contracts/schema/physical.schema.json');
const validator = new ContractValidator(JSON.parse(await readFile(schemaPath, 'utf8')));
validateNativeWorkerConfiguration(original, validator);
await mkdir(output, { recursive: false });
const records = resolve(output, 'policy-records');
await mkdir(records);
const missingSource = resolve(output, 'uninstalled-source');
assert.equal(existsSync(missingSource), false);
const missingRecord = resolve(output, 'uncreated-startup-record.json');
assert.equal(existsSync(missingRecord), false);
const sources = await Promise.all(
  [
    configurationPath,
    schemaPath,
    resolve(root, 'apps/server/src/native-worker-configuration.ts'),
    resolve(root, 'apps/server/src/native-worker.ts'),
    resolve(root, 'apps/server/src/native-worker-transport.ts'),
    resolve(root, 'harness/physical-runtime/src/physical_harness/execution/worker.py'),
    resolve(root, 'harness/physical-runtime/src/physical_harness/execution/worker_transport.py'),
    resolve(root, 'harness/physical-runtime/src/physical_harness/execution/policy_records.py'),
    resolve(root, 'scripts/check-worker-host-offline.mjs'),
  ].map(async (path) => ({
    path,
    sha256: createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
  })),
);
const context = new Context();
let processId;
let errorMessage;
let resourceReleaseConfirmed;
try {
  await context.plugin(LocalImageStore, { directory: resolve(output, 'images') });
  const configuration = {
    ...original,
    command: [
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
      EDH_POLICY_REQUEST_RECORD_DIR: records,
    },
    transportFd: 3,
    sourceRoot: missingSource,
    schemaPath,
    initializeTimeoutMs: 10000,
    closeTimeoutMs: 10000,
    onProcessStarted(pid) {
      assert.equal(processId, undefined);
      processId = pid;
      if (values['startup-file-error']) {
        if (values['async-startup']) return readFile(missingRecord).then(() => {});
        readFileSync(missingRecord);
      }
    },
  };
  const environment = createNativeWorkerEnvironment(
    configuration,
    { images: context.attachments },
    validator,
  );
  if (values['mutate-caller']) {
    configuration.command[0] = resolve(output, 'absent-caller-executable');
    configuration.cwd = resolve(output, 'absent-caller-directory');
    configuration.env.PYTHONPATH = resolve(output, 'absent-caller-pythonpath');
    configuration.sourceRoot = resolve(output, 'changed-caller-source');
    configuration.sceneConfiguration = { __preallocation_probe__: Number.POSITIVE_INFINITY };
  }
  await assert.rejects(environment, (error) => {
    assert(error instanceof Error);
    assert(!(error instanceof AggregateError));
    if (values['startup-file-error']) {
      assert.equal(error.code, 'ENOENT');
      assert.equal(error.path, missingRecord);
    } else {
      assert.match(error.message, /Native worker FileNotFoundError/);
      assert(error.message.includes(missingSource));
    }
    errorMessage = error.message;
    return true;
  });
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
  resourceReleaseConfirmed = true;
  assert.deepEqual(await readdir(records), []);
  assert.equal(existsSync(missingSource), false);
} finally {
  await context.fiber.dispose();
}
for (const source of sources) {
  assert.equal(
    createHash('sha256')
      .update(await readFile(source.path))
      .digest('hex'),
    source.sha256,
  );
}
assert.equal(createHash('sha256').update(configurationSource).digest('hex'), sources[0].sha256);
await writeFile(
  resolve(output, 'acceptance.json'),
  `${JSON.stringify(
    {
      schemaVersion: 'edh.worker_host_cpu.v1',
      recordedAt: new Date().toISOString(),
      provider: original.provider,
      nativeTaskId: original.nativeTaskId,
      processId,
      errorMessage,
      resourceReleaseConfirmed,
      imageContextDisposed: true,
      recordingProbeRemoved: true,
      callerMutationChecked: values['mutate-caller'],
      startupFileErrorChecked: values['startup-file-error'],
      asynchronousStartupObserver: values['async-startup'],
      processGroupAbsent: process.platform !== 'win32',
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
