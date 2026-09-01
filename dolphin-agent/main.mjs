import { existsSync, mkdirSync, promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell, Tray } from 'electron';
import { readDolphinFile } from './core/file-readers.mjs';
import { createFileLogger } from './core/logger.mjs';
import { extractRedemptions } from './core/redemption-extractor.mjs';
import { DolphinServerClient } from './core/server-client.mjs';
import { DolphinSourceApiClient } from './core/source-api-client.mjs';
import { defaultSettings, loadSettings, saveSettings } from './core/settings.mjs';
import { createAgentStateStore } from './core/state-store.mjs';
import { DolphinSyncAgent } from './core/sync-agent.mjs';

const APP_NAME = 'Термбург · Dolphin';
const APP_ID = 'ru.termburg.dolphin-agent';
const BACKGROUND_FLAG = '--background';
const CAPTURE_UI_OUTPUT = cliValue('--capture-ui-output');

let mainWindow = null;
let tray = null;
let syncAgent = null;
let settings = null;
let defaults = null;
let paths = null;
let logger = console;
let quitting = false;
let activationError = '';

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);
const userDataOverride = cliValue('--user-data-dir');
if (userDataOverride) app.setPath('userData', path.resolve(userDataOverride));
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

function appRoot() {
  return app.getAppPath();
}

function iconPath() {
  return path.join(appRoot(), 'desktop', 'assets', 'icon.png');
}

function excelReaderPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'dolphin-agent', 'excel-reader.ps1')
    : path.join(appRoot(), 'dolphin-agent', 'adapters', 'excel-reader.ps1');
}

async function readProtectedSecret(filePath) {
  try {
    const encoded = await fs.readFile(filePath, 'utf8');
    if (!safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.decryptString(Buffer.from(encoded.trim(), 'base64'));
  } catch (error) {
    if (error?.code !== 'ENOENT') logger.error('Credential read failed', error);
    return '';
  }
}

async function writeProtectedSecret(filePath, value) {
  const token = String(value || '').trim();
  if (!token) return;
  if (token.length < 24 || token.length > 256) throw new Error('Ключ подключения выглядит неверно.');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows не позволяет безопасно сохранить код.');
  await fs.writeFile(filePath, safeStorage.encryptString(token).toString('base64'), 'utf8');
}

async function readToken() {
  return readProtectedSecret(paths.credentials);
}

async function writeToken(value) {
  return writeProtectedSecret(paths.credentials, value);
}

async function readEnrollmentToken() {
  try {
    const filePath = path.join(appRoot(), 'dolphin-agent', 'generated', 'enrollment-token.json');
    const value = JSON.parse(await fs.readFile(filePath, 'utf8'));
    return String(value?.enrollmentToken || '').trim();
  } catch (error) {
    if (error?.code !== 'ENOENT') logger.error('Enrollment token read failed', error);
    return '';
  }
}

async function ensureEnrollment() {
  const existing = await readToken();
  if (existing) {
    activationError = '';
    return existing;
  }
  const enrollmentToken = await readEnrollmentToken();
  if (!enrollmentToken) throw new Error('В установщике нет данных автоматической активации.');
  let deviceToken = await readProtectedSecret(paths.pendingEnrollment);
  if (!deviceToken) {
    deviceToken = randomBytes(32).toString('hex');
    await writeProtectedSecret(paths.pendingEnrollment, deviceToken);
  }
  try {
    const client = new DolphinServerClient({ endpoint: settings.endpoint });
    await client.enroll({ enrollmentToken, deviceId: settings.deviceId, deviceToken });
    await writeToken(deviceToken);
    await fs.rm(paths.pendingEnrollment, { force: true });
    activationError = '';
    return deviceToken;
  } catch (error) {
    activationError = String(error?.message || error || 'Не удалось автоматически подключить компьютер.').slice(0, 500);
    throw error;
  }
}

function autoStartExecutable() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function applyAutoStart(enabled) {
  if (process.platform !== 'win32') return;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: autoStartExecutable(),
    args: [BACKGROUND_FLAG],
  });
}

async function combinedStatus() {
  const token = await readToken();
  const agentStatus = syncAgent?.status() || {};
  return {
    ...agentStatus,
    lastError: token ? agentStatus.lastError : activationError || agentStatus.lastError,
    settings: {
      watchFolder: settings.watchFolder,
      endpoint: settings.endpoint,
      timezoneOffset: settings.timezoneOffset,
      autoSync: settings.autoSync,
      autoStart: settings.autoStart,
    },
    configured: Boolean(token),
    activating: !token && !activationError,
    appVersion: app.getVersion(),
  };
}

async function broadcastStatus() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('agent:status', await combinedStatus());
}

