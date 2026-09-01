const EXACT_CODE_PATTERN = /^TB-[A-F0-9]{8}$/;
const CODE_CANDIDATE_PATTERN = /TB-[A-Z0-9]{5,16}/gi;

const CODE_HEADERS = new Set([
  'основание для льготы',
  'код льготы',
  'штрихкод',
  'barcode',
]);
const ENTRY_TIME_HEADERS = new Set([
  'время входа',
  'дата и время входа',
  'дата входа',
  'время использования',
  'entry time',
]);
const RECORD_HEADERS = new Set([
  'номер',
  'номер операции',
  '№',
  'record id',
]);

export function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .replace(/\s+/g, ' ');
}

function valueForHeaders(row, acceptedHeaders) {
  for (const [key, value] of Object.entries(row || {})) {
    if (acceptedHeaders.has(normalizeHeader(key))) return value;
  }
  return undefined;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function validDateParts(year, month, day, hour, minute, second) {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && date.getUTCHours() === hour
    && date.getUTCMinutes() === minute
    && date.getUTCSeconds() === second;
}

export function parseDolphinEntryTime(value, timezoneOffset = '+03:00') {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 1_000_000_000_000) {
      const timestamp = new Date(value);
      return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : '';
    }
    if (value >= 1_000_000_000) {
      const timestamp = new Date(value * 1000);
      return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : '';
    }
    if (value <= 0 || value > 100_000) return '';
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + value * 24 * 60 * 60 * 1000);
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
      + `T${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}${timezoneOffset}`;
  }

  const text = String(value ?? '').trim();
  if (!text) return '';

  const ru = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:\s+|T)(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (ru) {
    const day = Number(ru[1]);
    const month = Number(ru[2]);
    const year = Number(ru[3]) < 100 ? 2000 + Number(ru[3]) : Number(ru[3]);
    const hour = Number(ru[4]);
    const minute = Number(ru[5]);
    const second = Number(ru[6] || 0);
    if (!validDateParts(year, month, day, hour, minute, second)) return '';
    return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}${timezoneOffset}`;
  }

  const localIso = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localIso) {
    const [, year, month, day, hour, minute, second = '00'] = localIso;
    if (!validDateParts(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second))) return '';
    return `${year}-${month}-${day}T${hour}:${minute}:${second}${timezoneOffset}`;
  }

  return Number.isFinite(Date.parse(text)) ? new Date(text).toISOString() : '';
}

function exactCodes(value) {
  const candidates = String(value ?? '').toUpperCase().match(CODE_CANDIDATE_PATTERN) || [];
  return [...new Set(candidates.filter(code => EXACT_CODE_PATTERN.test(code)))];
}

function malformedCandidates(value) {
  const candidates = String(value ?? '').toUpperCase().match(CODE_CANDIDATE_PATTERN) || [];
  return [...new Set(candidates.filter(code => !EXACT_CODE_PATTERN.test(code)))];
}

export function extractRedemptions(rows, options = {}) {
  const timezoneOffset = /^[-+]\d{2}:\d{2}$/.test(options.timezoneOffset || '')
    ? options.timezoneOffset
    : '+03:00';
  const redemptionsByCode = new Map();
  const issues = [];
  let rowsWithCode = 0;
  let skippedWithoutEntryTime = 0;

  rows.forEach((row, index) => {
    const codeValue = valueForHeaders(row, CODE_HEADERS);
    const entryValue = valueForHeaders(row, ENTRY_TIME_HEADERS);
    const recordValue = valueForHeaders(row, RECORD_HEADERS);
    const codes = exactCodes(codeValue);
    const malformed = malformedCandidates(codeValue);

    for (const code of malformed) {
      issues.push({ row: index + 2, type: 'invalid-code', value: code });
    }
    if (codes.length === 0) return;
    rowsWithCode += 1;

    const redeemedAt = parseDolphinEntryTime(entryValue, timezoneOffset);
    if (!redeemedAt) {
      skippedWithoutEntryTime += 1;
      return;
    }

    const sourceRecordId = String(recordValue ?? '').trim().slice(0, 80) || null;
    for (const code of codes) {
      if (!redemptionsByCode.has(code)) {
        redemptionsByCode.set(code, { code, redeemedAt, sourceRecordId });
      }
    }
  });

  return {
    rows: [...redemptionsByCode.values()],
    issues,
    stats: {
      sourceRows: rows.length,
      rowsWithCode,
      redemptions: redemptionsByCode.size,
      skippedWithoutEntryTime,
      invalidCodes: issues.filter(issue => issue.type === 'invalid-code').length,
    },
  };
}
