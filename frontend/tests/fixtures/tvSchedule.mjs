import { readFileSync } from 'node:fs';

const seed = JSON.parse(readFileSync(new URL('../../public/data/default-schedule.json', import.meta.url), 'utf8'));

// Realistic dense TV day from the reported screenshot, plus one finished event.
const rows = [
  ['09:00', '09:30', 'Прошедшее мероприятие', 'Аквазона', 0],
  ['10:00', '21:00', 'День пожилого человека', 'Аквазона', 0],
  ['13:00', '13:30', 'Таёжная мовня', 'Хаммам', 390],
  ['13:30', '14:00', 'Кофейное скрабирование', 'Глинвилл', 0],
  ['14:00', '14:10', 'Коллективное парение: Восточный аромат', 'Русская парная', 0],
  ['14:30', '15:00', 'Обновление', 'Глинвилл', 0],
  ['15:30', '15:45', 'ГАЛО-медитация', 'Гамалайская сауна', 0],
  ['16:00', '16:10', 'Коллективное парение — Прованские травы', 'Русская парная', 0],
  ['16:30', '16:45', 'Самомассаж: Лицо', 'Травяная сауна', 0],
  ['17:00', '17:30', 'СПА: Таёжная мовня', 'Хаммам', 390],
  ['17:30', '18:00', 'Аквааэробика', 'Аквазона', 0],
  ['18:00', '18:25', 'Медовое СПА-парение с медовым скрабом', 'Шаманская парная', 290],
  ['19:00', '19:10', 'Коллективное парение: Пар с секретным ингредиентом', 'Русская парная', 0],
];

export const tvScheduleFixture = {
  ...seed,
  revision: 1000,
  updatedAt: '2026-10-01T05:40:00Z',
  exceptions: [],
  weeklyEvents: seed.locations.flatMap(location => rows.map(([time, endTime, title, venue, price], index) => ({
    id: `tv-qa-${location.id}-${index}`,
    locationId: location.id,
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    time,
    endTime,
    title,
    venue,
    priceKind: price ? 'paid' : 'free',
    price: price || undefined,
    published: true,
  }))),
};
