import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { ZodError } from 'zod';
import { Context } from '@deepseek-ai/cordis';
import { ContractValidator } from '@edh/contracts';
import { LocalImageStore } from '@edh/storage';
import { createNativeWorkerEnvironment } from '../apps/server/src/native-worker.ts';
import {
  nativeWorkerConfigurationSchema,
  validateNativeWorkerConfiguration,
} from '../apps/server/src/native-worker-configuration.ts';
import { readNativeWorkspaceConfiguration } from '../apps/server/src/native-workspace.mjs';
import { readNativeDeploymentConfiguration } from '../apps/server/src/native-deployment.mjs';

const { values } = parseArgs({
  options: { config: { type: 'string' }, output: { type: 'string' } },
});
assert(values.config && values.output, 'Supply an original --config and a new --output directory.');
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const childPath = relative(resolve(root, '.local/work'), output);
assert(
  childPath && !isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`),
);
const configurationPath = resolve(values.config);
const settings = await readNativeWorkspaceConfiguration({
  ...process.env,
  EDH_NATIVE_WORKSPACE_CONFIG: configurationPath,
});
const schemaPath = resolve(root, 'harness/contracts/schema/physical.schema.json');
const validator = new ContractValidator(JSON.parse(await readFile(schemaPath, 'utf8')));
const sources = [
  configurationPath,
  resolve(dirname(configurationPath), settings.configuration.modelConfiguration),
  ...Object.values(settings.configuration.deployments).map((entry) =>
    resolve(dirname(configurationPath), entry.configuration),
  ),
  schemaPath,
  resolve(root, 'apps/server/src/native-worker-configuration.ts'),
  resolve(root, 'apps/server/src/native-worker.ts'),
  resolve(root, 'examples/deployments/native-live.mjs'),
  resolve(root, 'apps/server/src/native-deployment.mjs'),
  resolve(root, 'apps/server/src/native-deployment-configuration.mjs'),
  resolve(root, 'apps/server/src/native-policy-environment.mjs'),
  resolve(root, 'apps/server/src/native-workspace.mjs'),
  resolve(root, 'scripts/check-native-scene-configuration.mjs'),
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceHashes = await Promise.all(
  sources.map(async (path) => ({ path, sha256: hash(await readFile(path)) })),
);
await mkdir(output, { recursive: false });
const invalidValues = [
  ['positive-overflow', JSON.parse('1e400')],
  ['negative-overflow', JSON.parse('-1e400')],
  ['nested-array-overflow', [{ camera: [0, JSON.parse('1e400')] }]],
  ['nan', Number.NaN],
  ['undefined', undefined],
  ['bigint', 1n],
  ['function', JSON.stringify],
  ['date', new Date('2026-10-08T00:00:00Z')],
  ['map', new Map([['value', 1]])],
  ['set', new Set([1])],
  ['typed-array', new Uint8Array([1])],
  ['symbol', Symbol('invalid-scene-value')],
];
const invalidEndpoints = [
  '',
  'not-a-policy-endpoint',
  'ws://',
  'ws://[',
  'http://127.0.0.1:8018',
  'https://127.0.0.1:8018',
  'file:///workspace/checkpoints/policy',
  'ws://operator@127.0.0.1:8018',
  'ws://operator:embedded-credential@127.0.0.1:8018',
  'ws://127.0.0.1:8018/#fragment',
  null,
  1,
  false,
  [],
  {},
];
const context = new Context();
const processes = [];
const originals = [];
const results = [];
const endpointResults = [];
const consolePortResults = [];
const consolePortInputs = [];
const invalidConsolePorts = [
  ['boolean', true],
  ['null', null],
  ['text', '4323'],
  ['array', [4323]],
  ['object', {}],
  ['fractional', 4323.5],
  ['zero', 0],
  ['negative', -1],
  ['overflow', 65536],
];
const deploymentVariables = {
  robodojo: 'EDH_ROBODOJO_CONFIG',
  robotwin: 'EDH_ROBOTWIN_CONFIG',
  robocasa: 'EDH_NATIVE_WORKER_CONFIG',
  behavior: 'EDH_BEHAVIOR_CONFIG',
};
const modelConfiguration = resolve(
  dirname(configurationPath),
  settings.configuration.modelConfiguration,
);
const portInput = async (name, sourcePath, original, consolePort, fields = ['consolePort']) => {
  const derivative = { ...original, consolePort };
  if (consolePort === undefined) delete derivative.consolePort;
  const path = resolve(output, `${name}.json`);
  const bytes = `${JSON.stringify(derivative, null, 2)}\n`;
  await writeFile(path, bytes, { flag: 'wx' });
  consolePortInputs.push({ name, path, sourcePath, sha256: hash(bytes), fields });
  return path;
};
const preservedPortBindings = (actual, original) => {
  const profiles = (value) =>
    Object.fromEntries(
      Object.entries(value.profiles).map(([id, { entry, ...profile }]) => [
        id,
        {
          ...profile,
          entry: Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'consolePort')),
        },
      ]),
    );
  assert.deepEqual(profiles(actual), profiles(original));
  for (const field of [
    'provider',
    'managedServices',
    'modelConfiguration',
    'defaultModel',
    'teamFile',
    'roleRoot',
  ])
    assert.deepEqual(actual[field], original[field]);
};
for (const [deploymentId, entry] of Object.entries(settings.configuration.deployments)) {
  const prefix = `${deploymentId}-${entry.provider}`;
  const sourcePath = resolve(dirname(configurationPath), entry.configuration);
  const original = JSON.parse(await readFile(sourcePath, 'utf8'));
  const environment = {
    ...process.env,
    EDH_CONSOLE_PORT: undefined,
    EDH_MODEL_CONFIG: modelConfiguration,
    [deploymentVariables[entry.provider]]: sourcePath,
  };
  const baseline = await readNativeDeploymentConfiguration(entry.provider, environment);
  for (const [label, consolePort, expected] of [
    ['original', original.consolePort, baseline.port],
    ['omitted', undefined, baseline.selected.port],
    ['minimum', 1, 1],
    ['maximum', 65535, 65535],
  ]) {
    const name = `${prefix}-console-${label}`;
    const path = await portInput(name, sourcePath, original, consolePort);
    const admitted = await readNativeDeploymentConfiguration(entry.provider, {
      ...environment,
      [deploymentVariables[entry.provider]]: path,
    });
    assert.equal(admitted.port, expected);
    preservedPortBindings(admitted, baseline);
    consolePortResults.push({
      name,
      result: 'admitted',
      port: admitted.port,
      bindingsPreserved: true,
    });
  }
  for (const [label, consolePort] of invalidConsolePorts) {
    const name = `${prefix}-console-${label}`;
    const path = await portInput(name, sourcePath, original, consolePort);
    await assert.rejects(
      readNativeDeploymentConfiguration(entry.provider, {
        ...environment,
        [deploymentVariables[entry.provider]]: path,
      }),
      (error) => {
        assert(error instanceof ZodError);
        assert(error.issues.every((issue) => issue.path[0] === 'consolePort'));
        consolePortResults.push({ name, result: 'rejected', issues: error.issues });
        return true;
      },
    );
  }
  if (entry.provider !== 'robocasa') {
    const admitted = await readNativeDeploymentConfiguration(entry.provider, {
      ...environment,
      EDH_CONSOLE_PORT: '0',
    });
    assert.equal(admitted.port, baseline.port);
    preservedPortBindings(admitted, baseline);
    consolePortResults.push({
      name: `${prefix}-console-provider-scope`,
      result: 'admitted',
      port: admitted.port,
      bindingsPreserved: true,
    });
    continue;
  }
  for (const [label, override] of [
    ['original', String(baseline.port)],
    ['minimum', '1'],
    ['maximum', '65535'],
  ]) {
    const admitted = await readNativeDeploymentConfiguration(entry.provider, {
      ...environment,
      EDH_CONSOLE_PORT: override,
    });
    assert.equal(admitted.port, Number(override));
    preservedPortBindings(admitted, baseline);
    consolePortResults.push({
      name: `${prefix}-console-environment-${label}`,
      result: 'admitted',
      port: admitted.port,
      bindingsPreserved: true,
    });
  }
  for (const [label, override] of [
    ['null', null],
    ['boolean', true],
    ['array', []],
    ['object', {}],
    ['empty', ''],
    ['blank', ' '],
    ['zero', '0'],
    ['overflow', '65536'],
    ['fractional', '4323.5'],
  ])
    await assert.rejects(
      readNativeDeploymentConfiguration(entry.provider, {
        ...environment,
        EDH_CONSOLE_PORT: override,
      }),
      (error) => {
        assert(error instanceof ZodError);
        assert(error.issues.every((issue) => issue.path[0] === 'EDH_CONSOLE_PORT'));
        consolePortResults.push({
          name: `${prefix}-console-environment-${label}`,
          result: 'rejected',
          issues: error.issues,
        });
        return true;
      },
    );
  const path = await portInput(
    `${prefix}-console-invalid-with-override`,
    sourcePath,
    original,
    true,
  );
  await assert.rejects(
    readNativeDeploymentConfiguration(entry.provider, {
      ...environment,
      [deploymentVariables[entry.provider]]: path,
      EDH_CONSOLE_PORT: String(baseline.port),
    }),
    (error) => {
      assert(error instanceof ZodError);
      assert(error.issues.every((issue) => issue.path[0] === 'consolePort'));
      consolePortResults.push({
        name: `${prefix}-console-invalid-with-override`,
        result: 'rejected',
        issues: error.issues,
      });
      return true;
    },
  );
}
const originalWorkspace = JSON.parse(await readFile(configurationPath, 'utf8'));
const relocatedWorkspace = {
  ...originalWorkspace,
  modelConfiguration,
  dataDirectory: resolve(dirname(configurationPath), originalWorkspace.dataDirectory),
  deployments: Object.fromEntries(
    Object.entries(originalWorkspace.deployments).map(([id, entry]) => [
      id,
      { ...entry, configuration: resolve(dirname(configurationPath), entry.configuration) },
    ]),
  ),
};
for (const [label, consolePort] of [
  ['original', originalWorkspace.consolePort],
  ['minimum', 1],
  ['maximum', 65535],
  ...invalidConsolePorts,
  ['omitted', undefined],
]) {
  const name = `workspace-console-${label}`;
  const path = await portInput(name, configurationPath, relocatedWorkspace, consolePort, [
    'consolePort',
    'modelConfiguration',
    'dataDirectory',
    'deployments.*.configuration',
  ]);
  if (['original', 'minimum', 'maximum'].includes(label)) {
    const admitted = await readNativeWorkspaceConfiguration({
      ...process.env,
      EDH_NATIVE_WORKSPACE_CONFIG: path,
    });
    assert.equal(admitted.port, consolePort);
    const bindings = (deployments) =>
      deployments.map(({ id, settings: { validator, ...configuration } }) => ({
        id,
        settings: configuration,
      }));
    assert.deepEqual(bindings(admitted.deployments), bindings(settings.deployments));
    consolePortResults.push({
      name,
      result: 'admitted',
      port: admitted.port,
      bindingsPreserved: true,
    });
  } else {
    await assert.rejects(
      readNativeWorkspaceConfiguration({ ...process.env, EDH_NATIVE_WORKSPACE_CONFIG: path }),
      (error) => {
        assert(error instanceof ZodError);
        assert(error.issues.every((issue) => issue.path[0] === 'consolePort'));
        consolePortResults.push({ name, result: 'rejected', issues: error.issues });
        return true;
      },
    );
  }
}
try {
  await context.plugin(LocalImageStore, { directory: resolve(output, 'images') });
  for (const { settings: deployment } of settings.deployments) {
    for (const [profileId, profile] of Object.entries(deployment.profiles)) {
      const original = profile.worker;
      const parsed = nativeWorkerConfigurationSchema.parse(original);
      assert.deepEqual(parsed.sceneConfiguration, original.sceneConfiguration);
      assert.equal(parsed.policyUri, original.policyUri);
      assert.deepEqual(
        JSON.parse(JSON.stringify(parsed.sceneConfiguration)),
        JSON.parse(JSON.stringify(original.sceneConfiguration)),
      );
      const caller = structuredClone(original);
      const admitted = validateNativeWorkerConfiguration(caller, validator);
      const admittedBeforeMutation = structuredClone(admitted);
      for (const field of ['command', 'env', 'sceneConfiguration', 'catalog']) {
        assert.notEqual(admitted[field], caller[field]);
        assert(Object.isFrozen(admitted[field]));
      }
      assert(Object.isFrozen(admitted));
      const task = admitted.catalog.tasks[admitted.nativeTaskId];
      assert(Object.isFrozen(task));
      assert(Object.isFrozen(task.goal));
      caller.command[0] = process.execPath;
      caller.env.EDH_ADMISSION_PROBE = 'caller-update';
      caller.sceneConfiguration.__preallocation_probe__ = JSON.parse('1e400');
      caller.catalog.revision = 'caller-update';
      assert.deepEqual(admitted, admittedBeforeMutation);
      assert.throws(() => {
        admitted.sceneConfiguration.__preallocation_probe__ = null;
      }, TypeError);
      originals.push({
        provider: deployment.provider,
        profileId,
        sceneSha256: hash(JSON.stringify(original.sceneConfiguration)),
        parametersPreserved: true,
        jsonRoundTripPreserved: true,
        admittedConfigurationDetached: true,
        admittedConfigurationFrozen: true,
        callerMutationIsolated: true,
      });
      for (const [name, value] of invalidValues) {
        const configuration = {
          ...original,
          env: { ...original.env, CUDA_VISIBLE_DEVICES: '' },
          sceneConfiguration: { ...original.sceneConfiguration, __preallocation_probe__: value },
          onProcessStarted: (pid) => processes.push(pid),
        };
        const admission = nativeWorkerConfigurationSchema.safeParse(configuration);
        assert.equal(
          admission.success,
          false,
          `${deployment.provider}/${name} must fail admission.`,
        );
        const issues = admission.error.issues;
        assert(issues.every((issue) => issue.path[0] === 'sceneConfiguration'));
        await assert.rejects(
          createNativeWorkerEnvironment(configuration, { images: context.attachments }, validator),
          (error) => {
            assert(error instanceof ZodError);
            assert.deepEqual(error.issues, issues);
            return true;
          },
        );
        assert.deepEqual(processes, []);
        results.push({ provider: deployment.provider, profileId, name, issues });
      }
      for (const [index, policyUri] of invalidEndpoints.entries()) {
        const configuration = {
          ...original,
          policyUri,
          env: { ...original.env, CUDA_VISIBLE_DEVICES: '' },
          onProcessStarted: (pid) => processes.push(pid),
        };
        const admission = nativeWorkerConfigurationSchema.safeParse(configuration);
        assert.equal(admission.success, false);
        const issues = admission.error.issues;
        assert(issues.every((issue) => issue.path[0] === 'policyUri'));
        await assert.rejects(
          createNativeWorkerEnvironment(configuration, { images: context.attachments }, validator),
          (error) => {
            assert(error instanceof ZodError);
            assert.deepEqual(error.issues, issues);
            return true;
          },
        );
        assert.deepEqual(processes, []);
        endpointResults.push({ provider: deployment.provider, profileId, index, issues });
      }
    }
  }
} finally {
  await context.fiber.dispose();
}
for (const source of sourceHashes) assert.equal(hash(await readFile(source.path)), source.sha256);
await writeFile(
  resolve(output, 'acceptance.json'),
  `${JSON.stringify(
    {
      sources: sourceHashes,
      originals,
      results,
      endpointResults,
      consolePortResults,
      consolePortInputs,
      workerProcessesStarted: processes,
      imageContextDisposed: true,
      modelCalls: 0,
      policyCalls: 0,
      environmentAllocations: 0,
      scope:
        'Actual configured scene, policy endpoint and Console port admission before allocation; no simulator or inference.',
    },
    null,
    2,
  )}\n`,
  { flag: 'wx' },
);
process.stdout.write(
  `${JSON.stringify({ output, profiles: originals.length, rejectedCases: results.length, rejectedEndpointCases: endpointResults.length, consolePortCases: consolePortResults.length })}\n`,
);
