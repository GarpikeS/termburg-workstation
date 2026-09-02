import { createHash } from 'node:crypto';
import {
  HTTP_TIMEOUT_MS,
  MAX_SOURCE_API_BYTES,
  MAX_SOURCE_API_ROWS,
} from './constants.mjs';
import { parseDolphinEntryTime } from './redemption-extractor.mjs';

const EXACT_CODE_PATTERN = /\bTB-[A-F0-9]{8}\b/i;
const TIME_KEY_PATTERN = /(время.*вход|дата.*вход|дата.*использ|entry|redeem|used|visit|date.*in|time.*in|datetime|timestamp)/i;
const RECORD_KEY_PATTERN = /^(id|номер|number|record.?id|operation.?id|barcode.?id)$/i;
const COLLECTION_KEYS = ['data', 'items', 'rows', 'result', 'barcodes', 'records'];
const DEFAULT_PATH = '/api/v1/barcodes/game';

export class DolphinSourceApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'DolphinSourceApiError';
    this.status = options.status || 0;
  }
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
}

export function normalizeSourceBaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ''));
  } catch {
    return '';
  }
  if (parsed.username || parsed.password || !['http:', 'https:'].includes(parsed.protocol)) return '';
  const hostname = parsed.hostname.toLowerCase();
  const localHost = hostname === 'localhost' || hostname === '::1' || isPrivateIpv4(hostname);
  if (parsed.protocol === 'http:' && !localHost) return '';
  parsed.pathname = parsed.pathname.replace(/\/$/, '') || '/';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

export function normalizeSourceConfig(value = {}) {
  const urls = Array.isArray(value.baseUrls) ? value.baseUrls : [];
  const baseUrls = [...new Set(urls.map(normalizeSourceBaseUrl).filter(Boolean))].slice(0, 8);
  const apiKey = typeof value.apiKey === 'string' ? value.apiKey.trim().slice(0, 256) : '';
  const apiPath = typeof value.apiPath === 'string' && /^\/[a-zA-Z0-9/_-]{1,180}$/.test(value.apiPath)
    ? value.apiPath
    : DEFAULT_PATH;
  const lookbackDays = Number.isInteger(value.lookbackDays)
    ? Math.min(7, Math.max(0, value.lookbackDays))
    : 2;
  return {
    enabled: value.enabled === true && baseUrls.length > 0 && apiKey.length >= 16,
    baseUrls,
    apiKey,
    apiPath,
    lookbackDays,
    applyRedemptions: value.applyRedemptions === true,
  };
}

function safeSchemaKey(value) {
  return String(value || '')
    .trim()
    .replace(/[^\p{L}\p{N}_. -]/gu, '')
    .slice(0, 60);
}

function objectEntriesDeep(value, depth = 0, prefix = '') {
  if (!value || typeof value !== 'object' || depth > 3) return [];
  const output = [];
  for (const [key, nested] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      output.push(...objectEntriesDeep(nested, depth + 1, fullKey));
    } else if (!Array.isArray(nested)) {
      output.push({ key: fullKey, leafKey: key, value: nested });
    }
  }
  return output;
}

function findCollections(value, depth = 0) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object' || depth > 3) return [];
  for (const key of COLLECTION_KEYS) {
    if (Array.isArray(value[key])) return value[key];
  }
  for (const nested of Object.values(value)) {
    const found = findCollections(nested, depth + 1);
    if (found.length > 0) return found;
  }
  return [value];
}

function codeFromEntries(entries) {
  for (const entry of entries) {
    const match = String(entry.value ?? '').toUpperCase().match(EXACT_CODE_PATTERN);
    if (match) return match[0];
  }
  return '';
}

function timeFromEntries(entries, timezoneOffset) {
  const preferred = entries.filter(entry => TIME_KEY_PATTERN.test(entry.leafKey) || TIME_KEY_PATTERN.test(entry.key));
  for (const entry of preferred) {
    const parsed = parseDolphinEntryTime(entry.value, timezoneOffset);
    if (parsed) return parsed;
  }
  return '';
}

function recordIdFromEntries(entries, code, redeemedAt) {
  const preferred = entries.find(entry => RECORD_KEY_PATTERN.test(entry.leafKey));
  const value = String(preferred?.value ?? '').trim().slice(0, 80);
  if (value) return value;
  return `api-${createHash('sha256').update(`${code}|${redeemedAt}`, 'utf8').digest('hex').slice(0, 24)}`;
}

