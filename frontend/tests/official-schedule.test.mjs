import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeOfficialScheduleItems } from '../src/features/schedule/officialSchedule.ts';
import { getEventsForDate } from '../src/features/schedule/scheduleTime.ts';

function createSchedule({ weeklyEvents, exceptions }) {
  return {
    schemaVersion: 1,
    revision: 1,
    updatedAt: '2026-09-04T00:00:00.000Z',
    locations: [],
    weeklyEvents,
    exceptions,
    monthlyPosters: [],
  };
}

test('maps WordPress weekday rows into recurring game events', () => {
  const normalized = normalizeOfficialScheduleItems([
    {
      id: 'official-weekly-2-957',
      date: '',
      title: 'ЗУМБА',
      time: '10:30',
      weekdays: ['Понедельник', 'Среда', 'Пятница'],
      day: ['Понедельник', 'Среда', 'Пятница'],
      type: 'free',
      location: 'Летняя терраса',
    },
  ], '2');

  assert.deepEqual(normalized.weeklyEvents[0].daysOfWeek, [1, 3, 5]);
  assert.equal(normalized.exceptions.length, 0);

  const fridayEvents = getEventsForDate(createSchedule(normalized), '2', '2026-09-04');
  assert.equal(fridayEvents.length, 1);
  assert.equal(fridayEvents[0].title, 'ЗУМБА');
});

test('keeps dated closures as exceptions and lets them replace weekly events', () => {
  const normalized = normalizeOfficialScheduleItems([
    {
      id: 'weekly-friday',
      date: '',
      title: 'Парение',
      time: '14:00',
      weekdays: ['Пятница'],
      type: 'free',
    },
    {
      id: 'sanitary-day',
      date: '2026-09-04',
      title: 'Санитарный день',
      closed: true,
      sanitaryDay: true,
    },
  ], '1');

  assert.equal(normalized.weeklyEvents.length, 1);
  assert.equal(normalized.exceptions.length, 1);
  assert.equal(normalized.exceptions[0].closed, true);

  const fridayEvents = getEventsForDate(createSchedule(normalized), '1', '2026-09-04');
  assert.equal(fridayEvents.length, 1);
  assert.equal(fridayEvents[0].title, 'Санитарный день');
});

test('isolates malformed WordPress rows and keeps valid siblings', () => {
  const normalized = normalizeOfficialScheduleItems([
    { id: 'missing-schedule', title: 'Без даты' },
    { id: 'unknown-day', title: 'Неизвестный день', weekdays: ['Когда-нибудь'] },
    { id: 'missing-title', date: '2026-09-04' },
    { id: 'wrong-title-type', title: 123, date: '2026-09-04' },
    { id: 'wrong-date-type', title: 'Числовая дата', date: 20260904 },
    { id: 'wrong-weekday-type', title: 'Числовой день', weekdays: 5 },
    {
      id: 'valid-sibling',
      title: 'Корректное событие',
      weekdays: [null, 'Пятница'],
      location: 123,
    },
  ], '1');

  assert.equal(normalized.weeklyEvents.length, 1);
  assert.equal(normalized.weeklyEvents[0].title, 'Корректное событие');
  assert.deepEqual(normalized.weeklyEvents[0].daysOfWeek, [5]);
  assert.equal(normalized.weeklyEvents[0].venue, '');
  assert.deepEqual(normalized.exceptions, []);
});
