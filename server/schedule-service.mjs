import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { createScheduleAuth } from './schedule-auth.mjs';
import {
  buildWordPressImportHeaders,
  buildWordPressSchedulePayload,
  normalizeWordPressSyncSettings,
  validateWordPressScheduleBeforePublish,
  validateWordPressImportResponse,
  validateWordPressImportUrl,
  WORDPRESS_SYNC_DEFAULTS_BY_LOCATION,
} from './wordpress-schedule.mjs';

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const TEST_SCHEDULE_LOCATION = {
  id: 'test',
  city: 'Тестовый режим',
  name: 'Тестовое расписание',
  shortName: 'Тест',
  address: 'Не публикуется на сайте',
  timezone: 'Europe/Moscow',
};
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
]);

export function getScheduleBaseUrls(port) {
  const addresses = new Set([`http://localhost:${port}`]);
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.add(`http://${entry.address}:${port}`);
    }
  }
  return [...addresses];
}

export function isScheduleData(value) {
  return Boolean(
    value
      && typeof value === 'object'
      && value.schemaVersion === 1
      && Number.isInteger(value.revision)
      && typeof value.updatedAt === 'string'
      && Array.isArray(value.locations)
      && Array.isArray(value.weeklyEvents)
      && Array.isArray(value.exceptions),
  );
}

