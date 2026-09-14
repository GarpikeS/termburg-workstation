import { createHash } from 'node:crypto';
import {
  HTTP_TIMEOUT_MS,
  MAX_SOURCE_API_BYTES,
  MAX_SOURCE_API_ROWS,
} from './constants.mjs';
import { normalizeSourceBaseUrl } from './source-api-client.mjs';

const DEFAULT_INITIAL_DATE = '2023-09-01';
const MAX_SCHEMA_FIELDS = 40;
const MAX_SCHEMA_DEPTH = 4;
const MAX_OBJECT_FIELDS = 200;
const KNOWN_CAMP_FIELDS = new Set([
  'ID', 'DATEBEGIN', 'DATEEND', 'NDOC', 'DAYCOUNT', 'ISVIP', 'ISSHAREDBALANCE', 'BALANCE',
  'ISCAR', 'CARNUMBER', 'IDCARCARD', 'TENTCOUNT', 'DESCRIPTION', 'IDUSERCREATE', 'STATUS',
  'RECORDCOLOR', 'RECORDFONT', 'IDOWNER', 'IDINOWNER', 'DATECHANGE', 'IDUSERCHANGE', 'DATEACTUAL',
  'IDSTATION', 'IDUSERCLOSE', 'IDSTATIONCLOSE', 'KINDBENEFIT', 'BENEFITDESCRIPTION', 'ISBUS',
  'IDCOMPANY', 'TIMESTART', 'IDVSTICKET', 'TIMEEND', 'ISGROUP', 'IDBENEFIT', 'IDADVSOURCE',
  'IDACCOUNTBONUSCARD', 'ISBOOKING', 'ISGUESTINHOTEL', 'ISSTAFF', 'DATEEXCHANGE', 'NAME', 'PIC',
  'TIMEBEGIN', 'TIMEUNTIL', 'ISVOUCHER', 'ISABONEMENT', 'IDGROUP', 'IDSTICKET', 'PRICE1', 'PRICE2',
  'PRICEFORKIND', 'PRICEFORVALUE', 'IDCOACH', 'ISGROUPNULL', 'IDSHOWGROUP', 'ISPOOL', 'IDPIC',
  'IDDEVISION', 'IDSUBJECT', 'KIND', 'IDGUESTTYPE', 'PRICE', 'IDTYPEDAY', 'PRICEFORKINDDOPLAT', 'PRICEDOPLAT',
  'DAYOFWEEK', 'ISSERVICE', 'SERVICEPROC', 'ISTIMEPRICEDOPLAT1', 'ISTIMEPRICEDOPLAT2',
  'PRICEDOPLAT1', 'PRICEDOPLAT2', 'TIMEPRICEDOPLAT1', 'TIMEPRICEDOPLAT2',
  'IDACCOUNT', 'IDCARD', 'IDSERVICE', 'SUMMA', 'IDPOINTOFSALE', 'IDUSER', 'DATEDOC',
  'IDTYPESALE', 'DAYNO', 'IDRSTACCOUNT', 'COMPUTERNAME', 'IDSALE', 'IDMAIN',
  'IDHOTELACCOUNTPAYMENT', 'GUIDOPER', 'IDCARDFORSERVICE', 'QUANTITY', 'ISEXTRATIME',
  'IDPARENTDOC', 'KINDCHECK', 'QUANTITYSUM',
]);
const KNOWN_CONTAINER_KEYS = new Set([
  'rows', 'data', 'items', 'result', 'guesttypes', 'guest_types', 'services', 'accounts',
  'accountsales', 'account_sales', 'типы гостей',
]);
const DEFAULT_ENDPOINTS = Object.freeze({
  guestTypes: '/api/v1/camp/guesttypes',
  services: '/api/v1/camp/services',
  accounts: '/api/v1/camp/accounts',
  accountSales: '/api/v1/camp/accountsales',
});

export class CampSourceApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'CampSourceApiError';
    this.status = options.status || 0;
  }
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeApiPath(value, fallback) {
  return typeof value === 'string' && /^\/[a-zA-Z0-9/_-]{1,180}$/.test(value)
    ? value
    : fallback;
}

