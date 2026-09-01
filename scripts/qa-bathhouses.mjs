import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, webkit } = require('C:/Claude Code/node_modules/playwright');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = path.join(projectRoot, 'frontend');
const previewOutDir = process.env.QA_PREVIEW_ROOT
  ? path.resolve(process.env.QA_PREVIEW_ROOT)
  : path.join(frontendRoot, 'build');
const externalBaseUrl = process.env.QA_BASE_URL?.replace(/\/$/, '');
const port = 43994;
const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${port}`;
const preview = externalBaseUrl ? null : spawn(process.execPath, [path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--outDir', previewOutDir, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: frontendRoot,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

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
    const error = request.failure()?.errorText ?? 'failed';
    if (request.url().includes('/fonts/') && error === 'net::ERR_ABORTED') return;
    report.requestFailures.push(`${label}: ${request.method()} ${request.url()} — ${error}`);
  });
}

async function verify(browser, label, viewport, report) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width <= 430, hasTouch: viewport.width <= 430 });
  const page = await context.newPage();
  observe(page, label, report);
  try {
    await page.goto(`${baseUrl}/bathhouses`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.getByRole('heading', { name: 'Термбург', exact: true }).count(), 2);
    assert.equal(await page.getByText('г. Москва', { exact: true }).isVisible(), true);
    assert.equal(await page.getByText('г. Зеленогорск', { exact: true }).isVisible(), true);
    assert.equal(await page.getByText('Ежедневно: 09:00–23:00', { exact: true }).isVisible(), true);
    assert.equal(await page.getByText('Первый понедельник месяца — санитарный день', { exact: true }).isVisible(), true);
    assert.equal(await page.getByText('Скоро открытие', { exact: true }).isVisible(), true);
    assert.equal(await page.getByText('Режим работы появится на официальном сайте', { exact: true }).isVisible(), true);
    assert.equal(await page.getByRole('link', { name: '+7 (495) 191-64-38' }).getAttribute('href'), 'tel:+74951916438');
    assert.equal(await page.getByRole('link', { name: '+7 (909) 167-47-46' }).getAttribute('href'), 'tel:+79091674746');
    const layout = await page.evaluate(() => ({
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    assert.equal(layout.documentWidth, layout.viewportWidth);
    assert.equal(layout.bodyWidth, layout.viewportWidth);
    report.layouts.push({ label, ...layout });
  } finally {
    await context.close();
  }
}

const report = { consoleErrors: [], pageErrors: [], requestFailures: [], layouts: [] };
let chromiumBrowser;
let webkitBrowser;
try {
  await waitForSite();
  webkitBrowser = await webkit.launch({ headless: true });
  await verify(webkitBrowser, 'webkit-390', { width: 390, height: 844 }, report);
  chromiumBrowser = await chromium.launch({ headless: true });
  await verify(chromiumBrowser, 'chromium-375', { width: 375, height: 812 }, report);
  await verify(chromiumBrowser, 'chromium-1440', { width: 1440, height: 900 }, report);
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