export function createScheduleService(options) {
  const {
    staticRoot,
    dataFile,
    seedFile,
    siteSyncFile = path.join(path.dirname(dataFile), 'site-sync.json'),
    testDataFile = '',
    authFile = '',
    authScryptOptions,
    testProfile = null,
    host = '0.0.0.0',
    port = 4174,
    adminToken = '',
    allowedOrigin = '*',
    localWritesOnly = false,
    logger = console,
  } = options;

  if (!staticRoot || !dataFile || !seedFile) {
    throw new Error('staticRoot, dataFile and seedFile are required');
  }

  const resolvedStaticRoot = path.resolve(staticRoot);
  const resolvedDataFile = path.resolve(dataFile);
  const resolvedTestDataFile = path.resolve(testDataFile || path.join(path.dirname(dataFile), 'schedule-test.json'));
  const resolvedSeedFile = path.resolve(seedFile);
  const resolvedSiteSyncFile = path.resolve(siteSyncFile);
  const scheduleAuth = authFile ? createScheduleAuth({ authFile, scryptOptions: authScryptOptions, testProfile }) : null;
  let boundPort = port;

  function setCommonHeaders(response) {
    response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    response.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
  }

  function sendJson(response, statusCode, value, extraHeaders = {}) {
    const body = JSON.stringify(value);
    response.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(body),
      ...extraHeaders,
    });
    response.end(body);
  }

  async function readSchedule() {
    try {
      return JSON.parse(await fs.readFile(resolvedDataFile, 'utf8'));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      return JSON.parse(await fs.readFile(resolvedSeedFile, 'utf8'));
    }
  }

  async function writeSchedule(schedule) {
    await fs.mkdir(path.dirname(resolvedDataFile), { recursive: true });
    const tempFile = `${resolvedDataFile}.${process.pid}.tmp`;
    await fs.writeFile(tempFile, `${JSON.stringify(schedule, null, 2)}\n`, 'utf8');
    await fs.rename(tempFile, resolvedDataFile);
  }

  function emptyTestSchedule() {
    return {
      schemaVersion: 1,
      revision: 0,
      updatedAt: new Date().toISOString(),
      locations: [TEST_SCHEDULE_LOCATION],
      weeklyEvents: [],
      exceptions: [],
      monthlyPosters: [],
    };
  }

  async function readTestSchedule() {
    try {
      const value = JSON.parse(await fs.readFile(resolvedTestDataFile, 'utf8'));
      return isScheduleData(value) ? value : emptyTestSchedule();
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      return emptyTestSchedule();
    }
  }

  async function writeTestSchedule(schedule) {
    await fs.mkdir(path.dirname(resolvedTestDataFile), { recursive: true });
    const tempFile = `${resolvedTestDataFile}.${process.pid}.tmp`;
    await fs.writeFile(tempFile, `${JSON.stringify(schedule, null, 2)}\n`, 'utf8');
    await fs.rename(tempFile, resolvedTestDataFile);
  }

  function isolateTestSchedule(incoming, current) {
    return {
      schemaVersion: 1,
      revision: Math.max(current.revision + 1, incoming.revision),
      updatedAt: new Date().toISOString(),
      locations: [TEST_SCHEDULE_LOCATION],
      weeklyEvents: incoming.weeklyEvents.filter(item => item?.locationId === 'test'),
      exceptions: incoming.exceptions.filter(item => item?.locationId === 'test'),
      monthlyPosters: Array.isArray(incoming.monthlyPosters)
        ? incoming.monthlyPosters.filter(item => item?.locationId === 'test')
        : [],
    };
  }

  async function readSiteSyncStore() {
    try {
      const value = JSON.parse(await fs.readFile(resolvedSiteSyncFile, 'utf8'));
      return value && typeof value === 'object' && value.locations && typeof value.locations === 'object'
        ? value
        : { locations: {} };
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      return { locations: {} };
    }
  }

  async function writeSiteSyncStore(store) {
    await fs.mkdir(path.dirname(resolvedSiteSyncFile), { recursive: true });
    const tempFile = `${resolvedSiteSyncFile}.${process.pid}.tmp`;
    await fs.writeFile(tempFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    await fs.rename(tempFile, resolvedSiteSyncFile);
  }

  function publicSiteSyncSettings(locationId, settings) {
    const normalized = normalizeWordPressSyncSettings(settings, WORDPRESS_SYNC_DEFAULTS_BY_LOCATION[locationId]);
    return {
      locationId,
      endpoint: normalized.endpoint,
      authMode: normalized.authMode,
      complexCode: normalized.complexCode,
      hasToken: Boolean(normalized.token),
      tokenHint: normalized.token ? `••••${normalized.token.slice(-4)}` : '',
      lastPublishedAt: normalized.lastPublishedAt,
      lastPublishedCount: normalized.lastPublishedCount,
    };
  }

  function getLocation(schedule, locationId) {
    return schedule.locations.find(location => location.id === locationId);
  }

  function mergeScheduleForLocation(current, incoming, locationId) {
    const keepOtherLocations = (items) => items.filter(item => item.locationId !== locationId);
    const takeAuthorizedLocation = (items) => items.filter(item => item.locationId === locationId);
    return {
      ...current,
      revision: Math.max(current.revision + 1, incoming.revision),
      updatedAt: new Date().toISOString(),
      weeklyEvents: [
        ...keepOtherLocations(current.weeklyEvents),
        ...takeAuthorizedLocation(incoming.weeklyEvents),
      ],
      exceptions: [
        ...keepOtherLocations(current.exceptions),
        ...takeAuthorizedLocation(incoming.exceptions),
      ],
      monthlyPosters: [
        ...keepOtherLocations(Array.isArray(current.monthlyPosters) ? current.monthlyPosters : []),
        ...takeAuthorizedLocation(Array.isArray(incoming.monthlyPosters) ? incoming.monthlyPosters : []),
      ],
    };
  }

  async function saveSiteSyncSettings(locationId, input) {
    const store = await readSiteSyncStore();
    const defaults = WORDPRESS_SYNC_DEFAULTS_BY_LOCATION[locationId];
    const previous = normalizeWordPressSyncSettings(store.locations[locationId], defaults);
    const endpoint = validateWordPressImportUrl(input.endpoint || previous.endpoint);
    const token = typeof input.token === 'string' && input.token.trim() ? input.token.trim() : previous.token;
    const next = normalizeWordPressSyncSettings({
      ...previous,
      endpoint,
      authMode: input.authMode,
      complexCode: input.complexCode,
      token,
    }, defaults);
    store.locations[locationId] = next;
    await writeSiteSyncStore(store);
    return next;
  }

  async function publishScheduleToSite(locationId) {
    const schedule = await readSchedule();
    if (!getLocation(schedule, locationId)) throw new Error('LOCATION_NOT_FOUND');
    const store = await readSiteSyncStore();
    const settings = normalizeWordPressSyncSettings(
      store.locations[locationId],
      WORDPRESS_SYNC_DEFAULTS_BY_LOCATION[locationId],
    );
    const endpoint = validateWordPressImportUrl(settings.endpoint);
    const payload = buildWordPressSchedulePayload(schedule, locationId);
    validateWordPressScheduleBeforePublish(schedule, locationId, payload);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const remoteResponse = await fetch(endpoint, {
        method: 'PUT',
        headers: buildWordPressImportHeaders(settings),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const responseText = await remoteResponse.text();
      let remoteBody = null;
      if (responseText) {
        try {
          remoteBody = JSON.parse(responseText);
        } catch {
          remoteBody = responseText.slice(0, 1000);
        }
      }
      if (!remoteResponse.ok) {
        const error = new Error('REMOTE_IMPORT_FAILED');
        error.remoteStatus = remoteResponse.status;
        error.remoteBody = remoteBody;
        throw error;
      }
      try {
        validateWordPressImportResponse(remoteBody, {
          expectedSite: settings.complexCode,
          expectedCount: payload.length,
        });
      } catch (cause) {
        const error = new Error(cause instanceof Error ? cause.message : 'Некорректный ответ сайта.');
        error.code = 'REMOTE_IMPORT_CONTRACT_FAILED';
        error.remoteBody = remoteBody;
        throw error;
      }

      const publishedAt = new Date().toISOString();
      store.locations[locationId] = normalizeWordPressSyncSettings({
        ...settings,
        lastPublishedAt: publishedAt,
        lastPublishedCount: payload.length,
      });
      await writeSiteSyncStore(store);
      return {
        ok: true,
        imported: payload.length,
        endpoint,
        remoteStatus: remoteResponse.status,
        remoteResponse: remoteBody,
        publishedAt,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  const scheduleSubscribers = new Set();

  function broadcastScheduleUpdate(schedule) {
    const payload = JSON.stringify({
      revision: schedule.revision,
      updatedAt: schedule.updatedAt,
    });
    for (const subscriber of scheduleSubscribers) {
      try {
        subscriber.write(`event: schedule\ndata: ${payload}\n\n`);
      } catch {
        scheduleSubscribers.delete(subscriber);
      }
    }
  }

  async function readBody(request) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  function writeAccess(request, locationId = '') {
    if (scheduleAuth) {
      if (!hasTrustedEditorOrigin(request)) return { allowed: false, status: 403, error: 'Запрос пришёл не из редактора расписания.' };
      return scheduleAuth.authorize(request, locationId);
    }
    if (adminToken) {
      return request.headers.authorization === `Bearer ${adminToken}`
        ? { allowed: true }
        : { allowed: false, status: 401, error: 'Неверный ключ редактора.' };
    }
    if (localWritesOnly && !LOOPBACK_ADDRESSES.has(request.socket.remoteAddress || '')) {
      return { allowed: false, status: 403, error: 'Изменения разрешены только на компьютере редактора.' };
    }
    return { allowed: true };
  }

  function localEditorAccess(request, { requireLoopback = localWritesOnly } = {}) {
    if (!hasTrustedEditorOrigin(request)) {
      return { allowed: false, status: 403, error: 'Запрос пришёл не из редактора расписания.' };
    }
    if (requireLoopback && !LOOPBACK_ADDRESSES.has(request.socket.remoteAddress || '')) {
      return { allowed: false, status: 403, error: 'Вход разрешён только на компьютере редактора.' };
    }
    return { allowed: true };
  }

  function hasTrustedEditorOrigin(request) {
    const origin = request.headers.origin;
    if (!origin) return true;
    try {
      const parsed = new URL(origin);
      return parsed.protocol === 'http:' && parsed.host === request.headers.host;
    } catch {
      return false;
    }
  }

  function safeStaticPath(urlPath) {
    let decoded;
    try {
      decoded = decodeURIComponent(urlPath);
    } catch {
      return null;
    }
    const relative = decoded.replace(/^\/+/, '');
    const resolved = path.resolve(resolvedStaticRoot, relative || 'index.html');
    const rootPrefix = `${resolvedStaticRoot}${path.sep}`;
    return resolved === resolvedStaticRoot || resolved.startsWith(rootPrefix) ? resolved : null;
  }

  async function serveStatic(request, response, url) {
    let filePath = safeStaticPath(url.pathname);
    if (!filePath) {
      response.writeHead(400).end('Bad request');
      return;
    }

    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) filePath = path.join(filePath, 'index.html');
      const content = await fs.readFile(filePath);
      response.writeHead(200, {
        'Content-Type': mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream',
        'Cache-Control': filePath.endsWith('.html') ? 'no-cache' : 'public, max-age=3600',
      });
      if (request.method === 'HEAD') response.end();
      else response.end(content);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      const fallback = await fs.readFile(path.join(resolvedStaticRoot, 'index.html'));
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      response.end(fallback);
    }
  }

  const server = createServer(async (request, response) => {
    const startedAt = Date.now();
    setCommonHeaders(response);
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

      if (request.method === 'OPTIONS') {
        response.writeHead(204).end();
        return;
      }

      if (url.pathname === '/api/health' && request.method === 'GET') {
        sendJson(response, 200, { ok: true, service: 'termburg-schedule', now: new Date().toISOString() });
        return;
      }

      if (url.pathname === '/api/info' && request.method === 'GET') {
        sendJson(response, 200, {
          port: boundPort,
          baseUrls: getScheduleBaseUrls(boundPort),
          writeMode: scheduleAuth ? 'login' : adminToken ? 'token' : localWritesOnly ? 'local-only' : 'lan',
        });
        return;
      }

      if (url.pathname === '/api/auth/status' && request.method === 'GET') {
        if (!scheduleAuth) {
          sendJson(response, 200, { configured: false, authenticated: false, user: null, disabled: true });
          return;
        }
        sendJson(response, 200, await scheduleAuth.status(request));
        return;
      }

      if (url.pathname === '/api/auth/setup' && request.method === 'POST') {
        if (!scheduleAuth) {
          sendJson(response, 404, { error: 'Вход для этой версии сервера не включён.' });
          return;
        }
        const access = localEditorAccess(request, { requireLoopback: true });
        if (!access.allowed) {
          sendJson(response, access.status, { error: access.error });
          return;
        }
        const input = JSON.parse(await readBody(request) || '{}');
        try {
          sendJson(response, 201, await scheduleAuth.setup(input));
        } catch (error) {
          if (error?.code?.startsWith('AUTH_')) {
            sendJson(response, error.status || 400, { error: error.message });
            return;
          }
          throw error;
        }
        return;
      }

      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        if (!scheduleAuth) {
          sendJson(response, 404, { error: 'Вход для этой версии сервера не включён.' });
          return;
        }
        const access = localEditorAccess(request);
        if (!access.allowed) {
          sendJson(response, access.status, { error: access.error });
          return;
        }
        const input = JSON.parse(await readBody(request) || '{}');
        try {
          const result = await scheduleAuth.login(input, request.socket.remoteAddress || '');
          sendJson(response, 200, { authenticated: true, user: result.user }, { 'Set-Cookie': result.cookie });
        } catch (error) {
          if (error?.code?.startsWith('AUTH_')) {
            sendJson(response, error.status || 400, { error: error.message });
            return;
          }
          throw error;
        }
        return;
      }

      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        if (!scheduleAuth) {
          sendJson(response, 200, { authenticated: false });
          return;
        }
        const access = localEditorAccess(request);
        if (!access.allowed) {
          sendJson(response, access.status, { error: access.error });
          return;
        }
        sendJson(response, 200, { authenticated: false }, { 'Set-Cookie': scheduleAuth.logout(request) });
        return;
      }

      if (url.pathname === '/api/schedule/stream' && request.method === 'GET') {
        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        response.write('retry: 2000\n: connected\n\n');
        scheduleSubscribers.add(response);
        request.once('close', () => scheduleSubscribers.delete(response));
        return;
      }

      if (url.pathname === '/api/schedule' && request.method === 'GET') {
        const access = scheduleAuth?.authorize(request);
        sendJson(response, 200, access?.allowed && access.user?.isTest
          ? await readTestSchedule()
          : await readSchedule());
        return;
      }

      if (url.pathname === '/api/schedule' && request.method === 'PUT') {
        const access = writeAccess(request);
        if (!access.allowed) {
          sendJson(response, access.status, { error: access.error });
          return;
        }

        const body = await readBody(request);
        let value;
        try {
          value = JSON.parse(body);
        } catch {
          sendJson(response, 400, { error: 'Неверный JSON.' });
          return;
        }
        if (!isScheduleData(value)) {
          sendJson(response, 400, { error: 'Неверный формат расписания.' });
          return;
        }
        const testSession = access.user?.isTest === true;
        const saved = testSession
          ? isolateTestSchedule(value, await readTestSchedule())
          : access.user?.locationId
            ? mergeScheduleForLocation(await readSchedule(), value, access.user.locationId)
            : value;
        if (testSession) await writeTestSchedule(saved);
        else await writeSchedule(saved);
        broadcastScheduleUpdate(saved);
        sendJson(response, 200, saved);
        return;
      }

      if (url.pathname === '/api/site-sync/settings' && request.method === 'GET') {
        const locationId = url.searchParams.get('locationId') || '';
        const access = writeAccess(request, locationId);
        if (!access.allowed) {
          sendJson(response, access.status, { error: access.error });
          return;
        }
        const schedule = await readSchedule();
        if (!getLocation(schedule, locationId)) {
          sendJson(response, 404, { error: 'Комплекс не найден.' });
          return;
        }
        const store = await readSiteSyncStore();
        sendJson(response, 200, publicSiteSyncSettings(locationId, store.locations[locationId]));
        return;
      }

      if (url.pathname === '/api/site-sync/settings' && request.method === 'PUT') {
        const input = JSON.parse(await readBody(request) || '{}');
        const locationId = typeof input.locationId === 'string' ? input.locationId : '';
        const access = writeAccess(request, locationId);
        if (!access.allowed) {
          sendJson(response, access.status, { error: access.error });
          return;
        }
        const schedule = await readSchedule();
        if (!getLocation(schedule, locationId)) {
          sendJson(response, 404, { error: 'Комплекс не найден.' });
          return;
        }
        const settings = await saveSiteSyncSettings(locationId, input);
        sendJson(response, 200, publicSiteSyncSettings(locationId, settings));
        return;
      }

      if (url.pathname === '/api/site-sync/publish' && request.method === 'POST') {
        const input = JSON.parse(await readBody(request) || '{}');
        const locationId = typeof input.locationId === 'string' ? input.locationId : '';
        const access = writeAccess(request, locationId);
        if (!access.allowed) {
          sendJson(response, access.status, { error: access.error });
          return;
        }
        try {
          sendJson(response, 200, await publishScheduleToSite(locationId));
        } catch (error) {
          if (error?.message === 'LOCATION_NOT_FOUND') {
            sendJson(response, 404, { error: 'Комплекс не найден.' });
            return;
          }
          if (typeof error?.message === 'string' && error.message.startsWith('Отправка на сайт остановлена:')) {
            sendJson(response, 400, { error: error.message });
            return;
          }
          if (error?.message === 'REMOTE_IMPORT_FAILED') {
            sendJson(response, 502, {
              error: `Сайт отклонил расписание (HTTP ${error.remoteStatus}).`,
              remoteStatus: error.remoteStatus,
              remoteResponse: error.remoteBody,
            });
            return;
          }
          if (error?.code === 'REMOTE_IMPORT_CONTRACT_FAILED') {
            sendJson(response, 502, {
              error: error.message,
              remoteResponse: error.remoteBody,
            });
            return;
          }
          if (error?.name === 'AbortError') {
            sendJson(response, 504, { error: 'Сайт не ответил за 20 секунд.' });
            return;
          }
          if (error instanceof TypeError) {
            sendJson(response, 502, { error: 'Не удалось подключиться к сайту.' });
            return;
          }
          throw error;
        }
        return;
      }

      if (url.pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: 'Not found' });
        return;
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
        return;
      }
      await serveStatic(request, response, url);
    } catch (error) {
      const status = error?.message === 'PAYLOAD_TOO_LARGE' ? 413 : 500;
      sendJson(response, status, { error: status === 413 ? 'Данные больше 12 МБ. Уменьшите изображения афиши.' : 'Ошибка сервера.' });
      logger.error?.('[schedule-server]', error);
    } finally {
      logger.info?.(`${request.method} ${request.url} ${response.statusCode} ${Date.now() - startedAt}ms`);
    }
  });

  server.requestTimeout = 10_000;
  server.headersTimeout = 12_000;
  server.keepAliveTimeout = 5_000;

  const heartbeat = setInterval(() => {
    for (const subscriber of scheduleSubscribers) {
      try {
        subscriber.write(': heartbeat\n\n');
      } catch {
        scheduleSubscribers.delete(subscriber);
      }
    }
  }, 15_000);
  heartbeat.unref?.();

  async function listen() {
    await scheduleAuth?.ready;
    await new Promise((resolve, reject) => {
      const onError = (error) => reject(error);
      server.once('error', onError);
      server.listen(port, host, () => {
        server.off('error', onError);
        resolve();
      });
    });
    const address = server.address();
    const activePort = typeof address === 'object' && address ? address.port : port;
    boundPort = activePort;
    return { port: activePort, baseUrls: getScheduleBaseUrls(activePort) };
  }

  async function close() {
    clearInterval(heartbeat);
    for (const subscriber of scheduleSubscribers) subscriber.end();
    scheduleSubscribers.clear();
    if (!server.listening) return;
    await new Promise((resolve, reject) => {
      const forceTimer = setTimeout(() => server.closeAllConnections?.(), 2_000);
      forceTimer.unref?.();
      server.close((error) => {
        clearTimeout(forceTimer);
        if (error) reject(error);
        else resolve();
      });
      server.closeIdleConnections?.();
    });
  }

  return {
    server,
    listen,
    close,
    paths: {
      staticRoot: resolvedStaticRoot,
      dataFile: resolvedDataFile,
      testDataFile: resolvedTestDataFile,
      seedFile: resolvedSeedFile,
      siteSyncFile: resolvedSiteSyncFile,
      ...(scheduleAuth ? { authFile: scheduleAuth.paths.authFile } : {}),
    },
  };
}

export async function startScheduleService(options) {
  const service = createScheduleService(options);
  const network = await service.listen();
  return { ...service, ...network };
}
