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
const port = 43996;
const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${port}`;
const preview = externalBaseUrl ? null : spawn(
  process.execPath,
  [path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: frontendRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
);

let previewOutput = '';
preview?.stdout.on('data', chunk => { previewOutput += chunk.toString(); });
preview?.stderr.on('data', chunk => { previewOutput += chunk.toString(); });

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
  page.on('requestfailed', request => {
    if (request.url().includes('/api/schedule/stream')) return;
    report.requestFailures.push(`${label}: ${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`);
  });
}

async function verifyRoute(browser, test, report) {
  const isMobile = test.viewport.width <= 430;
  const context = await browser.newContext({ viewport: test.viewport, isMobile, hasTouch: isMobile });
  const page = await context.newPage();
  observe(page, test.label, report);
  try {
    await page.goto(`${baseUrl}${test.path}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.locator(test.selector).first().waitFor({ state: 'visible' });
    const layout = await page.evaluate(() => ({
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    if (test.noOverflow) {
      assert.equal(layout.documentWidth, layout.viewportWidth, `${test.label}: document overflow`);
      assert.equal(layout.bodyWidth, layout.viewportWidth, `${test.label}: body overflow`);
    }
    report.routes.push({ label: test.label, path: test.path, ...layout });
  } finally {
    await context.close();
  }
}

const tests = [
  { label: 'mobile-schedule-moscow', path: '/bathhouses/1/schedule', selector: '.schedule-mobile', viewport: { width: 390, height: 844 }, schedule: true, noOverflow: true },
  { label: 'mobile-schedule-zelenogorsk', path: '/bathhouses/2/schedule', selector: '.schedule-mobile', viewport: { width: 390, height: 844 }, schedule: true, noOverflow: true },
  { label: 'mobile-feedback', path: '/profile/feedback', selector: '[data-feedback-form]', viewport: { width: 390, height: 844 }, noOverflow: true },
  { label: 'desktop-schedule-admin', path: '/schedule/admin', selector: '.schedule-admin', viewport: { width: 1440, height: 900 }, schedule: true },
  { label: 'desktop-schedule-screen', path: '/schedule/screen/1/landscape', selector: '.schedule-display', viewport: { width: 1440, height: 900 }, schedule: true },
  { label: 'desktop-schedule-print', path: '/schedule/print/1', selector: '.schedule-print-studio', viewport: { width: 1440, height: 900 }, schedule: true },
  { label: 'desktop-schedule-poster', path: '/schedule/poster/1', selector: '.schedule-poster-page', viewport: { width: 1440, height: 900 }, schedule: true },
];

const report = { consoleErrors: [], pageErrors: [], requestFailures: [], routes: [] };
let webkitBrowser;
let chromiumBrowser;
try {
  await waitForSite();
  webkitBrowser = await webkit.launch({ headless: true });
  for (const test of tests.filter(test => test.viewport.width <= 430)) {
    await verifyRoute(webkitBrowser, test, report);
  }
  chromiumBrowser = await chromium.launch({ headless: true });
  for (const test of tests.filter(test => test.viewport.width > 430)) {
    await verifyRoute(chromiumBrowser, test, report);
  }
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
