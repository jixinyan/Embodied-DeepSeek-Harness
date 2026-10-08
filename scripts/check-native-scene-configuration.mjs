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
import { readNativeWorkspaceConfiguration } from '../examples/deployments/native-workspace.mjs';

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
const context = new Context();
const processes = [];
const originals = [];
const results = [];
try {
  await context.plugin(LocalImageStore, { directory: resolve(output, 'images') });
  for (const { settings: deployment } of settings.deployments) {
    for (const [profileId, profile] of Object.entries(deployment.profiles)) {
      const original = profile.worker;
      const parsed = nativeWorkerConfigurationSchema.parse(original);
      assert.deepEqual(parsed.sceneConfiguration, original.sceneConfiguration);
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
      workerProcessesStarted: processes,
      imageContextDisposed: true,
      modelCalls: 0,
      policyCalls: 0,
      environmentAllocations: 0,
      scope:
        'Actual configured scene data and native preallocation failures; no simulator or inference.',
    },
    null,
    2,
  )}\n`,
  { flag: 'wx' },
);
process.stdout.write(
  `${JSON.stringify({ output, profiles: originals.length, rejectedCases: results.length })}\n`,
);
