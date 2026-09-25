import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateCampBusinessDays } from './camp-business-aggregator.mjs';

const visitorMetadata = () => ({
  accounts: [
    { ID: 10, ISSTAFF: 0 },
    { ID: 11, ISSTAFF: 0 },
    { ID: 12, ISSTAFF: 1 },
  ],
  cards: [
    { ID: 20, ISSTAFFCARD: 0 },
    { ID: 21, ISSTAFFCARD: null },
    { ID: 22, ISSTAFFCARD: 0 },
  ],
  skudAreas: [
    { ID: 1, STATUS: 0, KIND: 1, ISCHECKBALANCE: 1 },
    { ID: 2, STATUS: 0, KIND: 5, ISCHECKBALANCE: 0 },
  ],
  skudControllers: [
    { ID: 101, IDAREA: 1, READERIN: 1, READEROUT: 2, STATUS: 0 },
    { ID: 102, IDAREA: 2, READERIN: 1, READEROUT: 2, STATUS: 0 },
  ],
});

const entry = (overrides = {}) => ({
  DATEACTION: '2026-09-09 09:00:00.000',
  IDCONTROLLER: 101,
  IDREADER: 1,
  ISALLOW: 1,
  READERIN: 1,
  IDACCOUNT: 10,
  IDCARD: 20,
  STATUS: 0,
  ...overrides,
});

test('aggregates unique guests and fiscal payments, including negative refunds', () => {
  const resources = {
    ...visitorMetadata(),
    skudVerifyLogs: [
      entry(),
      entry({ DATEACTION: '2026-09-09 09:01:00.000' }),
      entry({ DATEACTION: '2026-09-09 09:02:00.000', IDACCOUNT: 11, IDCARD: 21 }),
      entry({ DATEACTION: '2026-09-09 09:03:00.000', IDACCOUNT: 12, IDCARD: 22 }),
      entry({ DATEACTION: '2026-09-09 09:04:00.000', IDCONTROLLER: 102 }),
      entry({ DATEACTION: '2026-09-09 09:05:00.000', ISALLOW: 0 }),
    ],
    accountPayments: [
      { DATEDOC: '2026-09-09 10:00:00.000', SUMMA: 100.1, STATUS: 0, ISNOTFISCAL: 0 },
      { DATEDOC: '2026-09-09 11:00:00.000', SUMMA: -20.05, STATUS: 0, ISNOTFISCAL: 0 },
      { DATEDOC: '2026-09-09 12:00:00.000', SUMMA: 500, STATUS: 0, ISNOTFISCAL: 1 },
      { DATEDOC: '2026-09-09 13:00:00.000', SUMMA: 700, STATUS: 1, ISNOTFISCAL: 0 },
    ],
  };

  const result = aggregateCampBusinessDays(resources, {
    currentDate: '2026-09-10',
    from: '2026-09-09',
    through: '2026-09-09',
    dateExchangeUsable: true,
    resourceSchemaHashes: { accountPayments: 'A'.repeat(64) },
  });

  assert.deepEqual(result, {
    days: [{
      date: '2026-09-09',
      uniqueVisitors: 2,
      visitorStatus: 'complete',
      fiscalRevenueKopecks: 8005,
      revenueStatus: 'complete',
      fiscalPaymentRows: 2,
    }],
    quality: {
      dateExchangeUsable: true,
      blockers: [],
      resourceSchemaHashes: { accountPayments: 'a'.repeat(64) },
    },
  });
  assert.doesNotMatch(JSON.stringify(result), /101|10:20|11:21/u);
});

test('distinguishes a missing resource from a valid empty resource', () => {
  const metadata = visitorMetadata();
  const missing = aggregateCampBusinessDays({
    accounts: metadata.accounts,
    skudAreas: metadata.skudAreas,
    skudControllers: metadata.skudControllers,
    skudVerifyLogs: [],
  }, {
    currentDate: '2026-09-10',
    from: '2026-09-09',
    through: '2026-09-09',
  });
  assert.deepEqual(missing.days[0], {
    date: '2026-09-09',
    uniqueVisitors: null,
    visitorStatus: 'blocked',
    fiscalRevenueKopecks: null,
    revenueStatus: 'blocked',
    fiscalPaymentRows: 0,
  });
  assert.deepEqual(missing.quality.blockers, ['incomplete-resource']);

  const empty = aggregateCampBusinessDays({
    accounts: [],
    cards: [],
    skudAreas: metadata.skudAreas,
    skudControllers: metadata.skudControllers,
    skudVerifyLogs: [],
    accountPayments: [],
  }, {
    currentDate: '2026-09-10',
    from: '2026-09-09',
    through: '2026-09-09',
  });
  assert.deepEqual(empty.days[0], {
    date: '2026-09-09',
    uniqueVisitors: 0,
    visitorStatus: 'complete',
    fiscalRevenueKopecks: 0,
    revenueStatus: 'complete',
    fiscalPaymentRows: 0,
  });
  assert.deepEqual(empty.quality.blockers, []);
});

