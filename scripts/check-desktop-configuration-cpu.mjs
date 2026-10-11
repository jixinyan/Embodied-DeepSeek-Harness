import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { readLaunchConfig } from '../apps/desktop/src/config.mjs';

const { values } = parseArgs({
  options: {
    repository: { type: 'string' },
    executable: { type: 'string' },
    workspace: { type: 'string' },
    output: { type: 'string' },
    wayland: { type: 'boolean', default: false },
  },
});
assert(values.repository && values.executable && values.workspace && values.output);
assert.equal(process.env.CUDA_VISIBLE_DEVICES, '');
const root = fileURLToPath(new URL('../', import.meta.url));
const source = await realpath(resolve(values.repository));
const output = resolve(
  await realpath(dirname(resolve(values.output))),
  basename(resolve(values.output)),
);
const ownedOutput = relative(await realpath(resolve(root, '.local/work')), output);
assert(ownedOutput !== '' && !isAbsolute(ownedOutput) && !ownedOutput.startsWith('..'));
const executable = await realpath(resolve(values.executable));
const workspace = await realpath(resolve(values.workspace));
const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain=v1'), '', 'Use a clean source checkout.');
const revision = git('rev-parse', 'HEAD');
const require = createRequire(resolve(source, 'package.json'));
const { _electron } = require('playwright-core');
const packagerRequire = createRequire(require.resolve('@electron/packager'));
const { extractFile } = await import(pathToFileURL(packagerRequire.resolve('@electron/asar')).href);
const { defaultSanitizePackageJson } = await import(
  pathToFileURL(resolve(dirname(require.resolve('@electron/packager')), 'sanitize-package-json.js'))
    .href
);
const identity = async (path) => ({
  path: await realpath(path),
  sha256: createHash('sha256')
    .update(await readFile(path))
    .digest('hex'),
});
const settings = JSON.parse(await readFile(workspace, 'utf8'));
const configurationSources = [
  workspace,
  resolve(dirname(workspace), settings.modelConfiguration),
  ...Object.values(settings.deployments).map((entry) =>
    resolve(dirname(workspace), entry.configuration),
  ),
];
const originalSources = await Promise.all(configurationSources.map(identity));
const archive =
  process.platform === 'darwin'
    ? resolve(dirname(executable), '../Resources/app.asar')
    : resolve(dirname(executable), 'resources/app.asar');
const packagedSources = [];
async function compare(directory, parent = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = parent ? `${parent}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await compare(resolve(directory, entry.name), child);
    else {
      assert(entry.isFile());
      const original = await identity(resolve(directory, entry.name));
      const bytes = extractFile(archive, child);
      const packaged = { path: child, sha256: createHash('sha256').update(bytes).digest('hex') };
      if (child === 'package.json') {
        assert.deepEqual(
          JSON.parse(bytes.toString()),
          defaultSanitizePackageJson(JSON.parse(await readFile(original.path, 'utf8'))),
        );
      } else assert.equal(original.sha256, packaged.sha256, child);
      packagedSources.push({ original, packaged });
    }
  }
}
await compare(resolve(source, 'apps/desktop'));
await mkdir(output, { recursive: false });
const save = (name, value) =>
  writeFile(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`);
