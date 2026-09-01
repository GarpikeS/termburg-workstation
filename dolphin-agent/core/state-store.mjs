import { promises as fs } from 'node:fs';
import path from 'node:path';

export function createDefaultAgentState() {
  return {
    version: 2,
    processedFiles: {},
    processedApi: {},
    queue: {},
    stats: {
      filesProcessed: 0,
      rowsFound: 0,
      apiPolls: 0,
      apiRows: 0,
      apiRedemptions: 0,
      redeemed: 0,
      alreadyRedeemed: 0,
      invalid: 0,
      unknown: 0,
    },
    lastScanAt: null,
    lastSuccessAt: null,
    lastError: null,
    sourceApi: {
      status: 'waiting',
      applyRedemptions: false,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastError: null,
      baseUrl: null,
      sourceRows: 0,
      redemptions: 0,
      skippedWithoutEntryTime: 0,
      schemaKeys: [],
    },
  };
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sanitizeState(value) {
  const defaults = createDefaultAgentState();
  const state = safeObject(value);
  const processedEntries = Object.entries(safeObject(state.processedFiles)).slice(-5_000);
  const processedApiEntries = Object.entries(safeObject(state.processedApi)).slice(-5_000);
  const queueEntries = Object.entries(safeObject(state.queue)).slice(-5_000);
  const sourceApi = safeObject(state.sourceApi);
  return {
    ...defaults,
    ...state,
    version: 2,
    processedFiles: Object.fromEntries(processedEntries),
    processedApi: Object.fromEntries(processedApiEntries),
    queue: Object.fromEntries(queueEntries),
    stats: { ...defaults.stats, ...safeObject(state.stats) },
    sourceApi: {
      ...defaults.sourceApi,
      ...sourceApi,
      schemaKeys: Array.isArray(sourceApi.schemaKeys)
        ? sourceApi.schemaKeys.map(value => String(value).slice(0, 60)).slice(0, 40)
        : [],
    },
  };
}

export class AtomicJsonStore {
  constructor(filePath, defaultFactory = () => ({})) {
    this.filePath = path.resolve(filePath);
    this.backupPath = `${this.filePath}.bak`;
    this.defaultFactory = defaultFactory;
  }

  async load() {
    for (const candidate of [this.filePath, this.backupPath]) {
      try {
        return sanitizeState(JSON.parse(await fs.readFile(candidate, 'utf8')));
      } catch (error) {
        if (error?.code === 'ENOENT') continue;
      }
    }
    return sanitizeState(this.defaultFactory());
  }

  async save(value) {
    const normalized = sanitizeState(value);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    try {
      await fs.copyFile(this.filePath, this.backupPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    await fs.copyFile(temporaryPath, this.filePath);
    await fs.rm(temporaryPath, { force: true });
    return normalized;
  }
}

export function createAgentStateStore(filePath) {
  return new AtomicJsonStore(filePath, createDefaultAgentState);
}
