import type { ScheduleData, ScheduleItem } from './types';

const ISO_WEEKDAY_BY_SHORT: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export const DAY_LABELS = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
] as const;

export const DAY_LABELS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

function numberPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return Number(parts.find(part => part.type === type)?.value ?? 0);
}

export function getZonedClock(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(now);
  const year = numberPart(parts, 'year');
  const month = numberPart(parts, 'month');
  const day = numberPart(parts, 'day');
  const hour = numberPart(parts, 'hour');
  const minute = numberPart(parts, 'minute');
  const second = numberPart(parts, 'second');
  const weekdayText = parts.find(part => part.type === 'weekday')?.value ?? 'Mon';

  return {
    dateKey: `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
    isoWeekday: ISO_WEEKDAY_BY_SHORT[weekdayText] ?? 1,
    hour,
    minute,
    second,
    minutes: hour * 60 + minute,
  };
}

export function timeToMinutes(time: string) {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMonths(dateKey: string, months: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function getIsoWeekday(dateKey: string) {
  const jsDay = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function startOfIsoWeek(dateKey: string) {
  return addDays(dateKey, 1 - getIsoWeekday(dateKey));
}

export function formatScheduleDate(dateKey: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('ru-RU', options ?? {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

export function getEventsForDate(data: ScheduleData, locationId: string, dateKey: string): ScheduleItem[] {
  const weekday = getIsoWeekday(dateKey);
  const exceptions: ScheduleItem[] = data.exceptions
    .filter(event => event.locationId === locationId && event.published && event.date === dateKey)
    .map(event => ({ ...event, occurrenceDate: dateKey, isException: true, daysOfWeek: [weekday] }));
  const closed = exceptions.filter(isClosedScheduleItem);
  if (closed.length > 0) return closed;

  const recurring: ScheduleItem[] = data.weeklyEvents
    .filter(event => event.locationId === locationId && event.published && event.daysOfWeek.includes(weekday))
    .map(event => ({ ...event, occurrenceDate: dateKey, isException: false }));
  return [...recurring, ...exceptions].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

export function isClosedScheduleItem(item: ScheduleItem) {
  return ('closed' in item && item.closed === true)
    || ('sanitaryDay' in item && item.sanitaryDay === true);
}

export function getItemEndMinutes(item: ScheduleItem) {
  if (isClosedScheduleItem(item)) return 24 * 60;
  return item.endTime ? timeToMinutes(item.endTime) : timeToMinutes(item.time) + 30;
}

export function getHighlightedItem(items: ScheduleItem[], currentMinutes: number) {
  const active = items.find(item => {
    const start = timeToMinutes(item.time);
    return start <= currentMinutes && currentMinutes < getItemEndMinutes(item);
  });
  if (active) return { item: active, status: 'now' as const };

  const upcoming = items.find(item => timeToMinutes(item.time) > currentMinutes);
  if (upcoming) return { item: upcoming, status: 'next' as const };

  return { item: null, status: null };
}

export function getNextScheduleItem(
  data: ScheduleData,
  locationId: string,
  dateKey: string,
  currentMinutes: number,
) {
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidateDate = addDays(dateKey, offset);
    const items = getEventsForDate(data, locationId, candidateDate);
    const item = items.find(event => offset > 0 || getItemEndMinutes(event) > currentMinutes);
    if (item) {
      const isActive = offset === 0
        && timeToMinutes(item.time) <= currentMinutes
        && currentMinutes < getItemEndMinutes(item);
      return { item, dayOffset: offset, status: isActive ? 'now' as const : 'next' as const };
    }
  }
  return null;
}

export function getMonthGrid(dateKey: string) {
  const [year, month] = dateKey.split('-').map(Number);
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = getIsoWeekday(first) - 1;
  const cells: Array<{ dateKey: string; day: number; inMonth: boolean }> = [];

  for (let index = -leading; index < daysInMonth; index += 1) {
    const key = addDays(first, index);
    const day = Number(key.slice(8, 10));
    cells.push({ dateKey: key, day, inMonth: index >= 0 });
  }
  while (cells.length % 7 !== 0) {
    const next = addDays(cells[cells.length - 1].dateKey, 1);
    cells.push({ dateKey: next, day: Number(next.slice(8, 10)), inMonth: false });
  }
  return cells;
}
