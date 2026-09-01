import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, webkit } = require('C:/Claude Code/node_modules/playwright');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = path.join(projectRoot, 'frontend');
const externalBaseUrl = process.env.QA_BASE_URL?.replace(/\/$/, '');
const outputRoot = path.join(projectRoot, 'docs', 'qa', externalBaseUrl ? 'pet-production' : 'pet');
const port = 43991;
const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${port}`;
const preview = externalBaseUrl
  ? null
  : spawn(process.execPath, [path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: frontendRoot,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

let previewOutput = '';
preview?.stdout.on('data', chunk => { previewOutput += chunk.toString(); });
preview?.stderr.on('data', chunk => { previewOutput += chunk.toString(); });

async function waitForPreview() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Vite preview did not start. ${previewOutput}`);
}

function observePage(page, label, report) {
  page.on('console', message => {
    if (message.type() === 'error') report.consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on('pageerror', error => report.pageErrors.push(`${label}: ${error.message}`));
  page.on('requestfailed', request => {
    const errorText = request.failure()?.errorText ?? 'failed';
    if (request.url().includes('/fonts/') && errorText === 'net::ERR_ABORTED') return;
    report.requestFailures.push(`${label}: ${request.method()} ${request.url()} — ${errorText}`);
  });
}

async function readLayout(page) {
  return page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    petWidth: document.querySelector('[data-pet-screen]')?.scrollWidth ?? null,
    petClientWidth: document.querySelector('[data-pet-screen]')?.clientWidth ?? null,
    lcp: Math.round(performance.getEntriesByType('largest-contentful-paint').at(-1)?.startTime ?? 0),
    cls: Number((window.__petQaCls ?? 0).toFixed(4)),
    widestElements: [...document.querySelectorAll('body *')]
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
          width: Math.round(rect.width),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        };
      })
      .filter(item => item.right > window.innerWidth + 1 || item.left < -1 || item.scrollWidth > item.clientWidth + 1)
      .sort((a, b) => Math.max(b.right - window.innerWidth, b.scrollWidth - b.clientWidth) - Math.max(a.right - window.innerWidth, a.scrollWidth - a.clientWidth))
      .slice(0, 8),
  }));
}

async function installMetrics(page) {
  await page.addInitScript(() => {
    window.__petQaCls = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__petQaCls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

async function runInteractiveIphone(browser, report) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  observePage(page, 'webkit-390', report);
  await installMetrics(page);
  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('termliny-progress'));
    await page.goto(`${baseUrl}/games/pet`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const portraits = [...document.querySelectorAll('[data-termlin-portrait]')];
      return portraits.length === 7 && portraits.every(portrait => portrait.getAttribute('data-loaded') === 'true');
    });
    assert.equal(await page.locator('[data-termlin-portrait] img').count(), 7);
    assert.equal(await page.locator('[data-termlin-portrait] img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), true);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outputRoot, 'iphone-adoption.png'), fullPage: true });

    await page.getByRole('button').filter({ hasText: 'Яромир' }).first().click();
    await page.locator('[data-pet-screen]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.getByText('Дела на сегодня').isVisible(), true);
    assert.equal(await page.getByRole('button', { name: 'Уход' }).isVisible(), true);

    const careLayout = await readLayout(page);
    assert.ok(careLayout.documentWidth <= careLayout.viewportWidth, `care overflow: ${JSON.stringify(careLayout)}`);
    report.layouts.push({ breakpoint: 'webkit-390-care', ...careLayout });
    await page.screenshot({ path: path.join(outputRoot, 'iphone-care.png'), fullPage: true });

    await page.locator('[data-pet-daily-gift]').click();
    await page.locator('[data-pet-notice]').filter({ hasText: '+10 опыта' }).waitFor();
    await page.locator('[data-pet-care="feed"]').click();
    await page.locator('[data-pet-notice]').filter({ hasText: '+8 опыта' }).waitFor();
    await page.locator('[data-pet-care="feed"]').click({ force: true });
    await page.locator('[data-pet-notice]').filter({ hasText: 'ещё отдыхает' }).waitFor();

    await page.locator('[data-pet-tab="activities"]').click();
    await page.locator('[data-pet-panel="activities"]').waitFor();
    await page.locator('[data-pet-activity="tea"]').click();
    await page.locator('[data-pet-notice]').filter({ hasText: '+18 опыта' }).waitFor();
    await page.locator('[data-pet-activity="herbs"]').click({ force: true });
    await page.locator('[data-pet-notice]').filter({ hasText: '2 уровне' }).waitFor();
    const activitiesLayout = await readLayout(page);
    assert.ok(activitiesLayout.documentWidth <= activitiesLayout.viewportWidth, `activities overflow: ${JSON.stringify(activitiesLayout)}`);
    report.layouts.push({ breakpoint: 'webkit-390-activities', ...activitiesLayout });
    await page.screenshot({ path: path.join(outputRoot, 'iphone-activities.png'), fullPage: true });

    await page.locator('[data-pet-tab="diary"]').click();
    await page.locator('[data-pet-panel="diary"]').waitFor();
    assert.equal(await page.getByText('Чаепитие у печи', { exact: true }).isVisible(), true);
    await page.screenshot({ path: path.join(outputRoot, 'iphone-diary.png'), fullPage: true });

    await page.locator('[data-pet-rename-open]').click();
    const renameForm = page.locator('[data-pet-rename-form]');
    await renameForm.getByRole('textbox').fill('Банник Добрыня');
    await renameForm.getByRole('button', { name: 'Сохранить' }).click();
    await page.getByText('Банник Добрыня', { exact: true }).first().waitFor();

    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('termliny-progress')));
    assert.equal(saved.pet.name, 'Банник Добрыня');
    assert.equal(saved.pet.daily.giftClaimed, true);
    assert.equal(saved.pet.daily.taskProgress['activity-1'], 1);
    assert.ok(saved.currency >= 12);

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Банник Добрыня', { exact: true }).first().waitFor();
    assert.equal(await page.locator('[data-pet-daily-gift]').getAttribute('aria-disabled'), 'true');

    const smallButtons = await page.locator('button:visible').evaluateAll(buttons => buttons
      .map(button => ({ label: button.getAttribute('aria-label') || button.textContent?.trim().slice(0, 40), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height }))
      .filter(button => button.width < 44 || button.height < 44));
    assert.deepEqual(smallButtons, [], `tap targets smaller than 44px: ${JSON.stringify(smallButtons)}`);

    const neglected = JSON.parse(await page.evaluate(() => localStorage.getItem('termliny-progress')));
    neglected.pet.hunger = 0;
    neglected.pet.lastUpdated = Date.now();
    await page.evaluate(progress => localStorage.setItem('termliny-progress', JSON.stringify(progress)), neglected);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-pet-departure]').waitFor();
    assert.equal(await page.getByText('Термлин ушёл в Термбург', { exact: true }).isVisible(), true);
    assert.equal(await page.getByRole('button', { name: 'Выбрать нового термлина' }).isVisible(), true);
    const departureProgress = JSON.parse(await page.evaluate(() => localStorage.getItem('termliny-progress')));
    assert.equal(departureProgress.pet, null);
    assert.equal(departureProgress.petDeparture.name, 'Банник Добрыня');
    assert.equal(departureProgress.petDeparture.depletedStat, 'hunger');
    await page.screenshot({ path: path.join(outputRoot, 'iphone-departure.png'), fullPage: true });

    await page.getByRole('button').filter({ hasText: 'Валькирия' }).first().click();
    await page.locator('[data-pet-screen]').waitFor();
    const replacementProgress = JSON.parse(await page.evaluate(() => localStorage.getItem('termliny-progress')));
    assert.equal(replacementProgress.pet.characterId, 'valkiriya');
    assert.equal(replacementProgress.petDeparture, null);
    return JSON.stringify(replacementProgress);
  } finally {
    await context.close();
  }
}

