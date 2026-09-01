import type { ScheduleData, ScheduleException, ScheduleLocation } from './types';

interface OfficialScheduleItem {
  id: number | string;
  date: string;
  name?: string;
  title?: string;
  time?: string;
  duration?: string;
  type?: string;
  description?: string;
  location?: string;
  instructor?: string;
  price?: number | null;
  isFree?: boolean;
  highlight?: boolean;
  closed?: boolean;
  sanitaryDay?: boolean;
}

const OFFICIAL_LOCATIONS: Array<ScheduleLocation & { endpoint: string }> = [
  {
    id: '1',
    city: 'Москва',
    name: 'Термбург Москва',
    shortName: 'Москва',
    address: 'ул. Гурьянова, 30',
    timezone: 'Europe/Moscow',
    endpoint: import.meta.env.VITE_MOSCOW_SCHEDULE_URL?.trim()
      || 'https://termburg.ru/wp-json/termburg/v1/schedule',
  },
  {
    id: '2',
    city: 'Зеленогорск',
    name: 'Термбург Зеленогорск',
    shortName: 'Зеленогорск',
    address: 'ул. Парковая, 23',
    timezone: 'Asia/Krasnoyarsk',
    endpoint: import.meta.env.VITE_ZELENOGORSK_SCHEDULE_URL?.trim()
      || 'https://termburg45.ru/wp-json/termburg/v1/schedule',
  },
];

const OFFICIAL_REFRESH_MS = 5 * 60 * 1000;
let cachedOfficialSchedule: ScheduleData | null = null;
let cachedOfficialAt = 0;

function addMinutes(time: string, minutes: number) {
  const [hours = 0, currentMinutes = 0] = time.split(':').map(Number);
  const total = Math.min(24 * 60 - 1, hours * 60 + currentMinutes + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function getEndTime(item: OfficialScheduleItem) {
  const duration = Number(item.duration?.match(/\d+/)?.[0]);
  if (!item.time || !Number.isFinite(duration) || duration <= 0) return undefined;
  return addMinutes(item.time, duration);
}

function normalizeItem(item: OfficialScheduleItem, locationId: string): ScheduleException | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date || '')) return null;
  const closed = item.closed === true || item.sanitaryDay === true || item.type === 'closed';
  const title = (item.title || item.name || '').trim();
  if (!title) return null;
  const price = Number(item.price);
  const priceKind = item.type === 'paid' || (Number.isFinite(price) && price > 0) ? 'paid' : 'free';
  const details = [item.description, item.instructor].filter(Boolean).join(' · ') || undefined;

  return {
    id: `official-${locationId}-${item.id}`,
    locationId,
    date: item.date,
    time: closed ? '00:00' : (item.time || '00:00'),
    endTime: closed ? undefined : getEndTime(item),
    title,
    venue: item.location?.trim() || '',
    details,
    priceKind,
    price: priceKind === 'paid' && Number.isFinite(price) ? price : undefined,
    published: true,
    highlight: item.highlight === true,
    closed,
    sanitaryDay: item.sanitaryDay === true,
  };
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
  return value
    .map(item => normalizeItem(item as OfficialScheduleItem, locationId))
    .filter((item): item is ScheduleException => Boolean(item));
}

export async function loadOfficialSchedule(timeoutMs = 8000): Promise<ScheduleData | null> {
  if (cachedOfficialSchedule && Date.now() - cachedOfficialAt < OFFICIAL_REFRESH_MS) {
    return cachedOfficialSchedule;
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const results = await Promise.allSettled(
      OFFICIAL_LOCATIONS.map(location => fetchOfficialLocation(location.id, location.endpoint, controller.signal)),
    );
    if (results.some(result => result.status === 'rejected')) return null;
    const exceptions = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    if (exceptions.length === 0) return null;

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
      weeklyEvents: [],
      exceptions,
      monthlyPosters: [],
    };
    cachedOfficialAt = Date.now();
    return cachedOfficialSchedule;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
