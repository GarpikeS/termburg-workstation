import assert from 'node:assert/strict';
import test from 'node:test';
import { DolphinServerClient } from './server-client.mjs';

test('uses a dedicated bearer token and sends no personal fields', async () => {
  const requests = [];
  const client = new DolphinServerClient({
    endpoint: 'https://tbgame.ru/api/integrations/dolphin/redemptions',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ results: [{ code: 'TB-B5FDD15D', status: 'redeemed' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
    maxAttempts: 1,
  });
  await client.send([{ code: 'TB-B5FDD15D', redeemedAt: '2026-08-18T14:10:00+03:00', sourceRecordId: '1' }], {
    token: 'connector-secret',
    deviceId: 'dolphin-test-device-0001',
  });
  assert.equal(requests[0].options.headers.Authorization, 'Bearer connector-secret');
  const body = JSON.parse(requests[0].options.body);
  assert.deepEqual(Object.keys(body).sort(), ['deviceId', 'dryRun', 'rows']);
  assert.deepEqual(Object.keys(body.rows[0]).sort(), ['code', 'redeemedAt', 'sourceRecordId']);
});

test('enrollment exchanges the one-time installer token without an authorization header', async () => {
  const requests = [];
  const client = new DolphinServerClient({
    endpoint: 'https://tbgame.ru/api/integrations/dolphin/redemptions',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ ok: true, deviceId: 'dolphin-test-device-0002' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    },
    maxAttempts: 1,
  });
  await client.enroll({
    enrollmentToken: 'one-time-installer-token',
    deviceId: 'dolphin-test-device-0002',
    deviceToken: 'c'.repeat(64),
  });
  assert.equal(requests[0].url, 'https://tbgame.ru/api/integrations/dolphin/enroll');
  assert.equal('Authorization' in requests[0].options.headers, false);
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    enrollmentToken: 'one-time-installer-token',
    deviceId: 'dolphin-test-device-0002',
    deviceToken: 'c'.repeat(64),
  });
});

test('fetches source configuration and sends a sanitized heartbeat with the device token', async () => {
  const requests = [];
  const client = new DolphinServerClient({
    endpoint: 'https://tbgame.ru/api/integrations/dolphin/redemptions',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      const body = url.endsWith('/source-config')
        ? { enabled: true, baseUrls: ['http://127.0.0.1:60888'] }
        : { ok: true };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
    maxAttempts: 1,
  });

  const token = 'connector-secret';
  await client.sourceConfig(token);
  await client.heartbeat(token, { appVersion: '1.1.0', sourceApi: { status: 'diagnostic' } });
  assert.equal(requests[0].url, 'https://tbgame.ru/api/integrations/dolphin/source-config');
  assert.equal(requests[0].options.headers.Authorization, `Bearer ${token}`);
  assert.equal(requests[1].url, 'https://tbgame.ru/api/integrations/dolphin/health');
  assert.equal(requests[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    appVersion: '1.1.0',
    sourceApi: { status: 'diagnostic' },
  });
});
