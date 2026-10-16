import test from 'node:test';
import assert from 'node:assert/strict';
import { changeDayEvent, countDayReplacements, createDayReplacementId, getDayReplacementRows, resetDayReplacements } from '../src/features/schedule/dayReplacement.ts';
import { getEventsForDate } from '../src/features/schedule/scheduleTime.ts';
import { validateScheduleItems } from '../../server/schedule-service.mjs';

const steam = { id: 'steam', locationId: '2', daysOfWeek: [1,2,3,4,5,6,7], time: '14:00', endTime: '14:30', title: 'Парение', venue: 'Парная', priceKind: 'paid', price: 390, published: true };
const fixture = () => ({ schemaVersion: 1, revision: 5, updatedAt: '2026-10-16', locations: [{ id: '1' }, { id: '2' }], weeklyEvents: [steam, { ...steam, id: 'wellness', title: 'Детское занятие' }, { ...steam, id: 'moscow', locationId: '1' }], exceptions: [], monthlyPosters: [] });
const update = (data, patch, id = 'steam', exception = false, date = '2026-10-17') => changeDayEvent(data, '2', date, id, exception, patch, () => 'override');

test('LAN HTTP generates unique IDs without secure-context randomUUID', () => {
  const source = { getRandomValues: value => crypto.getRandomValues(value) };
  const first = createDayReplacementId(source);
  assert.match(first, /^day-[a-f0-9]{32}$/);
  assert.notEqual(first, createDayReplacementId(source));
});

test('one edit changes only one date and one event; entire template, Moscow and wellness remain untouched', () => {
  const before = fixture();
  const next = update(before, { title: 'Праздничное парение', priceKind: 'free' });
  assert.equal(before.exceptions.length, 0);
  assert.equal(next.weeklyEvents, before.weeklyEvents);
  assert.equal(next.locations, before.locations);
  assert.equal(next.monthlyPosters, before.monthlyPosters);
  assert.equal(next.revision, before.revision);
  assert.equal(validateScheduleItems(next), '');
  assert.equal(countDayReplacements(next, '2', '2026-10-17'), 1);
  const changed = getEventsForDate(next, '2', '2026-10-17');
  assert.equal(changed.length, 2);
  assert.equal(changed.find(e => e.replacesEventId).price, undefined);
  assert.equal(changed.find(e => e.id === 'wellness').price, 390);
  for (const date of ['2026-10-16', '2026-10-18', '2026-10-24']) assert.deepEqual(getEventsForDate(next, '2', date), getEventsForDate(before, '2', date));
  assert.deepEqual(getEventsForDate(next, '1', '2026-10-17'), getEventsForDate(before, '1', '2026-10-17'));
});

test('typing repeatedly updates one linked override and retains its ID, date and metadata', () => {
  let next = update(fixture(), { title: 'Н' });
  next.exceptions[0].highlight = true;
  next = update(next, { title: 'Новое название', time: '15:00' }, 'override', true);
  assert.equal(next.exceptions.length, 1);
  assert.equal(next.exceptions[0].id, 'override');
  assert.equal(next.exceptions[0].replacesEventId, 'steam');
  assert.equal(next.exceptions[0].highlight, true);
  assert.equal(next.exceptions[0].date, '2026-10-17');
  assert.equal(next.exceptions[0].title, 'Новое название');
  assert.equal(validateScheduleItems(next), '');
});

test('reset restores only linked replacements on selected date and preserves additions, unpublished drafts and another date', () => {
  const data = update(fixture(), { title: 'Праздник' });
  data.exceptions.push({ ...data.exceptions[0], id: 'next-day', date: '2026-10-18' });
  data.exceptions.push({ ...data.exceptions[0], id: 'addition', replacesEventId: undefined });
  data.exceptions.push({ ...data.exceptions[0], id: 'draft', replacesEventId: 'wellness', published: false });
  const next = resetDayReplacements(data, '2', '2026-10-17');
  assert.deepEqual(next.exceptions.map(e => e.id), ['next-day', 'addition', 'draft']);
  assert.equal(getEventsForDate(next, '2', '2026-10-17').find(e => e.id === 'steam').price, 390);
  assert.equal(data.exceptions.length, 4);
});

test('editing an additional date event does not turn it into a weekly replacement', () => {
  const data = fixture();
  data.exceptions.push({ ...steam, id: 'special', daysOfWeek: undefined, date: '2026-10-17' });
  const next = update(data, { title: 'Другое разовое событие' }, 'special', true);
  assert.equal(next.exceptions[0].replacesEventId, undefined);
  assert.equal(next.exceptions.length, 1);
  assert.equal(next.weeklyEvents, data.weeklyEvents);
});

test('invalid or absent dates, wrong complex, stale ID, closure and a pending draft fail closed', () => {
  const data = fixture();
  for (const date of ['', '2026-02-31', 'junk']) {
    assert.deepEqual(getDayReplacementRows(data, '2', date), []);
    assert.throws(() => update(data, { title: 'X' }, 'steam', false, date));
  }
  assert.throws(() => update(data, { title: 'X' }, 'moscow'));
  assert.throws(() => update(data, { title: 'X' }, 'missing'));
  data.exceptions.push({ ...steam, id: 'closed', date: '2026-10-17', sanitaryDay: true });
  assert.throws(() => update(data, { title: 'X' }, 'closed', true));
  assert.throws(() => update(data, { title: 'X' }));
  const pending = update(fixture(), { title: 'Черновик' }); pending.exceptions[0].published = false;
  assert.throws(() => update(pending, { title: 'X' }), /черновик/);
});

test('opening or assigning the same value is not a change; reset single row preserves the other replacement', () => {
  const data = fixture();
  assert.equal(update(data, { title: steam.title }), data);
  let next = update(data, { title: 'Праздник' });
  next = changeDayEvent(next, '2', '2026-10-17', 'wellness', false, { title: 'Разовое название' }, () => 'other');
  assert.equal(countDayReplacements(next, '2', '2026-10-17'), 2);
  assert.deepEqual(resetDayReplacements(next, '2', '2026-10-17', 'override').exceptions.map(e => e.id), ['other']);
});
