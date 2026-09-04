import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { startScheduleService } from './schedule-service.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

test('schedule service reads, writes and serves the SPA', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'termburg-schedule-'));
  const dataFile = path.join(tempRoot, 'schedule.json');
  const service = await startScheduleService({
    staticRoot: path.join(repoRoot, 'frontend', 'build'),
    dataFile,
    seedFile: path.join(repoRoot, 'frontend', 'public', 'data', 'default-schedule.json'),
    host: '127.0.0.1',
    port: 0,
    localWritesOnly: true,
    logger: { info() {}, error() {} },
  });

  const origin = `http://127.0.0.1:${service.port}`;
  const streamController = new AbortController();
  let streamReader = null;
  try {
    const healthResponse = await fetch(`${origin}/api/health`);
    assert.equal(healthResponse.status, 200);
    assert.match(healthResponse.headers.get('content-security-policy') || '', /default-src 'self'/);

    const infoResponse = await fetch(`${origin}/api/info`);
    const info = await infoResponse.json();
    assert.equal(info.port, service.port);
    assert.equal(info.writeMode, 'local-only');
    assert.ok(info.baseUrls.some((item) => item.includes(`:${service.port}`)));

    const scheduleResponse = await fetch(`${origin}/api/schedule`);
    const schedule = await scheduleResponse.json();
    assert.equal(schedule.schemaVersion, 1);
    assert.ok(schedule.weeklyEvents.length > 0);

    const streamResponse = await fetch(`${origin}/api/schedule/stream`, {
      signal: streamController.signal,
    });
    assert.equal(streamResponse.status, 200);
    assert.match(streamResponse.headers.get('content-type') || '', /text\/event-stream/);
    streamReader = streamResponse.body.getReader();
    const connected = await streamReader.read();
    assert.match(new TextDecoder().decode(connected.value), /connected/);

    const invalidResponse = await fetch(`${origin}/api/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{broken',
    });
    assert.equal(invalidResponse.status, 400);

    const updated = {
      ...schedule,
      revision: schedule.revision + 1,
      updatedAt: new Date().toISOString(),
      monthlyPosters: [{
        id: 'poster-1-2026-09',
        locationId: '1',
        month: '2026-09',
        events: [
          { id: 'poster-event-1', date: '2026-09-01', title: 'Праздник', program: '13:00 — Открытие' },
          { id: 'poster-event-2', date: '2026-09-15', title: 'Семейный день', program: '14:00 — Программа' },
        ],
      }],
    };
    const saveResponse = await fetch(`${origin}/api/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    assert.equal(saveResponse.status, 200);

    const streamed = await Promise.race([
      streamReader.read(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SSE update timeout')), 2_000)),
    ]);
    const streamedText = new TextDecoder().decode(streamed.value);
    assert.match(streamedText, /event: schedule/);
    assert.match(streamedText, new RegExp(`"revision":${updated.revision}`));

    const saved = JSON.parse(await readFile(dataFile, 'utf8'));
    assert.equal(saved.revision, updated.revision);
    assert.equal(saved.monthlyPosters[0].events.length, 2);

    const spaResponse = await fetch(`${origin}/schedule/admin`);
    assert.equal(spaResponse.status, 200);
    assert.match(await spaResponse.text(), /<div id="root"><\/div>/);
  } finally {
    streamController.abort();
    await streamReader?.cancel().catch(() => {});
    await service.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('schedule service stores site credentials locally and publishes the full array', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'termburg-site-sync-'));
  const dataFile = path.join(tempRoot, 'schedule.json');
  const siteSyncFile = path.join(tempRoot, 'site-sync.json');
  let received = null;
  const remote = await new Promise((resolve) => {
    const server = createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      received = {
        method: request.method,
        authorization: request.headers.authorization,
        complexCode: request.headers['x-termburg-location'],
        contentType: request.headers['content-type'],
        body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
      };
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        success: true,
        site: 'moscow',
        count: received.body.length,
        updatedAt: '2026-08-14T06:10:48+03:00',
      }));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  const remoteAddress = remote.address();
  const endpoint = `http://127.0.0.1:${remoteAddress.port}/wp-json/termburg/v1/schedule/import`;
  const service = await startScheduleService({
    staticRoot: path.join(repoRoot, 'frontend', 'build'),
    dataFile,
    siteSyncFile,
    seedFile: path.join(repoRoot, 'frontend', 'public', 'data', 'default-schedule.json'),
    host: '127.0.0.1',
    port: 0,
    localWritesOnly: true,
    logger: { info() {}, error() {} },
  });
  const origin = `http://127.0.0.1:${service.port}`;
  try {
    const saveSettings = await fetch(`${origin}/api/site-sync/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: '1', endpoint, authMode: 'bearer', complexCode: 'moscow', token: 'site-secret' }),
    });
    assert.equal(saveSettings.status, 200);
    const publicSettings = await saveSettings.json();
    assert.equal(publicSettings.hasToken, true);
    assert.equal(publicSettings.token, undefined);
    assert.equal(publicSettings.tokenHint, '••••cret');

    const publish = await fetch(`${origin}/api/site-sync/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: '1' }),
    });
    assert.equal(publish.status, 200);
    const result = await publish.json();
    assert.equal(result.ok, true);
    assert.equal(result.imported, received.body.length);
    assert.equal(received.method, 'PUT');
    assert.equal(received.authorization, 'Bearer site-secret');
    assert.equal(received.complexCode, 'moscow');
    assert.match(received.contentType, /application\/json; charset=utf-8/);
    assert.ok(received.body.every(item => item.name && (item.time || item.type === 'closed')));

    const storedSettings = JSON.parse(await readFile(siteSyncFile, 'utf8'));
    assert.equal(storedSettings.locations['1'].token, 'site-secret');
    assert.equal(storedSettings.locations['1'].lastPublishedCount, result.imported);
  } finally {
    await service.close();
    await new Promise(resolve => remote.close(resolve));
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('schedule editor login protects writes and scopes users to one complex', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'termburg-auth-'));
  const dataFile = path.join(tempRoot, 'schedule.json');
  const authFile = path.join(tempRoot, 'schedule-auth.json');
  const service = await startScheduleService({
    staticRoot: path.join(repoRoot, 'frontend', 'build'),
    dataFile,
    authFile,
    seedFile: path.join(repoRoot, 'frontend', 'public', 'data', 'default-schedule.json'),
    host: '127.0.0.1',
    port: 0,
    localWritesOnly: true,
    authScryptOptions: { N: 1024, r: 8, p: 1, maxmem: 16 * 1024 * 1024 },
    logger: { info() {}, error() {} },
  });
  const origin = `http://127.0.0.1:${service.port}`;

  try {
    const initialStatus = await fetch(`${origin}/api/auth/status`).then(response => response.json());
    assert.deepEqual(initialStatus, { configured: false, authenticated: false, user: null });

    const schedule = await fetch(`${origin}/api/schedule`).then(response => response.json());
    const crossOriginSetup = await fetch(`${origin}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://example.org' },
      body: JSON.stringify({ moscowPassword: 'Moscow-pass-2026', zelenogorskPassword: 'Green-pass-2026' }),
    });
    assert.equal(crossOriginSetup.status, 403);

    const deniedSave = await fetch(`${origin}/api/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    });
    assert.equal(deniedSave.status, 401);

    const setup = await fetch(`${origin}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moscowPassword: '301123!',
        zelenogorskPassword: '301123!',
      }),
    });
    assert.equal(setup.status, 201);
    const storedAuth = await readFile(authFile, 'utf8');
    assert.doesNotMatch(storedAuth, /301123!/);
    assert.match(storedAuth, /"scrypt"/);

    const wrongLogin = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'moscow', password: 'wrong-password' }),
    });
    assert.equal(wrongLogin.status, 401);

    const login = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'moscow', password: '301123!' }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie?.startsWith('termburg_schedule_session='));
    assert.deepEqual((await login.json()).user, { username: 'moscow', locationId: '1' });

    const ownSettings = await fetch(`${origin}/api/site-sync/settings?locationId=1`, { headers: { Cookie: cookie } });
    assert.equal(ownSettings.status, 200);
    const otherSettings = await fetch(`${origin}/api/site-sync/settings?locationId=2`, { headers: { Cookie: cookie } });
    assert.equal(otherSettings.status, 403);

    const originalGreen = schedule.weeklyEvents.find(item => item.locationId === '2');
    const changed = {
      ...schedule,
      weeklyEvents: schedule.weeklyEvents.map(item => item.locationId === '1'
        ? { ...item, title: `${item.title} — Москва` }
        : { ...item, title: `${item.title} — недопустимая правка` }),
    };
    const savedResponse = await fetch(`${origin}/api/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(changed),
    });
    assert.equal(savedResponse.status, 200);
    const saved = await savedResponse.json();
    assert.ok(saved.weeklyEvents.filter(item => item.locationId === '1').every(item => item.title.endsWith('— Москва')));
    assert.equal(saved.weeklyEvents.find(item => item.id === originalGreen.id).title, originalGreen.title);

    const logout = await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie } });
    assert.equal(logout.status, 200);
    const deniedAfterLogout = await fetch(`${origin}/api/site-sync/settings?locationId=1`, { headers: { Cookie: cookie } });
    assert.equal(deniedAfterLogout.status, 401);
  } finally {
    await service.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('manual test login uses an isolated schedule and cannot publish production data', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'termburg-test-schedule-'));
  const dataFile = path.join(tempRoot, 'schedule.json');
  const testDataFile = path.join(tempRoot, 'schedule-test.json');
  const authFile = path.join(tempRoot, 'schedule-auth.json');
  const service = await startScheduleService({
    staticRoot: path.join(repoRoot, 'frontend', 'build'),
    dataFile,
    testDataFile,
    authFile,
    seedFile: path.join(repoRoot, 'frontend', 'public', 'data', 'default-schedule.json'),
    host: '127.0.0.1',
    port: 0,
    localWritesOnly: true,
    testProfile: { username: 'testtb', password: '2026', locationId: 'test', version: 1 },
    authScryptOptions: { N: 1024, r: 8, p: 1, maxmem: 16 * 1024 * 1024 },
    logger: { info() {}, error() {} },
  });
  const origin = `http://127.0.0.1:${service.port}`;

  try {
    const setup = await fetch(`${origin}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moscowPassword: 'Moscow-pass-2026',
        zelenogorskPassword: 'Green-pass-2026',
      }),
    });
    assert.equal(setup.status, 201);

    const login = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testTB', password: '2026' }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);
    assert.deepEqual((await login.json()).user, { username: 'testtb', locationId: 'test', isTest: true });

    const liveSchedule = await fetch(`${origin}/api/schedule`).then(response => response.json());
    const testSchedule = await fetch(`${origin}/api/schedule`, { headers: { Cookie: cookie } }).then(response => response.json());
    assert.deepEqual(testSchedule.locations.map(location => location.id), ['test']);
    assert.equal(testSchedule.weeklyEvents.length, 0);

    const testEvent = {
      id: 'test-weekly-1',
      locationId: 'test',
      daysOfWeek: [1],
      time: '12:00',
      endTime: '12:30',
      title: 'Тестовое событие',
      venue: 'Тестовый зал',
      priceKind: 'free',
      published: true,
    };
    const savedResponse = await fetch(`${origin}/api/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        ...testSchedule,
        weeklyEvents: [testEvent, ...liveSchedule.weeklyEvents],
      }),
    });
    assert.equal(savedResponse.status, 200);
    const savedTest = await savedResponse.json();
    assert.deepEqual(savedTest.weeklyEvents, [testEvent]);

    const liveAfterTestSave = await fetch(`${origin}/api/schedule`).then(response => response.json());
    assert.deepEqual(liveAfterTestSave.weeklyEvents, liveSchedule.weeklyEvents);
    const storedTest = JSON.parse(await readFile(testDataFile, 'utf8'));
    assert.deepEqual(storedTest.locations.map(location => location.id), ['test']);
    assert.deepEqual(storedTest.weeklyEvents, [testEvent]);

    const publishSettings = await fetch(`${origin}/api/site-sync/settings?locationId=test`, { headers: { Cookie: cookie } });
    assert.equal(publishSettings.status, 404);
  } finally {
    await service.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});
