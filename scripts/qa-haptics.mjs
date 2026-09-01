import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, webkit } = require('C:/Claude Code/node_modules/playwright');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = path.join(projectRoot, 'frontend');
const externalBaseUrl = process.env.QA_BASE_URL?.replace(/\/$/, '');
const port = 43993;
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

function baseProgress() {
  return {
    currentLevel: 1,
    levels: {},
    currency: 0,
    lives: 5,
    nextLifeAt: null,
    selectedCharacter: 'yaromir',
    tutorialCompleted: true,
    tutorialFlags: ['bubbles-aim', 'bubbles-match', 'game2048-move', 'game2048-merge', 'pet-care'],
    best2048Score: 0,
    bubbleLevelsCompleted: 0,
    pet: null,
    unlockedCharacters: ['yaromir'],
    inventory: {},
    cart: [],
    orders: [],
  };
}

function petProgress() {
  const progress = baseProgress();
  const now = Date.now();
  const date = new Date(now);
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  progress.pet = {
    characterId: 'yaromir',
    name: 'Яромир',
    hunger: 80,
    happiness: 80,
    energy: 80,
    cleanliness: 80,
    age: 0,
    stage: 'baby',
    lastUpdated: now,
    cooldowns: {},
    activityCooldowns: {},
    experience: 0,
    bond: 10,
    careStreak: 0,
    lastCareDate: null,
    daily: { date: dateKey, giftClaimed: false, taskProgress: {}, taskClaimed: [] },
    diary: [],
  };
  return progress;
}

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

function observe(page, label, report) {
  page.on('console', message => {
    if (message.type() === 'error') report.consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on('pageerror', error => report.pageErrors.push(`${label}: ${error.message}`));
  page.on('requestfailed', request => report.requestFailures.push(`${label}: ${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`));
}

async function installProgress(page, progress) {
  await page.addInitScript(value => localStorage.setItem('termliny-progress', JSON.stringify(value)), progress);
}

async function installHapticStub(page) {
  await page.addInitScript(() => {
    window.__hapticCalls = [];
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value(pattern) {
        window.__hapticCalls.push(pattern);
        return true;
      },
    });
  });
}

async function runChromium(browser, report) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  observe(page, 'chromium-haptics', report);
  await installHapticStub(page);
  await installProgress(page, baseProgress());

  try {
    await page.goto(`${baseUrl}/games/bubbles`, { waitUntil: 'networkidle' });
    const field = page.locator('.bubble-field-surface');
    const box = await field.boundingBox();
    assert.ok(box);
    await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.55);
    await page.waitForFunction(() => window.__hapticCalls.length > 0);
    assert.equal(await page.evaluate(() => window.__hapticCalls.includes(12)), true, 'бросок должен давать короткий импульс');

    await page.goto(`${baseUrl}/games/2048`, { waitUntil: 'networkidle' });
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(80);
      if (await page.evaluate(() => window.__hapticCalls.length > 0)) break;
    }
    const movePatterns = await page.evaluate(() => window.__hapticCalls);
    assert.ok(movePatterns.some(pattern => pattern === 16 || pattern === 24), '2048 должен вибрировать на ход или слияние');

    const petPage = await context.newPage();
    observe(petPage, 'chromium-pet-haptics', report);
    await installHapticStub(petPage);
    await installProgress(petPage, petProgress());
    await petPage.goto(`${baseUrl}/games/pet`, { waitUntil: 'networkidle' });
    await petPage.locator('[data-pet-daily-gift]').click();
    await petPage.waitForFunction(() => window.__hapticCalls.length > 0);
    assert.equal(await petPage.evaluate(() => window.__hapticCalls.includes(24)), true, 'успешное действие Пестуна должно откликаться');
    report.chromiumPatterns = await petPage.evaluate(() => window.__hapticCalls);
    await petPage.close();
  } finally {
    await context.close();
  }
}

async function runWebkitFallback(browser, report) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  observe(page, 'webkit-fallback', report);
  await installProgress(page, baseProgress());
  try {
    await page.goto(`${baseUrl}/games/bubbles`, { waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => typeof navigator.vibrate), 'undefined');
    const field = page.locator('.bubble-field-surface');
    const box = await field.boundingBox();
    assert.ok(box);
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
    await page.waitForTimeout(250);
  } finally {
    await context.close();
  }
}

const report = { consoleErrors: [], pageErrors: [], requestFailures: [], chromiumPatterns: [] };
let chromiumBrowser;
let webkitBrowser;
try {
  await waitForSite();
  chromiumBrowser = await chromium.launch({ headless: true });
  await runChromium(chromiumBrowser, report);
  webkitBrowser = await webkit.launch({ headless: true });
  await runWebkitFallback(webkitBrowser, report);
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
