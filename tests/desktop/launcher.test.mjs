import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readLaunchConfig } from '../../apps/desktop/src/config.mjs';
import { ServiceController } from '../../apps/desktop/src/service-controller.mjs';

const repository = resolve('.');
async function directory(t) {
  await mkdir('.local/work', { recursive: true });
  const result = await mkdtemp(resolve('.local/work/launcher-'));
  t.after(() => rm(result, { recursive: true, force: true }));
  return result;
}
async function config(t, fields = {}) {
  const root = await directory(t);
  const file = resolve(root, 'launch.json');
  await writeFile(
    file,
    JSON.stringify({
      version: 1,
      repository,
      deployment: resolve(repository, 'apps/server/src/index.ts'),
      dataDirectory: './data',
      ...fields,
    }),
  );
  return { root, file };
}
function waitFor(controller, predicate) {
  if (predicate(controller.state)) return Promise.resolve(controller.state);
  return new Promise((accept, reject) => {
    const timer = setTimeout(() => {
      controller.off('change', changed);
      reject(new Error(`Timed out: ${JSON.stringify(controller.state)}`));
    }, 15000);
    function changed(state) {
      if (!predicate(state)) return;
      clearTimeout(timer);
      controller.off('change', changed);
      accept(state);
    }
    controller.on('change', changed);
  });
}

test('launch paths resolve from the selected configuration and preserve explicit port', async (t) => {
  const { root, file } = await config(t, { port: 4319 });
  const value = await readLaunchConfig(file);
  assert.equal(value.repository, repository);
  assert.equal(value.dataDirectory, resolve(root, 'data'));
  assert.equal(value.port, 4319);
  assert.equal(value.deployment, resolve(repository, 'apps/server/src/index.ts'));
  assert.equal(value.environmentFile, undefined);
});

test('launch validation rejects unknown fields, invalid ports and missing paths', async (t) => {
  for (const fields of [
    { version: 2 },
    { port: -1 },
    { port: 65536 },
    { port: '4317' },
    { port: 1.5 },
    { repository: '' },
    { deployment: '' },
    { dataDirectory: '' },
    { environmentFile: '' },
    { apiKey: 'must-not-enter-config' },
    { deployment: './missing.ts' },
  ]) {
    const { file } = await config(t, fields);
    await assert.rejects(readLaunchConfig(file));
  }
});

test('environment file paths are validated without exposing or loading secrets', async (t) => {
  const { root, file } = await config(t, { environmentFile: './private.env' });
  await writeFile(resolve(root, 'private.env'), 'EDH_LAUNCHER_CHECK=local-value\n');
  const value = await readLaunchConfig(file);
  assert.equal(value.environmentFile, resolve(root, 'private.env'));
  assert.equal(process.env.EDH_LAUNCHER_CHECK, undefined);
  assert(!JSON.stringify(value).includes('local-value'));
});

test('actual child import failure remains visible and permits a subsequent launch', async (t) => {
  const { file, root } = await config(t);
  const controller = new ServiceController();
  t.after(() => controller.stop());
  for (let attempt = 0; attempt < 2; attempt++) {
    controller.start(file);
    assert.throws(() => controller.start(file), /Stop the current service/);
    const state = await waitFor(controller, (value) => !value.owned);
    assert.equal(state.status, 'failed');
    assert.match(state.error, /default-export a deployment factory/);
    assert.equal(state.url, null);
    assert.match(state.log, /default-export a deployment factory/);
    await assert.rejects(stat(resolve(root, 'data')), { code: 'ENOENT' });
  }
});

test('stopping an actual starting child waits for its confirmed clean exit', async (t) => {
  const { file } = await config(t);
  const controller = new ServiceController();
  const statuses = [];
  controller.on('change', (state) => statuses.push(state.status));
  controller.start(file);
  await controller.stop();
  assert.equal(controller.state.status, 'stopped');
  assert.equal(controller.state.owned, false);
  assert.equal(controller.state.error, null);
  assert(statuses.includes('starting'));
  assert(statuses.includes('stopping'));
  assert(!statuses.includes('running'));
  await controller.stop();
});

test('missing configuration fails in the actual child without claiming readiness', async (t) => {
  const root = await directory(t);
  const controller = new ServiceController();
  t.after(() => controller.stop());
  controller.start(resolve(root, 'missing.json'));
  const state = await waitFor(controller, (value) => !value.owned);
  assert.equal(state.status, 'failed');
  assert.match(state.error, /ENOENT/);
  assert.equal(state.url, null);
});
