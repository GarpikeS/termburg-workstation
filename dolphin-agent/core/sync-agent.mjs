import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_SCAN_INTERVAL_MS,
  DOLPHIN_EXPORT_NAME_PATTERN,
  MAX_BATCH_ROWS,
  MAX_SOURCE_FILE_BYTES,
  SUPPORTED_EXTENSIONS,
  UNKNOWN_RETRY_TTL_MS,
} from './constants.mjs';
import { extractRedemptions } from './redemption-extractor.mjs';

const MAX_FILES_PER_SCAN = 100;
const MAX_BATCHES_PER_SCAN = 10;

async function sha256File(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function publicError(error) {
  return String(error?.message || error || 'Неизвестная ошибка').slice(0, 500);
}

function maskCode(code) {
  return /^TB-[A-F0-9]{8}$/.test(code) ? `TB-****${code.slice(-4)}` : 'неверный код';
}

function nextNetworkRetry(now, attempts) {
  return now + Math.min(60 * 60 * 1000, 5 * 60 * 1000 * 2 ** Math.min(4, Math.max(0, attempts - 1)));
}

export function sourceDateBegin(timestamp, timezoneOffset = '+03:00', lookbackDays = 2) {
  const match = String(timezoneOffset).match(/^([+-])(\d{2}):(\d{2})$/);
  const direction = match?.[1] === '-' ? -1 : 1;
  const offsetMs = match
    ? direction * (Number(match[2]) * 60 + Number(match[3])) * 60 * 1000
    : 3 * 60 * 60 * 1000;
  const local = new Date(Number(timestamp) + offsetMs);
  local.setUTCDate(local.getUTCDate() - Math.min(7, Math.max(0, Number(lookbackDays) || 0)));
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
}

function apiRowFingerprint(row) {
  return createHash('sha256')
    .update(`${row.code}|${row.redeemedAt}|${row.sourceRecordId || ''}`, 'utf8')
    .digest('hex');
}

export async function discoverDolphinExports(folder) {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension) || !DOLPHIN_EXPORT_NAME_PATTERN.test(entry.name)) continue;
    const filePath = path.join(folder, entry.name);
    const stat = await fs.stat(filePath);
    if (stat.size <= 0 || stat.size > MAX_SOURCE_FILE_BYTES) continue;
    candidates.push({ filePath, size: stat.size, mtimeMs: stat.mtimeMs });
  }
  return candidates
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, MAX_FILES_PER_SCAN);
}

export class DolphinSyncAgent {
  constructor(options) {
    this.stateStore = options.stateStore;
    this.readFile = options.readFile;
    this.readerOptions = options.readerOptions || {};
    this.clientFactory = options.clientFactory;
    this.sourceClientFactory = options.sourceClientFactory || null;
    this.configProvider = options.configProvider;
    this.tokenProvider = options.tokenProvider;
    this.logger = options.logger || console;
    this.now = options.now || (() => Date.now());
    this.onStatus = options.onStatus || (() => {});
    this.state = null;
    this.running = false;
    this.timer = null;
  }

  async initialize() {
    if (!this.state) this.state = await this.stateStore.load();
    this.emit();
    return this.status();
  }

  status() {
    const state = this.state;
    return {
      running: this.running,
      queueSize: state ? Object.keys(state.queue).length : 0,
      processedFiles: state?.stats.filesProcessed || 0,
      rowsFound: state?.stats.rowsFound || 0,
      apiRows: state?.stats.apiRows || 0,
      apiPolls: state?.stats.apiPolls || 0,
      apiRedemptions: state?.stats.apiRedemptions || 0,
      redeemed: state?.stats.redeemed || 0,
      alreadyRedeemed: state?.stats.alreadyRedeemed || 0,
      invalid: state?.stats.invalid || 0,
      unknown: state?.stats.unknown || 0,
      lastScanAt: state?.lastScanAt || null,
      lastSuccessAt: state?.lastSuccessAt || null,
      lastError: state?.lastError || null,
      sourceApi: state?.sourceApi || null,
    };
  }

  emit() {
    this.onStatus(this.status());
  }

  async persist() {
    this.state = await this.stateStore.save(this.state);
    this.emit();
  }

