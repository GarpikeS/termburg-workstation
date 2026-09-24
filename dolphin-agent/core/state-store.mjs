import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  normalizeCampContainerPath,
  normalizeCampSchemaPath,
} from './camp-source-client.mjs';

export function createDefaultAgentState() {
  return {
    version: 4,
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
    businessSync: {
      status: 'waiting',
      generationId: '',
      lastSequence: 0,
      pending: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastError: null,
    },
  };
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function boundedText(value, maxLength) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function finiteNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function boundedCount(value, maximum = 1_000_000) {
  return Math.min(maximum, Math.max(0, Number(value) || 0));
}

const CAMP_VALUE_TYPES = new Set([
  'array', 'bigint', 'boolean', 'date', 'function', 'null', 'number', 'object', 'string', 'symbol', 'undefined',
]);
const CAMP_RESOURCE_NAMES = ['guestTypes', 'services', 'accounts', 'accountSales'];
const SAFE_CAMP_ERRORS = new Set([
  'CAMP API не ответил за 10 секунд.',
  'Нет связи с CAMP API.',
  'Ответ CAMP API слишком большой.',
  'Диагностика CAMP API не настроена.',
  'CAMP API не вернул диагностические данные.',
]);
const BUSINESS_STATUSES = new Set(['waiting', 'disabled', 'active', 'blocked', 'error']);
const BUSINESS_DAY_STATUSES = new Set(['complete', 'blocked', 'incomplete']);
const BUSINESS_BLOCKERS = new Set([
  'unresolved-controller-events',
  'unresolved-staff-events',
  'no-safely-classified-guest-controller',
  'incomplete-resource',
  'schema-changed',
  'source-unavailable',
  'fiscal-semantics-unconfirmed',
]);
const BUSINESS_RESOURCE_NAMES = new Set([
  'accounts', 'cards', 'skudAreas', 'skudControllers', 'skudVerifyLogs', 'accountPayments', 'kkmCheques',
]);

function sanitizeCampError(value) {
  const message = boundedText(value, 300);
  if (SAFE_CAMP_ERRORS.has(message)) return message;
  for (const resource of CAMP_RESOURCE_NAMES) {
    if (message === `CAMP API отклонил ключ при запросе ${resource}.`
      || message === `CAMP API не нашёл метод ${resource}.`
      || message === `CAMP API попытался перенаправить запрос ${resource}; переход заблокирован.`
      || message === `CAMP API вернул не JSON при запросе ${resource}.`
      || message === `CAMP API недоступен при запросе ${resource}.`
      || new RegExp(`^CAMP API ответил [1-5][0-9]{2} при запросе ${resource}\\.$`).test(message)) {
      return message;
    }
  }
  return message ? 'Ошибка CAMP API без безопасного описания.' : '';
}

function sanitizeCampSchema(value) {
  return (Array.isArray(value) ? value : []).slice(0, 40).map(field => ({
    path: normalizeCampSchemaPath(field?.path),
    types: (Array.isArray(field?.types) ? field.types : [])
      .map(type => boundedText(type, 16))
      .filter(type => CAMP_VALUE_TYPES.has(type))
      .slice(0, 8),
    observed: Math.min(100_000, Math.max(0, Number(field?.observed) || 0)),
    nulls: Math.min(100_000, Math.max(0, Number(field?.nulls) || 0)),
  })).filter(field => field.path);
}

function sanitizeCampProbe(value) {
  const probe = safeObject(value);
  return {
    dateExchange: /^\d{4}-\d{2}-\d{2}$/.test(probe.dateExchange || '') ? probe.dateExchange : '',
    queryStyle: ['standard', 'legacy'].includes(probe.queryStyle) ? probe.queryStyle : 'standard',
    payloadType: CAMP_VALUE_TYPES.has(probe.payloadType) ? probe.payloadType : '',
    containerPath: normalizeCampContainerPath(probe.containerPath),
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
  for (const resource of CAMP_RESOURCE_NAMES) {
    if (!Object.hasOwn(input, resource)) continue;
    const current = safeObject(input[resource]);
    resources[resource] = {
      status: ['ok', 'partial', 'error'].includes(current.status) ? current.status : 'error',
      probes: (Array.isArray(current.probes) ? current.probes : []).slice(0, 2).map(sanitizeCampProbe),
      errors: (Array.isArray(current.errors) ? current.errors : [])
        .map(sanitizeCampError)
        .filter(Boolean)
        .slice(0, 2),
    };
  }
  return resources;
}

export function sanitizeCampApiState(value) {
  const defaults = createDefaultAgentState().campApi;
  const campApi = safeObject(value);
  return {
    ...defaults,
    status: ['waiting', 'disabled', 'diagnostic', 'partial', 'error'].includes(campApi.status)
      ? campApi.status
      : defaults.status,
    lastAttemptAt: Number.isFinite(Number(campApi.lastAttemptAt)) ? Number(campApi.lastAttemptAt) : null,
    lastSuccessAt: Number.isFinite(Number(campApi.lastSuccessAt)) ? Number(campApi.lastSuccessAt) : null,
    lastError: sanitizeCampError(campApi.lastError) || null,
    initialDate: /^\d{4}-\d{2}-\d{2}$/.test(campApi.initialDate || '')
      ? campApi.initialDate
      : defaults.initialDate,
    currentDate: /^\d{4}-\d{2}-\d{2}$/.test(campApi.currentDate || '') ? campApi.currentDate : null,
    resources: sanitizeCampResources(campApi.resources),
  };
}

function calendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : '';
}

function isoTimestamp(value) {
  if (typeof value !== 'string' || !value || !Number.isFinite(Date.parse(value))) return '';
  return new Date(value).toISOString();
}

function generationId(value) {
  const normalized = boundedText(value, 36).toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : '';
}

function sanitizeBusinessEnvelope(value) {
  const input = safeObject(value);
  const id = generationId(input.generationId);
  const sequence = Number(input.sequence);
  const generatedAt = isoTimestamp(input.generatedAt);
  const windowInput = safeObject(input.window);
  const from = calendarDate(windowInput.from);
  const through = calendarDate(windowInput.through);
  const completeThrough = calendarDate(windowInput.completeThrough);
  if (input.schemaVersion !== 1 || !id || !Number.isSafeInteger(sequence) || sequence < 1 || !generatedAt
    || !from || !through || !completeThrough || from > completeThrough || completeThrough > through
    || windowInput.timezone !== 'Europe/Moscow') return null;
  const rawDays = Array.isArray(input.days) ? input.days : [];
  if (rawDays.length < 1 || rawDays.length > 62) return null;
  const days = [];
  for (const valueDay of rawDays) {
    const day = safeObject(valueDay);
    const date = calendarDate(day.date);
    const uniqueVisitors = day.uniqueVisitors === null ? null : Number(day.uniqueVisitors);
    const fiscalRevenueKopecks = day.fiscalRevenueKopecks === null ? null : Number(day.fiscalRevenueKopecks);
    const fiscalPaymentRows = Number(day.fiscalPaymentRows);
    if (!date || date < from || date > through || !BUSINESS_DAY_STATUSES.has(day.visitorStatus)
      || !BUSINESS_DAY_STATUSES.has(day.revenueStatus)
      || (uniqueVisitors !== null && (!Number.isSafeInteger(uniqueVisitors) || uniqueVisitors < 0 || uniqueVisitors > 1_000_000))
      || (fiscalRevenueKopecks !== null && (!Number.isSafeInteger(fiscalRevenueKopecks)
        || Math.abs(fiscalRevenueKopecks) > 10_000_000_000_000))
      || !Number.isSafeInteger(fiscalPaymentRows) || fiscalPaymentRows < 0 || fiscalPaymentRows > 10_000_000
      || (day.visitorStatus === 'complete') !== (uniqueVisitors !== null)
      || (day.revenueStatus === 'complete') !== (fiscalRevenueKopecks !== null)) return null;
    days.push({
      date,
      uniqueVisitors,
      visitorStatus: day.visitorStatus,
      fiscalRevenueKopecks,
      revenueStatus: day.revenueStatus,
      fiscalPaymentRows,
    });
  }
  days.sort((left, right) => left.date.localeCompare(right.date));
  const expectedDays = Math.floor(
    (Date.parse(`${through}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000,
  ) + 1;
  if (days.length !== expectedDays || days[0].date !== from || days.at(-1).date !== through
    || new Set(days.map(day => day.date)).size !== days.length
    || days.some(day => day.date > completeThrough
      && (day.visitorStatus === 'complete' || day.revenueStatus === 'complete'))) return null;
  const qualityInput = safeObject(input.quality);
  const blockers = (Array.isArray(qualityInput.blockers) ? qualityInput.blockers : [])
    .filter(blocker => BUSINESS_BLOCKERS.has(blocker))
    .slice(0, 12);
  const resourceSchemaHashes = Object.fromEntries(Object.entries(safeObject(qualityInput.resourceSchemaHashes))
    .flatMap(([name, hash]) => BUSINESS_RESOURCE_NAMES.has(name) && /^[a-f0-9]{64}$/i.test(hash || '')
      ? [[name, hash.toLowerCase()]]
      : []));
  return {
    schemaVersion: 1,
    generationId: id,
    sequence,
    generatedAt,
    window: { from, through, completeThrough, timezone: 'Europe/Moscow' },
    days,
    quality: {
      dateExchangeUsable: qualityInput.dateExchangeUsable === true,
      blockers: [...new Set(blockers)],
      resourceSchemaHashes,
    },
  };
}

export function sanitizeBusinessSyncState(value) {
  const defaults = createDefaultAgentState().businessSync;
  const input = safeObject(value);
  const id = generationId(input.generationId);
  const lastSequence = id && Number.isSafeInteger(Number(input.lastSequence)) && Number(input.lastSequence) >= 0
    ? Number(input.lastSequence)
    : 0;
  const candidate = sanitizeBusinessEnvelope(input.pending);
  const pending = candidate && candidate.generationId === id && candidate.sequence > lastSequence ? candidate : null;
  return {
    ...defaults,
    status: BUSINESS_STATUSES.has(input.status) ? input.status : defaults.status,
    generationId: id,
    lastSequence,
    pending,
    lastAttemptAt: finiteNumber(input.lastAttemptAt),
    lastSuccessAt: finiteNumber(input.lastSuccessAt),
    lastError: boundedText(input.lastError, 500) || null,
  };
}

function sanitizeState(value) {
  const defaults = createDefaultAgentState();
  const state = safeObject(value);
  const processedEntries = Object.entries(safeObject(state.processedFiles)).slice(-5_000);
  const processedApiEntries = Object.entries(safeObject(state.processedApi)).slice(-5_000);
  const queueEntries = Object.entries(safeObject(state.queue)).slice(-5_000);
  const sourceApi = safeObject(state.sourceApi);
  const inputStats = safeObject(state.stats);
  return {
    version: 4,
    processedFiles: Object.fromEntries(processedEntries),
    processedApi: Object.fromEntries(processedApiEntries),
    queue: Object.fromEntries(queueEntries),
    stats: Object.fromEntries(Object.keys(defaults.stats).map(key => [key, boundedCount(inputStats[key])])),
    lastScanAt: finiteNumber(state.lastScanAt),
    lastSuccessAt: finiteNumber(state.lastSuccessAt),
    lastError: boundedText(state.lastError, 500) || null,
    sourceApi: {
      status: ['waiting', 'disabled', 'diagnostic', 'active', 'error'].includes(sourceApi.status)
        ? sourceApi.status
        : defaults.sourceApi.status,
      applyRedemptions: sourceApi.applyRedemptions === true,
      lastAttemptAt: finiteNumber(sourceApi.lastAttemptAt),
      lastSuccessAt: finiteNumber(sourceApi.lastSuccessAt),
      lastError: boundedText(sourceApi.lastError, 500) || null,
      baseUrl: boundedText(sourceApi.baseUrl, 200) || null,
      sourceRows: boundedCount(sourceApi.sourceRows, 100_000),
      redemptions: boundedCount(sourceApi.redemptions, 100_000),
      skippedWithoutEntryTime: boundedCount(sourceApi.skippedWithoutEntryTime, 100_000),
      schemaKeys: Array.isArray(sourceApi.schemaKeys)
        ? sourceApi.schemaKeys.map(value => String(value).slice(0, 60)).slice(0, 40)
        : [],
    },
    campApi: sanitizeCampApiState(state.campApi),
    businessSync: sanitizeBusinessSyncState(state.businessSync),
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
