import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwrightRoot = [
  process.env.CODEX_PLAYWRIGHT_PATH,
  'C:/Users/vasiv/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
  'C:/Claude Code/node_modules/playwright',
].find(candidate => candidate && existsSync(candidate));
if (!playwrightRoot) throw new Error('Playwright runtime was not found. Set CODEX_PLAYWRIGHT_PATH.');
const { chromium } = require(playwrightRoot);
const projectRoot = path.resolve(import.meta.dirname, '..');
const frontendRoot = path.join(projectRoot, 'frontend');
const port = 43997;
const baseUrl = `http://127.0.0.1:${port}`;
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'termburg-schedule-png-'));
const inspectionRoot = process.env.SCHEDULE_QA_OUTPUT_DIR ? path.resolve(process.env.SCHEDULE_QA_OUTPUT_DIR) : '';
const preview = spawn(
  process.execPath,
  [path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: frontendRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
);

let previewOutput = '';
preview.stdout.on('data', chunk => { previewOutput += chunk.toString(); });
preview.stderr.on('data', chunk => { previewOutput += chunk.toString(); });

async function waitForSite() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Preview did not start. ${previewOutput}`);
}

function assertPng(buffer, label) {
  assert.ok(buffer.length > 20_000, `${label}: PNG is unexpectedly small`);
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${label}: invalid PNG signature`);
}

const seed = JSON.parse(await readFile(path.join(frontendRoot, 'public', 'data', 'default-schedule.json'), 'utf8'));
const posterFixtureImage = `data:image/png;base64,${(await readFile(path.join(projectRoot, 'desktop', 'assets', 'icon.png'))).toString('base64')}`;
seed.weeklyEvents.push(
  { id: 'qa-steam', locationId: '2', daysOfWeek: [2], time: '12:00', endTime: '12:30', title: 'Коллективное парение', venue: 'Русская баня', priceKind: 'paid', price: 500, published: true },
  { id: 'qa-kids', locationId: '2', daysOfWeek: [2], time: '13:00', endTime: '13:30', title: 'Пенная дискотека', venue: 'Детский бассейн', priceKind: 'free', published: true },
);
seed.monthlyPosters = [{
  id: 'poster-2-2026-09',
  locationId: '2',
  month: '2026-09',
  events: [
    { id: 'poster-event-1', date: '2026-09-05', title: 'Семейный праздник', program: '12:00 — Открытие\n13:00 — Игры', imageDataUrl: posterFixtureImage },
    { id: 'poster-event-2', date: '2026-09-19', title: 'День воды', program: '14:00 — Аквашоу\n15:30 — Парение' },
    { id: 'poster-event-3', date: '2026-09-21', title: 'День банных традиций', program: '13:00 — Встреча гостей\n14:00 — Чаепитие' },
    { id: 'poster-event-4', date: '2026-09-23', title: 'Осенний хоровод', program: '12:30 — Игровая программа\n15:00 — Мастер-класс' },
    { id: 'poster-event-5', date: '2026-09-25', title: 'Праздник урожая', program: '13:30 — Семейная программа\n16:00 — Коллективное парение' },
    { id: 'poster-event-6', date: '2026-09-27', title: 'Большой семейный праздник банных традиций', program: '12:00 — Торжественное открытие праздника\n13:15 — Семейная интерактивная программа\n14:30 — Творческая мастерская для детей\n16:00 — Коллективное ароматное парение' },
  ],
}];

