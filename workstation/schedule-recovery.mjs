import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadRemoteScheduleState, matchesSiteSchedule, importSiteSchedule } from '../server/schedule-site-state.mjs';

const markerName = 'holiday-recovery-20261017.done.json';
const publicId = id => id.replace(/^official-2-/, '');

export function recoverHolidayEvents(schedule, approved) {
  const weekly = schedule.weeklyEvents.filter(e => e.locationId === '2' && e.published);
  const next = structuredClone(schedule);
  let added = 0;
  for (const event of approved) {
    const original = weekly.find(e => publicId(e.id) === publicId(event.replacesEventId));
    const weekday = new Date(`${event.date}T12:00:00Z`).getUTCDay() || 7;
    if (!original || !original.daysOfWeek.includes(weekday)) return { schedule, added: 0, complete: false };
    if (next.exceptions.some(e => e.locationId === '2' && e.date === event.date && e.replacesEventId === original.id)) continue;
    if (next.exceptions.some(e => e.id === event.id)) return { schedule, added: 0, complete: false };
    next.exceptions.push({ id: event.id, locationId: '2', date: event.date, replacesEventId: original.id,
      time: original.time, ...(original.endTime ? { endTime: original.endTime } : {}),
      title: event.title, venue: original.venue, published: true, highlight: false, priceKind: 'free',
    });
    added++;
  }
  if (added) { next.revision++; next.updatedAt = new Date().toISOString(); }
  return { schedule: added ? next : schedule, added, complete: true };
}

export async function recoverWorkstationSchedule({ userData, logger = console, fetchImpl = fetch }) {
  const dataFile = path.join(userData, 'schedule.json');
  const settingsFile = path.join(userData, 'site-sync.json');
  const markerFile = path.join(userData, markerName);
  let raw, store;
  try {
    raw = await fs.readFile(dataFile, 'utf8');
    store = JSON.parse(await fs.readFile(settingsFile, 'utf8'));
  } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const settings = store.locations?.['2'];
  // Moscow-only installations must never acquire another complex's data.
  if (!settings || settings.complexCode !== 'zelenogorsk') return;
  let current = JSON.parse(raw);
  let migrated = false;
  try { await fs.access(markerFile); migrated = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!migrated) {
    const approved = JSON.parse(await fs.readFile(new URL('./holiday-recovery-20261017.json', import.meta.url), 'utf8'));
    let result = recoverHolidayEvents(current, approved);
    try {
      const state = await loadRemoteScheduleState(settings, fetchImpl);
      const holidays = state.events.filter(e => e.replacesEventId && approved.some(a => a.id === e.id));
      if (holidays.length === 20) {
        // The requested recovery includes the latest staff publication, with an exact local backup.
        result = { complete: true, added: 20, schedule: matchesSiteSchedule(current, '2', state) ? current : importSiteSchedule(current, '2', state) };
        if (result.schedule === current) result.added = 0;
      }
    } catch (error) { logger.warn('Using bundled holiday recovery while site loading is unavailable.', { message: error.message }); }
    if (!result.complete) { logger.warn('Holiday recovery needs current schedule from the site; no records changed.'); return; }
    if (result.added) {
      const backup = path.join(userData, `schedule-before-holiday-recovery-${Date.now()}.json`);
      await fs.writeFile(backup, raw, { flag: 'wx', mode: 0o600 });
      if (await fs.readFile(dataFile, 'utf8') !== raw) throw new Error('Schedule changed during holiday recovery.');
      await fs.writeFile(`${dataFile}.recovery.tmp`, JSON.stringify(result.schedule, null, 2) + '\n');
      await fs.rename(`${dataFile}.recovery.tmp`, dataFile);
      current = result.schedule;
    }
    await fs.writeFile(markerFile, JSON.stringify({ version: 1, added: result.added, date: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
    logger.info('Holiday schedule recovery completed.', { added: result.added });
  }
  // A baseline can be initialized only when content agrees; never bless stale data.
  if (!settings.lastRemoteRevision) {
    try {
      const state = await loadRemoteScheduleState(settings, fetchImpl);
      if (matchesSiteSchedule(current, '2', state)) {
        settings.lastRemoteRevision = state.revision;
        await fs.writeFile(`${settingsFile}.revision.tmp`, JSON.stringify(store, null, 2) + '\n', { mode: 0o600 });
        await fs.rename(`${settingsFile}.revision.tmp`, settingsFile);
      }
    } catch (error) { logger.warn('Site revision initialization deferred.', { message: error.message }); }
  }
}
