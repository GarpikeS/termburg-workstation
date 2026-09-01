import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, dialog, Menu, session, shell, Tray } from 'electron';
import { checkForPortableUpdate } from './github-updater.mjs';
import { startScheduleService } from '../server/schedule-service.mjs';
import { checkForWorkstationUpdate, launchWorkstationInstaller } from '../workstation/github-updater.mjs';
import { dolphinStatusLabel } from '../workstation/status.mjs';

const APP_NAME = 'Термбург Расписание';
const WORKSTATION_MARKER = path.join(app.getAppPath(), 'workstation', 'mode.json');
const WORKSTATION_MODE = app.isPackaged
  ? existsSync(WORKSTATION_MARKER)
  : process.argv.includes('--workstation');
const DISPLAY_NAME = WORKSTATION_MODE ? 'Термбург Рабочее место' : APP_NAME;
const APP_ID = WORKSTATION_MODE ? 'ru.termburg.workstation' : 'ru.termburg.schedule';
const BACKGROUND_FLAG = '--background';
const HOST = '0.0.0.0';
const requestedPort = Number(cliValue('--schedule-port'));
const PORT = Number.isInteger(requestedPort) && requestedPort >= 1024 && requestedPort <= 65535
  ? requestedPort
  : 4174;
const LOCAL_ORIGIN = `http://localhost:${PORT}`;
const ALLOWED_EXTERNAL_ROUTES = new Set([
  '/schedule/screen/1',
  '/schedule/screen/2',
  '/schedule/screen/1/landscape',
  '/schedule/screen/2/landscape',
  '/schedule/screen/1/portrait',
  '/schedule/screen/2/portrait',
  '/schedule/print/1',
  '/schedule/print/2',
  '/schedule/poster/1',
  '/schedule/poster/2',
]);

let mainWindow = null;
let tray = null;
let scheduleService = null;
let logFile = null;
let quitting = false;
let backgroundNoticeShown = false;
let dolphinRuntime = null;
let dolphinStatus = {};
let pendingWorkstationUpdate = null;
let workstationUpdateCheckRunning = false;
let workstationUpdateInstalling = false;

app.setName(DISPLAY_NAME);
app.setAppUserModelId(APP_ID);
const userDataOverride = cliValue('--user-data-dir');
if (userDataOverride) app.setPath('userData', path.resolve(userDataOverride));

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