let browser;
try {
  await waitForSite();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.addInitScript(schedule => {
    localStorage.setItem('termburg:schedule:v1', JSON.stringify(schedule));
  }, seed);
  await context.route('**/api/auth/status', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: false, authenticated: false, user: null, disabled: true }),
  }));
  await context.route('**/wp-json/termburg/v1/schedule', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));

  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/schedule/admin`, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Афиша месяца' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Показывать 1 событие' }).click();
  await page.locator('.monthly-poster__events[data-count="1"]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.monthly-poster-form__event').count(), 1, 'poster editor: one-card selection must be available');
  if (inspectionRoot) {
    await mkdir(inspectionRoot, { recursive: true });
    await page.locator('.monthly-poster').screenshot({ path: path.join(inspectionRoot, 'monthly-poster-one-card.png') });
  }
  await page.getByRole('button', { name: 'Показывать 6 событий' }).click();
  await page.locator('.monthly-poster__events[data-count="6"]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.monthly-poster-form__event').count(), 6, 'poster editor: six-card selection must be available');
  await page.locator('input[type="file"]').first().setInputFiles(path.join(projectRoot, 'desktop', 'assets', 'icon.png'));
  await page.locator('.monthly-poster-form__image-field img').first().waitFor({ state: 'visible' });

  await page.goto(`${baseUrl}/schedule/print/2`, { waitUntil: 'networkidle' });
  await page.locator('input[type="date"]').fill('2026-09-08');
  await page.locator('.schedule-event--print-steam').first().waitFor({ state: 'visible' });
  await page.locator('.schedule-event--print-kids').first().waitFor({ state: 'visible' });
  await page.getByText('+500 ₽', { exact: true }).waitFor({ state: 'visible' });
  await page.getByText('Бесплатно', { exact: true }).first().waitFor({ state: 'visible' });
  if (inspectionRoot) {
    await mkdir(inspectionRoot, { recursive: true });
    await page.locator('.schedule-paper').screenshot({ path: path.join(inspectionRoot, 'schedule-day.png') });
  }
  const printDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNG для соцсетей' }).click();
  const printDownload = await printDownloadPromise;
  const printPath = path.join(tempRoot, 'schedule.png');
  await printDownload.saveAs(printPath);
  assertPng(await readFile(printPath), 'schedule');

  await page.locator('select').selectOption('week');
  await page.locator('.schedule-week-summary-event--steam').first().waitFor({ state: 'visible' });
  await page.locator('.schedule-week-summary-event--kids').first().waitFor({ state: 'visible' });
  await page.locator('.schedule-week-summary-event__price.is-paid').filter({ hasText: '+500 ₽' }).waitFor({ state: 'visible' });
  if (inspectionRoot) {
    await page.locator('.schedule-paper').screenshot({ path: path.join(inspectionRoot, 'schedule-week.png') });
  }

  await page.goto(`${baseUrl}/schedule/poster/2?month=2026-09`, { waitUntil: 'networkidle' });
  const posterCards = page.locator('.monthly-poster-event');
  assert.equal(await posterCards.count(), 6, 'poster: all six editable days must be rendered');
  const [firstCardBox, secondCardBox, thirdCardBox, firstContentBox, firstImageBox] = await Promise.all([
    posterCards.nth(0).boundingBox(),
    posterCards.nth(1).boundingBox(),
    posterCards.nth(2).boundingBox(),
    posterCards.nth(0).locator('.monthly-poster-event__content').boundingBox(),
    posterCards.nth(0).locator('.monthly-poster-event__image').boundingBox(),
  ]);
  assert.ok(firstCardBox && secondCardBox && thirdCardBox && firstContentBox && firstImageBox, 'poster: card geometry is unavailable');
  assert.ok(secondCardBox.x > firstCardBox.x, 'poster: cards must form two columns');
  assert.ok(thirdCardBox.y > firstCardBox.y, 'poster: cards must form multiple rows');
  assert.ok(firstImageBox.x > firstContentBox.x, 'poster: uploaded image must be placed to the right of the text');
  const overflowingCards = await posterCards.evaluateAll(cards => cards.filter(card => {
    const content = card.querySelector('.monthly-poster-event__content');
    return content && (content.scrollHeight > content.clientHeight + 1 || content.scrollWidth > content.clientWidth + 1);
  }).length);
  assert.equal(overflowingCards, 0, 'poster: long card content must stay inside its card');
  await page.locator('.monthly-poster__brand img[src="/images/brand/termburg-logo.svg"]').waitFor({ state: 'visible' });
  if (inspectionRoot) {
    await page.locator('.monthly-poster').screenshot({ path: path.join(inspectionRoot, 'monthly-poster.png') });
  }
  const posterDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать PNG' }).click();
  const posterDownload = await posterDownloadPromise;
  const posterPath = path.join(tempRoot, 'poster.png');
  await posterDownload.saveAs(posterPath);
  assertPng(await readFile(posterPath), 'poster');

  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ ok: true, tested: ['poster-count-picker-1-to-6', 'png-upload', 'schedule-png-download', 'poster-six-card-layout', 'poster-png-download'] }, null, 2));
  await context.close();
} finally {
  if (browser) await browser.close();
  preview.kill();
  await new Promise(resolve => {
    if (preview.exitCode !== null) return resolve();
    preview.once('exit', resolve);
    setTimeout(resolve, 3_000);
  });
  await rm(tempRoot, { recursive: true, force: true });
}
