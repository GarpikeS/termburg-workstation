import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CampSourceApiClient,
  normalizeCampSourceConfig,
  profileCampResponse,
} from './camp-source-client.mjs';

test('probes CAMP dictionaries once and transactional resources only for the current Moscow date', async () => {
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
      accountSales: '/api/v1/camp/accountsales',
    },
  }, {
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      const body = url.includes('/guesttypes')
        ? { 'Типы гостей': [{ ID: 1, NAME: 'Взрослый' }] }
        : url.includes('/services')
          ? { services: [{ ID: 2, NAME: 'Банный комплекс' }] }
          : url.includes('/accountsales')
            ? { accountSales: [{ ID: 4, IDACCOUNT: 3, IDSERVICE: 2, SUMMA: 444.25, COMPUTERNAME: 'CASHBOX-SECRET' }] }
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
    'http://10.10.0.250:60888/api/v1/camp/accounts?dateexchange=2026-09-14',
    'http://10.10.0.250:60888/api/v1/camp/accountsales?dateexchange=2026-09-14',
  ]);
  assert.ok(requests.every(request => request.options.headers['X-API-Key'] === 'local-api-key-for-test-only'));
  assert.ok(requests.every(request => request.options.redirect === 'manual'));
  assert.equal(result.status, 'diagnostic');
  assert.equal(result.resources.guestTypes.probes[0].rowCount, 1);
  assert.equal(result.resources.accounts.probes.length, 1);
  assert.equal(result.resources.accountSales.probes.length, 1);
  assert.match(JSON.stringify(result), /BALANCE|SUMMA/);
  assert.doesNotMatch(JSON.stringify(result), /Взрослый|Банный комплекс|Иван Иванов|CASHBOX-SECRET|444\.25|local-api-key/);
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
  assert.ok(urls.includes('http://10.10.0.250:60888/api/v1/camp/accountsales?dateexchange=2023-09-01'));
  assert.ok(!urls.includes('http://10.10.0.250:60888/api/v1/camp/accountsales&dateexchange=2023-09-01'));
});

test('does not redownload an oversized successful response with the legacy query syntax', async () => {
  const urls = [];
  const client = new CampSourceApiClient({
    enabled: true,
    baseUrls: ['http://10.10.0.250:60888'],
    apiKey: 'local-api-key-for-test-only',
  }, {
    fetchImpl: async url => {
      urls.push(url);
      return new Response('{}', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(6 * 1024 * 1024),
        },
      });
    },
  });

  await assert.rejects(
    client.fetchResource('cards', '/api/v1/camp/cards', '2023-09-01', { businessProjection: true }),
    /слишком большой/u,
  );
  assert.deepEqual(urls, [
    'http://10.10.0.250:60888/api/v1/camp/cards?dateexchange=2023-09-01',
  ]);
});