export function extractRedemptionsFromApi(value, options = {}) {
  const timezoneOffset = /^[-+]\d{2}:\d{2}$/.test(options.timezoneOffset || '')
    ? options.timezoneOffset
    : '+03:00';
  const sourceRows = findCollections(value).slice(0, MAX_SOURCE_API_ROWS);
  const schemaKeys = new Set();
  const byCode = new Map();
  let rowsWithCode = 0;
  let skippedWithoutEntryTime = 0;

  for (const sourceRow of sourceRows) {
    if (!sourceRow || typeof sourceRow !== 'object' || Array.isArray(sourceRow)) continue;
    const entries = objectEntriesDeep(sourceRow);
    for (const entry of entries) {
      const key = safeSchemaKey(entry.key);
      if (key && schemaKeys.size < 40) schemaKeys.add(key);
    }
    const code = codeFromEntries(entries);
    if (!code) continue;
    rowsWithCode += 1;
    const redeemedAt = timeFromEntries(entries, timezoneOffset)
      || (options.allowBarcodeOnly === true ? String(options.fallbackRedeemedAt || '') : '');
    if (!redeemedAt) {
      skippedWithoutEntryTime += 1;
      continue;
    }
    if (!byCode.has(code)) {
      byCode.set(code, {
        code,
        redeemedAt,
        sourceRecordId: recordIdFromEntries(entries, code, redeemedAt),
      });
    }
  }

  return {
    rows: [...byCode.values()],
    schemaKeys: [...schemaKeys],
    stats: {
      sourceRows: sourceRows.length,
      rowsWithCode,
      redemptions: byCode.size,
      skippedWithoutEntryTime,
    },
  };
}

function requestUrls(baseUrl, apiPath, dateBegin) {
  const standard = new URL(apiPath, `${baseUrl}/`);
  standard.searchParams.set('datebegin', dateBegin);
  const legacy = new URL(apiPath, `${baseUrl}/`);
  legacy.pathname = `${legacy.pathname}&datebegin=${encodeURIComponent(dateBegin)}`;
  return [standard.toString(), legacy.toString()];
}

async function errorMessage(response) {
  if (response.status === 401 || response.status === 403) return 'Локальный API Dolphin отклонил API-ключ.';
  if (response.status === 404) return 'Локальный API Dolphin не нашёл метод штрихкодов.';
  return `Локальный API Dolphin ответил ${response.status}.`;
}

export class DolphinSourceApiClient {
  constructor(config, options = {}) {
    this.config = normalizeSourceConfig(config);
    this.fetch = options.fetchImpl || globalThis.fetch;
    this.timeoutMs = options.timeoutMs || HTTP_TIMEOUT_MS;
  }

  async fetchRedemptions(options = {}) {
    if (!this.config.enabled) throw new DolphinSourceApiError('Локальный API Dolphin не настроен.');
    const failures = [];
    for (const baseUrl of this.config.baseUrls) {
      for (const url of requestUrls(baseUrl, this.config.apiPath, options.dateBegin)) {
        try {
          const response = await this.fetch(url, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'X-API-Key': this.config.apiKey,
            },
            signal: AbortSignal.timeout(this.timeoutMs),
          });
          if (!response.ok) {
            const message = await errorMessage(response);
            failures.push(message);
            if (response.status === 404) continue;
            break;
          }
          const length = Number(response.headers.get('content-length') || 0);
          if (length > MAX_SOURCE_API_BYTES) throw new DolphinSourceApiError('Ответ локального API Dolphin слишком большой.');
          const body = await response.text();
          if (Buffer.byteLength(body, 'utf8') > MAX_SOURCE_API_BYTES) {
            throw new DolphinSourceApiError('Ответ локального API Dolphin слишком большой.');
          }
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch {
            throw new DolphinSourceApiError('Локальный API Dolphin вернул не JSON.');
          }
          const extracted = extractRedemptionsFromApi(parsed, {
            timezoneOffset: options.timezoneOffset,
            allowBarcodeOnly: this.config.applyRedemptions,
            fallbackRedeemedAt: options.fallbackRedeemedAt,
          });
          return {
            ...extracted,
            baseUrl,
            applyRedemptions: this.config.applyRedemptions,
          };
        } catch (error) {
          failures.push(error instanceof DolphinSourceApiError
            ? error.message
            : error?.name === 'TimeoutError'
              ? 'Локальный API Dolphin не ответил за 10 секунд.'
              : 'Нет связи с локальным API Dolphin.');
        }
      }
    }
    throw new DolphinSourceApiError(failures.at(-1) || 'Локальный API Dolphin недоступен.');
  }
}
