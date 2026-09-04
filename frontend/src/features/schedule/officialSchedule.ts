import type { ScheduleData, ScheduleEvent, ScheduleException, ScheduleLocation } from './types';

interface OfficialScheduleItem {
  id?: unknown;
  date?: unknown;
  name?: unknown;
  title?: unknown;
  time?: unknown;
  duration?: unknown;
  day?: unknown;
  weekdays?: unknown;
  type?: unknown;
  description?: unknown;
  location?: unknown;
  instructor?: unknown;
  price?: unknown;
  highlight?: unknown;
  closed?: unknown;
  sanitaryDay?: unknown;
}

const OFFICIAL_LOCATIONS: Array<ScheduleLocation & { endpoint: string }> = [
  {
    id: '1',
    city: 'Москва',
    name: 'Термбург Москва',
    shortName: 'Москва',
    address: 'ул. Гурьянова, 30',
    timezone: 'Europe/Moscow',
    endpoint: import.meta.env?.VITE_MOSCOW_SCHEDULE_URL?.trim()
      || 'https://termburg.ru/wp-json/termburg/v1/schedule',
  },
  {
    id: '2',
    city: 'Зеленогорск',
    name: 'Термбург Зеленогорск',
    shortName: 'Зеленогорск',
    address: 'ул. Парковая, 23',
    timezone: 'Asia/Krasnoyarsk',
    endpoint: import.meta.env?.VITE_ZELENOGORSK_SCHEDULE_URL?.trim()
      || 'https://termburg45.ru/wp-json/termburg/v1/schedule',
  },
];

const OFFICIAL_REFRESH_MS = 5 * 60 * 1000;
let cachedOfficialSchedule: ScheduleData | null = null;
let cachedOfficialAt = 0;

const ISO_WEEKDAY_BY_LABEL: Record<string, number> = {
  понедельник: 1,
  пн: 1,
  вторник: 2,
  вт: 2,
  среда: 3,
  ср: 3,
  четверг: 4,
  чт: 4,
  пятница: 5,
  пт: 5,
  суббота: 6,
  сб: 6,
  воскресенье: 7,
  вс: 7,
};

function addMinutes(time: string, minutes: number) {
  const [hours = 0, currentMinutes = 0] = time.split(':').map(Number);
  const total = Math.min(24 * 60 - 1, hours * 60 + currentMinutes + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getEndTime(item: OfficialScheduleItem, time: string) {
  const duration = Number(text(item.duration).match(/\d+/)?.[0]);
  if (!time || !Number.isFinite(duration) || duration <= 0) return undefined;
  return addMinutes(time, duration);
}

function asStringList(value: unknown) {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return items
    .filter((item): item is string => typeof item === 'string')
    .flatMap(item => item.split(','))
    .map(item => item.trim())
    .filter(Boolean);
}

function getWeekdays(item: OfficialScheduleItem) {
  const labels = [...asStringList(item.weekdays), ...asStringList(item.day)];
  return [...new Set(labels
    .map(label => ISO_WEEKDAY_BY_LABEL[label.toLocaleLowerCase('ru-RU')])
    .filter((day): day is number => day !== undefined))]
    .sort((left, right) => left - right);
}

type ScheduleItemBase = Omit<ScheduleEvent, 'daysOfWeek'>;

function normalizeItemBase(item: OfficialScheduleItem, locationId: string): ScheduleItemBase | null {
  const type = text(item.type);
  const closed = item.closed === true || item.sanitaryDay === true || type === 'closed';
  const title = text(item.title) || text(item.name);
  if (!title) return null;
  const price = typeof item.price === 'number'
    ? item.price
    : text(item.price) ? Number(text(item.price)) : Number.NaN;
  const priceKind = type === 'paid' || (Number.isFinite(price) && price > 0) ? 'paid' : 'free';
  const details = [text(item.description), text(item.instructor)].filter(Boolean).join(' · ') || undefined;
  const sourceTime = text(item.time);
  const time = closed ? '00:00' : (sourceTime || '00:00');
  const sourceId = typeof item.id === 'string' || typeof item.id === 'number' ? item.id : `${title}-${time}`;

  return {
    id: `official-${locationId}-${sourceId}`,
    locationId,
    time,
    endTime: closed ? undefined : getEndTime(item, sourceTime),
    title,
    venue: text(item.location),
    details,
    priceKind,
    price: priceKind === 'paid' && Number.isFinite(price) ? price : undefined,
    published: true,
    highlight: item.highlight === true,
  };
}

export function normalizeOfficialScheduleItems(value: unknown, locationId: string) {
  const weeklyEvents: ScheduleEvent[] = [];
  const exceptions: ScheduleException[] = [];
  if (!Array.isArray(value)) return { weeklyEvents, exceptions };

  value.forEach(candidate => {
    if (!candidate || typeof candidate !== 'object') return;
    const item = candidate as OfficialScheduleItem;
    const base = normalizeItemBase(item, locationId);
    if (!base) return;

    const date = text(item.date);
    const closed = item.closed === true || item.sanitaryDay === true || text(item.type) === 'closed';
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      exceptions.push({
        ...base,
        date,
        closed,
        sanitaryDay: item.sanitaryDay === true,
      });
      return;
    }

    const daysOfWeek = getWeekdays(item);
    if (daysOfWeek.length === 0 || closed) return;
    weeklyEvents.push({ ...base, daysOfWeek });
  });

  return { weeklyEvents, exceptions };
}

async function fetchOfficialLocation(locationId: string, endpoint: string, signal: AbortSignal) {
  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new Error('Некорректный формат расписания');
  return normalizeOfficialScheduleItems(value, locationId);
}

export async function loadOfficialSchedule(timeoutMs = 8000): Promise<ScheduleData | null> {
  if (cachedOfficialSchedule && Date.now() - cachedOfficialAt < OFFICIAL_REFRESH_MS) {
    return cachedOfficialSchedule;
  }
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const results = await Promise.allSettled(
      OFFICIAL_LOCATIONS.map(location => fetchOfficialLocation(location.id, location.endpoint, controller.signal)),
    );
    if (results.some(result => result.status === 'rejected')) return null;
    const weeklyEvents = results.flatMap(result => result.status === 'fulfilled' ? result.value.weeklyEvents : []);
    const exceptions = results.flatMap(result => result.status === 'fulfilled' ? result.value.exceptions : []);
    if (weeklyEvents.length === 0 && exceptions.length === 0) return null;

    cachedOfficialSchedule = {
      schemaVersion: 1,
      revision: Math.floor(Date.now() / 1000),
      updatedAt: new Date().toISOString(),
      locations: OFFICIAL_LOCATIONS.map(location => ({
        id: location.id,
        city: location.city,
        name: location.name,
        shortName: location.shortName,
        address: location.address,
        timezone: location.timezone,
      })),
      weeklyEvents,
      exceptions,
      monthlyPosters: [],
    };
    cachedOfficialAt = Date.now();
    return cachedOfficialSchedule;
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
