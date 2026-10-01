import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { MAX_POSTER_EVENTS, MIN_POSTER_EVENTS } from '../src/features/schedule/monthlyPoster.ts';
import { getSchedulePrintKinds } from '../src/features/schedule/schedulePrintKinds.ts';
import { getEventsForDate, getRemainingScheduleItems, getZonedClock } from '../src/features/schedule/scheduleTime.ts';
import { tvScheduleFixture } from './fixtures/tvSchedule.mjs';

const mobileSource = readFileSync(new URL('../src/components/screens/ScheduleMobileScreen.tsx', import.meta.url), 'utf8');
const displaySource = readFileSync(new URL('../src/components/screens/ScheduleDisplayScreen.tsx', import.meta.url), 'utf8');
const printSource = readFileSync(new URL('../src/components/screens/SchedulePrintScreen.tsx', import.meta.url), 'utf8');
const posterSource = readFileSync(new URL('../src/features/schedule/MonthlyPosterStudio.tsx', import.meta.url), 'utf8');
const imageSource = readFileSync(new URL('../src/features/schedule/downloadScheduleImage.ts', import.meta.url), 'utf8');
const scheduleStyles = readFileSync(new URL('../src/features/schedule/schedule.css', import.meta.url), 'utf8');
const tvStyles = readFileSync(new URL('../src/features/schedule/scheduleDisplay.css', import.meta.url), 'utf8');
const tvEventSource = readFileSync(new URL('../src/features/schedule/ScheduleTvEvent.tsx', import.meta.url), 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lastRuleBody(selector) {
  const matcher = new RegExp(`(?:^|\\r?\\n)${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\}`, 'g');
  const matches = [...scheduleStyles.matchAll(matcher)];
  return matches.at(-1)?.[1] ?? '';
}

test('keeps the published schedule-chat features in the Workstation release', () => {
  const zelenogorskClock = getZonedClock(new Date('2026-09-08T05:15:00.000Z'), 'Asia/Krasnoyarsk');
  assert.equal(zelenogorskClock.hour, 12);
  assert.equal(zelenogorskClock.minute, 15);

  assert.deepEqual(getSchedulePrintKinds({
    title: 'Коллективное парение для детей',
    venue: 'Русская баня',
    details: '',
  }), ['steam', 'kids']);
  assert.match(printSource, /PNG для соцсетей/);
  assert.match(printSource, /Расписание на неделю/);
  assert.match(imageSource, /pixelRatio:\s*Math\.max\(1, targetWidth \/ width\)/);

  assert.equal(MIN_POSTER_EVENTS, 1);
  assert.equal(MAX_POSTER_EVENTS, 6);
  assert.match(posterSource, /Показывать \$\{count\}/);
  assert.match(posterSource, /Остальные карточки будут удалены/);
  assert.match(mobileSource, /\['day', 'День'\], \['week', 'Неделя'\], \['month', 'Месяц'\]/);
});

test('keeps the mobile schedule compact and readable', () => {
  const hero = lastRuleBody('.schedule-mobile__hero');
  const dayCard = lastRuleBody('.schedule-mobile .schedule-event:not(.schedule-event--compact)');
  const time = lastRuleBody('.schedule-mobile .schedule-event:not(.schedule-event--compact) .schedule-event__time strong');
  const endTime = lastRuleBody('.schedule-mobile .schedule-event:not(.schedule-event--compact) .schedule-event__time span');
  const title = lastRuleBody('.schedule-mobile .schedule-event:not(.schedule-event--compact) .schedule-event__body h3');
  const price = lastRuleBody('.schedule-mobile .schedule-event:not(.schedule-event--compact) .schedule-price');

  assert.match(hero, /min-height:\s*11\.75rem/);
  assert.match(hero, /safe-area-inset-top/);
  assert.match(dayCard, /grid-template-columns:\s*4\.8rem minmax\(0, 1fr\)/);
  assert.match(time, /font-size:\s*clamp\(1\.38rem, 6vw, 1\.55rem\)/);
  assert.match(endTime, /font-size:\s*0\.75rem/);
  assert.match(endTime, /white-space:\s*nowrap/);
  assert.match(title, /font-size:\s*clamp\(1rem, 4\.25vw, 1\.12rem\)/);
  assert.match(title, /overflow-wrap:\s*anywhere/);
  assert.match(price, /font-size:\s*0\.75rem/);
});

test('keeps end times and price badges inside schedule rows', () => {
  const price = lastRuleBody('.schedule-price');

  assert.match(price, /max-width:\s*100%/);
  assert.match(price, /flex-shrink:\s*0/);
  assert.match(price, /white-space:\s*nowrap/);
  assert.match(tvEventSource, /schedule-tv-event__meta/);
  assert.match(tvEventSource, /schedule-tv-event__venue/);
  assert.match(tvEventSource, /schedule-tv-event__price/);
  assert.doesNotMatch(tvStyles, /translateY|background-clip|text-fill-color/);
});

test('keeps the TV display compact and free of redundant connection chrome', () => {
  assert.match(displaySource, /const LANDSCAPE_EVENT_LIMIT = 12/);
  assert.match(displaySource, /const PORTRAIT_EVENT_LIMIT = 9/);
  assert.doesNotMatch(displaySource, /Wifi|WifiOff|schedule-display__sync/);
  assert.match(displaySource, /ScheduleTvEvent/);
  assert.doesNotMatch(displaySource, /ScheduleEventRow|schedule-display__/);
  assert.match(displaySource, /matchMedia\('\(orientation: portrait\)'\)/);
  assert.match(displaySource, /getNextScheduleDay/);
  assert.match(displaySource, /requestFullscreen\(\{ navigationUI: 'hide' \}\)/);
  assert.match(displaySource, /На весь экран/);
});

test('dense TV fixture includes 12 remaining events, long titles and paid/free prices', () => {
  const clock = getZonedClock(new Date('2026-10-01T05:40:00Z'), 'Asia/Krasnoyarsk');
  const all = getEventsForDate(tvScheduleFixture, '2', clock.dateKey);
  const remaining = getRemainingScheduleItems(all, clock.minutes);
  assert.equal(all.length, 13);
  assert.equal(remaining.length, 12);
  assert.equal(remaining[0].time, '10:00'); // Ongoing all-day event must stay.
  assert.equal(remaining.at(-1).time, '19:00');
  assert.ok(remaining.some(item => item.title.length >= 50));
  assert.ok(remaining.some(item => item.price === 390));
  assert.ok(remaining.some(item => item.priceKind === 'free'));
  assert.ok(remaining.every(item => item.locationId === '2'));
});