  start(intervalMs = DEFAULT_SCAN_INTERVAL_MS) {
    this.stop();
    this.timer = setInterval(() => void this.runOnce(), intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async scanFiles(config, force) {
    const candidates = await discoverDolphinExports(config.watchFolder);
    for (const candidate of candidates.reverse()) {
      if (this.now() - candidate.mtimeMs < 2_000) continue;
      const fingerprint = `${candidate.size}:${candidate.mtimeMs}:${await sha256File(candidate.filePath)}`;
      if (!force && this.state.processedFiles[candidate.filePath]?.fingerprint === fingerprint) continue;

      try {
        const sourceRows = await this.readFile(candidate.filePath, this.readerOptions);
        const extracted = extractRedemptions(sourceRows, { timezoneOffset: config.timezoneOffset });
        const seenAt = this.now();
        for (const row of extracted.rows) {
          const existing = this.state.queue[row.code];
          this.state.queue[row.code] = {
            ...existing,
            ...row,
            firstSeenAt: existing?.firstSeenAt || seenAt,
            lastSeenAt: seenAt,
            attempts: existing?.attempts || 0,
            nextAttemptAt: Math.min(existing?.nextAttemptAt || seenAt, seenAt),
            sourceFile: path.basename(candidate.filePath).slice(0, 180),
          };
        }
        this.state.processedFiles[candidate.filePath] = {
          fingerprint,
          processedAt: seenAt,
          redemptions: extracted.stats.redemptions,
          invalidCodes: extracted.stats.invalidCodes,
          skippedWithoutEntryTime: extracted.stats.skippedWithoutEntryTime,
        };
        this.state.stats.filesProcessed += 1;
        this.state.stats.rowsFound += extracted.stats.redemptions;
        this.state.stats.invalid += extracted.stats.invalidCodes;
        this.logger.info('Dolphin export parsed', {
          file: path.basename(candidate.filePath),
          ...extracted.stats,
        });
      } catch (error) {
        this.state.lastError = `${path.basename(candidate.filePath)}: ${publicError(error)}`;
        this.logger.error('Dolphin export failed', { file: path.basename(candidate.filePath), error: publicError(error) });
      }
    }
  }

  enqueueRow(row, metadata = {}) {
    const seenAt = this.now();
    const existing = this.state.queue[row.code];
    this.state.queue[row.code] = {
      ...existing,
      ...row,
      ...metadata,
      firstSeenAt: existing?.firstSeenAt || seenAt,
      lastSeenAt: seenAt,
      attempts: existing?.attempts || 0,
      nextAttemptAt: Math.min(existing?.nextAttemptAt || seenAt, seenAt),
    };
  }

  async scanSourceApi(config, token, serverClient) {
    if (!this.sourceClientFactory || typeof serverClient?.sourceConfig !== 'function') return false;
    const attemptedAt = this.now();
    this.state.sourceApi.lastAttemptAt = attemptedAt;
    try {
      const sourceConfig = await serverClient.sourceConfig(token);
      if (sourceConfig?.enabled !== true) {
        this.state.sourceApi = {
          ...this.state.sourceApi,
          status: 'disabled',
          applyRedemptions: false,
          lastError: null,
          baseUrl: null,
          sourceRows: 0,
          redemptions: 0,
          skippedWithoutEntryTime: 0,
          schemaKeys: [],
        };
        return false;
      }

      const result = await this.sourceClientFactory(sourceConfig).fetchRedemptions({
        dateBegin: sourceDateBegin(attemptedAt, config.timezoneOffset, sourceConfig.lookbackDays),
        timezoneOffset: config.timezoneOffset,
      });
      const applyRedemptions = result.applyRedemptions === true;
      let newlyQueued = 0;
      if (applyRedemptions) {
        for (const row of result.rows) {
          const sourceFingerprint = apiRowFingerprint(row);
          if (this.state.processedApi[sourceFingerprint]) continue;
          this.enqueueRow(row, { sourceKind: 'api', sourceFingerprint });
          newlyQueued += 1;
        }
      }
      this.state.stats.apiPolls += 1;
      this.state.stats.apiRows += result.stats.sourceRows;
      this.state.stats.apiRedemptions += newlyQueued;
      this.state.sourceApi = {
        status: applyRedemptions ? 'active' : 'diagnostic',
        applyRedemptions,
        lastAttemptAt: attemptedAt,
        lastSuccessAt: this.now(),
        lastError: null,
        baseUrl: result.baseUrl,
        sourceRows: result.stats.sourceRows,
        redemptions: result.stats.redemptions,
        skippedWithoutEntryTime: result.stats.skippedWithoutEntryTime,
        schemaKeys: result.schemaKeys,
      };
      this.logger.info('Local Dolphin API checked', {
        status: this.state.sourceApi.status,
        sourceRows: result.stats.sourceRows,
        redemptions: result.stats.redemptions,
        skippedWithoutEntryTime: result.stats.skippedWithoutEntryTime,
      });
      return true;
    } catch (error) {
      const message = publicError(error);
      this.state.sourceApi = {
        ...this.state.sourceApi,
        status: 'error',
        lastAttemptAt: attemptedAt,
        lastError: message,
      };
      this.logger.error('Local Dolphin API check failed', { error: message });
      throw error;
    }
  }

  dueRows(now) {
    return Object.values(this.state.queue)
      .filter(row => Number(row.nextAttemptAt || 0) <= now)
      .sort((left, right) => left.firstSeenAt - right.firstSeenAt)
      .slice(0, MAX_BATCH_ROWS);
  }

  async flushQueue(config, token) {
    const client = this.clientFactory(config.endpoint);
    for (let batchNumber = 0; batchNumber < MAX_BATCHES_PER_SCAN; batchNumber += 1) {
      const currentTime = this.now();
      const batch = this.dueRows(currentTime);
      if (batch.length === 0) return true;
      try {
        const response = await client.send(batch.map(row => ({
          code: row.code,
          redeemedAt: row.redeemedAt,
          sourceRecordId: row.sourceRecordId,
        })), {
          token,
          deviceId: config.deviceId,
        });
        const returnedCodes = new Set();
        for (const result of response.results || []) {
          if (!result?.code) continue;
          returnedCodes.add(result.code);
          const queued = this.state.queue[result.code];
          if (!queued) continue;
          if (result.status === 'redeemed' || result.status === 'already_redeemed') {
            if (queued.sourceFingerprint) this.state.processedApi[queued.sourceFingerprint] = currentTime;
            delete this.state.queue[result.code];
            if (result.status === 'redeemed') this.state.stats.redeemed += 1;
            else this.state.stats.alreadyRedeemed += 1;
            this.logger.info('Redemption accepted', { code: maskCode(result.code), status: result.status });
          } else if (result.status === 'unknown') {
            queued.attempts += 1;
            queued.nextAttemptAt = currentTime + DEFAULT_SCAN_INTERVAL_MS;
            this.state.stats.unknown += 1;
            if (currentTime - queued.firstSeenAt >= UNKNOWN_RETRY_TTL_MS) {
              delete this.state.queue[result.code];
              this.state.lastError = `Код ${maskCode(result.code)} не найден на сервере за 7 дней.`;
              this.logger.warn('Unknown redemption expired from queue', { code: maskCode(result.code) });
            }
          } else if (result.status === 'invalid') {
            if (queued.sourceFingerprint) this.state.processedApi[queued.sourceFingerprint] = currentTime;
            delete this.state.queue[result.code];
            this.state.stats.invalid += 1;
          }
        }
        for (const row of batch) {
          if (returnedCodes.has(row.code) || !this.state.queue[row.code]) continue;
          this.state.queue[row.code].attempts += 1;
          this.state.queue[row.code].nextAttemptAt = nextNetworkRetry(currentTime, this.state.queue[row.code].attempts);
        }
        this.state.lastSuccessAt = currentTime;
        this.state.lastError = null;
        await this.persist();
      } catch (error) {
        for (const row of batch) {
          const queued = this.state.queue[row.code];
          if (!queued) continue;
          queued.attempts += 1;
          queued.nextAttemptAt = nextNetworkRetry(currentTime, queued.attempts);
        }
        this.state.lastError = publicError(error);
        this.logger.error('Server synchronization failed', { error: publicError(error), batchSize: batch.length });
        return false;
      }
    }
    return true;
  }

  async runOnce(options = {}) {
    if (this.running) return this.status();
    this.running = true;
    this.emit();
    try {
      await this.initialize();
      const config = await this.configProvider();
      const token = await this.tokenProvider();
      if (!token) throw new Error('Компьютер ещё не подключён к tbgame.ru.');
      const serverClient = this.clientFactory(config.endpoint);
      const cycleErrors = [];

      try {
        await this.scanSourceApi(config, token, serverClient);
      } catch (error) {
        cycleErrors.push(publicError(error));
      }

      if (config.watchFolder) {
        try {
          const stat = await fs.stat(config.watchFolder);
          if (stat.isDirectory()) await this.scanFiles(config, options.force === true);
        } catch (error) {
          const message = `Резервная папка выгрузок недоступна: ${publicError(error)}`;
          if (!this.sourceClientFactory) cycleErrors.push(message);
          this.logger.warn(message);
        }
      }
      this.state.lastScanAt = this.now();
      if (Object.keys(this.state.queue).length > 0) {
        const queueOk = await this.flushQueue(config, token);
        if (!queueOk && this.state.lastError) cycleErrors.push(this.state.lastError);
      }

      if (typeof serverClient.heartbeat === 'function') {
        try {
          await serverClient.heartbeat(token, {
            deviceId: config.deviceId,
            appVersion: config.appVersion || '',
            queueSize: Object.keys(this.state.queue).length,
            lastScanAt: this.state.lastScanAt,
            sourceApi: {
              status: this.state.sourceApi.status,
              applyRedemptions: this.state.sourceApi.applyRedemptions,
              lastSuccessAt: this.state.sourceApi.lastSuccessAt,
              lastError: this.state.sourceApi.lastError,
              sourceRows: this.state.sourceApi.sourceRows,
              redemptions: this.state.sourceApi.redemptions,
              skippedWithoutEntryTime: this.state.sourceApi.skippedWithoutEntryTime,
              schemaKeys: this.state.sourceApi.schemaKeys,
            },
          });
          this.state.lastSuccessAt = this.now();
        } catch (error) {
          cycleErrors.push(publicError(error));
        }
      }
      this.state.lastError = cycleErrors[0] || this.state.lastError;
      if (cycleErrors.length === 0) this.state.lastError = null;
      await this.persist();
    } catch (error) {
      if (this.state) {
        this.state.lastError = publicError(error);
        this.state.lastScanAt = this.now();
        await this.persist();
      }
      this.logger.error('Synchronization cycle failed', publicError(error));
    } finally {
      this.running = false;
      this.emit();
    }
    return this.status();
  }

  async clearProcessedFiles() {
    await this.initialize();
    this.state.processedFiles = {};
    await this.persist();
  }
}
