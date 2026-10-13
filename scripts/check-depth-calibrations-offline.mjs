import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { admitDepthIntrinsicsByCamera } from '@edh/perception';
import { startServer } from '../apps/server/src/index.ts';
import { prepareDeployment } from '../apps/server/src/deployment.ts';
import {
  readNativeWorkspaceConfiguration,
  createNativeWorkspaceFactory,
} from '../apps/server/src/native-workspace.mjs';

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    calibration: { type: 'string', multiple: true },
    output: { type: 'string' },
  },
});
assert(values.config && values.calibration?.length >= 2 && values.output);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const child = relative(resolve(root, '.local/work'), output);
assert(child && !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = new Map();
const original = async (file) => {
  const path = resolve(file);
  const bytes = await readFile(path);
  sources.set(path, hash(bytes));
  return bytes;
};
const configurationPath = resolve(values.config);
const configuration = JSON.parse((await original(configurationPath)).toString('utf8'));
await original(resolve(dirname(configurationPath), configuration.modelConfiguration));
for (const entry of Object.values(configuration.deployments))
  await original(resolve(dirname(configurationPath), entry.configuration));
const calibrations = await Promise.all(
  values.calibration.map(async (file) => {
    const path = resolve(file);
    const data = JSON.parse((await original(path)).toString('utf8'));
    const intrinsics = data.intrinsics ?? data;
    return {
      path,
      camera: data.camera ?? basename(dirname(path)),
      intrinsics: {
        calibrationId: intrinsics.calibration_id,
        fx: intrinsics.fx,
        fy: intrinsics.fy,
        cx: intrinsics.cx,
        cy: intrinsics.cy,
      },
    };
  }),
);
assert(new Set(calibrations.map((entry) => entry.intrinsics.calibrationId)).size >= 2);
const implementation = await Promise.all(
  [
    'harness/agent-runtime/perception/src/request-inputs.ts',
    'harness/agent-runtime/perception/src/index.ts',
    'apps/server/src/application.ts',
    'apps/server/src/deployment.ts',
    'apps/server/src/http-server.ts',
    'apps/server/src/native-deployment.mjs',
    'apps/server/src/native-deployment-configuration.mjs',
    'apps/server/src/native-policy-environment.mjs',
    'apps/server/src/native-workspace.mjs',
    'scripts/check-depth-calibrations-offline.mjs',
  ].map(async (path) => ({ path, sha256: hash(await readFile(resolve(root, path))) })),
);
await mkdir(output, { recursive: false });
const cases = [];
const verify = (name, check) => {
  check();
  cases.push({ name, passed: true });
};
const maps = calibrations.map(({ camera, intrinsics }) => ({ [camera]: intrinsics }));
for (const [index, map] of maps.entries()) {
  verify(`original-calibration-${index}`, () => {
    const decoded = admitDepthIntrinsicsByCamera(map);
    assert.deepEqual(Object.entries(decoded), Object.entries(map));
    assert.equal(Object.getPrototypeOf(decoded), null);
    assert(Object.isFrozen(decoded) && Object.values(decoded).every(Object.isFrozen));
  });
  verify(`detached-calibration-${index}`, () => {
    const copy = structuredClone(map);
    const decoded = admitDepthIntrinsicsByCamera(copy);
    copy[calibrations[index].camera].fx++;
    assert.deepEqual(Object.entries(decoded), Object.entries(map));
    assert.throws(() => {
      decoded[calibrations[index].camera].fx++;
    }, TypeError);
  });
  for (const [name, change] of [
    ['zero-focal-length', (value) => (value.fx = 0)],
    ['negative-focal-length', (value) => (value.fy = -1)],
    ['nonfinite-focal-length', (value) => (value.fx = Infinity)],
    ['nonfinite-principal-point', (value) => (value.cx = NaN)],
    ['missing-calibration-id', (value) => (value.calibrationId = '')],
    ['invalid-focal-type', (value) => (value.fx = String(value.fx))],
    ['unexpected-field', (value) => (value.unexpected = true)],
  ])
    verify(`${name}-${index}`, () => {
      const copy = structuredClone(map);
      change(copy[calibrations[index].camera]);
      assert.throws(() => admitDepthIntrinsicsByCamera(copy));
    });
}
for (const [name, input] of [
  ['null-calibrations', null],
  ['array-calibrations', []],
  ['empty-camera-name', { '': calibrations[0].intrinsics }],
  ['blank-camera-name', { ' ': calibrations[0].intrinsics }],
  ['oversized-camera-name', { ['a'.repeat(257)]: calibrations[0].intrinsics }],
])
  verify(name, () => assert.throws(() => admitDepthIntrinsicsByCamera(input)));
verify('explicit-empty-calibrations', () => {
  assert.deepEqual(Object.keys(admitDepthIntrinsicsByCamera({})), []);
});

const settings = await readNativeWorkspaceConfiguration({
  ...process.env,
  EDH_NATIVE_WORKSPACE_CONFIG: configurationPath,
});
for (const { id, settings: deployment } of settings.deployments)
  verify(`configured-calibrations-${id}`, () => {
    const expected = deployment.config.depthIntrinsicsByCamera ?? {};
    assert.deepEqual(Object.entries(deployment.depthIntrinsicsByCamera), Object.entries(expected));
    assert(Object.isFrozen(deployment.depthIntrinsicsByCamera));
  });
let prepared;
let input;
let ids;
const inheritedId = 'calibration-inherited';
const explicitId = 'calibration-explicit';
const emptyId = 'calibration-empty';
const workspace = resolve(output, 'workspace');
const server = await startServer({
  root,
  dataDirectory: workspace,
  port: 0,
  deployment: async (services) => {
    const factory = createNativeWorkspaceFactory({ ...settings, dataDirectory: workspace });
    const assembly = await factory(services);
    ids = Object.keys(assembly.launchProfiles);
    assert(ids.length > 1);
    const originalPrepared = prepareDeployment(
      assembly,
      settings.deployments[0].settings.validator,
    );
    for (const { id, settings: deployment } of settings.deployments)
      for (const [profileId, profile] of Object.entries(deployment.profiles))
        verify(`configured-profile-${id}.${profileId}`, () => {
          const selected = originalPrepared.launchProfiles[`${id}.${profileId}`];
          const expected =
            profile.entry.depthIntrinsicsByCamera ??
            deployment.config.depthIntrinsicsByCamera ??
            {};
          assert.deepEqual(
            Object.entries(selected.depthIntrinsicsByCamera),
            Object.entries(profile.depthIntrinsicsByCamera),
          );
          assert.deepEqual(
            Object.entries(selected.depthIntrinsicsByCamera),
            Object.entries(expected),
          );
          assert(Object.isFrozen(selected.depthIntrinsicsByCamera));
        });
    const first = assembly.launchProfiles[ids[0]];
    input = {
      ...assembly,
      depthIntrinsicsByCamera: structuredClone(maps[0]),
      launchProfiles: {
        ...Object.fromEntries(
          ids.map((id, index) => [
            id,
            {
              ...assembly.launchProfiles[id],
              depthIntrinsicsByCamera: structuredClone(maps[index % maps.length]),
            },
          ]),
        ),
        [inheritedId]: { ...first },
        [explicitId]: { ...first, depthIntrinsicsByCamera: structuredClone(maps[1]) },
        [emptyId]: { ...first, depthIntrinsicsByCamera: {} },
      },
    };
    delete input.launchProfiles[inheritedId].depthIntrinsicsByCamera;
    prepared = prepareDeployment(input, settings.deployments[0].settings.validator);
    return input;
  },
});
try {
  for (const [index, id] of ids.entries())
    verify(`native-profile-${id}`, () => {
      const profile = prepared.launchProfiles[id];
      assert.deepEqual(
        Object.entries(profile.depthIntrinsicsByCamera),
        Object.entries(maps[index % maps.length]),
      );
      assert(Object.isFrozen(profile.depthIntrinsicsByCamera));
      assert.notEqual(
        profile.depthIntrinsicsByCamera,
        input.launchProfiles[id].depthIntrinsicsByCamera,
      );
    });
  verify('deployment-default-inheritance', () => {
    assert.deepEqual(
      Object.entries(prepared.launchProfiles[inheritedId].depthIntrinsicsByCamera),
      Object.entries(maps[0]),
    );
  });
  verify('profile-explicit-calibrations', () => {
    assert.deepEqual(
      Object.entries(prepared.launchProfiles[explicitId].depthIntrinsicsByCamera),
      Object.entries(maps[1]),
    );
  });
  verify('profile-explicit-empty-calibrations', () => {
    assert.deepEqual(Object.keys(prepared.launchProfiles[emptyId].depthIntrinsicsByCamera), []);
  });
  const response = await fetch(`${server.url}/api/config`, { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200);
  const publicConfiguration = await response.json();
  verify('public-profile-metadata', () => {
    assert.deepEqual(
      Object.keys(publicConfiguration.launchProfiles).sort(),
      Object.keys(prepared.launchProfiles).sort(),
    );
    for (const [id, profile] of Object.entries(publicConfiguration.launchProfiles)) {
      assert.equal(profile.checkpoint, prepared.launchProfiles[id].checkpoint);
      assert.equal(profile.defaultModel, prepared.launchProfiles[id].defaultModel);
      assert(!Object.hasOwn(profile, 'createEnvironment'));
      assert(!Object.hasOwn(profile, 'depthIntrinsicsByCamera'));
    }
  });
  verify('detached-deployment-defaults', () => {
    input.depthIntrinsicsByCamera[calibrations[0].camera].fx++;
    assert.deepEqual(Object.entries(prepared.depthIntrinsicsByCamera), Object.entries(maps[0]));
    assert.deepEqual(
      Object.entries(prepared.launchProfiles[inheritedId].depthIntrinsicsByCamera),
      Object.entries(maps[0]),
    );
  });
  verify('detached-profile-calibrations', () => {
    input.launchProfiles[explicitId].depthIntrinsicsByCamera[calibrations[1].camera].fy++;
    assert.deepEqual(
      Object.entries(prepared.launchProfiles[explicitId].depthIntrinsicsByCamera),
      Object.entries(maps[1]),
    );
  });
  verify('invalid-deployment-calibration', () => {
    const map = structuredClone(maps[0]);
    map[calibrations[0].camera].fx = 0;
    assert.throws(() =>
      prepareDeployment(
        { ...input, depthIntrinsicsByCamera: map },
        settings.deployments[0].settings.validator,
      ),
    );
  });
  verify('invalid-profile-calibration', () => {
    const map = structuredClone(maps[1]);
    map[calibrations[1].camera].cy = Infinity;
    assert.throws(() =>
      prepareDeployment(
        {
          ...input,
          launchProfiles: {
            ...input.launchProfiles,
            [explicitId]: { ...input.launchProfiles[explicitId], depthIntrinsicsByCamera: map },
          },
        },
        settings.deployments[0].settings.validator,
      ),
    );
  });
  assert(prepared.serviceLifecycle.inspect().every((service) => service.state === 'idle'));
  assert.equal(server.store.statistics().sequence, 0);
} finally {
  await server.close();
}
await assert.rejects(access(resolve(workspace, 'writer.lock')), { code: 'ENOENT' });
await assert.rejects(fetch(`${server.url}/api/config`, { signal: AbortSignal.timeout(5000) }));
for (const [path, sha256] of sources) assert.equal(hash(await readFile(path)), sha256);
for (const source of implementation)
  assert.equal(hash(await readFile(resolve(root, source.path))), source.sha256);
const report = {
  schemaVersion: 'edh.depth_calibration_cpu.v1',
  implementation,
  sources: Array.from(sources, ([path, sha256]) => ({ path, sha256 })),
  calibrations,
  cases,
  profiles: ids,
  originalSourcesUnchanged: true,
  writerReleased: true,
  listenerClosed: true,
  modelCalls: 0,
  simulatorAllocations: 0,
  gpuJobs: 0,
  scope:
    'Original configuration and saved calibration values through production admission, native factories, preparation and idle HTTP server. Explicit in-memory profile derivatives; no provider execution or camera accuracy acceptance.',
};
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, cases: cases.length, profiles: ids.length, gpuJobs: 0 }));
