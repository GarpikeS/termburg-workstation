const DAY_LABELS = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
];

export const DEFAULT_WORDPRESS_IMPORT_URL = 'https://termburg45.ru/wp-json/termburg/v1/schedule/import';
export const WORDPRESS_SYNC_DEFAULTS_BY_LOCATION = {
  '2': {
    endpoint: DEFAULT_WORDPRESS_IMPORT_URL,
    complexCode: 'zelenogorsk',
  },
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function weekdayLabels(days) {
  if (!Array.isArray(days)) return [];
  return [...new Set(days)]
    .filter(day => Number.isInteger(day) && day >= 1 && day <= 7)
    .sort((left, right) => left - right)
    .map(day => DAY_LABELS[day - 1]);
}

function weekdayForDate(date) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return [];
  const day = parsed.getUTCDay();
  return [DAY_LABELS[(day === 0 ? 7 : day) - 1]];
}

function eventPrice(item) {
  return item.priceKind === 'paid' && Number(item.price) > 0 ? Number(item.price) : null;
}

function compareEventsByDisplayOrder(left, right) {
  const leftTime = text(left.time) || '99:99';
  const rightTime = text(right.time) || '99:99';
  return leftTime.localeCompare(rightTime)
    || text(left.date).localeCompare(text(right.date))
    || text(left.name).localeCompare(text(right.name))
    || text(left.id).localeCompare(text(right.id));
}

function isClosedWordPressEvent(item) {
  return item.closed === true || item.sanitaryDay === true || item.type === 'closed';
}

function dateKeyInTimeZone(now, timeZone = 'Europe/Moscow') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = part => parts.find(item => item.type === part)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function locationTimeZone(schedule, locationId) {
  const location = Array.isArray(schedule?.locations)
    ? schedule.locations.find(item => item.id === locationId)
    : null;
  return text(location?.timezone) || 'Europe/Moscow';
}

function toWordPressEvent(item, { date, daysOfWeek }) {
  const closed = Boolean(item.closed || item.sanitaryDay);
  const name = text(item.title) || (closed ? 'Санитарный день' : '');
  const days = date ? weekdayForDate(date) : weekdayLabels(daysOfWeek);
  const price = closed ? null : eventPrice(item);
  const result = {
    id: item.id,
    ...(date ? { date } : {}),
    name,
    title: name,
    time: closed ? '' : text(item.time),
    duration: '',
    day: days,
    weekdays: days,
    type: closed ? 'closed' : price ? 'paid' : 'free',
    description: text(item.details) || (closed ? 'Санитарный день' : ''),
    location: text(item.venue),
    instructor: '',
    price,
    isFree: price === null,
    highlight: closed ? false : Boolean(item.highlight),
  };

  if (closed) {
    result.closed = true;
    result.sanitaryDay = true;
  }
  return result;
}

export function buildWordPressSchedulePayload(schedule, locationId) {
  if (!schedule || !Array.isArray(schedule.weeklyEvents) || !Array.isArray(schedule.exceptions)) {
    throw new Error('Неверный формат расписания.');
  }

  const recurring = schedule.weeklyEvents
    .filter(item => item.locationId === locationId && item.published)
    .map(item => toWordPressEvent(item, { daysOfWeek: item.daysOfWeek }));

  const dated = schedule.exceptions
    .filter(item => item.locationId === locationId && item.published)
    .map(item => toWordPressEvent(item, { date: item.date }));

  return [...recurring, ...dated].sort(compareEventsByDisplayOrder);
}

