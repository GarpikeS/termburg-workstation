import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tvScheduleFixture } from '../frontend/tests/fixtures/tvSchedule.mjs';

// Local-only preview of the production build. No production data/auth is read.
const buildRoot = fileURLToPath(new URL('../frontend/build/', import.meta.url));
const port = Number(process.env.TV_QA_PORT || 4189);
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/data/default-schedule.json') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(tvScheduleFixture));
    return;
  }
  const requestedFile = path.resolve(buildRoot, `.${decodeURIComponent(url.pathname)}`);
  if (!requestedFile.startsWith(buildRoot)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const content = await readFile(requestedFile);
    response.setHeader('Content-Type', mime[path.extname(requestedFile)] || 'application/octet-stream');
    response.end(content);
  } catch {
    const clock = url.searchParams.get('qaNow') || '2026-10-01T05:40:00Z';
    if (!Number.isFinite(Date.parse(clock))) {
      response.writeHead(400).end('Invalid QA date');
      return;
    }
    const script = `<script>
      const NativeDate = Date;
      const qaInstant = ${Date.parse(clock)};
      window.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [qaInstant])); }
        static now() { return qaInstant; }
      };
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (input, options) => {
        const requestUrl = typeof input === 'string' ? input : input.url;
        if (requestUrl.includes('/wp-json/')) return Promise.resolve(new Response('', {status: 404}));
        return nativeFetch(input, options);
      };
    </script>`;
    const html = await readFile(path.join(buildRoot, 'index.html'), 'utf8');
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(html.replace('<head>', `<head>${script}`));
  }
});
server.listen(port, '127.0.0.1', () => console.log(`TV layout QA: http://127.0.0.1:${port}/schedule/screen/2/landscape`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
