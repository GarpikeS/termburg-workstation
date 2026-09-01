import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWordPressImportHeaders,
  buildWordPressSchedulePayload,
  normalizeWordPressSyncSettings,
  validateWordPressScheduleBeforePublish,
  validateWordPressImportResponse,
  WORDPRESS_SYNC_DEFAULTS_BY_LOCATION,
} from './wordpress-schedule.mjs';

const schedule = {
  schemaVersion: 1,
  revision: 1,
  updatedAt: '2026-08-12T10:00:00.000Z',
  locations: [{ id: '1', city: 'Москва' }, { id: '2', city: 'Другой комплекс' }],
  weeklyEvents: [
    { id: 'weekly-free', locationId: '1', daysOfWeek: [5, 1], time: '12:00', title: 'Аквааэробика', venue: 'Аквазона', priceKind: 'free', published: true, highlight: true },
    { id: 'weekly-paid', locationId: '1', daysOfWeek: [3], time: '14:00', title: 'Парение', venue: 'Русская баня', details: '16+', priceKind: 'paid', price: 390, published: true },
    { id: 'weekly-hidden', locationId: '1', daysOfWeek: [1], time: '15:00', title: 'Скрыто', venue: 'Зал', priceKind: 'free', published: false },
    { id: 'other-location', locationId: '2', daysOfWeek: [1], time: '16:00', title: 'Чужое', venue: 'Зал', priceKind: 'free', published: true },
  ],
  exceptions: [
    { id: 'special', locationId: '1', date: '2026-08-12', time: '17:00', title: 'Праздник', venue: 'Терраса', priceKind: 'paid', price: 500, published: true, highlight: false },
    { id: 'closed', locationId: '1', date: '2026-08-13', time: '', title: 'Санитарный день', venue: '', details: 'Санитарный день', priceKind: 'free', published: true, closed: true, sanitaryDay: true },
  ],
};

test('WordPress payload follows the agreed full-array contract', () => {
  const payload = buildWordPressSchedulePayload(schedule, '1');
  assert.equal(payload.length, 4);
  const free = payload.find(item => item.id === 'weekly-free');
  assert.deepEqual(free.weekdays, ['Понедельник', 'Пятница']);
  assert.equal(free.type, 'free');
  assert.equal(free.price, null);
  assert.equal(free.highlight, true);
  assert.equal('date' in free, false);

  const paid = payload.find(item => item.id === 'weekly-paid');
  assert.equal(paid.type, 'paid');
  assert.equal(paid.price, 390);
  assert.equal(paid.isFree, false);
  assert.equal(paid.description, '16+');

  const special = payload.find(item => item.id === 'special');
  assert.equal(special.date, '2026-08-12');
  assert.deepEqual(special.day, ['Среда']);

  const closed = payload.find(item => item.id === 'closed');
  assert.deepEqual(closed, {
    id: 'closed',
    date: '2026-08-13',
    name: 'Санитарный день',
    title: 'Санитарный день',
    time: '',
    duration: '',
    day: ['Четверг'],
    weekdays: ['Четверг'],
    type: 'closed',
    description: 'Санитарный день',
    location: '',
    instructor: '',
    price: null,
    isFree: true,
    highlight: false,
    closed: true,
    sanitaryDay: true,
  });
});

test('WordPress publish guard allows the current weekly schedule shape', () => {
  const payload = buildWordPressSchedulePayload(schedule, '1');
  assert.equal(
    validateWordPressScheduleBeforePublish(schedule, '1', payload, {
      now: new Date('2026-09-01T10:00:00+03:00'),
    }),
    true,
  );
});

test('WordPress publish guard blocks stale dated-only imports', () => {
  const staleImport = {
    ...schedule,
    weeklyEvents: [],
    exceptions: [
      {
        id: 'old-site-record',
        locationId: '1',
        date: '2026-08-30',
        time: '17:00',
        title: 'Старое событие',
        venue: '',
        priceKind: 'paid',
        price: 390,
        published: true,
      },
    ],
  };
  const payload = buildWordPressSchedulePayload(staleImport, '1');

  assert.throws(
    () => validateWordPressScheduleBeforePublish(staleImport, '1', payload, {
      now: new Date('2026-09-01T10:00:00+03:00'),
    }),
    /нет обычной недели.*без места проведения.*заканчиваются 2026-08-30/,
  );
});