async function runPortraitFallback(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.route('**/images/characters/*.webp', route => route.abort('failed'));
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('termliny-progress'));
    await page.goto(`${baseUrl}/games/pet`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const portraits = [...document.querySelectorAll('[data-termlin-portrait]')];
      return portraits.length === 7 && portraits.every(portrait => portrait.getAttribute('data-loaded') === 'true');
    });
    const fallbackImages = await page.locator('[data-termlin-portrait] img').evaluateAll(images => images.map(image => ({
      src: image.getAttribute('src'),
      complete: image.complete,
      naturalWidth: image.naturalWidth,
    })));
    assert.equal(fallbackImages.length, 7);
    assert.equal(fallbackImages.every(image => image.src?.endsWith('.jpg') && image.complete && image.naturalWidth > 0), true);
  } finally {
    await context.close();
  }
}

async function runSnapshot(browser, browserName, viewport, savedProgress, report) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const label = `${browserName}-${viewport.width}`;
  observePage(page, label, report);
  await installMetrics(page);
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(progress => localStorage.setItem('termliny-progress', progress), savedProgress);
    await page.goto(`${baseUrl}/games/pet`, { waitUntil: 'networkidle' });
    await page.locator('[data-pet-screen]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const layout = await readLayout(page);
    assert.ok(layout.documentWidth <= layout.viewportWidth, `${label} overflow: ${JSON.stringify(layout)}`);
    report.layouts.push({ breakpoint: label, ...layout });
    await page.screenshot({ path: path.join(outputRoot, `${label}.png`), fullPage: true });
  } finally {
    await context.close();
  }
}

const report = { consoleErrors: [], pageErrors: [], requestFailures: [], layouts: [] };
let chromiumBrowser;
let webkitBrowser;
try {
  await mkdir(outputRoot, { recursive: true });
  await waitForPreview();
  webkitBrowser = await webkit.launch({ headless: true });
  await runPortraitFallback(webkitBrowser);
  const savedProgress = await runInteractiveIphone(webkitBrowser, report);
  chromiumBrowser = await chromium.launch({ headless: true });
  await runSnapshot(chromiumBrowser, 'chromium', { width: 375, height: 812 }, savedProgress, report);
  await runSnapshot(chromiumBrowser, 'chromium', { width: 768, height: 1024 }, savedProgress, report);
  await runSnapshot(chromiumBrowser, 'chromium', { width: 1440, height: 900 }, savedProgress, report);

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.requestFailures, []);
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (chromiumBrowser) await chromiumBrowser.close();
  if (webkitBrowser) await webkitBrowser.close();
  if (preview) {
    preview.kill();
    await new Promise(resolve => {
      if (preview.exitCode !== null) return resolve();
      preview.once('exit', resolve);
      setTimeout(resolve, 3_000);
    });
  }
}
