import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { MAX_POSTER_EVENTS, MIN_POSTER_EVENTS } from '../src/features/schedule/monthlyPoster.ts';
import { getSchedulePrintKinds } from '../src/features/schedule/schedulePrintKinds.ts';
import { getZonedClock } from '../src/features/schedule/scheduleTime.ts';

const mobileSource = readFileSync(new URL('../src/components/screens/ScheduleMobileScreen.tsx', import.meta.url), 'utf8');
const printSource = readFileSync(new URL('../src/components/screens/SchedulePrintScreen.tsx', import.meta.url), 'utf8');
const posterSource = readFileSync(new URL('../src/features/schedule/MonthlyPosterStudio.tsx', import.meta.url), 'utf8');
const imageSource = readFileSync(new URL('../src/features/schedule/downloadScheduleImage.ts', import.meta.url), 'utf8');
const scheduleStyles = readFileSync(new URL('../src/features/schedule/schedule.css', import.meta.url), 'utf8');

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
  assert.match(scheduleStyles, /@container schedule-display \(orientation: portrait\) and \(width < 40rem\)[\s\S]*?\.schedule-display__events\s*\{[\s\S]*?grid-auto-rows:\s*auto/);
  assert.match(scheduleStyles, /\.schedule-display \.schedule-event__body\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(scheduleStyles, /\.schedule-display \.schedule-price--compact\s*\{[\s\S]*?justify-self:\s*end/);
});
