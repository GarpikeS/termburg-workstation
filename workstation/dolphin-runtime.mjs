import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { app, safeStorage } from 'electron';
import { readDolphinFile } from '../dolphin-agent/core/file-readers.mjs';
import { createFileLogger } from '../dolphin-agent/core/logger.mjs';
import { DolphinServerClient } from '../dolphin-agent/core/server-client.mjs';
import { DolphinSourceApiClient } from '../dolphin-agent/core/source-api-client.mjs';
import { defaultSettings, loadSettings, saveSettings } from '../dolphin-agent/core/settings.mjs';
import { createAgentStateStore } from '../dolphin-agent/core/state-store.mjs';
import { DolphinSyncAgent } from '../dolphin-agent/core/sync-agent.mjs';
import { migrateMissingFiles } from './migration.mjs';

const BACKGROUND_FLAG = '--background';
const STANDALONE_DATA_DIRECTORY = 'Термбург · Dolphin';
const MIGRATED_FILE_NAMES = [
  'settings.json',
  'credentials.bin',
  'pending-enrollment.bin',
  'state.json',
];

function protectedTokenError() {
  return new Error('Windows не позволяет безопасно сохранить подключение Dolphin.');
}

export class EmbeddedDolphinRuntime {
  constructor(options = {}) {
    this.appVersion = options.appVersion || app.getVersion();
    this.onStatus = options.onStatus || (() => {});
    this.consoleLogger = options.logger || console;
    this.dataRoot = path.join(app.getPath('userData'), 'dolphin');
    this.paths = {
      settings: path.join(this.dataRoot, 'settings.json'),
      credentials: path.join(this.dataRoot, 'credentials.bin'),
      pendingEnrollment: path.join(this.dataRoot, 'pending-enrollment.bin'),
      state: path.join(this.dataRoot, 'state.json'),
      log: path.join(this.dataRoot, 'dolphin-agent.log'),
    };
    this.settings = null;
    this.defaults = null;
    this.syncAgent = null;
    this.fileLogger = null;
    this.activationError = '';
    this.configured = false;
    this.started = false;
  }

  dataDirectory() {
    return this.dataRoot;
  }

  status() {
    const agentStatus = this.syncAgent?.status() || {};
    return {
      ...agentStatus,
      configured: this.configured,
      lastError: this.configured
        ? agentStatus.lastError || null
        : this.activationError || agentStatus.lastError || null,
      appVersion: this.appVersion,
    };
  }

  emitStatus() {
    this.onStatus(this.status());
  }

  async readProtectedSecret(filePath) {
    try {
      const encoded = await fs.readFile(filePath, 'utf8');
      if (!safeStorage.isEncryptionAvailable()) return '';
      return safeStorage.decryptString(Buffer.from(encoded.trim(), 'base64'));
    } catch (error) {
      if (error?.code !== 'ENOENT') this.fileLogger?.error('Credential read failed', error);
      return '';
    }
  }

