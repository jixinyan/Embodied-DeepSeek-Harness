import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createConnection, createServer } from 'node:net';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { parse, stringify } from 'yaml';
import { z } from 'zod';
import { Context } from '@deepseek-ai/cordis';
import { LocalImageStore, LocalStore } from '@edh/storage';
import {
  createNativeDeploymentFactory,
  nativeDeploymentRoot,
  readNativeDeploymentConfiguration,
} from '../apps/server/src/native-deployment.mjs';
import {
  openNativeEnvironment,
  readNativeGptPolicyInputs,
} from '../apps/server/src/native-policy-environment.mjs';
import { readNativeWorkspaceConfiguration } from '../apps/server/src/native-workspace.mjs';

const { values } = parseArgs({
  options: { config: { type: 'string' }, output: { type: 'string' } },
});
assert(values.config && values.output, 'Supply an original-input --config and new --output.');
assert.equal(process.env.CUDA_VISIBLE_DEVICES, '', 'Disable CUDA for this CPU diagnostic.');
const root = resolve(nativeDeploymentRoot);
assert.equal(process.cwd(), root, 'Run this diagnostic from the repository root.');
const configurationPath = resolve(values.config);
const configuration = z
  .object({
    schemaVersion: z.literal('edh.native_policy_inputs.v1'),
    deploymentConfiguration: z.string().trim().min(1),
    profileId: z.string().trim().min(1),
    modelEndpoint: z.string().trim().min(1),
    demonstrationText: z.string().trim().min(1),
    demonstrationImages: z.array(z.string().trim().min(1)).length(2),
    workspaceConfiguration: z.string().trim().min(1),
  })
  .strict()
  .parse(JSON.parse(await readFile(configurationPath, 'utf8')));
