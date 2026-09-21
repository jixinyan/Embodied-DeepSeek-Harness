import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _electron } from 'playwright-core';
import electronExecutable from 'electron';

test('actual desktop window preserves selection and reports real service import errors', async (t) => {
  await mkdir('.local/work', { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/desktop-ui-'));
  let application;
  t.after(async () => {
    if (application) await application.close();
    await rm(directory, { recursive: true, force: true });
  });
  const configFile = resolve(directory, 'launch.json');
  await writeFile(
    configFile,
    JSON.stringify({
      version: 1,
      repository: resolve('.'),
      deployment: resolve('apps/server/src/index.ts'),
      dataDirectory: resolve(directory, 'workspace'),
    }),
  );
  const dataDirectory = resolve(directory, 'application');
  await mkdir(dataDirectory);
  await writeFile(resolve(dataDirectory, 'launch-selection.json'), JSON.stringify({ configFile }));
  application = await _electron.launch({
    executablePath: process.env.EDH_DESKTOP_EXECUTABLE || electronExecutable,
    args: process.env.EDH_DESKTOP_EXECUTABLE ? [] : [resolve('apps/desktop')],
    cwd: directory,
    env: { ...process.env, EDH_LAUNCHER_DATA_DIR: dataDirectory },
    artifactsDir: resolve(directory, 'artifacts'),
    timeout: 15000,
  });
  const page = await application.firstWindow();
  await page.waitForFunction(() =>
    document.querySelector('#configuration').textContent.endsWith('launch.json'),
  );
  assert.equal(await page.title(), 'EDH Launcher');
  assert.equal(await page.locator('#status').textContent(), 'idle');
  assert.equal(await page.locator('#configuration').textContent(), configFile);
  assert(await page.locator('#start').isEnabled());
  assert(await page.locator('#stop').isDisabled());
  assert(await page.locator('#open').isDisabled());
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  const preferences = await application.evaluate(({ BrowserWindow }) => {
    const value = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      sandbox: value.sandbox,
      isolated: value.contextIsolation,
      node: value.nodeIntegration,
    };
  });
  assert.deepEqual(preferences, { sandbox: true, isolated: true, node: false });
  await assert.rejects(
    page.evaluate(() => window.launcher.open()),
    /service is not ready/,
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.locator('#start').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#status').textContent === 'failed' &&
        !document.querySelector('#start').disabled,
    );
    assert.equal((await page.evaluate(() => window.launcher.state())).owned, false);
    assert.match(await page.locator('#error').textContent(), /default-export a deployment factory/);
    assert.match(await page.locator('#log').textContent(), /default-export a deployment factory/);
    assert(await page.locator('#start').isEnabled());
    assert(await page.locator('#stop').isDisabled());
    assert(await page.locator('#open').isDisabled());
  }
  assert.equal(await page.evaluate(() => window.open('https://example.com')), null);
  assert.equal(application.windows().length, 1);
});
