import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { LocalStore } from '@edh/storage';
import { startServer } from '../apps/server/src/index.ts';
import { readNativeDeploymentConfiguration } from '../examples/deployments/native-live.mjs';

const { values } = parseArgs({
  options: {
    provider: { type: 'string' },
    config: { type: 'string' },
    models: { type: 'string' },
    checkpoint: { type: 'string' },
    journal: { type: 'string' },
    port: { type: 'string', default: '4365' },
  },
});
assert(values.provider && values.config, 'Supply --provider and --config.');
const variables = {
  robotwin: 'EDH_ROBOTWIN_CONFIG',
  behavior: 'EDH_BEHAVIOR_CONFIG',
  robocasa: 'EDH_NATIVE_WORKER_CONFIG',
  robodojo: 'EDH_ROBODOJO_CONFIG',
};
assert(Object.hasOwn(variables, values.provider), 'Unknown native provider.');
process.env[variables[values.provider]] = resolve(values.config);
if (values.models) process.env.EDH_MODEL_CONFIG = resolve(values.models);
if (values.checkpoint) process.env.EDH_POLICY_CHECKPOINT_LABEL = values.checkpoint;
await mkdir('.local/checks', { recursive: true });
const directory = await mkdtemp(resolve('.local/checks/native-deployment-'));
process.env.EDH_DATA_DIRECTORY = directory;
let sourceJournal;
if (values.journal) {
  const bytes = await readFile(resolve(values.journal, 'records.jsonl'));
  await writeFile(resolve(directory, 'records.jsonl'), bytes);
  sourceJournal = createHash('sha256').update(bytes).digest('hex');
  const store = new LocalStore(directory);
  try {
    for (const record of store.scan('user-session:')) {
      assert.equal(record.value.state, 'closed', 'Journal must contain closed Sessions.');
      assert.equal(record.value.resources, 'released');
    }
  } finally {
    await store.close();
  }
}
const settings = await readNativeDeploymentConfiguration(values.provider);
const { default: deployment } = await import(`../examples/deployments/${values.provider}-live.mjs`);
assert.equal(typeof deployment, 'function');
const server = await startServer({
  root: resolve('.'),
  dataDirectory: directory,
  port: Number(values.port),
  deployment,
});
try {
  const response = await fetch(`${server.url}/api/config`);
  assert.equal(response.status, 200);
  const config = await response.json();
  assert.equal(config.mode, 'simulation');
  assert.equal(config.deploymentId, `${values.provider}-live`);
  assert.deepEqual(Object.keys(config.launchProfiles), Object.keys(settings.profiles));
  for (const [id, profile] of Object.entries(config.launchProfiles)) {
    assert.equal(profile.source, 'simulation');
    assert.equal(profile.taskSource, 'environment');
    assert.deepEqual(profile.tasks, []);
    assert.equal(profile.checkpoint, settings.profiles[id].checkpoint);
  }
  const result = {
    provider: values.provider,
    configuration: resolve(values.config),
    teamFile: settings.teamFile,
    roleRoot: settings.roleRoot,
    profiles: Object.keys(config.launchProfiles),
    nativeTasks: Object.values(settings.profiles).map((profile) => profile.worker.nativeTaskId),
    defaultFactoryLoaded: true,
    serverMetadataRead: true,
    nativeEnvironmentAllocated: false,
    modelInferencePerformed: false,
    ...(sourceJournal ? { sourceJournal } : {}),
    directory,
  };
  await writeFile(resolve(directory, 'result.json'), JSON.stringify(result, null, 2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await server.close();
}
