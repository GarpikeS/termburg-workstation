import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { webkit } = require('C:/Claude Code/node_modules/playwright');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = path.join(projectRoot, 'frontend');
const outputRoot = path.join(projectRoot, 'docs', 'qa', 'daily-economy');
const port = 43995;
const externalBaseUrl = process.env.QA_BASE_URL?.replace(/\/$/, '');
const baseUrl = externalBaseUrl || `http://127.0.0.1:${port}`;
const preview = externalBaseUrl ? null : spawn(
  process.execPath,
  [path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: frontendRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
);

const progress = {
  currentLevel: 1,
  levels: {},
  currency: 90,
  lives: 5,
  nextLifeAt: null,
  selectedCharacter: 'yaromir',
  tutorialCompleted: true,
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
  await fs.mkdir(outputRoot, { recursive: true });
  await waitForSite();
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => runtimeErrors.push(`page: ${error.message}`));
  await page.addInitScript(seed => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    localStorage.setItem('termliny-progress', JSON.stringify({
      ...seed,
      dailyGameRewards: {
        date,
        earned: { match3: 10, game2048: 20, bubbles: 30, pet: 30 },
      },
    }));
  }, progress);

  await page.goto(`${baseUrl}/profile`, { waitUntil: 'networkidle' });
  const economy = page.locator('[data-daily-game-rewards]');
  await economy.waitFor();
  await economy.getByText('90/120', { exact: true }).waitFor();
  for (const expected of ['Хоровод', 'Славич', 'Бирюльки', 'Пестун', '10/30', '20/30', '30/30']) {
    assert.ok(await economy.getByText(expected, { exact: true }).count() >= 1, `missing daily economy marker: ${expected}`);
  }
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  assert.equal(dimensions.document, dimensions.viewport);
  assert.deepEqual(runtimeErrors, []);
  await page.screenshot({ path: path.join(outputRoot, 'webkit-390x844-profile.png'), fullPage: true });
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