export function normalizeCampSourceConfig(value = {}) {
  const urls = Array.isArray(value.baseUrls) ? value.baseUrls : [];
  const baseUrls = [...new Set(urls.map(normalizeCampBaseUrl).filter(Boolean))].slice(0, 8);
  const apiKey = typeof value.apiKey === 'string' ? value.apiKey.trim().slice(0, 256) : '';
  const inputEndpoints = value.endpoints && typeof value.endpoints === 'object' ? value.endpoints : {};
  const initialDate = isIsoDate(value.initialDate) ? value.initialDate : DEFAULT_INITIAL_DATE;
  return {
    enabled: value.enabled === true && baseUrls.length > 0 && apiKey.length >= 16,
    baseUrls,
    apiKey,
    initialDate,
    endpoints: {
      guestTypes: normalizeApiPath(inputEndpoints.guestTypes, DEFAULT_ENDPOINTS.guestTypes),
      services: normalizeApiPath(inputEndpoints.services, DEFAULT_ENDPOINTS.services),
      accounts: normalizeApiPath(inputEndpoints.accounts, DEFAULT_ENDPOINTS.accounts),
      accountSales: normalizeApiPath(inputEndpoints.accountSales, DEFAULT_ENDPOINTS.accountSales),
    },
  };
}

function timezoneDateKey(timestamp, timezoneOffset = '+03:00') {
  const match = String(timezoneOffset).match(/^([+-])(\d{2}):(\d{2})$/);
  const direction = match?.[1] === '-' ? -1 : 1;
  const offsetMs = match
    ? direction * (Number(match[2]) * 60 + Number(match[3])) * 60 * 1000
    : 3 * 60 * 60 * 1000;
  const local = new Date(Number(timestamp) + offsetMs);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
}

function normalizeCampBaseUrl(value) {
  const normalized = normalizeSourceBaseUrl(value);
  if (!normalized) return '';
  const hostname = new URL(normalized).hostname.toLowerCase();
  return hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || isPrivateIpv4(hostname)
    ? normalized
    : '';
}

function safeContainerSegment(value) {
  const normalized = String(value || '').trim();
  return KNOWN_CONTAINER_KEYS.has(normalized.toLocaleLowerCase('ru'))
    ? normalized
    : 'NODE_REDACTED';
}

function safeSchemaSegment(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return KNOWN_CAMP_FIELDS.has(normalized) ? normalized : 'FIELD_REDACTED';
}

export function normalizeCampContainerPath(value) {
  const normalized = String(value || '').trim().slice(0, 160);
  const segments = normalized.split('.');
  if (segments[0] !== '$' || segments.length > MAX_SCHEMA_DEPTH + 2) return '';
  return segments.slice(1).every(segment => (
    segment === 'NODE_REDACTED' || KNOWN_CONTAINER_KEYS.has(segment.toLocaleLowerCase('ru'))
  )) ? normalized : '';
}

export function normalizeCampSchemaPath(value) {
  const normalized = String(value || '').trim().slice(0, 120);
  if (normalized === '$value') return normalized;
  const segments = normalized.split('.');
  if (segments.length === 0 || segments.length > MAX_SCHEMA_DEPTH + 1) return '';
  return segments.every(segment => segment === 'FIELD_REDACTED' || KNOWN_CAMP_FIELDS.has(segment))
    ? normalized
    : '';
}

function findRows(value, depth = 0, containerPath = '$') {
  if (Array.isArray(value)) return { rows: value, containerPath };
  if (!value || typeof value !== 'object' || depth > MAX_SCHEMA_DEPTH) return { rows: [], containerPath };
  const entries = Object.entries(value).slice(0, MAX_OBJECT_FIELDS);
  const directArrays = entries.filter(([, nested]) => Array.isArray(nested));
  const preferred = directArrays.find(([key]) => /^(?:rows|data|items|guest_?types|services|accounts|account_?sales)$/i.test(key));
  if (preferred) {
    return { rows: preferred[1], containerPath: `${containerPath}.${safeContainerSegment(preferred[0])}` };
  }
  const nonEmpty = directArrays.find(([key, nested]) => (
    nested.length > 0 && !/^(?:errors?|warnings?|messages?)$/i.test(key)
  ));
  if (nonEmpty) {
    return { rows: nonEmpty[1], containerPath: `${containerPath}.${safeContainerSegment(nonEmpty[0])}` };
  }
  for (const [key, nested] of entries) {
    if (Array.isArray(nested)) continue;
    const found = findRows(nested, depth + 1, `${containerPath}.${safeContainerSegment(key)}`);
    if (found.rows.length > 0) return found;
  }
  if (directArrays.length > 0) {
    return {
      rows: directArrays[0][1],
      containerPath: `${containerPath}.${safeContainerSegment(directArrays[0][0])}`,
    };
  }
  return { rows: [value], containerPath };
}

