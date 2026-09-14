import { promises as fs } from 'node:fs';
import path from 'node:path';

export function createDefaultAgentState() {
  return {
    version: 3,
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
    campApi: {
      status: 'waiting',
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastError: null,
      initialDate: '2023-09-01',
      currentDate: null,
      resources: {},
    },
  };
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function boundedText(value, maxLength) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function sanitizeCampSchema(value) {
  return (Array.isArray(value) ? value : []).slice(0, 40).map(field => ({
    path: boundedText(field?.path, 120),
    types: (Array.isArray(field?.types) ? field.types : [])
      .map(type => boundedText(type, 16))
      .filter(Boolean)
      .slice(0, 8),
    observed: Math.min(100_000, Math.max(0, Number(field?.observed) || 0)),
    nulls: Math.min(100_000, Math.max(0, Number(field?.nulls) || 0)),
  })).filter(field => field.path);
}

function sanitizeCampProbe(value) {
  const probe = safeObject(value);
  return {
    dateExchange: boundedText(probe.dateExchange, 10),
    baseUrl: boundedText(probe.baseUrl, 200),
    queryStyle: ['standard', 'legacy'].includes(probe.queryStyle) ? probe.queryStyle : 'standard',
    payloadType: boundedText(probe.payloadType, 16),
    containerPath: boundedText(probe.containerPath, 160),
    rowCount: Math.min(1_000_000, Math.max(0, Number(probe.rowCount) || 0)),
    profiledRows: Math.min(10_000, Math.max(0, Number(probe.profiledRows) || 0)),
    truncated: probe.truncated === true,
    byteCount: Math.min(5 * 1024 * 1024, Math.max(0, Number(probe.byteCount) || 0)),
    schemaHash: /^[a-f0-9]{64}$/i.test(probe.schemaHash || '') ? probe.schemaHash.toLowerCase() : '',
    schema: sanitizeCampSchema(probe.schema),
  };
}

function sanitizeCampResources(value) {
  const input = safeObject(value);
  if (Object.keys(input).length === 0) return {};
  const resources = {};
  for (const resource of ['guestTypes', 'services', 'accounts']) {
    const current = safeObject(input[resource]);
    resources[resource] = {
      status: ['ok', 'partial', 'error'].includes(current.status) ? current.status : 'error',
      probes: (Array.isArray(current.probes) ? current.probes : []).slice(0, 2).map(sanitizeCampProbe),
      errors: (Array.isArray(current.errors) ? current.errors : [])
        .map(error => boundedText(error, 300))
        .filter(Boolean)
        .slice(0, 2),
    };
  }
  return resources;
}

function sanitizeState(value) {
  const defaults = createDefaultAgentState();
  const state = safeObject(value);
  const processedEntries = Object.entries(safeObject(state.processedFiles)).slice(-5_000);
  const processedApiEntries = Object.entries(safeObject(state.processedApi)).slice(-5_000);
  const queueEntries = Object.entries(safeObject(state.queue)).slice(-5_000);
  const sourceApi = safeObject(state.sourceApi);
  const campApi = safeObject(state.campApi);
  return {
    ...defaults,
    ...state,
    version: 3,
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
    campApi: {
      ...defaults.campApi,
      status: ['waiting', 'disabled', 'diagnostic', 'partial', 'error'].includes(campApi.status)
        ? campApi.status
        : defaults.campApi.status,
      lastAttemptAt: Number.isFinite(Number(campApi.lastAttemptAt)) ? Number(campApi.lastAttemptAt) : null,
      lastSuccessAt: Number.isFinite(Number(campApi.lastSuccessAt)) ? Number(campApi.lastSuccessAt) : null,
      lastError: boundedText(campApi.lastError, 500) || null,
      initialDate: /^\d{4}-\d{2}-\d{2}$/.test(campApi.initialDate || '')
        ? campApi.initialDate
        : defaults.campApi.initialDate,
      currentDate: /^\d{4}-\d{2}-\d{2}$/.test(campApi.currentDate || '') ? campApi.currentDate : null,
      resources: sanitizeCampResources(campApi.resources),
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
