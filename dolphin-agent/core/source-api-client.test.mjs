import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DolphinSourceApiClient,
  extractRedemptionsFromApi,
  normalizeSourceBaseUrl,
} from './source-api-client.mjs';

test('calls the local Dolphin API with X-API-Key and extracts entry records', async () => {
  const requests = [];
  const client = new DolphinSourceApiClient({
    enabled: true,
    baseUrls: ['http://127.0.0.1:60888'],
    apiKey: 'local-api-key-for-test-only',
    apiPath: '/api/v1/barcodes/game',
    applyRedemptions: false,
  }, {
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({
        result: {
          items: [{ id: '160961', barcode: 'TB-B5FDD15D', entry_time: '31.08.2026 14:10' }],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const result = await client.fetchRedemptions({ dateBegin: '2026-08-31', timezoneOffset: '+03:00' });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'http://127.0.0.1:60888/api/v1/barcodes/game?datebegin=2026-08-31');
  assert.equal(requests[0].options.headers['X-API-Key'], 'local-api-key-for-test-only');
  assert.deepEqual(result.rows, [{
    code: 'TB-B5FDD15D',
    redeemedAt: '2026-08-31T14:10:00+03:00',
    sourceRecordId: '160961',
  }]);
  assert.equal(result.applyRedemptions, false);
});

test('falls back to the legacy ampersand URL when the standard route is absent', async () => {
  const urls = [];
  const client = new DolphinSourceApiClient({
    enabled: true,
    baseUrls: ['http://10.10.0.250:60888'],
    apiKey: 'local-api-key-for-test-only',
  }, {
    fetchImpl: async url => {
      urls.push(url);
      return urls.length === 1
        ? new Response('{}', { status: 404 })
        : new Response(JSON.stringify([]), { status: 200 });
    },
  });

  await client.fetchRedemptions({ dateBegin: '2026-08-31' });
  assert.equal(urls.length, 2);
  assert.equal(urls[1], 'http://10.10.0.250:60888/api/v1/barcodes/game&datebegin=2026-08-31');
});

test('never sends an API key over public plain HTTP', async () => {
  let called = false;
  assert.equal(normalizeSourceBaseUrl('http://85.202.234.197:60888'), '');
  const client = new DolphinSourceApiClient({
    enabled: true,
    baseUrls: ['http://85.202.234.197:60888'],
    apiKey: 'must-never-leave-over-http',
  }, {
    fetchImpl: async () => {
      called = true;
      return new Response('{}');
    },
  });
  await assert.rejects(() => client.fetchRedemptions({ dateBegin: '2026-08-31' }), /не настроен/i);
  assert.equal(called, false);
});

test('ignores a ticket code without an actual entry time', () => {
  const result = extractRedemptionsFromApi([{ barcode: 'TB-EE185628', entry_time: '' }]);
  assert.equal(result.rows.length, 0);
  assert.equal(result.stats.skippedWithoutEntryTime, 1);
});