const inputPath = (value) => resolve(dirname(configurationPath), value);
const requestedOutput = resolve(values.output);
const output = resolve(await realpath(dirname(requestedOutput)), basename(requestedOutput));
const outputPath = relative(resolve(root, '.local/work'), output);
assert(
  outputPath &&
    !isAbsolute(outputPath) &&
    outputPath !== '..' &&
    !outputPath.startsWith(`..${sep}`),
  'Keep diagnostic output in a new repository .local/work directory.',
);
const originalPath = inputPath(configuration.deploymentConfiguration);
const original = JSON.parse(await readFile(originalPath, 'utf8'));
const { profileId, modelEndpoint } = configuration;
const originalSettings = await readNativeDeploymentConfiguration('robodojo', {
  EDH_ROBODOJO_CONFIG: originalPath,
});
assert(originalSettings.profiles[profileId], 'Select an existing RoboDojo profile.');
assert(
  ['direct', 'hybrid'].includes(originalSettings.profiles[profileId].mode),
  'Select an original direct or hybrid GPT profile.',
);
const modelPath = resolve(original.modelConfiguration);
const originalModels = parse(await readFile(modelPath, 'utf8'));
const modelAlias = original.profiles[profileId].policyModel ?? originalModels.defaultModel;
assert.equal(originalModels.models[modelAlias].endpoint, modelEndpoint);
const textFile = inputPath(configuration.demonstrationText);
const imageFiles = configuration.demonstrationImages.map(inputPath);
const workspacePath = inputPath(configuration.workspaceConfiguration);
const originalWorkspace = JSON.parse(await readFile(workspacePath, 'utf8'));
await readNativeWorkspaceConfiguration({ EDH_NATIVE_WORKSPACE_CONFIG: workspacePath });
const workspaceModelPath = resolve(dirname(workspacePath), originalWorkspace.modelConfiguration);
const instructionsPath = resolve(root, 'examples/policies/robodojo-astra.md');
const sourcePaths = [
  configurationPath,
  originalPath,
  modelPath,
  textFile,
  ...imageFiles,
  workspacePath,
  workspaceModelPath,
  ...Object.values(originalWorkspace.deployments).map((entry) =>
    resolve(dirname(workspacePath), entry.configuration),
  ),
  instructionsPath,
  ...[
    'scripts/check-native-policy-inputs-offline.mjs',
    'apps/server/src/native-policy-environment.mjs',
    'apps/server/src/native-deployment.mjs',
    'apps/server/src/native-deployment-configuration.mjs',
    'apps/server/src/managed-services.ts',
    'harness/agent-runtime/storage/src/local-images.ts',
    'harness/agent-runtime/storage/src/dsh/attachment-local/image.ts',
    'harness/agent-runtime/storage/src/dsh/attachment-local/store.ts',
    'harness/agent-runtime/execution/src/gpt-policy.ts',
  ].map((path) => resolve(root, path)),
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = await Promise.all(
  [...new Set(sourcePaths)].map(async (path) => ({ path, sha256: hash(await readFile(path)) })),
);
assert((await readFile(textFile, 'utf8')).trim(), 'Supply nonempty original text.');
await mkdir(output, { recursive: false });
const endpoints = [createServer(), createServer()];
const ports = [];
try {
  for (const endpoint of endpoints) {
    endpoint.listen(0, '127.0.0.1');
    await once(endpoint, 'listening');
    ports.push(endpoint.address().port);
  }
} finally {
  for (const endpoint of endpoints) {
    if (endpoint.listening)
      await new Promise((accept, reject) =>
        endpoint.close((error) => (error ? reject(error) : accept())),
      );
  }
}
const [modelPort, consolePort] = ports;
const models = structuredClone(originalModels);
models.endpoints[modelEndpoint].baseURL = `http://127.0.0.1:${modelPort}/v1`;
models.endpoints[modelEndpoint].authentication = { type: 'none' };
const restoredModels = structuredClone(models);
restoredModels.endpoints[modelEndpoint] = originalModels.endpoints[modelEndpoint];
assert.deepEqual(restoredModels, originalModels);
const modelsFile = resolve(output, 'models.yaml');
await writeFile(modelsFile, stringify(models), { flag: 'wx' });
const workspaceRuntime = resolve(output, 'console-runtime');
const workspaceFile = resolve(output, 'workspace.json');
const workspace = {
  ...originalWorkspace,
  dataDirectory: workspaceRuntime,
  consolePort,
  modelConfiguration: workspaceModelPath,
  deployments: Object.fromEntries(
    Object.entries(originalWorkspace.deployments).map(([id, entry]) => [
      id,
      { ...entry, configuration: resolve(dirname(workspacePath), entry.configuration) },
    ]),
  ),
};
await writeFile(workspaceFile, `${JSON.stringify(workspace, null, 2)}\n`, { flag: 'wx' });
const service = {
  label: 'EDH configured CPU Console',
  command: [process.execPath, '--import', 'tsx', 'examples/deployments/native-workspace.mjs'],
  cwd: root,
  env: {
    CUDA_VISIBLE_DEVICES: '',
    TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.runtime.json'),
    EDH_NATIVE_WORKSPACE_CONFIG: workspaceFile,
  },
  readiness: {
    type: 'http_json',
    url: `http://127.0.0.1:${consolePort}/api/config`,
    schema: {
      type: 'object',
      required: ['deploymentId'],
      properties: { deploymentId: { const: 'native-workspace' } },
    },
  },
  startupTimeoutMs: 30000,
  probeTimeoutMs: 1000,
  probeIntervalMs: 100,
  shutdownTimeoutMs: 15000,
};
const emptyText = resolve(output, 'empty.txt');
const blankText = resolve(output, 'blank.txt');
const truncatedImage = resolve(output, 'truncated.png');
await writeFile(emptyText, '', { flag: 'wx' });
await writeFile(blankText, ' \n\t', { flag: 'wx' });
await writeFile(truncatedImage, (await readFile(imageFiles[0])).subarray(0, 40), { flag: 'wx' });
const checks = [];
const inputs = [];
const prepared = [];
const idleServices = (deployment) => {
  const status = deployment.serviceLifecycle.inspect();
  assert.deepEqual(status, [
    {
      id: 'console',
      label: service.label,
      state: 'idle',
      leases: 0,
      pid: null,
      startedAt: null,
      stoppedAt: null,
      error: null,
    },
  ]);
  return status;
};
const profile = async (name, mode, demonstration) => {
  const input = structuredClone(original);
  input.dataDirectory = resolve(output, name, 'native-runtime');
  input.modelConfiguration = modelsFile;
  input.managedServices = { console: service };
  input.serviceIds = ['console'];
  input.profiles[profileId].worker.sceneConfiguration.control_mode = mode;
  delete input.profiles[profileId].demonstration;
  if (demonstration) input.profiles[profileId].demonstration = demonstration;
  const restored = structuredClone(input);
  for (const field of ['dataDirectory', 'modelConfiguration', 'managedServices', 'serviceIds']) {
    if (Object.hasOwn(original, field)) restored[field] = original[field];
    else delete restored[field];
  }
  const originalProfile = original.profiles[profileId];
  if (Object.hasOwn(originalProfile.worker.sceneConfiguration, 'control_mode'))
    restored.profiles[profileId].worker.sceneConfiguration.control_mode =
      originalProfile.worker.sceneConfiguration.control_mode;
  else delete restored.profiles[profileId].worker.sceneConfiguration.control_mode;
  if (Object.hasOwn(originalProfile, 'demonstration'))
    restored.profiles[profileId].demonstration = originalProfile.demonstration;
  else delete restored.profiles[profileId].demonstration;
  assert.deepEqual(restored, original);
  const path = resolve(output, `${name}.json`);
  await writeFile(path, `${JSON.stringify(input, null, 2)}\n`, { flag: 'wx' });
  inputs.push({ name, path, sha256: hash(await readFile(path)) });
  const settings = await readNativeDeploymentConfiguration('robodojo', {
    EDH_ROBODOJO_CONFIG: path,
    EDH_MODEL_CONFIG: modelsFile,
  });
  return { settings, selected: settings.profiles[profileId] };
};
const withImages = async (name, options, work) => {
  const context = new Context();
  try {
    await context.plugin(LocalImageStore, {
      directory: resolve(output, name, 'images'),
      ...options,
    });
    return await work(context.attachments);
  } finally {
    await context.fiber.dispose();
  }
};
for (const [name, mode, demonstration] of [
  ['zero-shot', '0-shot', undefined],
  ['textual', 'textual-1-shot', { textFile }],
  ['visual-one', 'visual-1-shot', { textFile, imageFiles: [imageFiles[0]] }],
  ['visual-two', 'visual-1-shot', { textFile, imageFiles }],
]) {
  const { selected } = await profile(name, mode, demonstration);
  await withImages(name, {}, async (images) => {
    const result = await readNativeGptPolicyInputs(selected, images, new AbortController().signal);
    assert.equal(result.controlMode, mode);
    assert.equal(result.instructions, await readFile(instructionsPath, 'utf8'));
    const stored = [];
    if (mode === '0-shot') assert.equal(result.demonstration, undefined);
    else {
      assert.equal(result.demonstration.text, await readFile(textFile, 'utf8'));
      assert.equal(result.demonstration.images.length, demonstration.imageFiles?.length ?? 0);
      for (const [index, ref] of result.demonstration.images.entries()) {
        const image = await images.readImage(ref);
        assert.equal(ref.attachmentId, `sha256:${hash(image.data)}`);
        assert.equal(hash(image.data), hash(await readFile(demonstration.imageFiles[index])));
        stored.push({
          ref,
          sha256: hash(image.data),
          path: images.imageHostPath(ref),
          sourcePath: demonstration.imageFiles[index],
        });
      }
    }
    prepared.push({
      name,
      controlMode: mode,
      instructionsSha256: hash(result.instructions),
      ...(result.demonstration ? { textSha256: hash(result.demonstration.text) } : {}),
      images: stored,
    });
    checks.push({ name, result: 'admitted-original-file-content' });
  });
}
const invalidInputs = [
  [
    'missing-text',
    { textFile: resolve(output, 'absent.txt') },
    {},
    (error) => error.code === 'ENOENT',
  ],
  ['text-directory', { textFile: output }, {}, (error) => error.code === 'EISDIR'],
  [
    'empty-text',
    { textFile: emptyText },
    {},
    (error) => error.message === 'One-shot mode requires an explicit demonstration.',
  ],
  [
    'blank-text',
    { textFile: blankText },
    {},
    (error) => error.message === 'One-shot mode requires an explicit demonstration.',
  ],
  [
    'missing-image',
    { textFile, imageFiles: [resolve(output, 'absent.png')] },
    {},
    (error) => error.code === 'ENOENT',
  ],
  ['image-directory', { textFile, imageFiles: [output] }, {}, (error) => error.code === 'EISDIR'],
  [
    'invalid-image',
    { textFile, imageFiles: [textFile] },
    {},
    (error) => error.code === 'INVALID_IMAGE',
  ],
  [
    'truncated-image',
    { textFile, imageFiles: [truncatedImage] },
    {},
    (error) => error.code === 'INVALID_IMAGE',
  ],
  [
    'invalid-second-image',
    { textFile, imageFiles: [imageFiles[0], textFile] },
    {},
    (error) => error.code === 'INVALID_IMAGE',
  ],
  [
    'image-byte-limit',
    { textFile, imageFiles: [imageFiles[0]] },
    { maxImageBytes: 1 },
    (error) => /byte limit/.test(error.message),
  ],
  [
    'image-count-limit',
    { textFile, imageFiles },
    { maxImagesPerMessage: 1 },
    (error) => error.code === 'TOO_MANY_IMAGES',
  ],
  [
    'image-pixel-limit',
    { textFile, imageFiles: [imageFiles[0]] },
    { maxImagePixels: 1 },
    (error) => error.code === 'IMAGE_TOO_MANY_PIXELS',
  ],
];
for (const [name, demonstration, options, predicate] of invalidInputs) {
  for (const consumer of ['reader', 'factory']) {
    const id = `${consumer}-${name}`;
    const mode = demonstration.imageFiles ? 'visual-1-shot' : 'textual-1-shot';
    const { settings, selected } = await profile(id, mode, demonstration);
    await withImages(id, options, async (images) => {
      const signal = new AbortController().signal;
      const deployment = await createNativeDeploymentFactory(settings)({ images });
      let failure;
      try {
        await assert.rejects(
          consumer === 'reader'
            ? readNativeGptPolicyInputs(selected, images, signal)
            : deployment.launchProfiles[profileId].createEnvironment({
                signal,
                services: { images },
              }),
          (error) => {
            assert(predicate(error), `${id}: ${error.message}`);
            failure = { code: error.code ?? null, message: error.message };
            return true;
          },
        );
        const status = idleServices(deployment);
        await assert.rejects(access(images.root), { code: 'ENOENT' });
        await assert.rejects(access(settings.dataDirectory), { code: 'ENOENT' });
        checks.push({
          name: id,
          result: 'rejected-original-file-boundary',
          failure,
          status,
          imagesPublished: 0,
        });
      } finally {
        await deployment.serviceLifecycle.close();
      }
    });
  }
}
for (const mode of ['pre-aborted', 'file-read-timeout']) {
  const { settings } = await profile(mode, 'visual-1-shot', { textFile, imageFiles });
  await withImages(mode, {}, async (images) => {
    const deployment = await createNativeDeploymentFactory(settings)({ images });
    const controller = new AbortController();
    if (mode === 'pre-aborted')
      controller.abort(new Error('Native preparation cancelled by caller.'));
    const signal = mode === 'pre-aborted' ? controller.signal : AbortSignal.timeout(0);
    try {
      await assert.rejects(
        deployment.launchProfiles[profileId].createEnvironment({ signal, services: { images } }),
        (error) => {
          assert(signal.aborted);
          assert(
            error === signal.reason ||
              (error.name === 'AbortError' && error.cause === signal.reason),
          );
          return true;
        },
      );
      checks.push({
        name: mode,
        result: 'cancelled-before-service-acquisition',
        status: idleServices(deployment),
      });
    } finally {
      await deployment.serviceLifecycle.close();
    }
  });
}
const { settings, selected } = await profile('entry-guards', '0-shot');
await withImages('entry-guards', {}, async (images) => {
  const deployment = await createNativeDeploymentFactory(settings)({ images });
  try {
    for (const [name, input] of [
      ['missing-preparation', undefined],
      ['different-mode', { controlMode: 'textual-1-shot' }],
    ]) {
      await assert.rejects(
        openNativeEnvironment(
          settings,
          selected,
          deployment,
          { images },
          new AbortController().signal,
          input,
        ),
        /Native GPT policy inputs must match the selected profile/,
      );
      checks.push({
        name,
        result: 'rejected-before-host-gateway-worker',
        status: idleServices(deployment),
      });
    }
    const lease = await deployment.serviceLifecycle.acquire(
      ['console'],
      new AbortController().signal,
    );
    const state = deployment.serviceLifecycle.inspect()[0];
    try {
      assert.equal(state.state, 'ready');
      assert.equal(state.leases, 1);
      assert(state.pid > 0);
      const response = await fetch(service.readiness.url, { signal: AbortSignal.timeout(3000) });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).deploymentId, 'native-workspace');
    } finally {
      await lease.release();
    }
    const stopped = deployment.serviceLifecycle.inspect()[0];
    assert.equal(stopped.state, 'stopped');
    assert.equal(stopped.leases, 0);
    assert.equal(stopped.pid, null);
    assert.throws(() => process.kill(-state.pid, 0), { code: 'ESRCH' });
    const socket = createConnection({ host: '127.0.0.1', port: consolePort });
    try {
      await assert.rejects(once(socket, 'connect'), { code: 'ECONNREFUSED' });
    } finally {
      socket.destroy();
    }
    const journalPath = resolve(workspaceRuntime, 'records.jsonl');
    const journalHash = hash(await readFile(journalPath));
    const store = new LocalStore(workspaceRuntime);
    try {
      assert.equal([...store.scan('session:')].length, 0);
    } finally {
      await store.close();
    }
    assert.equal(hash(await readFile(journalPath)), journalHash);
    await assert.rejects(access(resolve(workspaceRuntime, 'writer.lock')), { code: 'ENOENT' });
    checks.push({
      name: 'actual-console-service',
      result: 'ready-and-released',
      pid: state.pid,
      port: consolePort,
      journalPath,
      journalHash,
      sessions: 0,
      processGroupReleased: true,
      writerReleased: true,
    });
  } finally {
    await deployment.serviceLifecycle.close();
  }
});
assert.equal(checks.length, 33);
for (const source of sources) assert.equal(hash(await readFile(source.path)), source.sha256);
for (const input of inputs) assert.equal(hash(await readFile(input.path)), input.sha256);
const report = {
  schemaVersion: 'edh.native_policy_inputs_acceptance.v1',
  cases: checks.length,
  checks,
  sources,
  inputs,
  prepared,
  inputManifest: configurationPath,
  originalPath,
  profileId,
  modelsFile,
  workspaceFile,
  originalModelsPath: modelPath,
  originalWorkspacePath: workspacePath,
  modelDerivativeFields: [
    `endpoints.${modelEndpoint}.baseURL`,
    `endpoints.${modelEndpoint}.authentication`,
  ],
  profileDerivativeFields: [
    'dataDirectory',
    'modelConfiguration',
    'managedServices',
    'serviceIds',
    `profiles.${profileId}.worker.sceneConfiguration.control_mode`,
    `profiles.${profileId}.demonstration`,
  ],
  workspaceDerivativeFields: [
    'dataDirectory',
    'consolePort',
    'modelConfiguration',
    'deployments.*.configuration',
  ],
  originalSourcesUnchanged: true,
  modelCalls: 0,
  gatewayAllocations: 0,
  workerAllocations: 0,
  simulatorAllocations: 0,
  gpuJobs: 0,
  scope:
    'Actual file preparation, original profile derivatives and production Console startup/shutdown; no model response or simulator execution.',
};
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(report, null, 2)}\n`, {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    cases: checks.length,
    preparedModes: prepared.length,
    sourceComparisons: sources.length,
    nativeAllocations: 0,
  }),
);