test('allows only the approved Dolphin CAMP origin over public plain HTTP', async () => {
  const requests = [];
  const config = normalizeCampSourceConfig({
    enabled: true,
    baseUrls: [
      'http://85.202.234.197:60888/untrusted-path?leak=yes',
      'http://203.0.113.7:60888',
      'https://public-api.example.test',
    ],
    apiKey: 'approved-vendor-key-for-test-only',
    initialDate: '2023-09-01',
  });
  const client = new CampSourceApiClient(config, {
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const result = await client.probe({
    timestamp: Date.parse('2023-09-01T10:00:00.000Z'),
    timezoneOffset: '+03:00',
  });
  assert.equal(result.status, 'diagnostic');
  assert.equal(config.enabled, true);
  assert.deepEqual(config.baseUrls, ['http://85.202.234.197:60888']);
  assert.ok(requests.length > 0);
  assert.ok(requests.every(request => request.url.startsWith('http://85.202.234.197:60888/')));
  assert.ok(requests.every(request => request.options.headers['X-API-Key'] === 'approved-vendor-key-for-test-only'));
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

test('recognizes every CAMP_ACCOUNTSALES metadata field without retaining row values', () => {
  const metadataFields = [
    'ID', 'IDACCOUNT', 'IDCARD', 'IDSERVICE', 'SUMMA', 'IDPOINTOFSALE', 'IDUSER', 'STATUS',
    'RECORDCOLOR', 'RECORDFONT', 'IDOWNER', 'IDINOWNER', 'DATEDOC', 'IDTYPESALE', 'DAYNO',
    'IDRSTACCOUNT', 'COMPUTERNAME', 'IDSALE', 'IDMAIN', 'IDHOTELACCOUNTPAYMENT', 'GUIDOPER',
    'IDCARDFORSERVICE', 'QUANTITY', 'ISEXTRATIME', 'IDPARENTDOC', 'KINDCHECK', 'IDSUBJECT',
    'QUANTITYSUM', 'DATEEXCHANGE',
  ];
  const row = Object.fromEntries(metadataFields.map((field, index) => [field, `secret-${index}-${field}`]));

  const profile = profileCampResponse({ accountSales: [row] });

  assert.equal(profile.containerPath, '$.accountSales');
  assert.equal(profile.rowCount, 1);
  assert.deepEqual(profile.schema.map(field => field.path).sort(), [...metadataFields].sort());
  assert.doesNotMatch(JSON.stringify(profile), /secret-/);
  assert.ok(profile.schema.every(field => !field.path.startsWith('FIELD_')));
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

test('redacts unknown container and field names so dynamic PII keys cannot leave the workstation', () => {
  const profile = profileCampResponse({
    'Иван Иванов': [{ ID: 41, 'Телефон клиента': '+7 999 000-00-00' }],
  });
  const serialized = JSON.stringify(profile);

  assert.doesNotMatch(serialized, /Иван Иванов|Телефон клиента|999 000/);
  assert.equal(profile.containerPath, '$.NODE_REDACTED');
  assert.ok(profile.schema.some(field => field.path === 'FIELD_REDACTED'));
});

const businessEndpoints = {
  cards: '/api/v1/camp/cards',
  skudAreas: '/api/v1/camp/skudareas',
  skudControllers: '/api/v1/camp/skudcontrollers',
  skudVerifyLogs: '/api/v1/camp/skudverifylogs',
  accountPayments: '/api/v1/camp/accountpayments',
};

function businessBody(url, overrides = {}) {
  const date = new URL(url).searchParams.get('dateexchange');
  if (url.includes('/accounts?')) return [{ ID: 10, ISSTAFF: 0, NAME: 'Иван Иванов' }];
  if (url.includes('/cards?')) return [{ ID: 20, ISSTAFFCARD: 0, SERIAL: 'CARD-SECRET' }];
  if (url.includes('/skudareas?')) return [{ ID: 1, STATUS: 0, KIND: 1, ISCHECKBALANCE: 1, NAME: 'Главный вход' }];
  if (url.includes('/skudcontrollers?')) {
    return [{ ID: 101, IDAREA: 1, READERIN: 1, READEROUT: 2, STATUS: 0, ADDRESS: 'SECRET' }];
  }
  if (url.includes('/skudverifylogs?')) {
    return [{
      DATEACTION: overrides.verifyDate || `${date} 09:00:00.000`,
      IDCONTROLLER: 101,
      IDREADER: 1,
      ISALLOW: 1,
      READERIN: 1,
      IDACCOUNT: 10,
      IDCARD: 20,
      STATUS: 0,
      GUESTNAME: 'Иван Иванов',
    }];
  }
  if (url.includes('/accountpayments?')) {
    return [{
      DATEDOC: overrides.paymentDate || `${date} 10:00:00.000`,
      SUMMA: 123.45,
      STATUS: 0,
      ISNOTFISCAL: 0,
      COMMENT: 'Телефон +7 999 555-44-33',
    }];
  }
  return [];
}

test('business collection projects only required fields for completed days and today', async () => {
  const requests = [];
  const client = new CampSourceApiClient({
    enabled: true,
    baseUrls: ['http://85.202.234.197:60888'],
    apiKey: 'local-api-key-for-test-only',
    business: { enabled: true, lookbackDays: 1, endpoints: businessEndpoints },
  }, {
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify(businessBody(url)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const result = await client.fetchBusinessResources({
    timestamp: Date.parse('2026-09-10T10:00:00.000Z'),
  });

  assert.equal(requests.length, 9);
  for (const resource of ['cards', 'skudareas', 'skudcontrollers']) {
    const matching = requests.filter(request => request.url.includes(`/camp/${resource}?`));
    assert.equal(matching.length, 1);
    assert.match(matching[0].url, /dateexchange=2023-09-01$/u);
  }
  assert.deepEqual({
    currentDate: result.currentDate,
    from: result.from,
    through: result.through,
    completeThrough: result.completeThrough,
  }, {
    currentDate: '2026-09-10',
    from: '2026-09-09',
    through: '2026-09-10',
    completeThrough: '2026-09-09',
  });
  assert.equal(result.resources.accountPayments.length, 2);
  assert.deepEqual(Object.keys(result.resources.accountPayments[0]).sort(), ['DATEDOC', 'ISNOTFISCAL', 'STATUS', 'SUMMA']);
  assert.deepEqual(Object.keys(result.resources.skudVerifyLogs[0]).sort(), [
    'DATEACTION', 'IDACCOUNT', 'IDCARD', 'IDCONTROLLER', 'IDREADER', 'ISALLOW', 'READERIN', 'STATUS',
  ]);
  assert.equal(result.quality.dateExchangeUsable, true);
  assert.deepEqual(result.quality.blockers, []);
  assert.equal(Object.keys(result.quality.resourceSchemaHashes).length, 6);
  assert.doesNotMatch(JSON.stringify(result), /Иван Иванов|CARD-SECRET|Телефон|SECRET/u);
});

test('business collection accepts cumulative transactional responses and keeps only each requested day', async () => {
  const client = new CampSourceApiClient({
    enabled: true,
    baseUrls: ['http://85.202.234.197:60888'],
    apiKey: 'local-api-key-for-test-only',
    business: { enabled: true, lookbackDays: 1, endpoints: businessEndpoints },
  }, {
    fetchImpl: async url => {
      const requestedDate = new URL(url).searchParams.get('dateexchange');
      let body = businessBody(url);
      if (requestedDate === '2026-09-09' && url.includes('/skudverifylogs?')) {
        body = [
          ...body,
          ...businessBody(url, { verifyDate: '2026-09-10 09:00:00.000' }),
        ];
      }
      if (requestedDate === '2026-09-09' && url.includes('/accountpayments?')) {
        body = [
          ...body,
          ...businessBody(url, { paymentDate: '2026-09-10 10:00:00.000' }),
        ];
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const result = await client.fetchBusinessResources({
    timestamp: Date.parse('2026-09-10T10:00:00.000Z'),
  });

  assert.deepEqual(result.resources.skudVerifyLogs.map(row => row.DATEACTION), [
    '2026-09-09 09:00:00.000',
    '2026-09-10 09:00:00.000',
  ]);
  assert.deepEqual(result.resources.accountPayments.map(row => row.DATEDOC), [
    '2026-09-09 10:00:00.000',
    '2026-09-10 10:00:00.000',
  ]);
  assert.deepEqual(result.quality.blockers, []);
});

test('business collection treats explicit empty arrays as available zero-row resources', async () => {
  const client = new CampSourceApiClient({
    enabled: true,
    baseUrls: ['http://85.202.234.197:60888'],
    apiKey: 'local-api-key-for-test-only',
    business: { enabled: true, lookbackDays: 1, endpoints: businessEndpoints },
  }, {
    fetchImpl: async () => new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  });

  const result = await client.fetchBusinessResources({
    timestamp: Date.parse('2026-09-10T10:00:00.000Z'),
  });

  assert.deepEqual(Object.keys(result.resources), [
    'accounts', 'cards', 'skudAreas', 'skudControllers', 'skudVerifyLogs', 'accountPayments',
  ]);
  assert.ok(Object.values(result.resources).every(rows => rows.length === 0));
  assert.equal(Object.keys(result.quality.resourceSchemaHashes).length, 6);
  assert.equal(result.quality.dateExchangeUsable, true);
  assert.deepEqual(result.quality.blockers, []);
});

test('a failed business method does not suppress later methods on the same CAMP origin', async () => {
  const requestedResources = [];
  const client = new CampSourceApiClient({
    enabled: true,
    baseUrls: ['http://85.202.234.197:60888'],
    apiKey: 'local-api-key-for-test-only',
    business: { enabled: true, lookbackDays: 1, endpoints: businessEndpoints },
  }, {
    fetchImpl: async url => {
      const resource = Object.entries(businessEndpoints)
        .find(([, endpoint]) => url.includes(endpoint))?.[0] || 'accounts';
      requestedResources.push(resource);
      if (resource === 'cards') throw new Error('simulated cards timeout');
      return new Response(JSON.stringify(businessBody(url)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const result = await client.fetchBusinessResources({
    timestamp: Date.parse('2026-09-10T10:00:00.000Z'),
  });

  assert.equal(Object.hasOwn(result.resources, 'cards'), false);
  assert.equal(Object.hasOwn(result.resources, 'skudAreas'), true);
  assert.equal(Object.hasOwn(result.resources, 'skudControllers'), true);
  assert.equal(Object.hasOwn(result.resources, 'skudVerifyLogs'), true);
  assert.equal(Object.hasOwn(result.resources, 'accountPayments'), true);
  assert.ok(requestedResources.indexOf('accountPayments') > requestedResources.indexOf('cards'));
  assert.ok(result.quality.blockers.includes('source-unavailable'));
  assert.ok(result.quality.blockers.includes('incomplete-resource'));
});

test('business collection fails closed when endpoints or schemas are missing', async () => {
  const withoutEndpoints = new CampSourceApiClient({
    enabled: true,
    baseUrls: ['http://85.202.234.197:60888'],
    apiKey: 'local-api-key-for-test-only',
    business: { enabled: true, lookbackDays: 1, endpoints: {} },
  }, { fetchImpl: async () => { throw new Error('must not request'); } });
  const missing = await withoutEndpoints.fetchBusinessResources({
    timestamp: Date.parse('2026-09-10T10:00:00.000Z'),
  });
  assert.deepEqual(missing.resources, {});
  assert.equal(missing.quality.dateExchangeUsable, false);
  assert.deepEqual(missing.quality.blockers, ['source-unavailable', 'incomplete-resource']);

  const incompleteSchema = new CampSourceApiClient({
    enabled: true,
    baseUrls: ['http://85.202.234.197:60888'],
    apiKey: 'local-api-key-for-test-only',
    business: { enabled: true, lookbackDays: 1, endpoints: businessEndpoints },
  }, {
    fetchImpl: async url => {
      const body = url.includes('/cards?') ? [{ ID: 20, SERIAL: 'CARD-SECRET' }] : businessBody(url);
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  const result = await incompleteSchema.fetchBusinessResources({
    timestamp: Date.parse('2026-09-10T10:00:00.000Z'),
  });
  assert.equal(Object.hasOwn(result.resources, 'cards'), false);
  assert.ok(result.quality.blockers.includes('incomplete-resource'));
  assert.doesNotMatch(JSON.stringify(result), /CARD-SECRET/u);
});

test('business collection rejects a transactional response outside its requested date', async () => {
  const client = new CampSourceApiClient({
    enabled: true,
    baseUrls: ['http://85.202.234.197:60888'],
    apiKey: 'local-api-key-for-test-only',
    business: { enabled: true, lookbackDays: 1, endpoints: businessEndpoints },
  }, {
    fetchImpl: async url => new Response(JSON.stringify(businessBody(url, {
      paymentDate: '2026-09-01 10:00:00.000',
    })), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  });

  const result = await client.fetchBusinessResources({
    timestamp: Date.parse('2026-09-10T10:00:00.000Z'),
  });
  assert.equal(Object.hasOwn(result.resources, 'accountPayments'), false);
  assert.equal(result.quality.dateExchangeUsable, false);
  assert.ok(result.quality.blockers.includes('incomplete-resource'));
});
