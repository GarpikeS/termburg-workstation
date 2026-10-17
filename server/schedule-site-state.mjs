import { buildWordPressSchedulePayload } from './wordpress-schedule.mjs';

export function siteStateUrl(endpoint) {
  const url = new URL(endpoint);
  if (!url.pathname.endsWith('/schedule/import')) throw new Error('Загрузка с сайта доступна для адреса /schedule/import.');
  url.pathname = url.pathname.replace(/\/import$/, '/state');
  url.search = '';
  return url.toString();
}

export async function loadRemoteScheduleState(settings, fetchImpl = fetch) {
  const response = await fetchImpl(siteStateUrl(settings.endpoint), { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Не удалось загрузить расписание с сайта (HTTP ${response.status}).`);
  const state = await response.json();
  if (state.protocol !== 1 || !/^[a-f0-9]{64}$/.test(state.revision) || !Array.isArray(state.events)
    || state.count !== state.events.length || state.site !== settings.complexCode) throw new Error('Сайт вернул неподходящую версию или другой комплекс расписания.');
  return state;
}

const labels = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
const publicId = (id, locationId) => id.startsWith(`official-${locationId}-`) ? id.slice(`official-${locationId}-`.length) : id;

// Project both API formats to the content that publication actually changes.
export function sameSiteEvents(left, right) {
  const project = events => events.map(e => JSON.stringify([
    e.id, e.date || '', e.replacesEventId || '', e.title || e.name || '', e.time || '',
    [...(e.weekdays || e.day || [])].sort(), e.location || '', e.description || '',
    e.isFree === false || e.type === 'paid' ? Number(e.price) || 0 : 0,
    Boolean(e.highlight), Boolean(e.closed || e.sanitaryDay || e.type === 'closed'),
  ])).sort();
  return JSON.stringify(project(left)) === JSON.stringify(project(right));
}

export function importSiteSchedule(current, locationId, state) {
  if (!current.locations.some(location => location.id === locationId)) throw new Error('Комплекс не найден.');
  const ids = new Set();
  const known = new Map([...current.weeklyEvents, ...current.exceptions].filter(e => e.locationId === locationId).map(e => [publicId(e.id, locationId), e.id]));
  const idFor = id => known.get(id) || `official-${locationId}-${id}`;
  const weeklyEvents = [], exceptions = [];
  for (const event of state.events) {
    if (!event || typeof event.id !== 'string' || !event.id || ids.has(event.id) || !(event.title || event.name)) throw new Error('Некорректное событие на сайте.');
    ids.add(event.id);
    if ([...current.weeklyEvents, ...current.exceptions].some(e => e.locationId === locationId && !e.published && e.id === idFor(event.id))) throw new Error('На сайте опубликовано событие, у которого здесь есть неопубликованный черновик. Сначала проверьте черновик.');
    const closed = Boolean(event.closed || event.sanitaryDay || event.type === 'closed');
    const paid = event.type === 'paid' || event.isFree === false;
    const item = {
      id: idFor(event.id), locationId, title: event.title || event.name,
      time: closed ? '00:00' : event.time, venue: event.location || '',
      details: event.description || '', published: true, highlight: Boolean(event.highlight),
      priceKind: paid ? 'paid' : 'free', ...(paid ? { price: Number(event.price) || 0 } : {}),
      ...(closed ? { closed: true, sanitaryDay: true } : {}),
    };
    // Preserve private/local presentation fields that the website does not carry.
    const previous = [...current.weeklyEvents, ...current.exceptions].find(e => e.id === item.id);
    if (previous?.endTime) item.endTime = previous.endTime;
    if (event.date) exceptions.push({ ...item, date: event.date, ...(event.replacesEventId ? { replacesEventId: idFor(event.replacesEventId) } : {}) });
    else {
      const days = (event.weekdays || event.day || []).map(day => labels.indexOf(day) + 1).filter(day => day > 0);
      if (!days.length || !item.time || !item.venue) throw new Error('На сайте есть событие без дня, времени или места.');
      weeklyEvents.push({ ...item, daysOfWeek: [...new Set(days)].sort() });
    }
  }
  if (!weeklyEvents.length) throw new Error('На сайте отсутствует обычная неделя. Загрузка остановлена.');
  return { ...current, revision: current.revision + 1, updatedAt: new Date().toISOString(),
    weeklyEvents: [...current.weeklyEvents.filter(e => e.locationId !== locationId || !e.published), ...weeklyEvents],
    exceptions: [...current.exceptions.filter(e => e.locationId !== locationId || !e.published), ...exceptions],
  };
}

export function matchesSiteSchedule(schedule, locationId, state) {
  return sameSiteEvents(buildWordPressSchedulePayload(schedule, locationId), state.events);
}
