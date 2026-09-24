import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { createAccountService } from './account-service.mjs';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_ADMIN_BODY_BYTES = 256 * 1024;
const MAX_CONNECTOR_HEARTBEAT_BYTES = 128 * 1024;
const MAX_DOLPHIN_BUSINESS_SUMMARY_BYTES = 256 * 1024;
const MAX_DOLPHIN_BUSINESS_DAYS = 62;
const MAX_REDEMPTION_IMPORT_ROWS = 2_000;
const DEFAULT_RATE_LIMIT = 5;
const DEFAULT_RATE_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_CONNECTOR_RATE_LIMIT = 60;
const DEFAULT_CONNECTOR_RATE_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_ENROLLMENT_RATE_LIMIT = 10;
const DEFAULT_ENROLLMENT_RATE_WINDOW_MS = 10 * 60 * 1000;
const REWARD_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const REWARD_PRICE = 50;
const REWARD_CONSENT_VERSION = 'reward-2026-08-12';
const FOUR_GAME_CAMPAIGN_ID = 'four-games-v1';
const CATEGORIES = new Set(['bug', 'idea', 'visual', 'other']);
const CAMP_VALUE_TYPES = new Set([
  'array', 'bigint', 'boolean', 'date', 'function', 'null', 'number', 'object', 'string', 'symbol', 'undefined',
]);
// Keep this transport allowlist aligned with dolphin-agent/core/camp-source-client.mjs.
// Schema names outside the documented CAMP metadata contract are deliberately redacted.
const CAMP_SCHEMA_FIELDS = new Set([
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
const CAMP_RESOURCE_NAMES = ['guestTypes', 'services', 'accounts', 'accountSales'];
const TRUSTED_CAMP_HTTP_ORIGINS = new Set([
  'http://85.202.234.197:60888',
]);
const SAFE_CAMP_ERRORS = new Set([
  'CAMP API не ответил за 10 секунд.',
  'Нет связи с CAMP API.',
  'Ответ CAMP API слишком большой.',
  'Диагностика CAMP API не настроена.',
  'CAMP API не вернул диагностические данные.',
]);
const REWARD_CITIES = new Set(['Москва', 'Зеленогорск']);
const REWARD_CITY_TIMEZONES = {
  Москва: 'Europe/Moscow',
  Зеленогорск: 'Asia/Krasnoyarsk',
};
const REWARD_CODE_PATTERN = /^TB-[A-F0-9]{8}$/;
const CASHIER_EXPORT_FIELDS = [
  'code',
  'city',
  'name',
  'phone',
  'purchasedAt',
  'expiresAt',
  'status',
];
const DOLPHIN_BUSINESS_SCOPE_BY_DEVICE_LOCATION = Object.freeze({
  moscow: 'pechatniki',
  zelenogorsk: 'zelenogorsk',
});
const DOLPHIN_BUSINESS_SCOPES = new Set(Object.values(DOLPHIN_BUSINESS_SCOPE_BY_DEVICE_LOCATION));
const DOLPHIN_BUSINESS_DAY_STATUSES = new Set(['complete', 'blocked', 'incomplete']);
const DOLPHIN_BUSINESS_RESOURCE_NAMES = new Set([
  'accountPayments', 'skudVerifyLogs', 'cards', 'skudAreas', 'skudControllers', 'accounts', 'kkmCheques',
]);
const DOLPHIN_BUSINESS_BLOCKERS = new Set([
  'unresolved-controller-events',
  'unresolved-staff-events',
  'no-safely-classified-guest-controller',
  'incomplete-resource',
  'schema-changed',
  'source-unavailable',
  'fiscal-semantics-unconfirmed',
]);

function sendJson(response, statusCode, value, extraHeaders = {}) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    ...extraHeaders,
  });
  response.end(body);
}

