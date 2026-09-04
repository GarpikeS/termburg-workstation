import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const playwrightRoots = [
  path.join(process.env.USERPROFILE || '', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'),
  'C:/Claude Code/node_modules/playwright',
];
const playwrightRoot = playwrightRoots.find(candidate => fs.existsSync(candidate));
if (!playwrightRoot) throw new Error('Playwright is unavailable for workstation browser QA.');
const { chromium } = require(playwrightRoot);
const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const frontendRoot = path.join(repoRoot, 'frontend');
const screenshotPath = path.join(repoRoot, 'release', 'qa-workstation-login-version.png');
const port = 43997;
const baseUrl = `http://127.0.0.1:${port}`;
const preview = spawn(
  process.execPath,
  [path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: frontendRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
);

let previewOutput = '';
preview.stdout.on('data', chunk => { previewOutput += chunk.toString(); });
preview.stderr.on('data', chunk => { previewOutput += chunk.toString(); });

async function waitForPreview() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(baseUrl)).ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Workstation preview did not start. ${previewOutput}`);
}

let browser;
try {
  await waitForPreview();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('**/api/auth/status', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: true, authenticated: false, user: null }),
  }));
  await page.route('**/api/auth/config', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ available: false, method: 'password', passwordMinLength: 8 }),
  }));
  await page.route('**/api/auth/me', route => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'AUTH_REQUIRED' }),
  }));

  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('401 (Unauthorized)')) errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseUrl}/schedule/admin?desktop=workstation&version=1.1.9`, { waitUntil: 'networkidle' });
  const version = page.locator('.schedule-access__version');
  await version.waitFor({ state: 'visible' });
  await assert.doesNotReject(() => page.locator('.schedule-access__card').waitFor({ state: 'visible' }));
  const loginField = page.locator('input[autocomplete="username"]');
  await loginField.fill('testTB');
  assert.equal(await loginField.inputValue(), 'testTB');
  assert.equal(await version.textContent(), 'Термбург Рабочее место · версия 1.1.9');
  const bounds = await version.boundingBox();
  assert.ok(bounds, 'Version label has no layout bounds.');
  assert.ok(bounds.x + bounds.width <= 1432, 'Version label is not aligned to the lower-right edge.');
  assert.ok(bounds.y + bounds.height <= 896, 'Version label overflows below the viewport.');
  assert.ok(bounds.x > 1000 && bounds.y > 820, 'Version label is not in the lower-right corner.');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(JSON.stringify({ ok: true, screenshotPath, bounds }));
} finally {
  if (browser) await browser.close();
  preview.kill();
  await new Promise(resolve => {
    if (preview.exitCode !== null) return resolve();
    preview.once('exit', resolve);
    setTimeout(resolve, 3_000);
  });
}