function scalarType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  return typeof value;
}

function recordSchemaValue(value, path, depth, schema) {
  if (!path || schema.size >= MAX_SCHEMA_FIELDS) return;
  if (value && typeof value === 'object' && !Array.isArray(value) && depth < MAX_SCHEMA_DEPTH) {
    const entries = Object.entries(value).slice(0, MAX_OBJECT_FIELDS);
    if (entries.length === 0) {
      recordSchemaValue('[object]', path, MAX_SCHEMA_DEPTH, schema);
      return;
    }
    for (const [key, nested] of entries) {
      const safeKey = safeSchemaSegment(key);
      recordSchemaValue(nested, path ? `${path}.${safeKey}` : safeKey, depth + 1, schema);
      if (schema.size >= MAX_SCHEMA_FIELDS) break;
    }
    return;
  }
  const type = scalarType(value);
  const current = schema.get(path) || { path, types: new Set(), observed: 0, nulls: 0 };
  current.types.add(type);
  current.observed += 1;
  if (value === null) current.nulls += 1;
  schema.set(path, current);
}

export function profileCampResponse(value, options = {}) {
  const collection = findRows(value);
  const sourceRows = collection.rows.slice(0, MAX_SOURCE_API_ROWS);
  const schema = new Map();
  for (const row of sourceRows) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      for (const [key, nested] of Object.entries(row).slice(0, MAX_OBJECT_FIELDS)) {
        recordSchemaValue(nested, safeSchemaSegment(key), 0, schema);
        if (schema.size >= MAX_SCHEMA_FIELDS) break;
      }
    } else {
      recordSchemaValue(row, '$value', 0, schema);
    }
    if (schema.size >= MAX_SCHEMA_FIELDS) break;
  }
  const fields = [...schema.values()]
    .map(field => ({
      path: field.path.slice(0, 120),
      types: [...field.types].sort().slice(0, 8),
      observed: field.observed,
      nulls: field.nulls,
    }))
    .sort((left, right) => left.path.localeCompare(right.path, 'ru'));
  const payloadType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  const containerPath = collection.containerPath.slice(0, 160);
  const schemaSignature = {
    payloadType,
    containerPath,
    fields: fields.map(field => ({ path: field.path, types: field.types })),
  };
  return {
    payloadType,
    containerPath,
    rowCount: collection.rows.length,
    profiledRows: sourceRows.length,
    truncated: collection.rows.length > sourceRows.length,
    byteCount: Math.max(0, Number(options.byteCount) || 0),
    schemaHash: createHash('sha256').update(JSON.stringify(schemaSignature), 'utf8').digest('hex'),
    schema: fields,
  };
}

function requestUrl(baseUrl, apiPath, dateExchange, style) {
  const url = new URL(apiPath, `${baseUrl}/`);
  if (style === 'legacy') {
    url.pathname = `${url.pathname}&dateexchange=${encodeURIComponent(dateExchange)}`;
  } else {
    url.searchParams.set('dateexchange', dateExchange);
  }
  return url.toString();
}

async function readBoundedBody(response, maxBytes) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new CampSourceApiError('Ответ CAMP API слишком большой.');
  if (!response.body?.getReader) {
    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > maxBytes) throw new CampSourceApiError('Ответ CAMP API слишком большой.');
    return body;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let byteCount = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteCount += value.byteLength;
    if (byteCount > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new CampSourceApiError('Ответ CAMP API слишком большой.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, byteCount).toString('utf8');
}

function responseError(response, resource) {
  if (response.status === 401 || response.status === 403) return `CAMP API отклонил ключ при запросе ${resource}.`;
  if (response.status === 404) return `CAMP API не нашёл метод ${resource}.`;
  if (response.status >= 300 && response.status < 400) return `CAMP API попытался перенаправить запрос ${resource}; переход заблокирован.`;
  return `CAMP API ответил ${response.status} при запросе ${resource}.`;
}

function publicNetworkError(error) {
  if (error instanceof CampSourceApiError) return error;
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return new CampSourceApiError('CAMP API не ответил за 10 секунд.');
  }
  return new CampSourceApiError('Нет связи с CAMP API.');
}

