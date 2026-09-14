import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CampSourceApiClient,
  normalizeCampSourceConfig,
  profileCampResponse,
} from './camp-source-client.mjs';

test('probes CAMP dictionaries from 2023-09-01 and accounts for the initial and current Moscow dates', async () => {
  const requests = [];
  const client = new CampSourceApiClient({
    enabled: true,
    baseUrls: ['http://10.10.0.250:60888'],
    apiKey: 'local-api-key-for-test-only',
    initialDate: '2023-09-01',
    endpoints: {
      guestTypes: '/api/v1/camp/guesttypes',
      services: '/api/v1/camp/services',
      accounts: '/api/v1/camp/accounts',
    },
  }, {
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      const body = url.includes('/guesttypes')
        ? { 'Типы гостей': [{ ID: 1, NAME: 'Взрослый' }] }
        : url.includes('/services')
          ? { services: [{ ID: 2, NAME: 'Банный комплекс' }] }
          : { accounts: [{ ID: 3, BALANCE: 1200, DESCRIPTION: 'Иван Иванов' }] };
      const json = JSON.stringify(body);
      return new Response(url.includes('/guesttypes') ? `\uFEFF${json}` : json, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const result = await client.probe({
    timestamp: Date.parse('2026-09-14T10:00:00.000Z'),
    timezoneOffset: '+03:00',
  });

  assert.deepEqual(requests.map(request => request.url), [
    'http://10.10.0.250:60888/api/v1/camp/guesttypes?dateexchange=2023-09-01',
    'http://10.10.0.250:60888/api/v1/camp/services?dateexchange=2023-09-01',
    'http://10.10.0.250:60888/api/v1/camp/accounts?dateexchange=2023-09-01',
    'http://10.10.0.250:60888/api/v1/camp/accounts?dateexchange=2026-09-14',
  ]);
  assert.ok(requests.every(request => request.options.headers['X-API-Key'] === 'local-api-key-for-test-only'));
  assert.ok(requests.every(request => request.options.redirect === 'manual'));
  assert.equal(result.status, 'diagnostic');
  assert.equal(result.resources.guestTypes.probes[0].rowCount, 1);
  assert.equal(result.resources.accounts.probes.length, 2);
  assert.match(JSON.stringify(result), /BALANCE/);
  assert.doesNotMatch(JSON.stringify(result), /Взрослый|Банный комплекс|Иван Иванов|local-api-key/);
});

test('falls back to the legacy ampersand dateexchange URL only after a route-level 404', async () => {
  const urls = [];
  const client = new CampSourceApiClient({
    enabled: true,
    baseUrls: ['http://10.10.0.250:60888'],
    apiKey: 'local-api-key-for-test-only',
    initialDate: '2023-09-01',
  }, {
    fetchImpl: async url => {
      urls.push(url);
      return url.includes('?dateexchange=')
        ? new Response('{}', { status: 404 })
        : new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const result = await client.probe({
    timestamp: Date.parse('2023-09-01T10:00:00.000Z'),
    timezoneOffset: '+03:00',
  });

  assert.equal(result.status, 'diagnostic');
  assert.ok(urls.some(url => url === 'http://10.10.0.250:60888/api/v1/camp/guesttypes&dateexchange=2023-09-01'));
  assert.ok(urls.every(url => !url.includes('?dateexchange=') || urls.includes(url.replace('?dateexchange=', '&dateexchange='))));
});

test('negotiates standard and legacy query styles independently for each endpoint', async () => {
  const urls = [];
  const client = new CampSourceApiClient({
    enabled: true,
    baseUrls: ['http://10.10.0.250:60888'],
    apiKey: 'local-api-key-for-test-only',
    initialDate: '2023-09-01',
  }, {
    fetchImpl: async url => {
      urls.push(url);
      if (url.includes('/guesttypes?')) return new Response('{}', { status: 404 });
      if (url.includes('/services&')) return new Response('{}', { status: 404 });
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const result = await client.probe({
    timestamp: Date.parse('2023-09-01T10:00:00.000Z'),
    timezoneOffset: '+03:00',
  });

  assert.equal(result.status, 'diagnostic');
  assert.ok(urls.includes('http://10.10.0.250:60888/api/v1/camp/guesttypes&dateexchange=2023-09-01'));
  assert.ok(urls.includes('http://10.10.0.250:60888/api/v1/camp/services?dateexchange=2023-09-01'));
  assert.ok(!urls.includes('http://10.10.0.250:60888/api/v1/camp/services&dateexchange=2023-09-01'));
});

test('never sends an API key to the supplied public plain-HTTP address', async () => {
  let called = false;
  const config = normalizeCampSourceConfig({
    enabled: true,
    baseUrls: ['http://85.202.234.197:60888'],
    apiKey: 'must-never-leave-over-http',
    initialDate: '2023-09-01',
  });
  const client = new CampSourceApiClient(config, {
    fetchImpl: async () => {
      called = true;
      return new Response('{}');
    },
  });

  await assert.rejects(() => client.probe(), /не настроен/i);
  assert.equal(config.enabled, false);
  assert.equal(called, false);
});

test('profiles field names and types without retaining source values', () => {
  const value = {
    result: {
      rows: [
        { ID: 17, NAME: 'Секретное имя', ACTIVE: true, DATEEND: null },
        { ID: 18, NAME: 'Другое имя', ACTIVE: false, DATEEND: '2026-09-14T10:00:00' },
      ],
    },
  };

  const profile = profileCampResponse(value, { byteCount: 321 });

  assert.equal(profile.rowCount, 2);
  assert.equal(profile.byteCount, 321);
  assert.deepEqual(profile.schema.find(field => field.path === 'ID')?.types, ['number']);
  assert.deepEqual(profile.schema.find(field => field.path === 'DATEEND')?.types, ['null', 'string']);
  assert.doesNotMatch(JSON.stringify(profile), /Секретное имя|Другое имя|2026-09-14T10:00:00/);
});

test('keeps the schema hash stable when only row and null counts change', () => {
  const first = profileCampResponse([{ ID: 1, NAME: 'Первый' }]);
  const second = profileCampResponse([
    { ID: 2, NAME: 'Второй' },
    { ID: 3, NAME: 'Третий' },
  ]);

  assert.notEqual(first.schema[0].observed, second.schema[0].observed);
  assert.equal(first.schemaHash, second.schemaHash);
});

test('prefers the known data collection over an earlier empty errors array', () => {
  const profile = profileCampResponse({
    errors: [],
    accounts: [{ ID: 41, BALANCE: 900 }],
  });

  assert.equal(profile.containerPath, '$.accounts');
  assert.equal(profile.rowCount, 1);
  assert.ok(profile.schema.some(field => field.path === 'BALANCE'));
});

test('hashes unknown container and field names so dynamic PII keys cannot leave the workstation', () => {
  const profile = profileCampResponse({
    'Иван Иванов': [{ ID: 41, 'Телефон клиента': '+7 999 000-00-00' }],
  });
  const serialized = JSON.stringify(profile);

  assert.doesNotMatch(serialized, /Иван Иванов|Телефон клиента|999 000/);
  assert.match(profile.containerPath, /^\$\.NODE_[a-f0-9]{12}$/);
  assert.ok(profile.schema.some(field => /^FIELD_[a-f0-9]{12}$/.test(field.path)));
});