function serializeLogValue(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function writeLog(level, ...values) {
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${values.map(serializeLogValue).join(' ')}\n`;
  if (logFile) appendFileSync(logFile, line, 'utf8');
  if (!app.isPackaged) console[level === 'error' ? 'error' : 'log'](line.trim());
}

const logger = {
  info: (...values) => writeLog('info', ...values),
  warn: (...values) => writeLog('warn', ...values),
  error: (...values) => writeLog('error', ...values),
};

function cliValue(name) {
  const prefix = `${name}=`;
  return process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length) || '';
}

function isAllowedLocalUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === LOCAL_ORIGIN;
  } catch {
    return false;
  }
}

function openLocalRouteInBrowser(route) {
  if (!ALLOWED_EXTERNAL_ROUTES.has(route)) return;
  void shell.openExternal(`${LOCAL_ORIGIN}${route}`);
}

function getIconPath() {
  return path.join(app.getAppPath(), 'desktop', 'assets', 'icon.png');
}

function showMainWindow() {
  if (!mainWindow && scheduleService) createMainWindow();
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function runDolphinNow() {
  if (!dolphinRuntime) return;
  try {
    dolphinStatus = await dolphinRuntime.runOnce();
  } catch (error) {
    logger.error('Manual Dolphin synchronization failed', error);
  } finally {
    refreshTrayMenu();
  }
}

async function confirmWorkstationUpdate() {
  if (!pendingWorkstationUpdate || workstationUpdateInstalling) return;
  const options = {
    type: 'info',
    title: 'Обновление Термбург Рабочее место',
    message: `Доступна версия ${pendingWorkstationUpdate.version}`,
    detail: 'Программа закроется, установит проверенное обновление и сохранит расписание и настройки Dolphin.',
    buttons: ['Обновить сейчас', 'Позже'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  };
  const result = mainWindow
    ? await dialog.showMessageBox(mainWindow, options)
    : await dialog.showMessageBox(options);
  if (result.response !== 0) return;
  try {
    workstationUpdateInstalling = true;
    logger.info('Launching Workstation update', {
      fromVersion: app.getVersion(),
      toVersion: pendingWorkstationUpdate.version,
      targetFile: pendingWorkstationUpdate.targetFile,
    });
    launchWorkstationInstaller({ installerPath: pendingWorkstationUpdate.targetFile });
    app.quit();
  } catch (error) {
    workstationUpdateInstalling = false;
    logger.error('Workstation update launch failed', error);
    dialog.showErrorBox('Не удалось установить обновление', serializeLogValue(error));
  }
}

async function checkWorkstationUpdates({ prompt = false, announceCurrent = false } = {}) {
  if (!WORKSTATION_MODE || !app.isPackaged || process.argv.includes('--no-update')) return;
  if (workstationUpdateCheckRunning) return;
  if (pendingWorkstationUpdate) {
    if (prompt) await confirmWorkstationUpdate();
    return;
  }
  workstationUpdateCheckRunning = true;
  try {
    const update = await checkForWorkstationUpdate({
      currentVersion: app.getVersion(),
      updateDirectory: path.join(app.getPath('userData'), 'updates'),
      logger,
    });
    if (update.updateReady) {
      pendingWorkstationUpdate = update;
      logger.info('Workstation update is ready', { version: update.version, targetFile: update.targetFile });
      Menu.setApplicationMenu(buildApplicationMenu());
      refreshTrayMenu();
      if (prompt) await confirmWorkstationUpdate();
    } else if (announceCurrent && update.reason === 'current-version') {
      const options = {
        type: 'info',
        title: 'Обновления',
        message: 'Установлена актуальная версия',
        detail: `Термбург Рабочее место ${app.getVersion()}`,
        buttons: ['Хорошо'],
      };
      if (mainWindow) await dialog.showMessageBox(mainWindow, options);
      else await dialog.showMessageBox(options);
    } else if (announceCurrent) {
      dialog.showErrorBox('Не удалось проверить обновления', 'GitHub не вернул проверенный установщик. Повторите позже.');
    }
  } catch (error) {
    logger.error('Workstation update check failed', error);
    if (announceCurrent) dialog.showErrorBox('Не удалось проверить обновления', 'Проверьте интернет-соединение и повторите позже.');
  } finally {
    workstationUpdateCheckRunning = false;
  }
}

function workstationUpdateMenuTemplate() {
  if (!WORKSTATION_MODE) return [];
  return [{
    label: 'Программа',
    submenu: [
      { label: `Версия ${app.getVersion()}`, enabled: false },
      pendingWorkstationUpdate
        ? { label: `Установить обновление ${pendingWorkstationUpdate.version}`, click: () => void confirmWorkstationUpdate() }
        : { label: 'Проверить обновления', click: () => void checkWorkstationUpdates({ prompt: true, announceCurrent: true }) },
    ],
  }];
}

function dolphinMenuTemplate() {
  if (!WORKSTATION_MODE) return [];
  return [{
    label: 'Dolphin',
    submenu: [
      { label: dolphinStatusLabel(dolphinStatus), enabled: false },
      { label: 'Проверить сейчас', click: () => void runDolphinNow() },
      { label: 'Открыть журнал Dolphin', click: () => {
        if (dolphinRuntime) void shell.openPath(dolphinRuntime.dataDirectory());
      } },
    ],
  }];
}

function buildApplicationMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Расписание',
      submenu: [
        { label: 'Редактор', accelerator: 'Ctrl+1', click: () => {
          showMainWindow();
          void mainWindow?.loadURL(`${LOCAL_ORIGIN}/schedule/admin`);
        } },
        { label: 'ТВ-экран · горизонтальный', accelerator: 'Ctrl+2', click: () => openLocalRouteInBrowser('/schedule/screen/1/landscape') },
        { label: 'ТВ-экран · вертикальный', accelerator: 'Ctrl+Shift+2', click: () => openLocalRouteInBrowser('/schedule/screen/1/portrait') },
        { label: 'Печать · Москва', accelerator: 'Ctrl+3', click: () => openLocalRouteInBrowser('/schedule/print/1') },
        { label: 'Афиша месяца · Москва', accelerator: 'Ctrl+4', click: () => openLocalRouteInBrowser('/schedule/poster/1') },
        { type: 'separator' },
        { label: 'Открыть папку данных', click: () => void shell.openPath(app.getPath('userData')) },
        { type: 'separator' },
        { label: 'Выход', role: 'quit' },
      ],
    },
    ...dolphinMenuTemplate(),
    ...workstationUpdateMenuTemplate(),
    {
      label: 'Вид',
      submenu: [
        { label: 'Обновить', role: 'reload', accelerator: 'Ctrl+R' },
        { type: 'separator' },
        { label: 'Увеличить', role: 'zoomIn' },
        { label: 'Уменьшить', role: 'zoomOut' },
        { label: 'Обычный масштаб', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'На весь экран', role: 'togglefullscreen', accelerator: 'F11' },
      ],
    },
  ]);
}

function createMainWindow() {
  const iconPath = getIconPath();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: DISPLAY_NAME,
    backgroundColor: '#edf2f3',
    icon: existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (!WORKSTATION_MODE || !process.argv.includes(BACKGROUND_FLAG)) mainWindow?.show();
  });
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow?.setTitle(DISPLAY_NAME);
  });
  mainWindow.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    mainWindow?.hide();
    logger.info('Editor hidden; TV server remains active');
    if (process.platform === 'win32' && tray && !backgroundNoticeShown) {
      backgroundNoticeShown = true;
      tray.displayBalloon({
        iconType: 'info',
        title: DISPLAY_NAME,
        content: WORKSTATION_MODE
          ? 'Программа продолжает обновлять расписание и проверять Dolphin.'
          : 'Редактор скрыт. ТВ-экран продолжает получать обновления.',
      });
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isAllowedLocalUrl(navigationUrl)) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.origin === LOCAL_ORIGIN && ALLOWED_EXTERNAL_ROUTES.has(parsed.pathname)) {
        void shell.openExternal(parsed.toString());
      }
    } catch {
      // Invalid or untrusted URLs are deliberately ignored.
    }
    return { action: 'deny' };
  });

  void mainWindow.loadURL(`${LOCAL_ORIGIN}/schedule/admin`);
}

function createTray() {
  if (tray) return;
  const iconPath = getIconPath();
  if (!existsSync(iconPath)) return;
  tray = new Tray(iconPath);
  tray.setToolTip(`${DISPLAY_NAME} · работает`);
  refreshTrayMenu();
  tray.on('click', showMainWindow);
  tray.on('double-click', showMainWindow);
}

function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть редактор', click: showMainWindow },
    { label: 'ТВ-экран · горизонтальный', click: () => openLocalRouteInBrowser('/schedule/screen/1/landscape') },
    { label: 'ТВ-экран · вертикальный', click: () => openLocalRouteInBrowser('/schedule/screen/1/portrait') },
    { label: 'Афиша месяца · Москва', click: () => openLocalRouteInBrowser('/schedule/poster/1') },
    ...(WORKSTATION_MODE ? [
      { type: 'separator' },
      { label: dolphinStatusLabel(dolphinStatus), enabled: false },
      { label: 'Проверить Dolphin сейчас', click: () => void runDolphinNow() },
      { label: 'Открыть журнал Dolphin', click: () => {
        if (dolphinRuntime) void shell.openPath(dolphinRuntime.dataDirectory());
      } },
      pendingWorkstationUpdate
        ? { label: `Установить обновление ${pendingWorkstationUpdate.version}`, click: () => void confirmWorkstationUpdate() }
        : { label: 'Проверить обновления', click: () => void checkWorkstationUpdates({ prompt: true, announceCurrent: true }) },
    ] : []),
    { type: 'separator' },
    { label: WORKSTATION_MODE ? 'Выход' : 'Выход и остановить ТВ-сервер', click: () => app.quit() },
  ]));
}

async function migrateScheduleData(userData) {
  if (!WORKSTATION_MODE) return;
  const { migrateMissingFiles } = await import('../workstation/migration.mjs');
  await migrateMissingFiles({
    sourceDirectory: path.join(app.getPath('appData'), APP_NAME),
    targetDirectory: userData,
    fileNames: ['schedule.json', 'site-sync.json', 'schedule-auth.json'],
    logger,
  });
}

async function startDolphin() {
  if (!WORKSTATION_MODE || process.argv.includes('--skip-dolphin')) return;
  try {
    const { createEmbeddedDolphinRuntime } = await import('../workstation/dolphin-runtime.mjs');
    dolphinRuntime = await createEmbeddedDolphinRuntime({
      appVersion: app.getVersion(),
      logger,
      onStatus: status => {
        dolphinStatus = status;
        refreshTrayMenu();
      },
    });
    dolphinStatus = dolphinRuntime.status();
  } catch (error) {
    dolphinStatus = { configured: false, lastError: serializeLogValue(error) };
    logger.error('Embedded Dolphin startup failed', error);
  }
}

async function startDesktop() {
  const appRoot = app.getAppPath();
  const userData = app.getPath('userData');
  mkdirSync(userData, { recursive: true });
  logFile = path.join(userData, 'schedule.log');
  await migrateScheduleData(userData);

  if (!WORKSTATION_MODE && app.isPackaged && !process.argv.includes('--no-update')) {
    try {
      const update = await checkForPortableUpdate({
        currentVersion: app.getVersion(),
        updateDirectory: path.join(userData, 'updates'),
        logger,
      });
      if (update.updateReady) {
        logger.info('Relaunching updated schedule app', { version: update.version, targetFile: update.targetFile });
        quitting = true;
        app.releaseSingleInstanceLock?.();
        app.relaunch({ execPath: update.targetFile, args: [`--updated-from=${app.getVersion()}`] });
        app.exit(0);
        return;
      }
    } catch (error) {
      logger.error('Update check failed', error);
    }
  }

  const staticRoot = path.join(appRoot, 'frontend', 'build');
  const seedFile = path.join(appRoot, 'frontend', 'public', 'data', 'default-schedule.json');
  const dataFile = path.join(userData, 'schedule.json');
  const siteSyncFile = path.join(userData, 'site-sync.json');
  const authFile = path.join(userData, 'schedule-auth.json');

  if (!existsSync(path.join(staticRoot, 'index.html')) || !existsSync(seedFile)) {
    throw new Error('В сборке отсутствуют файлы интерфейса или начального расписания.');
  }

  scheduleService = await startScheduleService({
    staticRoot,
    dataFile,
    seedFile,
    siteSyncFile,
    authFile,
    host: HOST,
    port: PORT,
    localWritesOnly: false,
    logger,
  });
  logger.info('Desktop started', { port: scheduleService.port, dataFile });
  await startDolphin();

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  Menu.setApplicationMenu(buildApplicationMenu());
  const smokeTestOutput = cliValue('--smoke-test-output');
  if (smokeTestOutput) {
    let dolphinPackage = null;
    if (WORKSTATION_MODE && process.argv.includes('--validate-dolphin-package')) {
      const { validateEmbeddedDolphinPackage } = await import('../workstation/dolphin-runtime.mjs');
      dolphinPackage = await validateEmbeddedDolphinPackage({
        enrollmentRequired: !process.argv.includes('--expect-no-enrollment'),
      });
    }
    writeFileSync(smokeTestOutput, `${JSON.stringify({
      ok: true,
      mode: WORKSTATION_MODE ? 'workstation' : 'schedule',
      port: scheduleService.port,
      dolphinSkipped: process.argv.includes('--skip-dolphin'),
      dolphinPackage,
      version: app.getVersion(),
    }, null, 2)}\n`, 'utf8');
    app.quit();
    return;
  }
  createMainWindow();
  createTray();
  if (WORKSTATION_MODE && app.isPackaged && !process.argv.includes('--no-update')) {
    void checkWorkstationUpdates({ prompt: !process.argv.includes(BACKGROUND_FLAG) });
  }
}

app.on('second-instance', () => {
  showMainWindow();
  if (WORKSTATION_MODE) void checkWorkstationUpdates({ prompt: true });
});

app.on('activate', () => {
  showMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  dolphinRuntime?.stop();
  const closeSchedule = scheduleService ? scheduleService.close() : Promise.resolve();
  void closeSchedule
    .catch((error) => logger.error('Shutdown failed', error))
    .finally(() => {
      scheduleService = null;
      tray?.destroy();
      tray = null;
      app.exit(0);
    });
});

if (hasLock) {
  app.whenReady()
    .then(startDesktop)
    .catch((error) => {
      logger.error('Startup failed', error);
      const detail = error?.code === 'EADDRINUSE'
        ? `Порт ${PORT} уже занят. Закройте старое окно расписания или другой запущенный экземпляр и повторите запуск.`
        : serializeLogValue(error);
      dialog.showErrorBox(`Не удалось запустить ${DISPLAY_NAME}`, detail);
      app.quit();
    });
}