function showWindow() {
  if (!mainWindow) createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 760,
    minWidth: 760,
    minHeight: 640,
    show: false,
    title: APP_NAME,
    backgroundColor: '#171426',
    icon: existsSync(iconPath()) ? iconPath() : undefined,
    webPreferences: {
      preload: path.join(appRoot(), 'dolphin-agent', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  mainWindow.once('ready-to-show', async () => {
    if (CAPTURE_UI_OUTPUT) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const image = await mainWindow.webContents.capturePage();
      await fs.writeFile(CAPTURE_UI_OUTPUT, image.toPNG());
      quitting = true;
      app.exit(0);
      return;
    }
    if (!process.argv.includes(BACKGROUND_FLAG)) mainWindow.show();
  });
  mainWindow.on('close', event => {
    if (quitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  void mainWindow.loadFile(path.join(appRoot(), 'dolphin-agent', 'ui', 'index.html'));
}

function createTray() {
  if (tray || !existsSync(iconPath())) return;
  tray = new Tray(iconPath());
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть', click: showWindow },
    { label: 'Синхронизировать сейчас', click: () => void syncAgent.runOnce() },
    { type: 'separator' },
    { label: 'Выход', click: () => app.quit() },
  ]));
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
}

async function runSelfTest(filePath, outputPath) {
  const rows = await readDolphinFile(filePath, { excelReaderPath: excelReaderPath() });
  const extracted = extractRedemptions(rows, { timezoneOffset: '+03:00' });
  const result = {
    ok: true,
    stats: extracted.stats,
    codes: extracted.rows.map(row => row.code),
  };
  if (outputPath) await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  else console.log(JSON.stringify(result));
}

function cliValue(name) {
  const prefix = `${name}=`;
  return process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length) || '';
}

async function start() {
  const selfTestFile = cliValue('--self-test-file');
  if (selfTestFile) {
    try {
      await runSelfTest(selfTestFile, cliValue('--self-test-output'));
      app.exit(0);
    } catch (error) {
      const outputPath = cliValue('--self-test-output');
      if (outputPath) await fs.writeFile(outputPath, `${JSON.stringify({ ok: false, error: String(error?.message || error) })}\n`, 'utf8');
      app.exit(1);
    }
    return;
  }

  const userData = app.getPath('userData');
  mkdirSync(userData, { recursive: true });
  paths = {
    settings: path.join(userData, 'settings.json'),
    credentials: path.join(userData, 'credentials.bin'),
    pendingEnrollment: path.join(userData, 'pending-enrollment.bin'),
    state: path.join(userData, 'state.json'),
    log: path.join(userData, 'dolphin-agent.log'),
  };
  logger = createFileLogger(paths.log, { console: !app.isPackaged });
  defaults = defaultSettings(app.getPath('downloads'));
  settings = await loadSettings(paths.settings, defaults);
  settings = await saveSettings(paths.settings, settings, defaults);
  await ensureEnrollment().catch(error => logger.warn('Automatic enrollment pending', String(error?.message || error)));

  syncAgent = new DolphinSyncAgent({
    stateStore: createAgentStateStore(paths.state),
    readFile: readDolphinFile,
    readerOptions: { excelReaderPath: excelReaderPath() },
    clientFactory: endpoint => new DolphinServerClient({ endpoint }),
    sourceClientFactory: sourceConfig => new DolphinSourceApiClient(sourceConfig),
    configProvider: async () => ({ ...settings, appVersion: app.getVersion() }),
    tokenProvider: ensureEnrollment,
    logger,
    onStatus: () => void broadcastStatus(),
  });
  await syncAgent.initialize();
  if (settings.autoSync && !CAPTURE_UI_OUTPUT) syncAgent.start();
  if (!CAPTURE_UI_OUTPUT) applyAutoStart(settings.autoStart);
  createWindow();
  if (!CAPTURE_UI_OUTPUT) {
    createTray();
    void syncAgent.runOnce();
  }
}

ipcMain.handle('agent:get-status', combinedStatus);
ipcMain.handle('agent:choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Папка выгрузок Dolphin' });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('agent:save-settings', async (_event, value) => {
  const input = value && typeof value === 'object' ? value : {};
  settings = await saveSettings(paths.settings, { ...settings, ...input }, defaults);
  applyAutoStart(settings.autoStart);
  if (settings.autoSync) syncAgent.start(); else syncAgent.stop();
  await broadcastStatus();
  return combinedStatus();
});
ipcMain.handle('agent:sync-now', async (_event, force) => {
  if (force) await syncAgent.clearProcessedFiles();
  await syncAgent.runOnce({ force });
  return combinedStatus();
});
ipcMain.handle('agent:test-connection', async () => {
  const token = await ensureEnrollment();
  const client = new DolphinServerClient({ endpoint: settings.endpoint });
  return client.health(token);
});
ipcMain.handle('agent:open-data-folder', () => shell.openPath(app.getPath('userData')));
ipcMain.handle('agent:hide-window', () => mainWindow?.hide());

app.on('second-instance', showWindow);
app.on('activate', showWindow);
app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  quitting = true;
  syncAgent?.stop();
  tray?.destroy();
  tray = null;
});

if (hasLock) {
  app.whenReady().then(start).catch(error => {
    dialog.showErrorBox('Не удалось запустить агент Dolphin', String(error?.stack || error));
    app.quit();
  });
}
