import test from 'node:test';
import assert from 'node:assert/strict';

import { termburgLocations } from '../frontend/src/data/termburgLocations.ts';

test('карточки используют актуальные города и контакты официальных сайтов', () => {
  const moscow = termburgLocations.find(location => location.id === 1);
  const zelenogorsk = termburgLocations.find(location => location.id === 2);

  assert.ok(moscow);
  assert.equal(moscow.city, 'г. Москва');
  assert.equal(moscow.phone, '+7 (495) 191-64-38');
  assert.equal(moscow.workHours, 'Ежедневно: 09:00–23:00');
  assert.match(moscow.workHoursNote, /санитарный день/i);
  assert.equal(moscow.website, 'https://termburg.ru');

  assert.ok(zelenogorsk);
  assert.equal(zelenogorsk.city, 'г. Зеленогорск');
  assert.equal(zelenogorsk.phone, '+7 (902) 990-70-70');
  assert.equal(zelenogorsk.workHours, 'Пн–чт 10:00–21:00 · Пт 10:00–22:00');
  assert.equal(zelenogorsk.workHoursNote, 'Сб–вс 09:00–22:00');
  assert.equal(zelenogorsk.website, 'https://termburg45.ru');
});