export function validateWordPressScheduleBeforePublish(schedule, locationId, payload, { now = new Date() } = {}) {
  if (!Array.isArray(payload)) {
    throw new Error('Неверный массив для отправки на сайт.');
  }

  const publishedWeekly = Array.isArray(schedule?.weeklyEvents)
    ? schedule.weeklyEvents.filter(item => item.locationId === locationId && item.published)
    : [];
  const regularItems = payload.filter(item => !isClosedWordPressEvent(item));
  const problems = [];

  if (payload.length === 0) {
    problems.push('нет опубликованных событий для выбранного комплекса');
  }

  if (publishedWeekly.length === 0 && regularItems.length > 0) {
    problems.push('нет обычной недели — отправка похожа на старый датированный импорт');
  }

  const missingLocationCount = regularItems.filter(item => !text(item.location)).length;
  if (missingLocationCount > 0) {
    problems.push(`${missingLocationCount} событий без места проведения`);
  }

  const invalidContractCount = payload.filter(item => {
    const closed = isClosedWordPressEvent(item);
    const hasName = Boolean(text(item.name) || text(item.title));
    const hasTime = Boolean(text(item.time)) || closed;
    const days = Array.isArray(item.weekdays) ? item.weekdays : item.day;
    const hasDayOrDate = Boolean(text(item.date)) || (Array.isArray(days) && days.length > 0);
    return !hasName || !hasTime || !hasDayOrDate;
  }).length;
  if (invalidContractCount > 0) {
    problems.push(`${invalidContractCount} событий не проходят обязательный контракт сайта`);
  }

  const datedItems = payload.filter(item => text(item.date));
  const datedOnly = payload.length > 0 && datedItems.length === payload.length;
  const latestDate = datedItems
    .map(item => text(item.date))
    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
    .at(-1);
  const today = dateKeyInTimeZone(now, locationTimeZone(schedule, locationId));
  if (datedOnly && latestDate && latestDate < today) {
    problems.push(`все события датированные и заканчиваются ${latestDate}, сегодня уже ${today}`);
  }

  if (datedOnly && payload.length > 120) {
    problems.push(`слишком много датированных событий (${payload.length}) вместо компактной обычной недели`);
  }

  if (problems.length > 0) {
    throw new Error(`Отправка на сайт остановлена: ${problems.join('; ')}. Проверьте расписание в этой копии приложения.`);
  }

  return true;
}

export function normalizeWordPressSyncSettings(value = {}, defaults = {}) {
  const authMode = value.authMode === 'x-api-key' ? 'x-api-key' : 'bearer';
  return {
    endpoint: text(value.endpoint) || text(defaults.endpoint),
    authMode,
    token: typeof value.token === 'string' ? value.token.trim() : '',
    complexCode: text(value.complexCode) || text(defaults.complexCode),
    lastPublishedAt: text(value.lastPublishedAt),
    lastPublishedCount: Number.isInteger(value.lastPublishedCount) && value.lastPublishedCount >= 0
      ? value.lastPublishedCount
      : null,
  };
}

export function validateWordPressImportResponse(value, { expectedSite = '', expectedCount } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.success !== true) {
    throw new Error('Сайт не подтвердил успешный импорт расписания.');
  }
  if (typeof value.site !== 'string' || !value.site.trim()) {
    throw new Error('Сайт не указал комплекс в ответе на импорт.');
  }
  if (expectedSite && value.site !== expectedSite) {
    throw new Error(`Сайт подтвердил другой комплекс: «${value.site}» вместо «${expectedSite}».`);
  }
  if (!Number.isInteger(value.count) || value.count < 0) {
    throw new Error('Сайт не указал количество импортированных событий.');
  }
  if (Number.isInteger(expectedCount) && value.count !== expectedCount) {
    throw new Error(`Сайт подтвердил ${value.count} событий из ${expectedCount}.`);
  }
  if (typeof value.updatedAt !== 'string' || !value.updatedAt.trim()) {
    throw new Error('Сайт не указал время обновления расписания.');
  }
  return value;
}

export function validateWordPressImportUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Укажите полный адрес импорта сайта.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Адрес импорта должен начинаться с https:// или http:// и не содержать логин с паролем.');
  }
  return parsed.toString();
}

export function buildWordPressImportHeaders(settings) {
  const normalized = normalizeWordPressSyncSettings(settings);
  if (!normalized.token) throw new Error('Сначала сохраните токен сайта.');
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (normalized.authMode === 'x-api-key') headers['X-API-Key'] = normalized.token;
  else headers.Authorization = `Bearer ${normalized.token}`;
  if (normalized.complexCode) headers['X-Termburg-Location'] = normalized.complexCode;
  return headers;
}