export class CampSourceApiClient {
  constructor(config, options = {}) {
    this.config = normalizeCampSourceConfig(config);
    this.fetch = options.fetchImpl || globalThis.fetch;
    this.timeoutMs = options.timeoutMs || HTTP_TIMEOUT_MS;
    this.deadBaseUrls = new Set();
    this.preferredBaseUrl = '';
  }

  orderedBaseUrls() {
    return [...this.config.baseUrls].sort((left, right) => (
      left === this.preferredBaseUrl ? -1 : right === this.preferredBaseUrl ? 1 : 0
    ));
  }

  async fetchResource(resource, apiPath, dateExchange) {
    const failures = [];
    for (const baseUrl of this.orderedBaseUrls()) {
      if (this.deadBaseUrls.has(baseUrl)) continue;
      const styles = ['standard', 'legacy'];
      for (const style of styles) {
        try {
          const response = await this.fetch(requestUrl(baseUrl, apiPath, dateExchange, style), {
            method: 'GET',
            redirect: 'manual',
            headers: {
              Accept: 'application/json',
              'X-API-Key': this.config.apiKey,
            },
            signal: AbortSignal.timeout(this.timeoutMs),
          });
          if (!response.ok) {
            const error = new CampSourceApiError(responseError(response, resource), { status: response.status });
            failures.push(error.message);
            if (response.status === 404 && style === 'standard') continue;
            break;
          }
          const body = await readBoundedBody(response, MAX_SOURCE_API_BYTES);
          let parsed;
          try {
            const jsonBody = body.charCodeAt(0) === 0xFEFF ? body.slice(1) : body;
            parsed = JSON.parse(jsonBody);
          } catch {
            throw new CampSourceApiError(`CAMP API вернул не JSON при запросе ${resource}.`);
          }
          this.preferredBaseUrl = baseUrl;
          return {
            dateExchange,
            baseUrl,
            queryStyle: style,
            ...profileCampResponse(parsed, { byteCount: Buffer.byteLength(body, 'utf8') }),
          };
        } catch (error) {
          const normalized = publicNetworkError(error);
          failures.push(normalized.message);
          if (!(error instanceof CampSourceApiError) || error?.name === 'TimeoutError' || error?.name === 'AbortError') {
            this.deadBaseUrls.add(baseUrl);
            break;
          }
          if (normalized.status === 401 || normalized.status === 403 || (normalized.status >= 300 && normalized.status < 400)) {
            break;
          }
        }
      }
    }
    throw new CampSourceApiError(failures.at(-1) || `CAMP API недоступен при запросе ${resource}.`);
  }

  async probe(options = {}) {
    if (!this.config.enabled) throw new CampSourceApiError('Диагностика CAMP API не настроена.');
    this.deadBaseUrls.clear();
    this.preferredBaseUrl = '';
    const timestamp = Number.isFinite(Number(options.timestamp)) ? Number(options.timestamp) : Date.now();
    const currentDate = timezoneDateKey(timestamp, options.timezoneOffset);
    const plan = [
      ['guestTypes', this.config.endpoints.guestTypes, [this.config.initialDate]],
      ['services', this.config.endpoints.services, [this.config.initialDate]],
      ['accounts', this.config.endpoints.accounts, [...new Set([this.config.initialDate, currentDate])]],
      ['accountSales', this.config.endpoints.accountSales, [...new Set([this.config.initialDate, currentDate])]],
    ];
    const resources = {};
    let successCount = 0;
    let errorCount = 0;
    for (const [resource, apiPath, dates] of plan) {
      const probes = [];
      const errors = [];
      for (const dateExchange of dates) {
        try {
          probes.push(await this.fetchResource(resource, apiPath, dateExchange));
          successCount += 1;
        } catch (error) {
          errors.push(String(error?.message || error).slice(0, 300));
          errorCount += 1;
        }
      }
      resources[resource] = {
        status: errors.length === 0 ? 'ok' : probes.length > 0 ? 'partial' : 'error',
        probes,
        errors,
      };
    }
    return {
      status: successCount === 0 ? 'error' : errorCount > 0 ? 'partial' : 'diagnostic',
      initialDate: this.config.initialDate,
      currentDate,
      resources,
    };
  }
}