test('WordPress publish guard blocks regular events without venues', () => {
  const scheduleWithoutVenue = {
    ...schedule,
    weeklyEvents: [
      {
        id: 'weekly-no-venue',
        locationId: '1',
        daysOfWeek: [1],
        time: '12:00',
        title: 'Событие без площадки',
        venue: '',
        priceKind: 'free',
        published: true,
      },
    ],
    exceptions: [],
  };
  const payload = buildWordPressSchedulePayload(scheduleWithoutVenue, '1');

  assert.throws(
    () => validateWordPressScheduleBeforePublish(scheduleWithoutVenue, '1', payload, {
      now: new Date('2026-09-01T10:00:00+03:00'),
    }),
    /1 событий без места проведения/,
  );
});

test('WordPress payload stays chronological after the site filters any weekday', () => {
  const payload = buildWordPressSchedulePayload({
    ...schedule,
    weeklyEvents: [
      { id: 'early-tuesday', locationId: '1', daysOfWeek: [2], time: '10:30', title: 'Раннее', venue: 'Зал', priceKind: 'free', published: true },
      { id: 'late-all-week', locationId: '1', daysOfWeek: [1, 2, 3, 4, 5], time: '17:00', title: 'Позднее первое', venue: 'Баня', priceKind: 'free', published: true },
      { id: 'middle-tuesday', locationId: '1', daysOfWeek: [2], time: '13:30', title: 'Среднее', venue: 'Сауна', priceKind: 'free', published: true },
      { id: 'late-tuesday', locationId: '1', daysOfWeek: [2], time: '17:00', title: 'Позднее второе', venue: 'Баня', priceKind: 'free', published: true },
    ],
    exceptions: [],
  }, '1');

  const tuesday = payload.filter(item => item.weekdays.includes('Вторник'));
  assert.deepEqual(tuesday.map(item => item.time), ['10:30', '13:30', '17:00', '17:00']);
  assert.deepEqual(tuesday.slice(0, 2).map(item => item.id), ['early-tuesday', 'middle-tuesday']);
  assert.deepEqual(tuesday.slice(2).map(item => item.id).sort(), ['late-all-week', 'late-tuesday'].sort());
});

test('WordPress auth settings support Bearer and X-API-Key without exposing defaults', () => {
  const zelenogorsk = normalizeWordPressSyncSettings({}, WORDPRESS_SYNC_DEFAULTS_BY_LOCATION['2']);
  assert.equal(zelenogorsk.authMode, 'bearer');
  assert.equal(zelenogorsk.complexCode, 'zelenogorsk');
  assert.equal(zelenogorsk.endpoint, 'https://termburg45.ru/wp-json/termburg/v1/schedule/import');
  assert.equal(normalizeWordPressSyncSettings({}).endpoint, '');
  assert.deepEqual(buildWordPressImportHeaders({ token: 'secret', authMode: 'bearer', complexCode: 'moscow' }), {
    Accept: 'application/json',
    'Content-Type': 'application/json; charset=utf-8',
    Authorization: 'Bearer secret',
    'X-Termburg-Location': 'moscow',
  });
  assert.deepEqual(buildWordPressImportHeaders({ token: 'secret', authMode: 'x-api-key' }), {
    Accept: 'application/json',
    'Content-Type': 'application/json; charset=utf-8',
    'X-API-Key': 'secret',
  });
});

test('WordPress import response must confirm the expected site and full count', () => {
  const response = {
    success: true,
    site: 'zelenogorsk',
    count: 10,
    updatedAt: '2026-08-14T06:10:48+03:00',
  };
  assert.equal(validateWordPressImportResponse(response, { expectedSite: 'zelenogorsk', expectedCount: 10 }), response);
  assert.throws(
    () => validateWordPressImportResponse(response, { expectedSite: 'moscow', expectedCount: 10 }),
    /другой комплекс/,
  );
  assert.throws(
    () => validateWordPressImportResponse(response, { expectedSite: 'zelenogorsk', expectedCount: 11 }),
    /10 событий из 11/,
  );
});