const configurationFile = resolve(output, 'launch.json');
const dataDirectory = resolve(output, 'workspace');
const environmentFile = resolve(output, 'native.env');
await writeFile(environmentFile, `EDH_NATIVE_WORKSPACE_CONFIG=${workspace}\n`, { mode: 0o600 });
await save('launch.json', {
  version: 1,
  repository: source,
  deployment: resolve(source, 'examples/deployments/native-workspace.mjs'),
  dataDirectory,
  environmentFile,
  port: 0,
});
await readLaunchConfig(configurationFile);
const applicationDirectory = resolve(output, 'application');
await mkdir(applicationDirectory);
await writeFile(
  resolve(applicationDirectory, 'launch-selection.json'),
  JSON.stringify({ configFile: configurationFile }),
);
const args = ['--disable-gpu', '--use-gl=disabled'];
if (values.wayland) {
  assert.equal(process.platform, 'linux');
  assert(process.env.XDG_RUNTIME_DIR && process.env.WAYLAND_DISPLAY);
  args.push('--ozone-platform=wayland');
}
const application = await _electron.launch({
  executablePath: executable,
  args,
  cwd: source,
  env: { ...process.env, EDH_LAUNCHER_DATA_DIR: applicationDirectory },
  artifactsDir: resolve(output, 'artifacts'),
  timeout: 30_000,
});
const applicationPid = application.process().pid;
let closed = false;
const browserErrors = [];
const cycles = [];
try {
  const launcher = await application.firstWindow();
  launcher.on('pageerror', (error) => browserErrors.push(String(error)));
  await launcher.waitForFunction(() =>
    document.querySelector('#configuration').textContent.endsWith('launch.json'),
  );
  assert.equal(await launcher.locator('#configuration').textContent(), configurationFile);
  assert.equal(await launcher.locator('#status').textContent(), 'idle');
  assert.equal(await launcher.evaluate(() => typeof window.require), 'undefined');
  const metadata = await application.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    version: app.getVersion(),
    versions: process.versions,
    gpuFeatures: app.getGPUFeatureStatus(),
    arguments: process.argv,
  }));
  await save('application.json', { applicationPid, ...metadata });
  assert.equal(metadata.packaged, true);
  for (const argument of args) assert(metadata.arguments.includes(argument));
  for (const value of Object.values(metadata.gpuFeatures))
    assert(!String(value).startsWith('enabled'));
  for (let cycle = 0; cycle < 2; cycle++) {
    await launcher.locator('#start').click();
    await launcher.waitForFunction(() =>
      ['running', 'failed'].includes(document.querySelector('#status').textContent),
    );
    await save(
      `cycle-${cycle}-start-state.json`,
      await launcher.evaluate(() => window.launcher.state()),
    );
    assert.equal(
      await launcher.locator('#status').textContent(),
      'running',
      await launcher.locator('#log').textContent(),
    );
    const state = await launcher.evaluate(() => window.launcher.state());
    assert.equal(state.owned, true);
    const childPid = Number(await readFile(resolve(dataDirectory, 'writer.lock'), 'utf8'));
    assert(Number.isInteger(childPid) && childPid > 0);
    const windowOpened = application.waitForEvent('window');
    await launcher.locator('#open').click();
    const consolePage = await windowOpened;
    consolePage.on('pageerror', (error) => browserErrors.push(String(error)));
    await consolePage.waitForFunction(
      () => document.querySelector('#launch-profile')?.options.length > 0,
    );
    const get = async (path) => {
      const response = await consolePage.request.get(`${state.url}${path}`);
      assert.equal(response.status(), 200);
      return response.json();
    };
    const configuration = await get('api/config');
    await save(`cycle-${cycle}-configuration.json`, configuration);
    assert.equal(configuration.deploymentId, 'native-workspace');
    assert.equal(configuration.sourceCode.revision, revision);
    assert.equal(configuration.recordRetirement.available, true);
    const profiles = Object.entries(configuration.launchProfiles);
    assert(profiles.length > 0);
    const observed = [];
    for (const [profileId, profile] of profiles) {
      await consolePage.locator('#select-environment').selectOption(profile.environment);
      await consolePage.waitForFunction(
        (id) =>
          [...document.querySelector('#launch-profile').options].some(
            (option) => option.value === id,
          ),
        profileId,
      );
      await consolePage.locator('#launch-profile').selectOption(profileId);
      const selected = {};
      for (const field of [
        'source',
        'environment',
        'embodiment',
        'executionMode',
        'checkpoint',
        'policy',
        'defaultModel',
      ]) {
        selected[field] = await consolePage.locator(`#select-${field}`).inputValue();
        assert.equal(selected[field], profile[field]);
      }
      assert.equal(await consolePage.locator('#task-instruction').isDisabled(), true);
      observed.push({ profileId, selected });
    }
    const sessions = await get('api/sessions');
    const services = await get('api/services');
    assert.equal(sessions.activeId, null);
    for (const service of services.services) {
      assert.equal(service.state, 'idle');
      assert.equal(service.leases, 0);
      assert.equal(service.pid, null);
    }
    assert.equal(await consolePage.evaluate(() => typeof window.require), 'undefined');
    const preferences = await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((window) => {
        const values = window.webContents.getLastWebPreferences();
        return {
          sandbox: values.sandbox,
          contextIsolation: values.contextIsolation,
          nodeIntegration: values.nodeIntegration,
        };
      }),
    );
    assert.equal(preferences.length, 2);
    for (const preference of preferences)
      assert.deepEqual(preference, {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      });
    await save(`cycle-${cycle}-services.json`, services);
    await save(`cycle-${cycle}-sessions.json`, sessions);
    if (cycle === 0) {
      await launcher.locator('#stop').click();
      await launcher.waitForFunction(
        () => document.querySelector('#status').textContent === 'stopped',
      );
      assert.equal((await launcher.evaluate(() => window.launcher.state())).owned, false);
      assert.equal(application.windows().length, 1);
    } else {
      await application.close();
      closed = true;
    }
    assert.equal(existsSync(resolve(dataDirectory, 'writer.lock')), false);
    assert.throws(() => process.kill(childPid, 0), { code: 'ESRCH' });
    await assert.rejects(
      fetch(`${state.url}api/config`, { signal: AbortSignal.timeout(3000) }),
      (error) => error.cause?.code === 'ECONNREFUSED',
    );
    cycles.push({
      selectedProfiles: observed,
      servicePid: childPid,
      operation: cycle === 0 ? 'stop_service' : 'quit_application',
      writerReleased: true,
      serviceExited: true,
      listenerClosed: true,
      url: state.url,
    });
  }
  assert.throws(() => process.kill(applicationPid, 0), { code: 'ESRCH' });
  assert.deepEqual(browserErrors, []);
  assert.deepEqual(await Promise.all(configurationSources.map(identity)), originalSources);
  assert.equal(git('status', '--porcelain=v1'), '');
  await save('acceptance.json', {
    format: 'edh.desktop-configuration-cpu.v1',
    source,
    revision,
    executable: await identity(executable),
    diagnostic: await identity(fileURLToPath(import.meta.url)),
    applicationPid,
    applicationReleased: true,
    applicationMetadata: metadata,
    originalSources,
    packagedSources,
    archive: await identity(archive),
    cycles,
    browserErrors,
    modelInferencePerformed: false,
    managedServiceProcessesStarted: false,
    nativeEnvironmentAllocated: false,
    gpuAllocated: false,
    scope: 'Packaged CPU Desktop, configured component selectors and owned service shutdown.',
  });
  console.log(
    JSON.stringify({
      output,
      revision,
      packagedFiles: packagedSources.length,
      cycles: cycles.length,
      nativeAllocations: 0,
    }),
  );
} finally {
  if (!closed) await application.close();
}