  async writeProtectedSecret(filePath, value) {
    const token = String(value || '').trim();
    if (!token) return;
    if (token.length < 24 || token.length > 256) throw new Error('Ключ подключения Dolphin выглядит неверно.');
    if (!safeStorage.isEncryptionAvailable()) throw protectedTokenError();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, safeStorage.encryptString(token).toString('base64'), 'utf8');
  }

  async readEnrollmentToken() {
    try {
      const filePath = path.join(app.getAppPath(), 'workstation', 'generated', 'enrollment-token.json');
      const value = JSON.parse(await fs.readFile(filePath, 'utf8'));
      return String(value?.enrollmentToken || '').trim();
    } catch (error) {
      if (error?.code !== 'ENOENT') this.fileLogger?.error('Enrollment token read failed', error);
      return '';
    }
  }

  async ensureEnrollment() {
    const existing = await this.readProtectedSecret(this.paths.credentials);
    if (existing) {
      this.configured = true;
      this.activationError = '';
      return existing;
    }

    const enrollmentToken = await this.readEnrollmentToken();
    if (!enrollmentToken) throw new Error('В установщике нет автоматической активации Dolphin.');
    let deviceToken = await this.readProtectedSecret(this.paths.pendingEnrollment);
    if (!deviceToken) {
      deviceToken = randomBytes(32).toString('hex');
      await this.writeProtectedSecret(this.paths.pendingEnrollment, deviceToken);
    }

    try {
      const client = new DolphinServerClient({ endpoint: this.settings.endpoint });
      await client.enroll({ enrollmentToken, deviceId: this.settings.deviceId, deviceToken });
      await this.writeProtectedSecret(this.paths.credentials, deviceToken);
      await fs.rm(this.paths.pendingEnrollment, { force: true });
      this.configured = true;
      this.activationError = '';
      return deviceToken;
    } catch (error) {
      this.configured = false;
      this.activationError = String(error?.message || error || 'Не удалось подключить Dolphin.').slice(0, 500);
      this.emitStatus();
      throw error;
    }
  }

  excelReaderPath() {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'workstation', 'excel-reader.ps1')
      : path.join(app.getAppPath(), 'dolphin-agent', 'adapters', 'excel-reader.ps1');
  }

  applyAutoStart() {
    if (process.platform !== 'win32') return;
    app.setLoginItemSettings({
      openAtLogin: this.settings?.autoStart !== false,
      path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
      args: [BACKGROUND_FLAG],
    });
  }

  async migrateStandaloneData() {
    const sourceDirectory = path.join(app.getPath('appData'), STANDALONE_DATA_DIRECTORY);
    if (!existsSync(sourceDirectory)) return [];
    return migrateMissingFiles({
      sourceDirectory,
      targetDirectory: this.dataRoot,
      fileNames: MIGRATED_FILE_NAMES,
      logger: this.consoleLogger,
    });
  }

  async start() {
    if (this.started) return this.status();
    try {
      mkdirSync(this.dataRoot, { recursive: true });
      await this.migrateStandaloneData();
      this.fileLogger = createFileLogger(this.paths.log, { console: !app.isPackaged });
      this.defaults = defaultSettings(app.getPath('downloads'));
      this.settings = await loadSettings(this.paths.settings, this.defaults);
      this.settings = await saveSettings(this.paths.settings, this.settings, this.defaults);
      await this.ensureEnrollment().catch(error => this.fileLogger.warn('Automatic enrollment pending', String(error?.message || error)));

      this.syncAgent = new DolphinSyncAgent({
        stateStore: createAgentStateStore(this.paths.state),
        readFile: readDolphinFile,
        readerOptions: { excelReaderPath: this.excelReaderPath() },
        clientFactory: endpoint => new DolphinServerClient({ endpoint }),
        sourceClientFactory: sourceConfig => new DolphinSourceApiClient(sourceConfig),
        configProvider: async () => ({ ...this.settings, appVersion: this.appVersion }),
        tokenProvider: () => this.ensureEnrollment(),
        logger: this.fileLogger,
        onStatus: () => this.emitStatus(),
      });
      await this.syncAgent.initialize();
      if (this.settings.autoSync) this.syncAgent.start();
      this.applyAutoStart();
      this.started = true;
      this.emitStatus();
      void this.syncAgent.runOnce();
      return this.status();
    } catch (error) {
      this.started = false;
      this.syncAgent?.stop();
      this.syncAgent = null;
      throw error;
    }
  }

  async runOnce() {
    if (!this.started) await this.start();
    return this.syncAgent.runOnce();
  }

  stop() {
    this.syncAgent?.stop();
  }
}

export async function createEmbeddedDolphinRuntime(options = {}) {
  const runtime = new EmbeddedDolphinRuntime(options);
  await runtime.start();
  return runtime;
}

export async function validateEmbeddedDolphinPackage({ enrollmentRequired = true } = {}) {
  const enrollmentFile = path.join(app.getAppPath(), 'workstation', 'generated', 'enrollment-token.json');
  const excelReader = app.isPackaged
    ? path.join(process.resourcesPath, 'workstation', 'excel-reader.ps1')
    : path.join(app.getAppPath(), 'dolphin-agent', 'adapters', 'excel-reader.ps1');
  let enrollmentReady = false;
  try {
    const value = JSON.parse(await fs.readFile(enrollmentFile, 'utf8'));
    const enrollmentToken = String(value?.enrollmentToken || '').trim();
    enrollmentReady = /^[a-f0-9]{64}$/.test(enrollmentToken);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (enrollmentRequired && !enrollmentReady) throw new Error('Invalid embedded Dolphin enrollment token.');
  await fs.access(excelReader);
  return { ok: true, enrollmentReady, excelReaderReady: true };
}
