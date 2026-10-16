import { getEventsForDate, getIsoWeekday } from './scheduleTime.ts';
import type { ScheduleData, ScheduleException, ScheduleItem } from './types';

export type DayEventPatch = Partial<Pick<ScheduleException,
  'title' | 'time' | 'endTime' | 'venue' | 'details' | 'priceKind' | 'price'>>;

// LAN HTTP browsers expose getRandomValues, but randomUUID needs a secure context.
export function createDayReplacementId(source: Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>> = crypto) {
  const suffix = typeof source.randomUUID === 'function' ? source.randomUUID()
    : [...source.getRandomValues(new Uint32Array(4))].map(value => value.toString(16).padStart(8, '0')).join('');
  return `day-${suffix}`;
}

export function isDayReplacementDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T12:00:00Z`))
    && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
}

export function getDayReplacementRows(data: ScheduleData, locationId: string, date: string) {
  return isDayReplacementDate(date) ? getEventsForDate(data, locationId, date) : [];
}

export function getPendingDayReplacement(data: ScheduleData, item: ScheduleItem) {
  return !item.isException ? data.exceptions.find(event => !event.published
    && event.locationId === item.locationId && event.date === item.occurrenceDate
    && event.replacesEventId === item.id) : undefined;
}

// Use the existing date-exception contract. Never clone or edit the weekly template.
export function changeDayEvent(
  data: ScheduleData, locationId: string, date: string, itemId: string,
  isException: boolean, patch: DayEventPatch, createId = createDayReplacementId,
): ScheduleData {
  const item = getDayReplacementRows(data, locationId, date)
    .find(event => event.id === itemId && event.isException === isException);
  if (!item || ('closed' in item && item.closed) || ('sanitaryDay' in item && item.sanitaryDay)) {
    throw new Error('Событие недоступно для замены. Обновите расписание или откройте «Особые даты».');
  }
  if (getPendingDayReplacement(data, item)) {
    throw new Error('У события есть черновик замены. Сначала проверьте его в разделе «Особые даты».');
  }
  if (Object.entries(patch).every(([key, value]) => item[key as keyof ScheduleItem] === value)) return data;
  const original = isException ? data.exceptions.find(event => event.id === itemId)! : undefined;
  const updated: ScheduleException = {
    ...(original ?? {
      id: createId(), locationId, date, replacesEventId: item.id,
      time: item.time, endTime: item.endTime, title: item.title, venue: item.venue,
      details: item.details, priceKind: item.priceKind, price: item.price,
      published: true, highlight: item.highlight,
    }),
    ...patch,
  };
  if (updated.priceKind === 'free') delete updated.price;
  return {
    ...data,
    exceptions: original ? data.exceptions.map(event => event === original ? updated : event)
      : [...data.exceptions, updated],
  };
}

// Additional one-off events and closures are intentionally NOT removed by this action.
export function resetDayReplacements(data: ScheduleData, locationId: string, date: string, exceptionId?: string) {
  if (!isDayReplacementDate(date)) throw new Error('Выберите дату.');
  return {
    ...data,
    exceptions: data.exceptions.filter(event => !(event.locationId === locationId && event.date === date
      && event.replacesEventId && event.published && (!exceptionId || event.id === exceptionId))),
  };
}

export function countDayReplacements(data: ScheduleData, locationId: string, date: string) {
  const weekday = getIsoWeekday(date);
  return data.exceptions.filter(event => event.locationId === locationId && event.date === date
    && event.published && event.replacesEventId && data.weeklyEvents.some(weekly => weekly.id === event.replacesEventId
      && weekly.locationId === locationId && weekly.published && weekly.daysOfWeek.includes(weekday))).length;
}
