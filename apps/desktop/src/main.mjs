import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ServiceController } from './service-controller.mjs';
import { readLaunchConfig } from './config.mjs';

const service = new ServiceController();
app.setName('Embodied DeepSeek Harness');
if (process.env.EDH_LAUNCHER_DATA_DIR) {
  if (!isAbsolute(process.env.EDH_LAUNCHER_DATA_DIR))
    throw new Error('EDH_LAUNCHER_DATA_DIR must be an absolute directory.');
  await mkdir(process.env.EDH_LAUNCHER_DATA_DIR, { recursive: true });
  app.setPath('userData', process.env.EDH_LAUNCHER_DATA_DIR);
}
const launcherFile = fileURLToPath(new URL('../public/index.html', import.meta.url));
const launcherURL = pathToFileURL(launcherFile).href;
let launcher;
let consoleWindow;
let configFile = '';
let quitting = false;
const snapshot = () => ({ ...service.state, configFile });
const publish = () => {
  if (launcher && !launcher.isDestroyed()) launcher.webContents.send('launcher:state', snapshot());
};
function restrict(window, allowed) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!allowed(url)) event.preventDefault();
  });
  window.webContents.on('will-redirect', (event, url) => {
    if (!allowed(url)) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  window.webContents.session.setPermissionCheckHandler(() => false);
}
async function openConsole() {
  const state = service.state;
  if (state.status !== 'running' || !state.url) throw new Error('The service is not ready.');
  if (consoleWindow && !consoleWindow.isDestroyed()) {
    consoleWindow.show();
    consoleWindow.focus();
    return;
  }
  consoleWindow = new BrowserWindow({
    width: 1500,
    height: 980,
    title: 'Embodied DeepSeek Harness',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  restrict(consoleWindow, (url) => new URL(url).origin === new URL(state.url).origin);
  await consoleWindow.loadURL(state.url);
}
function handle(channel, action) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      event.sender !== launcher?.webContents ||
      event.senderFrame !== launcher.webContents.mainFrame ||
      event.senderFrame.url !== launcherURL
    )
      throw new Error('Launcher request is not authorized.');
    return action(...args);
  });
}
async function saveSelection(value) {
  const directory = app.getPath('userData');
  await mkdir(directory, { recursive: true });
  const file = join(directory, 'launch-selection.json');
  await writeFile(file + '.pending', JSON.stringify({ configFile: value }), { mode: 0o600 });
  await rename(file + '.pending', file);
}
async function createLauncher() {
  launcher = new BrowserWindow({
    width: 800,
    height: 730,
    minWidth: 620,
    minHeight: 560,
    title: 'EDH Launcher',
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  restrict(launcher, (url) => url === launcherURL);
  await launcher.loadFile(launcherFile);
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    launcher?.show();
    launcher?.focus();
  });
  app.on('before-quit', (event) => {
    if (!service.state.owned) return;
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    void service.stop().then(() => {
      quitting = false;
      if (service.state.status === 'failed') {
        dialog.showErrorBox('Service cleanup needs attention', service.state.error);
        return;
      }
      app.quit();
    });
  });
  app.on('window-all-closed', () => app.quit());
  void app
    .whenReady()
    .then(initialize)
    .catch((error) => {
      dialog.showErrorBox('Launcher startup failed', error.message);
      app.quit();
    });
}
async function initialize() {
  const selection = await readFile(join(app.getPath('userData'), 'launch-selection.json'), 'utf8')
    .then(JSON.parse)
    .catch((error) => {
      if (error.code === 'ENOENT') return { configFile: '' };
      throw error;
    });
  if (typeof selection.configFile !== 'string') throw new Error('Invalid saved launch selection.');
  configFile = selection.configFile;
  handle('launcher:state', snapshot);
  handle('launcher:select', async () => {
    if (service.state.owned) throw new Error('Stop the service before changing its configuration.');
    const result = await dialog.showOpenDialog(launcher, {
      title: 'Select EDH launch configuration',
      filters: [{ name: 'Launch configuration', extensions: ['json'] }],
      properties: ['openFile', 'showHiddenFiles'],
    });
    if (result.canceled) return snapshot();
    const config = await readLaunchConfig(result.filePaths[0]);
    if (service.state.owned) throw new Error('The service started while the dialog was open.');
    await saveSelection(config.configFile);
    configFile = config.configFile;
    publish();
    return snapshot();
  });
  handle('launcher:start', () => service.start(configFile));
  handle('launcher:stop', async () => {
    await service.stop();
    return snapshot();
  });
  handle('launcher:open', openConsole);
  service.on('change', (state) => {
    if (state.status !== 'running' && consoleWindow && !consoleWindow.isDestroyed())
      consoleWindow.close();
    publish();
  });
  app.on('activate', () => {
    if (!launcher || launcher.isDestroyed()) void createLauncher();
    else launcher.show();
  });
  await createLauncher();
}