test('publishes fiscal revenue even when a visitor reference resource is unavailable', () => {
  const metadata = visitorMetadata();
  const result = aggregateCampBusinessDays({
    accounts: metadata.accounts,
    skudAreas: metadata.skudAreas,
    skudControllers: metadata.skudControllers,
    skudVerifyLogs: [entry()],
    accountPayments: [
      { DATEDOC: '2026-09-09 10:00:00.000', SUMMA: 123.45, STATUS: 0, ISNOTFISCAL: 0 },
    ],
  }, {
    currentDate: '2026-09-10',
    from: '2026-09-09',
    through: '2026-09-09',
  });

  assert.equal(result.days[0].uniqueVisitors, null);
  assert.equal(result.days[0].visitorStatus, 'blocked');
  assert.equal(result.days[0].fiscalRevenueKopecks, 12_345);
  assert.equal(result.days[0].revenueStatus, 'complete');
  assert.ok(result.quality.blockers.includes('incomplete-resource'));
});

test('blocks only the affected visitor day when a controller cannot be resolved', () => {
  const result = aggregateCampBusinessDays({
    ...visitorMetadata(),
    skudVerifyLogs: [
      entry({ DATEACTION: '2026-09-08 09:00:00.000' }),
      entry({ DATEACTION: '2026-09-09 09:00:00.000', IDCONTROLLER: 999 }),
    ],
    accountPayments: [],
  }, {
    currentDate: '2026-09-10',
    from: '2026-09-08',
    through: '2026-09-09',
  });

  assert.deepEqual(result.days.map(day => ({ date: day.date, value: day.uniqueVisitors, status: day.visitorStatus })), [
    { date: '2026-09-08', value: 1, status: 'complete' },
    { date: '2026-09-09', value: null, status: 'blocked' },
  ]);
  assert.deepEqual(result.quality.blockers, ['unresolved-controller-events']);
});

test('fails closed on unresolved staff while a positive staff flag safely excludes the event', () => {
  const metadata = visitorMetadata();
  const result = aggregateCampBusinessDays({
    ...metadata,
    accounts: [...metadata.accounts, { ID: 13, ISSTAFF: 0 }],
    cards: [...metadata.cards, { ID: 23, ISSTAFFCARD: 1 }],
    skudVerifyLogs: [
      entry({ DATEACTION: '2026-09-08 09:00:00.000', IDACCOUNT: 13, IDCARD: 23 }),
      entry({ DATEACTION: '2026-09-08 09:01:00.000', IDACCOUNT: 999, IDCARD: 20 }),
    ],
    accountPayments: [],
  }, {
    currentDate: '2026-09-10',
    from: '2026-09-08',
    through: '2026-09-08',
  });

  assert.equal(result.days[0].visitorStatus, 'blocked');
  assert.equal(result.days[0].uniqueVisitors, null);
  assert.deepEqual(result.quality.blockers, ['unresolved-staff-events']);
});

test('always marks the current day incomplete and withholds partial values', () => {
  const result = aggregateCampBusinessDays({
    ...visitorMetadata(),
    skudVerifyLogs: [entry({ DATEACTION: '2026-09-10 09:00:00.000' })],
    accountPayments: [
      { DATEDOC: '2026-09-10 10:00:00.000', SUMMA: -12.34, STATUS: 0, ISNOTFISCAL: 0 },
    ],
  }, {
    currentDate: '2026-09-10',
    from: '2026-09-10',
    through: '2026-09-10',
  });

  assert.deepEqual(result.days[0], {
    date: '2026-09-10',
    uniqueVisitors: null,
    visitorStatus: 'incomplete',
    fiscalRevenueKopecks: null,
    revenueStatus: 'incomplete',
    fiscalPaymentRows: 1,
  });
});

test('supports normalized camelCase projections and blocks malformed fiscal rows', () => {
  const result = aggregateCampBusinessDays({
    accounts: [{ id: 10, isStaff: false }],
    cards: [{ id: 20, isStaffCard: false }],
    skudAreas: [{ id: 1, status: 0, kind: 1, isCheckBalance: 1 }],
    skudControllers: [{ id: 101, idArea: 1, readerIn: 1, readerOut: 2, status: 0 }],
    skudVerifyLogs: [{
      dateAction: '2026-09-09T09:00:00',
      idController: 101,
      idReader: 1,
      isAllow: true,
      readerIn: 1,
      idAccount: 10,
      idCard: 20,
      status: 0,
    }],
    accountPayments: [{
      dateDoc: '2026-09-09T10:00:00',
      summa: 'not-a-number',
      status: 0,
      isNotFiscal: 0,
    }],
  }, {
    currentDate: '2026-09-10',
    from: '2026-09-09',
    through: '2026-09-09',
  });

  assert.equal(result.days[0].uniqueVisitors, 1);
  assert.equal(result.days[0].visitorStatus, 'complete');
  assert.equal(result.days[0].fiscalRevenueKopecks, null);
  assert.equal(result.days[0].revenueStatus, 'blocked');
  assert.deepEqual(result.quality.blockers, ['incomplete-resource']);
});

test('rejects windows that cannot fit the upload contract', () => {
  assert.throws(() => aggregateCampBusinessDays({}, {
    currentDate: '2026-09-10',
    from: '2026-07-01',
    through: '2026-09-10',
  }), /between 1 and 62/u);
});