function sendText(response, statusCode, body, contentType, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    ...extraHeaders,
  });
  response.end(body);
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isCalendarDate(value) {
  if (!isIsoDate(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isoTimestamp(value) {
  if (typeof value !== 'string' || value.length > 40) return '';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function exactKeys(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => allowed.has(key));
}

function isDolphinBusinessStore(value) {
  return value?.schemaVersion === 1
    && value.scopes
    && typeof value.scopes === 'object'
    && !Array.isArray(value.scopes);
}

function dolphinBusinessWriterDeviceId(entry) {
  for (const candidate of [entry?.writerDeviceId, entry?.deviceId]) {
    if (typeof candidate === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(candidate)) return candidate;
  }
  return '';
}

function sanitizeDolphinBusinessUpload(value, currentTime = Date.now()) {
  if (!exactKeys(value, new Set(['schemaVersion', 'generationId', 'sequence', 'generatedAt', 'window', 'days', 'quality']))) return null;
  if (value.schemaVersion !== 1) return null;
  const generationId = text(value.generationId, 36).toLowerCase();
  const sequence = Number(value.sequence);
  const generatedAt = isoTimestamp(value.generatedAt);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(generationId)
    || !Number.isSafeInteger(sequence) || sequence < 1 || !generatedAt
    || Date.parse(generatedAt) > currentTime + 5 * 60 * 1000) return null;

  const window = value.window;
  if (!exactKeys(window, new Set(['from', 'through', 'completeThrough', 'timezone']))
    || !isCalendarDate(window.from) || !isCalendarDate(window.through) || !isCalendarDate(window.completeThrough)
    || window.from > window.completeThrough || window.completeThrough > window.through
    || window.timezone !== 'Europe/Moscow') return null;

  if (!Array.isArray(value.days) || value.days.length === 0 || value.days.length > MAX_DOLPHIN_BUSINESS_DAYS) return null;
  const dates = new Set();
  const days = [];
  for (const input of value.days) {
    if (!exactKeys(input, new Set([
      'date', 'uniqueVisitors', 'visitorStatus', 'fiscalRevenueKopecks', 'revenueStatus', 'fiscalPaymentRows',
    ])) || !isCalendarDate(input.date) || input.date < window.from || input.date > window.through
      || !DOLPHIN_BUSINESS_DAY_STATUSES.has(input.visitorStatus)
      || !DOLPHIN_BUSINESS_DAY_STATUSES.has(input.revenueStatus) || dates.has(input.date)) return null;
    const uniqueVisitors = input.uniqueVisitors === null ? null : Number(input.uniqueVisitors);
    const fiscalRevenueKopecks = input.fiscalRevenueKopecks === null ? null : Number(input.fiscalRevenueKopecks);
    const fiscalPaymentRows = Number(input.fiscalPaymentRows);
    if (uniqueVisitors !== null && (!Number.isSafeInteger(uniqueVisitors) || uniqueVisitors < 0 || uniqueVisitors > 1_000_000)) return null;
    if (fiscalRevenueKopecks !== null && (!Number.isSafeInteger(fiscalRevenueKopecks) || Math.abs(fiscalRevenueKopecks) > 10_000_000_000_000)) return null;
    if (!Number.isSafeInteger(fiscalPaymentRows) || fiscalPaymentRows < 0 || fiscalPaymentRows > 10_000_000) return null;
    if (input.visitorStatus === 'complete' && uniqueVisitors === null) return null;
    if (input.revenueStatus === 'complete' && fiscalRevenueKopecks === null) return null;
    if (input.visitorStatus !== 'complete' && uniqueVisitors !== null) return null;
    if (input.revenueStatus !== 'complete' && fiscalRevenueKopecks !== null) return null;
    dates.add(input.date);
    days.push({
      date: input.date,
      uniqueVisitors,
      visitorStatus: input.visitorStatus,
      fiscalRevenueKopecks,
      revenueStatus: input.revenueStatus,
      fiscalPaymentRows,
    });
  }
  days.sort((left, right) => left.date.localeCompare(right.date));
  if (days[0].date !== window.from || days.at(-1).date !== window.through) return null;
  const expectedDayCount = Math.floor(
    (Date.parse(`${window.through}T00:00:00.000Z`) - Date.parse(`${window.from}T00:00:00.000Z`)) / 86_400_000,
  ) + 1;
  if (days.length !== expectedDayCount) return null;
  if (days.some(day => day.date > window.completeThrough
    && (day.visitorStatus === 'complete' || day.revenueStatus === 'complete'))) return null;

  const quality = value.quality;
  if (!exactKeys(quality, new Set(['dateExchangeUsable', 'blockers', 'resourceSchemaHashes']))
    || typeof quality.dateExchangeUsable !== 'boolean' || !Array.isArray(quality.blockers)
    || quality.blockers.length > 12 || !quality.blockers.every(blocker => DOLPHIN_BUSINESS_BLOCKERS.has(blocker))
    || !quality.resourceSchemaHashes || typeof quality.resourceSchemaHashes !== 'object'
    || Array.isArray(quality.resourceSchemaHashes)) return null;
  const resourceSchemaHashes = {};
  for (const [resource, hash] of Object.entries(quality.resourceSchemaHashes)) {
    if (!DOLPHIN_BUSINESS_RESOURCE_NAMES.has(resource) || !/^[a-f0-9]{64}$/i.test(hash)) return null;
    resourceSchemaHashes[resource] = hash.toLowerCase();
  }

  return {
    schemaVersion: 1,
    generationId,
    sequence,
    generatedAt,
    window: { ...window },
    days,
    quality: {
      dateExchangeUsable: quality.dateExchangeUsable,
      blockers: [...quality.blockers],
      resourceSchemaHashes,
    },
  };
}

function localDateKey(timestamp, city) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REWARD_CITY_TIMEZONES[city] || 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const part = type => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

async function readJsonBody(request, maxBytes = MAX_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function text(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function requestIp(request) {
  const realIp = request.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp) return realIp.trim();
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return request.socket.remoteAddress || 'unknown';
}

function normalizedPhone(value) {
  const digits = text(value, 40).replace(/\D/g, '');
  if (digits.length === 10) return `+7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return '';
}

function publicClaim(claim, redemption = null, currentTime = Date.now()) {
  const status = redemption ? 'redeemed' : claim.expiresAt > currentTime ? 'active' : 'expired';
  return {
    id: claim.id,
    rewardId: claim.rewardId,
    code: claim.code,
    purchasedAt: claim.purchasedAt,
    expiresAt: claim.expiresAt,
    nextPurchaseAt: claim.nextPurchaseAt,
    status,
    ...(claim.campaignId === FOUR_GAME_CAMPAIGN_ID ? { campaignId: FOUR_GAME_CAMPAIGN_ID } : {}),
    ...(redemption ? { redeemedAt: redemption.redeemedAt } : {}),
  };
}

function normalizeRewardCode(value) {
  const code = text(value, 32).toUpperCase();
  return REWARD_CODE_PATTERN.test(code) ? code : '';
}

function redemptionMap(entries) {
  const byCode = new Map();
  for (const entry of entries) {
    if (entry?.code && !byCode.has(entry.code)) byCode.set(entry.code, entry);
  }
  return byCode;
}

function sha256(value) {
  return createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function equalHex(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(left || '') || !/^[a-f0-9]{64}$/i.test(right || '')) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function emptyConnectorState() {
  return { version: 1, connectors: [], enrollments: [] };
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
}

function normalizeDolphinSourceUrls(value, options = {}) {
  const allowedPublicHttpOrigins = options.allowedPublicHttpOrigins instanceof Set
    ? options.allowedPublicHttpOrigins
    : new Set();
  const candidates = Array.isArray(value) ? value : String(value || '').split(',');
  const normalized = candidates.flatMap(candidate => {
    try {
      const url = new URL(String(candidate || '').trim());
      if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) return [];
      const hostname = url.hostname.toLowerCase();
      const privateHost = hostname === 'localhost' || hostname === '::1' || isPrivateIpv4(hostname);
      const approvedPublicHttp = url.protocol === 'http:' && allowedPublicHttpOrigins.has(url.origin);
      if (url.protocol === 'http:' && !privateHost && !approvedPublicHttp) return [];
      url.pathname = '/';
      url.search = '';
      url.hash = '';
      return [url.toString().replace(/\/$/, '')];
    } catch {
      return [];
    }
  });
  return [...new Set(normalized)].slice(0, 8);
}

function normalizeDolphinApiPath(value, fallback) {
  return typeof value === 'string' && /^\/[a-zA-Z0-9/_-]{1,180}$/.test(value)
    ? value
    : fallback;
}

function safeCampSchemaPath(value) {
  const normalized = text(value, 120);
  if (normalized === '$value') return normalized;
  const segments = normalized.split('.');
  return segments.length > 0
    && segments.length <= 5
    && segments.every(segment => segment === 'FIELD_REDACTED' || CAMP_SCHEMA_FIELDS.has(segment))
    ? normalized
    : '';
}

function sanitizeCampError(value) {
  const message = text(value, 300);
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

function safeCampContainerPath(value) {
  const normalized = text(value, 160);
  const safeSegments = new Set([
    'rows', 'data', 'items', 'result', 'guesttypes', 'guestTypes', 'guest_types', 'services', 'accounts',
    'accountsales', 'accountSales', 'account_sales', 'Типы гостей', 'NODE_REDACTED',
  ]);
  const segments = normalized.split('.');
  return segments[0] === '$'
    && segments.length <= 6
    && segments.slice(1).every(segment => safeSegments.has(segment))
    ? normalized
    : null;
}

function sanitizeCampSchema(value) {
  return (Array.isArray(value) ? value : []).slice(0, 40).flatMap(field => {
    const fieldPath = safeCampSchemaPath(field?.path);
    if (!fieldPath) return [];
    return [{
      path: fieldPath,
      types: (Array.isArray(field?.types) ? field.types : [])
        .map(type => text(type, 16))
        .filter(type => CAMP_VALUE_TYPES.has(type))
        .slice(0, 8),
      observed: Math.min(100_000, Math.max(0, Number(field?.observed) || 0)),
      nulls: Math.min(100_000, Math.max(0, Number(field?.nulls) || 0)),
    }];
  });
}

function sanitizeCampProbe(value) {
  const probe = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    dateExchange: isIsoDate(probe.dateExchange) ? probe.dateExchange : null,
    queryStyle: probe.queryStyle === 'legacy' ? 'legacy' : 'standard',
    payloadType: CAMP_VALUE_TYPES.has(probe.payloadType) ? probe.payloadType : null,
    containerPath: safeCampContainerPath(probe.containerPath),
    rowCount: Math.min(1_000_000, Math.max(0, Number(probe.rowCount) || 0)),
    profiledRows: Math.min(10_000, Math.max(0, Number(probe.profiledRows) || 0)),
    truncated: probe.truncated === true,
    byteCount: Math.min(5 * 1024 * 1024, Math.max(0, Number(probe.byteCount) || 0)),
    schemaHash: /^[a-f0-9]{64}$/i.test(probe.schemaHash || '') ? probe.schemaHash.toLowerCase() : null,
    schema: sanitizeCampSchema(probe.schema),
  };
}

function sanitizeCampResources(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(CAMP_RESOURCE_NAMES.flatMap(resourceName => {
    const resource = input[resourceName];
    if (!resource || typeof resource !== 'object' || Array.isArray(resource)) return [];
    return [[resourceName, {
      status: ['ok', 'partial', 'error'].includes(resource.status) ? resource.status : 'error',
      probes: (Array.isArray(resource.probes) ? resource.probes : []).slice(0, 2).map(sanitizeCampProbe),
      errors: (Array.isArray(resource.errors) ? resource.errors : [])
        .map(sanitizeCampError)
        .filter(Boolean)
        .slice(0, 2),
    }]];
  }));
}

function sanitizeCampHeartbeat(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    status: ['waiting', 'disabled', 'diagnostic', 'partial', 'error'].includes(source.status)
      ? source.status
      : 'waiting',
    lastAttemptAt: Number.isFinite(Number(source.lastAttemptAt)) ? Number(source.lastAttemptAt) : null,
    lastSuccessAt: Number.isFinite(Number(source.lastSuccessAt)) ? Number(source.lastSuccessAt) : null,
    lastError: sanitizeCampError(source.lastError) || null,
    initialDate: isIsoDate(source.initialDate) ? source.initialDate : null,
    currentDate: isIsoDate(source.currentDate) ? source.currentDate : null,
    resources: sanitizeCampResources(source.resources),
  };
}

function sanitizeDolphinHeartbeat(value) {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const source = payload.sourceApi && typeof payload.sourceApi === 'object' && !Array.isArray(payload.sourceApi)
    ? payload.sourceApi
    : {};
  const sourceStatus = new Set(['waiting', 'disabled', 'diagnostic', 'active', 'error']).has(source.status)
    ? source.status
    : 'waiting';
  return {
    appVersion: text(payload.appVersion, 24) || null,
    queueSize: Math.min(5_000, Math.max(0, Number(payload.queueSize) || 0)),
    lastScanAt: Number.isFinite(Number(payload.lastScanAt)) ? Number(payload.lastScanAt) : null,
    sourceApi: {
      status: sourceStatus,
      applyRedemptions: source.applyRedemptions === true,
      lastSuccessAt: Number.isFinite(Number(source.lastSuccessAt)) ? Number(source.lastSuccessAt) : null,
      lastError: text(source.lastError, 500) || null,
      sourceRows: Math.min(100_000, Math.max(0, Number(source.sourceRows) || 0)),
      redemptions: Math.min(100_000, Math.max(0, Number(source.redemptions) || 0)),
      skippedWithoutEntryTime: Math.min(100_000, Math.max(0, Number(source.skippedWithoutEntryTime) || 0)),
      schemaKeys: Array.isArray(source.schemaKeys)
        ? source.schemaKeys.map(key => text(key, 60)).filter(Boolean).slice(0, 40)
        : [],
    },
    campApi: sanitizeCampHeartbeat(payload.campApi),
  };
}

export function createFeedbackService(options) {
  const {
    dataFile,
    claimsDataFile,
    redemptionsDataFile,
    host = '127.0.0.1',
    port = 4175,
    allowedOrigin = '',
    rateLimit = DEFAULT_RATE_LIMIT,
    rateWindowMs = DEFAULT_RATE_WINDOW_MS,
    logger = console,
    now = () => Date.now(),
    cashierExportToken = '',
    rewardAdminToken = '',
    dolphinConnectorToken = '',
    dolphinEnrollmentTokenHash = '',
    dolphinEnrollmentLocationCode = '',
    dolphinConnectorsDataFile = '',
    dolphinBusinessSummariesDataFile = '',
    dolphinBusinessInternalToken = '',
    dolphinSourceApiKey = '',
    dolphinSourceApiUrls = '',
    dolphinSourceApiPath = '/api/v1/barcodes/game',
    dolphinSourceApply = false,
    dolphinSourceLookbackDays = 2,
    dolphinCampSourceEnabled = false,
    dolphinCampSourceApiUrls = '',
    dolphinCampInitialDate = '2023-09-01',
    dolphinCampGuestTypesPath = '/api/v1/camp/guesttypes',
    dolphinCampServicesPath = '/api/v1/camp/services',
    dolphinCampAccountsPath = '/api/v1/camp/accounts',
    dolphinCampAccountSalesPath = '/api/v1/camp/accountsales',
    dolphinCampBusinessEnabled = false,
    dolphinCampBusinessLookbackDays = 7,
    dolphinCampAccountPaymentsPath = '/api/v1/camp/accountpayments',
    dolphinCampSkudVerifyLogsPath = '/api/v1/camp/skudverifylogs',
    dolphinCampCardsPath = '/api/v1/camp/cards',
    dolphinCampSkudAreasPath = '/api/v1/camp/skudareas',
    dolphinCampSkudControllersPath = '/api/v1/camp/skudcontrollers',
    dolphinCampKkmChequesPath = '/api/v1/camp/kkmcheques',
    dolphinSourceProfiles = {},
    connectorRateLimit = DEFAULT_CONNECTOR_RATE_LIMIT,
    connectorRateWindowMs = DEFAULT_CONNECTOR_RATE_WINDOW_MS,
    enrollmentRateLimit = DEFAULT_ENROLLMENT_RATE_LIMIT,
    enrollmentRateWindowMs = DEFAULT_ENROLLMENT_RATE_WINDOW_MS,
    accountOptions = {},
  } = options;

  if (!dataFile) throw new Error('dataFile is required');

  const resolvedDataFile = path.resolve(dataFile);
  const resolvedClaimsDataFile = path.resolve(claimsDataFile || path.join(path.dirname(dataFile), 'reward-claims.jsonl'));
  const resolvedRedemptionsDataFile = path.resolve(redemptionsDataFile || path.join(path.dirname(dataFile), 'reward-redemptions.jsonl'));
  const resolvedDolphinConnectorsDataFile = path.resolve(
    dolphinConnectorsDataFile || path.join(path.dirname(dataFile), 'dolphin-connectors.json'),
  );
  const resolvedDolphinBusinessSummariesDataFile = path.resolve(
    dolphinBusinessSummariesDataFile || path.join(path.dirname(dataFile), 'dolphin-business-summaries.json'),
  );
  const resolvedDolphinBusinessSummariesBackupFile = `${resolvedDolphinBusinessSummariesDataFile}.bak`;
  function normalizeSourceProfile(value = {}) {
    const apiPath = normalizeDolphinApiPath(value.apiPath, '/api/v1/barcodes/game');
    const apiUrls = normalizeDolphinSourceUrls(value.apiUrls);
    const campUrls = normalizeDolphinSourceUrls(value.campApiUrls || value.apiUrls, {
      allowedPublicHttpOrigins: TRUSTED_CAMP_HTTP_ORIGINS,
    });
    const campEndpoints = value.campEndpoints && typeof value.campEndpoints === 'object'
      ? value.campEndpoints
      : {};
    return {
      urls: apiUrls,
      apiKey: text(value.apiKey, 256),
      apiPath,
      lookbackDays: Math.min(7, Math.max(0, Number(value.lookbackDays) || 0)),
      apply: value.apply === true,
      camp: {
        enabled: value.campEnabled === true,
        urls: campUrls,
        initialDate: isIsoDate(value.campInitialDate) ? value.campInitialDate : '2023-09-01',
        endpoints: {
          guestTypes: normalizeDolphinApiPath(campEndpoints.guestTypes, '/api/v1/camp/guesttypes'),
          services: normalizeDolphinApiPath(campEndpoints.services, '/api/v1/camp/services'),
          accounts: normalizeDolphinApiPath(campEndpoints.accounts, '/api/v1/camp/accounts'),
          accountSales: normalizeDolphinApiPath(campEndpoints.accountSales, '/api/v1/camp/accountsales'),
        },
        business: {
          enabled: value.campBusinessEnabled === true,
          lookbackDays: Math.min(31, Math.max(1, Number(value.campBusinessLookbackDays) || 7)),
          endpoints: {
            accountPayments: normalizeDolphinApiPath(campEndpoints.accountPayments, '/api/v1/camp/accountpayments'),
            skudVerifyLogs: normalizeDolphinApiPath(campEndpoints.skudVerifyLogs, '/api/v1/camp/skudverifylogs'),
            cards: normalizeDolphinApiPath(campEndpoints.cards, '/api/v1/camp/cards'),
            skudAreas: normalizeDolphinApiPath(campEndpoints.skudAreas, '/api/v1/camp/skudareas'),
            skudControllers: normalizeDolphinApiPath(campEndpoints.skudControllers, '/api/v1/camp/skudcontrollers'),
            kkmCheques: normalizeDolphinApiPath(campEndpoints.kkmCheques, '/api/v1/camp/kkmcheques'),
          },
        },
      },
    };
  }
  const defaultDolphinSourceProfile = normalizeSourceProfile({
    apiUrls: dolphinSourceApiUrls,
    apiKey: dolphinSourceApiKey,
    apiPath: dolphinSourceApiPath,
    lookbackDays: dolphinSourceLookbackDays,
    apply: dolphinSourceApply,
    campEnabled: dolphinCampSourceEnabled,
    campApiUrls: dolphinCampSourceApiUrls || dolphinSourceApiUrls,
    campInitialDate: dolphinCampInitialDate,
    campEndpoints: {
      guestTypes: dolphinCampGuestTypesPath,
      services: dolphinCampServicesPath,
      accounts: dolphinCampAccountsPath,
      accountSales: dolphinCampAccountSalesPath,
      accountPayments: dolphinCampAccountPaymentsPath,
      skudVerifyLogs: dolphinCampSkudVerifyLogsPath,
      cards: dolphinCampCardsPath,
      skudAreas: dolphinCampSkudAreasPath,
      skudControllers: dolphinCampSkudControllersPath,
      kkmCheques: dolphinCampKkmChequesPath,
    },
    campBusinessEnabled: dolphinCampBusinessEnabled,
    campBusinessLookbackDays: dolphinCampBusinessLookbackDays,
  });
  const resolvedDolphinSourceProfiles = Object.fromEntries(Object.entries(dolphinSourceProfiles || {})
    .filter(([locationCode]) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(locationCode))
    .map(([locationCode, profile]) => [locationCode, normalizeSourceProfile(profile)]));
  const resolvedEnrollmentLocationCode = Object.hasOwn(DOLPHIN_BUSINESS_SCOPE_BY_DEVICE_LOCATION, dolphinEnrollmentLocationCode)
    ? dolphinEnrollmentLocationCode
    : '';
  const resolvedEnrollmentScopeId = resolvedEnrollmentLocationCode
    ? DOLPHIN_BUSINESS_SCOPE_BY_DEVICE_LOCATION[resolvedEnrollmentLocationCode]
    : '';

  function sourceProfileForLocation(locationCode) {
    return resolvedDolphinSourceProfiles[locationCode] || defaultDolphinSourceProfile;
  }

  function isDolphinCampBusinessProfileEnabled(profile) {
    return dolphinCampBusinessEnabled
      && profile.camp.enabled
      && profile.camp.urls.length > 0
      && profile.apiKey.length >= 16
      && profile.camp.business.enabled;
  }
  const accountService = createAccountService({
    databaseFile: accountOptions.databaseFile || path.join(path.dirname(resolvedDataFile), 'accounts.sqlite'),
    claimsDataFile: resolvedClaimsDataFile,
    redemptionsDataFile: resolvedRedemptionsDataFile,
    allowedOrigin,
    logger,
    now,
    ...accountOptions,
  });
  const rateBuckets = new Map();
  const rewardRateBuckets = new Map();
  const connectorRateBuckets = new Map();
  const enrollmentRateBuckets = new Map();
  let claims = null;
  let redemptions = null;
  let connectorState = null;
  let dolphinBusinessSummaries = null;
  let claimQueue = Promise.resolve();
  let connectorQueue = Promise.resolve();
  let dolphinBusinessQueue = Promise.resolve();
  let boundPort = port;

  function consumeRateLimit(
    ip,
    currentTime = Date.now(),
    buckets = rateBuckets,
    limit = rateLimit,
    windowMs = rateWindowMs,
  ) {
    const current = buckets.get(ip);
    if (!current || current.resetAt <= currentTime) {
      buckets.set(ip, { count: 1, resetAt: currentTime + windowMs });
      return { allowed: true, retryAfter: 0 };
    }
    if (current.count >= limit) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - currentTime) / 1000)) };
    }
    current.count += 1;
    return { allowed: true, retryAfter: 0 };
  }

  async function saveFeedback(entry) {
    await fs.mkdir(path.dirname(resolvedDataFile), { recursive: true });
    await fs.appendFile(resolvedDataFile, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o640 });
  }

  async function loadClaims() {
    if (claims) return claims;
    try {
      const raw = await fs.readFile(resolvedClaimsDataFile, 'utf8');
      claims = raw
        .split('\n')
        .filter(Boolean)
        .flatMap(line => {
          try { return [JSON.parse(line)]; } catch { return []; }
        });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      claims = [];
    }
    return claims;
  }

  async function appendClaim(entry) {
    await fs.mkdir(path.dirname(resolvedClaimsDataFile), { recursive: true });
    await fs.appendFile(resolvedClaimsDataFile, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o640 });
  }

  async function loadRedemptions() {
    if (redemptions) return redemptions;
    try {
      const raw = await fs.readFile(resolvedRedemptionsDataFile, 'utf8');
      redemptions = raw
        .split('\n')
        .filter(Boolean)
        .flatMap(line => {
          try { return [JSON.parse(line)]; } catch { return []; }
        });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      redemptions = [];
    }
    return redemptions;
  }

  async function appendRedemptions(entries) {
    if (entries.length === 0) return;
    await fs.mkdir(path.dirname(resolvedRedemptionsDataFile), { recursive: true });
    const body = `${entries.map(entry => JSON.stringify(entry)).join('\n')}\n`;
    await fs.appendFile(resolvedRedemptionsDataFile, body, { encoding: 'utf8', mode: 0o640 });
  }

  function withClaimLock(task) {
    const result = claimQueue.then(task, task);
    claimQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  function withConnectorLock(task) {
    const result = connectorQueue.then(task, task);
    connectorQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  function withDolphinBusinessLock(task) {
    const result = dolphinBusinessQueue.then(task, task);
    dolphinBusinessQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  async function loadConnectorState() {
    if (connectorState) return connectorState;
    try {
      const value = JSON.parse(await fs.readFile(resolvedDolphinConnectorsDataFile, 'utf8'));
      connectorState = {
        version: 1,
        connectors: Array.isArray(value?.connectors) ? value.connectors : [],
        enrollments: Array.isArray(value?.enrollments) ? value.enrollments : [],
      };
    } catch (error) {
      if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      connectorState = emptyConnectorState();
    }
    return connectorState;
  }

  async function saveConnectorState(value) {
    await fs.mkdir(path.dirname(resolvedDolphinConnectorsDataFile), { recursive: true });
    const temporaryPath = `${resolvedDolphinConnectorsDataFile}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o640 });
    await fs.rename(temporaryPath, resolvedDolphinConnectorsDataFile);
    connectorState = value;
  }

  async function loadDolphinBusinessSummaries() {
    if (dolphinBusinessSummaries) return dolphinBusinessSummaries;
    let invalidExistingStore = false;
    for (const candidate of [resolvedDolphinBusinessSummariesDataFile, resolvedDolphinBusinessSummariesBackupFile]) {
      try {
        const value = JSON.parse(await fs.readFile(candidate, 'utf8'));
        if (isDolphinBusinessStore(value)) {
          dolphinBusinessSummaries = value;
          return dolphinBusinessSummaries;
        }
        invalidExistingStore = true;
      } catch (error) {
        if (error?.code === 'ENOENT') continue;
        if (error instanceof SyntaxError) {
          invalidExistingStore = true;
          continue;
        }
        throw error;
      }
    }
    if (invalidExistingStore) throw new Error('DOLPHIN_BUSINESS_STORE_INVALID');
    dolphinBusinessSummaries = { schemaVersion: 1, updatedAt: null, scopes: {} };
    return dolphinBusinessSummaries;
  }

  async function saveDolphinBusinessSummaries(value) {
    await fs.mkdir(path.dirname(resolvedDolphinBusinessSummariesDataFile), { recursive: true });
    const temporaryPath = `${resolvedDolphinBusinessSummariesDataFile}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o640 });
    let preservedValidCopy = false;
    try {
      const primary = JSON.parse(await fs.readFile(resolvedDolphinBusinessSummariesDataFile, 'utf8'));
      if (isDolphinBusinessStore(primary)) {
        await fs.copyFile(resolvedDolphinBusinessSummariesDataFile, resolvedDolphinBusinessSummariesBackupFile);
        preservedValidCopy = true;
      }
    } catch (error) {
      if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
    if (!preservedValidCopy) {
      try {
        const backup = JSON.parse(await fs.readFile(resolvedDolphinBusinessSummariesBackupFile, 'utf8'));
        preservedValidCopy = isDolphinBusinessStore(backup);
      } catch (error) {
        if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      }
    }
    if (!preservedValidCopy) await fs.copyFile(temporaryPath, resolvedDolphinBusinessSummariesBackupFile);
    await fs.rename(temporaryPath, resolvedDolphinBusinessSummariesDataFile);
    dolphinBusinessSummaries = value;
  }

  function dolphinBusinessScopeForIdentity(identity) {
    const scopeId = identity?.scopeId;
    return DOLPHIN_BUSINESS_SCOPES.has(scopeId) ? scopeId : '';
  }

  function validateOrigin(request, response) {
    const origin = request.headers.origin || '';
    if (allowedOrigin && origin && origin !== allowedOrigin) {
      sendJson(response, 403, { error: 'Этот сайт не может отправлять данные.' });
      return false;
    }
    return true;
  }

  function requireJson(request, response) {
    if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      sendJson(response, 415, { error: 'Нужен формат JSON.' });
      return false;
    }
    return true;
  }

  function requireRewardAdmin(request, response) {
    const authorization = String(request.headers.authorization || '');
    if (!rewardAdminToken || authorization !== `Bearer ${rewardAdminToken}`) {
      sendJson(response, 401, { error: 'Нужен ключ погашения наград.' }, { 'WWW-Authenticate': 'Bearer' });
      return false;
    }
    return true;
  }

  async function requireDolphinConnector(request, response) {
    const authorization = String(request.headers.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (dolphinConnectorToken && equalHex(sha256(token), sha256(dolphinConnectorToken))) {
      return { authorized: true, kind: 'legacy', deviceId: '', locationCode: '', scopeId: '' };
    }
    if (token) {
      const tokenHash = sha256(token);
      const connector = (await loadConnectorState()).connectors.find(item => equalHex(item?.tokenHash, tokenHash));
      if (connector) {
        return {
          authorized: true,
          kind: 'device',
          deviceId: connector.deviceId,
          locationCode: text(connector.locationCode, 40),
          scopeId: DOLPHIN_BUSINESS_SCOPES.has(connector.scopeId) ? connector.scopeId : '',
        };
      }
    }
    sendJson(response, 401, { error: 'Нужен ключ агента Dolphin.' }, { 'WWW-Authenticate': 'Bearer' });
    return { authorized: false, kind: '', deviceId: '', locationCode: '', scopeId: '' };
  }

  async function handleDolphinEnrollment(request, response) {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Доступна только активация.' }, { Allow: 'POST' });
      return;
    }
    if (!requireJson(request, response)) return;
    const limit = consumeRateLimit(
      requestIp(request),
      now(),
      enrollmentRateBuckets,
      enrollmentRateLimit,
      enrollmentRateWindowMs,
    );
    if (!limit.allowed) {
      sendJson(response, 429, { error: 'Слишком много попыток активации.' }, { 'Retry-After': String(limit.retryAfter) });
      return;
    }

    const payload = await readJsonBody(request);
    const enrollmentToken = text(payload.enrollmentToken, 256);
    const deviceId = text(payload.deviceId, 80);
    const deviceToken = text(payload.deviceToken, 128).toLowerCase();
    const expectedEnrollmentHash = String(dolphinEnrollmentTokenHash || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedEnrollmentHash)) {
      sendJson(response, 503, { error: 'Автоматическая активация временно недоступна.' });
      return;
    }
    if (!resolvedEnrollmentLocationCode || !resolvedEnrollmentScopeId) {
      sendJson(response, 503, { error: 'Для установщика не назначен комплекс.' });
      return;
    }
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(deviceId) || !/^[a-f0-9]{64}$/.test(deviceToken)) {
      sendJson(response, 400, { error: 'Установщик передал неверные данные активации.' });
      return;
    }
    if (!equalHex(sha256(enrollmentToken), expectedEnrollmentHash)) {
      sendJson(response, 401, { error: 'Этот установщик больше нельзя активировать.' });
      return;
    }

    const result = await withConnectorLock(async () => {
      const state = await loadConnectorState();
      const deviceTokenHash = sha256(deviceToken);
      const consumed = state.enrollments.find(item => equalHex(item?.enrollmentTokenHash, expectedEnrollmentHash));
      if (consumed) {
        if (consumed.deviceId !== deviceId || !equalHex(consumed.deviceTokenHash, deviceTokenHash)) {
          return { conflict: true };
        }
        if ((consumed.locationCode && consumed.locationCode !== resolvedEnrollmentLocationCode)
          || (consumed.scopeId && consumed.scopeId !== resolvedEnrollmentScopeId)) return { conflict: true };
        const existingConnector = state.connectors.find(item => (
          item.deviceId === deviceId && equalHex(item.tokenHash, deviceTokenHash)
        ));
        if (existingConnector
          && ((existingConnector.locationCode && existingConnector.locationCode !== resolvedEnrollmentLocationCode)
            || (existingConnector.scopeId && existingConnector.scopeId !== resolvedEnrollmentScopeId))) {
          return { conflict: true };
        }
        consumed.locationCode = resolvedEnrollmentLocationCode;
        consumed.scopeId = resolvedEnrollmentScopeId;
        if (existingConnector) {
          existingConnector.locationCode = resolvedEnrollmentLocationCode;
          existingConnector.scopeId = resolvedEnrollmentScopeId;
        } else {
          state.connectors.push({
            deviceId,
            tokenHash: deviceTokenHash,
            locationCode: resolvedEnrollmentLocationCode,
            scopeId: resolvedEnrollmentScopeId,
            createdAt: consumed.consumedAt,
          });
        }
        await saveConnectorState(state);
        return { enrolled: true, repeated: true };
      }

      const existingDevice = state.connectors.find(item => item.deviceId === deviceId);
      if (existingDevice && !equalHex(existingDevice.tokenHash, deviceTokenHash)) return { conflict: true };
      if (existingDevice
        && ((existingDevice.locationCode && existingDevice.locationCode !== resolvedEnrollmentLocationCode)
          || (existingDevice.scopeId && existingDevice.scopeId !== resolvedEnrollmentScopeId))) return { conflict: true };
      const currentTime = now();
      if (existingDevice) {
        existingDevice.locationCode = resolvedEnrollmentLocationCode;
        existingDevice.scopeId = resolvedEnrollmentScopeId;
      } else {
        state.connectors.push({
          deviceId,
          tokenHash: deviceTokenHash,
          locationCode: resolvedEnrollmentLocationCode,
          scopeId: resolvedEnrollmentScopeId,
          createdAt: currentTime,
        });
      }
      state.enrollments.push({
        enrollmentTokenHash: expectedEnrollmentHash,
        deviceId,
        deviceTokenHash,
        locationCode: resolvedEnrollmentLocationCode,
        scopeId: resolvedEnrollmentScopeId,
        consumedAt: currentTime,
      });
      await saveConnectorState(state);
      return { enrolled: true, repeated: false };
    });

    if (result.conflict) {
      sendJson(response, 409, { error: 'Установщик уже активирован на другом компьютере.' });
      return;
    }
    sendJson(response, result.repeated ? 200 : 201, { ok: true, deviceId, repeated: result.repeated });
  }

  async function handleRewardRequest(request, response, url) {
    if (request.method === 'GET') {
      const deviceId = text(url.searchParams.get('deviceId'), 80);
      const requestedCampaignId = url.searchParams.get('campaignId');
      const hasCampaignId = requestedCampaignId !== null && requestedCampaignId !== '';
      const campaignId = requestedCampaignId === FOUR_GAME_CAMPAIGN_ID ? FOUR_GAME_CAMPAIGN_ID : '';
      if (hasCampaignId && !campaignId) {
        sendJson(response, 400, { error: 'Неизвестная акция.', code: 'UNKNOWN_REWARD_CAMPAIGN' });
        return;
      }
      const currentTime = now();
      let identity = null;
      if (campaignId) {
        const expectedAccountId = text(url.searchParams.get('expectedAccountId'), 80);
        identity = await accountService.getRewardAccountIdentity(request, expectedAccountId);
        if (!identity.ok) {
          sendJson(response, identity.status, { error: identity.error, code: identity.code });
          return;
        }
      } else if (!/^[a-zA-Z0-9-]{16,80}$/.test(deviceId)) {
        sendJson(response, 400, { error: 'Не удалось определить устройство.' });
        return;
      }
      const entries = await loadClaims();
      const redeemedByCode = redemptionMap(await loadRedemptions());
      const claim = campaignId
        ? [...entries].reverse().find(entry => (
          entry.rewardId === 'ticket-free'
          && entry.campaignId === campaignId
          && identity.matchesClaim(entry)
        ))
        : [...entries].reverse().find(entry => (
          entry.rewardId === 'ticket-free'
          && entry.deviceId === deviceId
          && entry.nextPurchaseAt > currentTime
        ));
      sendJson(response, 200, claim
        ? {
          available: false,
          ...(!campaignId && claim.campaignId === FOUR_GAME_CAMPAIGN_ID ? {} : {
            claim: publicClaim(claim, redeemedByCode.get(claim.code), currentTime),
          }),
          nextPurchaseAt: claim.nextPurchaseAt,
        }
        : { available: true });
      return;
    }

    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Доступны только проверка и получение награды.' }, { Allow: 'GET, POST' });
      return;
    }
    if (!validateOrigin(request, response) || !requireJson(request, response)) return;

    const limit = consumeRateLimit(requestIp(request), now(), rewardRateBuckets);
    if (!limit.allowed) {
      sendJson(response, 429, { error: 'Слишком много попыток. Подождите и попробуйте снова.' }, {
        'Retry-After': String(limit.retryAfter),
      });
      return;
    }

    const payload = await readJsonBody(request);
    const name = text(payload.name, 80);
    const phone = normalizedPhone(payload.phone);
    const age = Number(payload.age);
    const city = text(payload.city, 40);
    const deviceId = text(payload.deviceId, 80);
    const hasCampaignId = payload.campaignId !== undefined && payload.campaignId !== null && payload.campaignId !== '';
    const campaignId = payload.campaignId === FOUR_GAME_CAMPAIGN_ID ? FOUR_GAME_CAMPAIGN_ID : '';
    const expectedAccountId = text(payload.expectedAccountId, 80);

    if (hasCampaignId && !campaignId) {
      sendJson(response, 400, { error: 'Неизвестная акция.', code: 'UNKNOWN_REWARD_CAMPAIGN' });
      return;
    }

    if (name.length < 2) {
      sendJson(response, 400, { error: 'Укажите имя.', field: 'name' });
      return;
    }
    if (!phone) {
      sendJson(response, 400, { error: 'Укажите корректный номер телефона.', field: 'phone' });
      return;
    }
    if (!Number.isInteger(age) || age < 18 || age > 100) {
      sendJson(response, 400, { error: 'Анкету заполняет совершеннолетний гость.', field: 'age' });
      return;
    }
    if (!REWARD_CITIES.has(city)) {
      sendJson(response, 400, { error: 'Выберите город.', field: 'city' });
      return;
    }
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(deviceId)) {
      sendJson(response, 400, { error: 'Не удалось определить устройство.' });
      return;
    }
    if (payload.consent !== true || payload.consentVersion !== REWARD_CONSENT_VERSION) {
      sendJson(response, 400, { error: 'Для выдачи награды нужно отдельное согласие на обработку данных.', field: 'consent' });
      return;
    }
    let rewardIdentity = null;
    if (campaignId) {
      rewardIdentity = await accountService.verifyRewardCampaign(request, { campaignId, phone, expectedAccountId });
      if (!rewardIdentity.ok) {
        sendJson(response, rewardIdentity.status, {
          error: rewardIdentity.error,
          code: rewardIdentity.code,
          ...(rewardIdentity.field ? { field: rewardIdentity.field } : {}),
          ...(rewardIdentity.completedGames ? { completedGames: rewardIdentity.completedGames } : {}),
          ...(rewardIdentity.stageCounts ? { stageCounts: rewardIdentity.stageCounts } : {}),
          ...(Number.isFinite(rewardIdentity.completedStages)
            ? { completedStages: rewardIdentity.completedStages }
            : {}),
        });
        return;
      }
    } else if (Number(payload.balance) < REWARD_PRICE) {
      sendJson(response, 400, { error: `Для получения нужно ${REWARD_PRICE} термокоинов.` });
      return;
    } else {
      const optionalIdentity = await accountService.getRewardAccountIdentity(request);
      if (optionalIdentity.ok && optionalIdentity.matchesPhone(phone)) rewardIdentity = optionalIdentity;
    }

    const result = await withClaimLock(async () => {
      const currentTime = now();
      const entries = await loadClaims();
      const campaignDuplicateByAccount = campaignId
        ? [...entries].reverse().find(entry => (
          entry.rewardId === 'ticket-free'
          && entry.campaignId === campaignId
          && rewardIdentity.matchesClaim(entry)
        ))
        : null;
      if (campaignDuplicateByAccount) {
        return { duplicate: campaignDuplicateByAccount, duplicateKind: 'campaign' };
      }
      const campaignDuplicateByDevice = campaignId
        ? [...entries].reverse().find(entry => (
          entry.rewardId === 'ticket-free'
          && entry.campaignId === campaignId
          && entry.deviceId === deviceId
        ))
        : null;
      if (campaignDuplicateByDevice) {
        return {
          duplicate: campaignDuplicateByDevice,
          duplicateKind: 'campaign',
          suppressDuplicateClaim: true,
        };
      }

      const active = [...entries].reverse().find(entry => (
        entry.rewardId === 'ticket-free'
        && (entry.phone === phone || entry.deviceId === deviceId)
        && entry.nextPurchaseAt > currentTime
      ));
      if (active) {
        return {
          duplicate: active,
          duplicateKind: 'cooldown',
          suppressDuplicateClaim: Boolean(campaignId) || active.campaignId === FOUR_GAME_CAMPAIGN_ID,
        };
      }

      const entry = {
        id: randomUUID(),
        rewardId: 'ticket-free',
        code: `TB-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`,
        purchasedAt: currentTime,
        expiresAt: currentTime + REWARD_COOLDOWN_MS,
        nextPurchaseAt: currentTime + REWARD_COOLDOWN_MS,
        price: campaignId ? 0 : REWARD_PRICE,
        currency: campaignId ? 'promotion' : 'termcoins',
        ...(campaignId ? { campaignId } : {}),
        ...(rewardIdentity?.accountId ? { accountId: rewardIdentity.accountId } : {}),
        name,
        phone,
        age,
        city,
        deviceId,
        consentAt: new Date(currentTime).toISOString(),
        consentVersion: REWARD_CONSENT_VERSION,
        source: text(payload.source, 80) || null,
        userAgent: text(request.headers['user-agent'], 300) || null,
      };
      await appendClaim(entry);
      entries.push(entry);
      return { created: entry };
    });

    if (result.duplicate) {
      const redeemedByCode = redemptionMap(await loadRedemptions());
      const campaignDuplicate = result.duplicateKind === 'campaign';
      sendJson(response, 409, {
        error: campaignDuplicate
          ? `Разовый подарок уже получен. Новые часы можно получать за ${REWARD_PRICE} термокоинов — не чаще раза в 7 дней.`
          : `Час уже получен. Новый час за ${REWARD_PRICE} термокоинов будет доступен через неделю.`,
        code: campaignDuplicate ? 'CAMPAIGN_ALREADY_CLAIMED' : 'REWARD_COOLDOWN',
        ...(!result.suppressDuplicateClaim ? {
          claim: publicClaim(result.duplicate, redeemedByCode.get(result.duplicate.code), now()),
        } : {}),
        availableAt: result.duplicate.nextPurchaseAt,
      });
      return;
    }

    sendJson(response, 201, { ok: true, claim: publicClaim(result.created, null, now()) });
  }

  async function handleRedemptionImport(request, response, mode = 'admin') {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Доступен только импорт погашений.' }, { Allow: 'POST' });
      return;
    }
    const connectorIdentity = mode === 'dolphin'
      ? await requireDolphinConnector(request, response)
      : null;
    const authorized = mode === 'dolphin' ? connectorIdentity.authorized : requireRewardAdmin(request, response);
    if (!authorized || !requireJson(request, response)) return;

    if (mode === 'dolphin') {
      const limit = consumeRateLimit(
        requestIp(request),
        now(),
        connectorRateBuckets,
        connectorRateLimit,
        connectorRateWindowMs,
      );
      if (!limit.allowed) {
        sendJson(response, 429, { error: 'Агент слишком часто отправляет данные.' }, {
          'Retry-After': String(limit.retryAfter),
        });
        return;
      }
    }

    const payload = await readJsonBody(request, MAX_ADMIN_BODY_BYTES);
    const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, MAX_REDEMPTION_IMPORT_ROWS + 1) : [];
    if (rows.length === 0) {
      sendJson(response, 400, { error: 'Передайте непустой массив rows.' });
      return;
    }
    if (rows.length > MAX_REDEMPTION_IMPORT_ROWS) {
      sendJson(response, 400, { error: `За один раз можно проверить не более ${MAX_REDEMPTION_IMPORT_ROWS} строк.` });
      return;
    }

    const dryRun = payload.dryRun !== false;
    const source = mode === 'dolphin'
      ? `dolphin-agent:${connectorIdentity.deviceId || text(payload.deviceId, 60) || 'unidentified'}`
      : text(payload.source, 80) || 'manual-import';
    const result = await withClaimLock(async () => {
      const currentTime = now();
      const claimByCode = new Map((await loadClaims()).map(claim => [claim.code, claim]));
      const existingByCode = redemptionMap(await loadRedemptions());
      const pendingCodes = new Set();
      const additions = [];
      const results = rows.map((rawRow, index) => {
        const row = rawRow && typeof rawRow === 'object' ? rawRow : {};
        const inputCode = text(row.code, 32);
        const code = normalizeRewardCode(inputCode);
        const sourceRecordId = text(row.sourceRecordId, 80) || null;
        if (!code) return { row: index + 1, inputCode, sourceRecordId, status: 'invalid' };
        if (!claimByCode.has(code)) return { row: index + 1, code, sourceRecordId, status: 'unknown' };
        const previous = existingByCode.get(code);
        if (previous || pendingCodes.has(code)) {
          return {
            row: index + 1,
            code,
            sourceRecordId,
            status: 'already_redeemed',
            redeemedAt: previous?.redeemedAt ?? additions.find(entry => entry.code === code)?.redeemedAt,
          };
        }

        const parsedTime = typeof row.redeemedAt === 'number' ? row.redeemedAt : Date.parse(text(row.redeemedAt, 64));
        const redeemedAt = Number.isFinite(parsedTime) && parsedTime > 0 && parsedTime <= currentTime + 5 * 60 * 1000
          ? parsedTime
          : currentTime;
        const entry = {
          id: randomUUID(),
          code,
          redeemedAt,
          source,
          sourceRecordId,
          importedAt: currentTime,
        };
        additions.push(entry);
        pendingCodes.add(code);
        return { row: index + 1, code, sourceRecordId, status: dryRun ? 'would_redeem' : 'redeemed', redeemedAt };
      });

      if (!dryRun) {
        await appendRedemptions(additions);
        redemptions.push(...additions);
      }
      return { dryRun, source, results };
    });

    const summary = result.results.reduce((counts, row) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
      return counts;
    }, { received: result.results.length });
    sendJson(response, 200, { ...result, summary });
  }

  async function handleDolphinHealth(request, response) {
    if (!['GET', 'POST'].includes(request.method)) {
      sendJson(response, 405, { error: 'Доступны проверка и отправка статуса.' }, { Allow: 'GET, POST' });
      return;
    }
    const identity = await requireDolphinConnector(request, response);
    if (!identity.authorized) return;
    let connector = null;
    if (identity.kind === 'device' && identity.deviceId) {
      if (request.method === 'POST' && !requireJson(request, response)) return;
      connector = await withConnectorLock(async () => {
        const state = await loadConnectorState();
        const current = state.connectors.find(item => item.deviceId === identity.deviceId);
        if (!current) return null;
        current.lastSeenAt = now();
        if (request.method === 'POST') {
          current.heartbeat = sanitizeDolphinHeartbeat(await readJsonBody(request, MAX_CONNECTOR_HEARTBEAT_BYTES));
        }
        await saveConnectorState(state);
        return current;
      });
    }
    sendJson(response, 200, {
      ok: true,
      service: 'dolphin-redemption-import',
      deviceId: identity.deviceId || null,
      maxRows: MAX_REDEMPTION_IMPORT_ROWS,
      lastSeenAt: connector?.lastSeenAt || null,
      heartbeat: connector?.heartbeat || null,
      now: new Date(now()).toISOString(),
    });
  }

  async function handleDolphinSourceConfig(request, response) {
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Доступно только получение конфигурации.' }, { Allow: 'GET' });
      return;
    }
    const identity = await requireDolphinConnector(request, response);
    if (!identity.authorized) return;
    if (identity.kind === 'device'
      && !Object.hasOwn(DOLPHIN_BUSINESS_SCOPE_BY_DEVICE_LOCATION, identity.locationCode)) {
      sendJson(response, 403, { error: 'Для этого рабочего места не назначен комплекс.' });
      return;
    }
    const profile = identity.kind === 'device'
      ? sourceProfileForLocation(identity.locationCode)
      : defaultDolphinSourceProfile;
    const enabled = profile.urls.length > 0 && profile.apiKey.length >= 16;
    const campEnabled = profile.camp.enabled && profile.camp.urls.length > 0 && profile.apiKey.length >= 16;
    const campBusinessEnabled = isDolphinCampBusinessProfileEnabled(profile);
    sendJson(response, 200, {
      enabled,
      baseUrls: enabled ? profile.urls : [],
      apiKey: enabled || campEnabled ? profile.apiKey : '',
      apiPath: profile.apiPath,
      lookbackDays: profile.lookbackDays,
      applyRedemptions: enabled && profile.apply,
      camp: {
        enabled: campEnabled,
        baseUrls: campEnabled ? profile.camp.urls : [],
        initialDate: profile.camp.initialDate,
        endpoints: profile.camp.endpoints,
        business: {
          enabled: campBusinessEnabled,
          lookbackDays: profile.camp.business.lookbackDays,
          endpoints: profile.camp.business.endpoints,
        },
      },
    });
  }

  async function handleDolphinBusinessSummaryUpload(request, response) {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Доступна только отправка агрегата.' }, { Allow: 'POST' });
      return;
    }
    const identity = await requireDolphinConnector(request, response);
    if (!identity.authorized) return;
    if (identity.kind !== 'device' || !identity.deviceId) {
      sendJson(response, 403, { error: 'Агрегат принимает только зарегистрированное рабочее место.' });
      return;
    }
    const scopeId = dolphinBusinessScopeForIdentity(identity);
    if (!scopeId) {
      sendJson(response, 403, { error: 'Для этого рабочего места не назначен комплекс.' });
      return;
    }
    if (!isDolphinCampBusinessProfileEnabled(sourceProfileForLocation(identity.locationCode))) {
      sendJson(response, 503, { error: 'Агрегаты Dolphin временно отключены.' });
      return;
    }
    const limit = consumeRateLimit(
      `business:${identity.deviceId}`,
      now(),
      connectorRateBuckets,
      connectorRateLimit,
      connectorRateWindowMs,
    );
    if (!limit.allowed) {
      sendJson(response, 429, { error: 'Рабочее место слишком часто отправляет агрегаты.' }, {
        'Retry-After': String(limit.retryAfter),
      });
      return;
    }
    if (!requireJson(request, response)) return;

    const payload = sanitizeDolphinBusinessUpload(
      await readJsonBody(request, MAX_DOLPHIN_BUSINESS_SUMMARY_BYTES),
      now(),
    );
    if (!payload) {
      sendJson(response, 400, { error: 'Агрегат Dolphin не соответствует контракту.' });
      return;
    }
    const { generationId, sequence, generatedAt } = payload;
    const payloadSha256 = sha256(JSON.stringify(payload));
    const result = await withDolphinBusinessLock(async () => {
      const store = await loadDolphinBusinessSummaries();
      const previous = store.scopes[scopeId];
      const writerDeviceId = dolphinBusinessWriterDeviceId(previous);
      if (writerDeviceId && writerDeviceId !== identity.deviceId) return { writerConflict: true };
      if (previous?.generationId === generationId && previous.sequence === sequence) {
        if (previous.payloadSha256 !== payloadSha256) return { conflict: true };
        if (previous.writerDeviceId === identity.deviceId) return { repeated: true, value: previous };

        const updatedAt = new Date(now()).toISOString();
        const value = { ...previous, writerDeviceId: identity.deviceId };
        delete value.deviceId;
        const next = {
          schemaVersion: 1,
          updatedAt,
          scopes: { ...store.scopes, [scopeId]: value },
        };
        await saveDolphinBusinessSummaries(next);
        return { repeated: true, value };
      }
      if (previous?.generationId === generationId && previous.sequence > sequence) return { stale: true };
      if (previous?.generationId !== generationId && previous?.generatedAt && generatedAt < previous.generatedAt) return { stale: true };

      const receivedAt = new Date(now()).toISOString();
      const value = {
        schemaVersion: 1,
        scopeId,
        scopeEvidence: 'device-profile',
        writerDeviceId: identity.deviceId,
        generationId,
        sequence,
        generatedAt,
        receivedAt,
        payloadSha256,
        upload: payload,
      };
      const next = {
        schemaVersion: 1,
        updatedAt: receivedAt,
        scopes: { ...store.scopes, [scopeId]: value },
      };
      await saveDolphinBusinessSummaries(next);
      return { repeated: false, value };
    });

    if (result.conflict) {
      sendJson(response, 409, { error: 'Этот номер агрегата уже использован с другим содержимым.' });
      return;
    }
    if (result.writerConflict) {
      sendJson(response, 409, { error: 'Для этого комплекса уже назначено рабочее место.' });
      return;
    }
    if (result.stale) {
      sendJson(response, 409, { error: 'Получен устаревший агрегат Dolphin.' });
      return;
    }
    sendJson(response, result.repeated ? 200 : 201, {
      ok: true,
      scopeId,
      sequence,
      repeated: result.repeated,
      receivedAt: result.value.receivedAt,
    });
  }

  async function handleDolphinBusinessSummariesInternal(request, response) {
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Доступно только чтение агрегатов.' }, { Allow: 'GET' });
      return;
    }
    const authorization = String(request.headers.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!dolphinBusinessInternalToken || !token || !equalHex(sha256(token), sha256(dolphinBusinessInternalToken))) {
      sendJson(response, 401, { error: 'Нужен внутренний ключ агрегатов Dolphin.' }, { 'WWW-Authenticate': 'Bearer' });
      return;
    }
    const store = await loadDolphinBusinessSummaries();
    sendJson(response, 200, {
      schemaVersion: 1,
      updatedAt: store.updatedAt || null,
      scopes: Object.fromEntries(Object.entries(store.scopes || {}).flatMap(([scopeId, entry]) => {
        const upload = sanitizeDolphinBusinessUpload(entry?.upload, now());
        return DOLPHIN_BUSINESS_SCOPES.has(scopeId) && upload
          ? [[scopeId, {
            schemaVersion: 1,
            scopeId,
            scopeEvidence: 'device-profile',
            generatedAt: upload.generatedAt,
            receivedAt: isoTimestamp(entry.receivedAt) || null,
            upload,
          }]]
          : [];
      })),
    });
  }

  async function handleCashierExport(request, response, url) {
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Доступна только выгрузка.' }, { Allow: 'GET' });
      return;
    }
    const authorization = String(request.headers.authorization || '');
    if (!cashierExportToken || authorization !== `Bearer ${cashierExportToken}`) {
      sendJson(response, 401, { error: 'Нужен ключ кассы.' }, { 'WWW-Authenticate': 'Bearer' });
      return;
    }

    const city = text(url.searchParams.get('city'), 40);
    const requestedDate = text(url.searchParams.get('date'), 10)
      || localDateKey(now(), city || 'Москва');
    if (!isIsoDate(requestedDate)) {
      sendJson(response, 400, { error: 'Дата нужна в формате ГГГГ-ММ-ДД.' });
      return;
    }
    if (city && !REWARD_CITIES.has(city)) {
      sendJson(response, 400, { error: 'Неизвестный город.' });
      return;
    }
    const currentTime = now();
    const redeemedByCode = redemptionMap(await loadRedemptions());
    const rows = (await loadClaims()).filter(claim => (
      localDateKey(claim.purchasedAt, claim.city) === requestedDate
      && (!city || claim.city === city)
    ));
    const body = [
      CASHIER_EXPORT_FIELDS.join(','),
      ...rows.map(claim => [
        claim.code,
        claim.city,
        claim.name,
        claim.phone,
        new Date(claim.purchasedAt).toISOString(),
        new Date(claim.expiresAt).toISOString(),
        redeemedByCode.has(claim.code) ? 'redeemed' : claim.expiresAt > currentTime ? 'active' : 'expired',
      ].map(csvCell).join(',')),
    ].join('\r\n');

    sendText(response, 200, `\uFEFF${body}\r\n`, 'text/csv; charset=utf-8', {
      'Content-Disposition': `attachment; filename="termburg-free-hour-${requestedDate}${city ? `-${encodeURIComponent(city)}` : ''}.csv"`,
    });
  }

  const server = createServer(async (request, response) => {
    const startedAt = Date.now();
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

      if (accountService.matches(url.pathname)) {
        await accountService.handle(request, response, url);
        return;
      }

      if (url.pathname === '/api/feedback/health' && request.method === 'GET') {
        sendJson(response, 200, { ok: true, service: 'termliny-feedback', now: new Date(now()).toISOString() });
        return;
      }

      if (url.pathname === '/api/rewards/free-hour') {
        await handleRewardRequest(request, response, url);
        return;
      }

      if (url.pathname === '/api/admin/rewards/free-hour/export') {
        await handleCashierExport(request, response, url);
        return;
      }

      if (url.pathname === '/api/admin/rewards/free-hour/redemptions/import') {
        await handleRedemptionImport(request, response, 'admin');
        return;
      }

      if (url.pathname === '/api/integrations/dolphin/redemptions') {
        await handleRedemptionImport(request, response, 'dolphin');
        return;
      }

      if (url.pathname === '/api/integrations/dolphin/enroll') {
        await handleDolphinEnrollment(request, response);
        return;
      }

      if (url.pathname === '/api/integrations/dolphin/health') {
        await handleDolphinHealth(request, response);
        return;
      }

      if (url.pathname === '/api/integrations/dolphin/source-config') {
        await handleDolphinSourceConfig(request, response);
        return;
      }

      if (url.pathname === '/api/integrations/dolphin/business-summary') {
        await handleDolphinBusinessSummaryUpload(request, response);
        return;
      }

      if (url.pathname === '/api/internal/dolphin/business-summaries') {
        await handleDolphinBusinessSummariesInternal(request, response);
        return;
      }

      if (url.pathname !== '/api/feedback') {
        sendJson(response, 404, { error: 'Не найдено.' });
        return;
      }

      if (request.method !== 'POST') {
        sendJson(response, 405, { error: 'Разрешена только отправка формы.' }, { Allow: 'POST' });
        return;
      }

      if (!validateOrigin(request, response) || !requireJson(request, response)) return;

      const payload = await readJsonBody(request);
      const honeypot = text(payload.website, 200);
      if (honeypot) {
        sendJson(response, 201, { ok: true, id: randomUUID() });
        return;
      }

      const category = text(payload.category, 20);
      const message = text(payload.message, 1500);
      const contact = text(payload.contact, 120);
      const page = text(payload.page, 300);
      const rating = payload.rating === null || payload.rating === undefined || payload.rating === ''
        ? null
        : Number(payload.rating);

      if (!CATEGORIES.has(category)) {
        sendJson(response, 400, { error: 'Выберите тип обращения.', field: 'category' });
        return;
      }
      if (message.length < 10) {
        sendJson(response, 400, { error: 'Напишите хотя бы 10 символов.', field: 'message' });
        return;
      }
      if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
        sendJson(response, 400, { error: 'Оценка должна быть от 1 до 5.', field: 'rating' });
        return;
      }

      const limit = consumeRateLimit(requestIp(request), now());
      if (!limit.allowed) {
        sendJson(response, 429, { error: 'Слишком много сообщений. Попробуйте чуть позже.' }, {
          'Retry-After': String(limit.retryAfter),
        });
        return;
      }

      const entry = {
        id: randomUUID(),
        createdAt: new Date(now()).toISOString(),
        category,
        rating,
        message,
        contact: contact || null,
        page: page || null,
        userAgent: text(request.headers['user-agent'], 300) || null,
      };
      await saveFeedback(entry);
      sendJson(response, 201, { ok: true, id: entry.id });
    } catch (error) {
      if (error?.message === 'PAYLOAD_TOO_LARGE') {
        sendJson(response, 413, { error: 'Сообщение слишком большое.' });
      } else if (error?.message === 'INVALID_JSON') {
        sendJson(response, 400, { error: 'Не удалось прочитать форму.' });
      } else {
        logger.error?.('[feedback-service]', error);
        sendJson(response, 500, { error: 'Не удалось сохранить сообщение. Попробуйте ещё раз.' });
      }
    } finally {
      logger.info?.(`${request.method} ${request.url} ${response.statusCode} ${Date.now() - startedAt}ms`);
    }
  });

  server.requestTimeout = 10_000;
  server.headersTimeout = 12_000;
  server.keepAliveTimeout = 5_000;

  async function listen() {
    await accountService.ready;
    await new Promise((resolve, reject) => {
      const onError = error => reject(error);
      server.once('error', onError);
      server.listen(port, host, () => {
        server.off('error', onError);
        resolve();
      });
    });
    const address = server.address();
    boundPort = typeof address === 'object' && address ? address.port : port;
    return boundPort;
  }

  async function close() {
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeIdleConnections?.();
      });
    }
    accountService.close();
  }

  return {
    server,
    listen,
    close,
    get port() { return boundPort; },
    dataFile: resolvedDataFile,
    claimsDataFile: resolvedClaimsDataFile,
    redemptionsDataFile: resolvedRedemptionsDataFile,
    dolphinConnectorsDataFile: resolvedDolphinConnectorsDataFile,
    dolphinBusinessSummariesDataFile: resolvedDolphinBusinessSummariesDataFile,
    accountDatabaseFile: accountService.databaseFile,
  };
}

export async function startFeedbackService(options) {
  const service = createFeedbackService(options);
  await service.listen();
  return service;
}
