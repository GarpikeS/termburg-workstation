import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { webkit } = require('C:/Claude Code/node_modules/playwright');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = path.join(projectRoot, 'frontend');
const port = 43998;
const externalBaseUrl = process.env.QA_BASE_URL?.replace(/\/$/, '');
const baseUrl = externalBaseUrl || `http://127.0.0.1:${port}`;
const preview = externalBaseUrl ? null : spawn(
  process.execPath,
  [path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: frontendRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
);

const richProgress = {
  currentLevel: 1,
  levels: {},
  currency: 650,
  lives: 5,
  nextLifeAt: null,
  selectedCharacter: 'yaromir',
  tutorialCompleted: false,
  tutorialFlags: [],
  best2048Score: 0,
  bubbleLevelsCompleted: 0,
  pet: null,
  petDeparture: null,
  unlockedCharacters: ['yaromir'],
  inventory: {},
  rewardClaims: [],
  cart: [],
  orders: [],
};

async function waitForSite() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Preview did not start');
}

let browser;
try {
  await waitForSite();
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.route('**/api/rewards/free-hour**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ available: true }),
  }));
  await page.addInitScript(progress => localStorage.setItem('termliny-progress', JSON.stringify(progress)), richProgress);
  await page.goto(`${baseUrl}/shop`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Мерч' }).click();
  await page.getByText('600 термокоинов', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Купить', exact: true }).click();
  await page.getByText('В инвентаре: 1', { exact: true }).waitFor();
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('termliny-progress')));
  assert.equal(progress.currency, 50);
  assert.equal(progress.inventory['merch-hat'], 1);
  await context.close();
} finally {
  if (browser) await browser.close();
  if (preview) {
    preview.kill();
    await new Promise(resolve => {
      if (preview.exitCode !== null) return resolve();
      preview.once('exit', resolve);
      setTimeout(resolve, 3000);
    });
  }
}
