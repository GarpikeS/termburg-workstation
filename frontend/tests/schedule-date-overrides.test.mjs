import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventsForDate } from '../src/features/schedule/scheduleTime.ts';
import { validateScheduleItems } from '../../server/schedule-service.mjs';
import { buildWordPressSchedulePayload } from '../../server/wordpress-schedule.mjs';

const steam = { id: 'steam', locationId: '2', daysOfWeek: [1,2,3,4,5,6,7], time: '14:00', title: 'Обычное парение', venue: 'Парная', priceKind: 'paid', price: 390, published: true };
const wellness = { ...steam, id: 'wellness', title: 'Детская анимация', venue: 'Бассейн' };
const moscow = { ...steam, id: 'moscow', locationId: '1' };
const replacement = date => ({ ...steam, id: 'replacement-' + date, daysOfWeek: undefined, replacesEventId: 'steam', date, title: 'Праздничное парение', priceKind: 'free', price: undefined });
const fixture = () => ({ schemaVersion: 1, revision: 1, updatedAt: '', locations: [{ id: '1' }, { id: '2' }], weeklyEvents: [steam, wellness, moscow], exceptions: ['2026-10-17', '2026-10-18'].map(replacement), monthlyPosters: [] });

test('replaces only the selected ceremony on two dates, preserving wellness and Moscow', () => {
  const data = fixture(), before = structuredClone(data);
  for (const date of ['2026-10-17', '2026-10-18']) {
    const events = getEventsForDate(data, '2', date);
    assert.equal(events.length, 2);
    assert.deepEqual(events.map(e => e.title).sort(), ['Детская анимация', 'Праздничное парение']);
    assert.equal(events.find(e => e.replacesEventId).priceKind, 'free');
    assert.equal(events.find(e => e.id === 'wellness').price, 390);
    assert.equal(getEventsForDate(data, '1', date)[0].title, steam.title);
  }
  for (const date of ['2026-10-16', '2026-10-19', '2026-10-24', '2026-10-25']) {
    const item = getEventsForDate(data, '2', date).find(e => e.id === steam.id);
    assert.equal(item.title, steam.title);
    assert.equal(item.price, 390);
  }
  assert.deepEqual(data, before);
});

test('unpublishing or deleting the replacement restores the normal event; closure still wins', () => {
  const data = fixture();
  data.exceptions[0].published = false;
  assert.equal(getEventsForDate(data, '2', '2026-10-17').find(e => e.id === 'steam').price, 390);
  data.exceptions = [];
  assert.equal(getEventsForDate(data, '2', '2026-10-18').length, 2);
  data.exceptions.push({ ...replacement('2026-10-18'), replacesEventId: undefined, closed: true });
  assert.equal(getEventsForDate(data, '2', '2026-10-18').length, 1);
});

test('rejects cross-complex, duplicate, orphan, wrong-weekday, unpublished and closed replacements', () => {
  assert.equal(validateScheduleItems(fixture()), '');
  for (const mutate of [
    data => { data.exceptions[0].replacesEventId = 'moscow'; },
    data => data.exceptions.push({ ...data.exceptions[0], id: 'duplicate' }),
    data => { data.exceptions[0].replacesEventId = 'missing'; },
    data => { data.weeklyEvents[0] = { ...steam, daysOfWeek: [1] }; },
    data => { data.weeklyEvents[0] = { ...steam, published: false }; },
    data => { data.exceptions[0].closed = true; },
  ]) {
    const data = fixture(); mutate(data);
    assert.notEqual(validateScheduleItems(data), '');
  }
});

test('Zelenogorsk receives linked date replacements without changing ordinary events', () => {
  const data = fixture();
  const normal = buildWordPressSchedulePayload({ ...data, exceptions: [] }, '2');
  const payload = buildWordPressSchedulePayload(data, '2');
  assert.deepEqual(payload.filter(item => !item.replacesEventId), normal);
  assert.equal(payload.filter(item => item.replacesEventId).length, 2);
  assert.equal(payload.find(item => item.replacesEventId).price, null);
  const moscowData = { ...data, exceptions: data.exceptions.map(item => ({ ...item, locationId: '1', replacesEventId: 'moscow' })) };
  assert.deepEqual(buildWordPressSchedulePayload(moscowData, '1'), buildWordPressSchedulePayload({ ...moscowData, exceptions: [] }, '1'));
});

test('exported replacement references use the same public ID as imported recurring events', () => {
  const data = fixture();
  data.weeklyEvents[0].id = 'official-2-steam';
  data.exceptions.forEach(item => { item.replacesEventId = 'official-2-steam'; });
  const payload = buildWordPressSchedulePayload(data, '2');
  assert(payload.some(item => item.id === 'steam' && !item.date));
  assert.equal(payload.find(item => item.replacesEventId).replacesEventId, 'steam');
});
