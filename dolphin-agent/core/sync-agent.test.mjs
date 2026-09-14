import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readDolphinFile } from './file-readers.mjs';
import { createAgentStateStore } from './state-store.mjs';
import { DolphinSyncAgent } from './sync-agent.mjs';

test('scans a Dolphin CSV, sends once and keeps no duplicate queue entry', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'termburg-dolphin-agent-'));
  const csvFile = path.join(root, 'Штрихкоды за сегодня.csv');
  await writeFile(csvFile, [
    'Номер;Основание для льготы;Время входа',
    '0000160961;TB-B5FDD15D;18.08.2026 14:10',
    '0000160962;TB-EE185628;',
  ].join('\r\n'), 'utf8');
  const sent = [];
  let now = Date.now() + 10_000;
  const agent = new DolphinSyncAgent({
    stateStore: createAgentStateStore(path.join(root, 'state.json')),
    readFile: readDolphinFile,
    clientFactory: () => ({
      async send(rows) {
        sent.push(rows);
        return { results: rows.map(row => ({ ...row, status: sent.length === 1 ? 'redeemed' : 'already_redeemed' })) };
      },
    }),
    configProvider: async () => ({
      watchFolder: root,
      endpoint: 'https://tbgame.ru/api/integrations/dolphin/redemptions',
      timezoneOffset: '+03:00',
      deviceId: 'dolphin-test-device-0001',
    }),
    tokenProvider: async () => 'test-token-that-is-long-enough',
    logger: { info() {}, warn() {}, error() {} },
    now: () => now,
  });

  try {
    await agent.runOnce();
    assert.equal(sent.length, 1);
    assert.equal(sent[0][0].code, 'TB-B5FDD15D');
    assert.equal(agent.status().queueSize, 0);
    assert.equal(agent.status().redeemed, 1);

    now += 5 * 60 * 1000;
    await agent.runOnce();
    assert.equal(sent.length, 1);

    await agent.clearProcessedFiles();
    await agent.runOnce({ force: true });
    assert.equal(sent.length, 2);
    assert.equal(agent.status().alreadyRedeemed, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('checks the local API in diagnostic mode and reports heartbeat without redeeming', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'termburg-dolphin-api-diagnostic-'));
  const heartbeats = [];
  const sent = [];
  const agent = new DolphinSyncAgent({
    stateStore: createAgentStateStore(path.join(root, 'state.json')),
    readFile: readDolphinFile,
    clientFactory: () => ({
      async sourceConfig() {
        return { enabled: true, applyRedemptions: false, lookbackDays: 2 };
      },
      async heartbeat(_token, value) {
        heartbeats.push(value);
        return { ok: true };
      },
      async send(rows) {
        sent.push(rows);
        return { results: [] };
      },
    }),
    sourceClientFactory: () => ({
      async fetchRedemptions() {
        return {
          rows: [{ code: 'TB-B5FDD15D', redeemedAt: '2026-08-31T14:10:00+03:00', sourceRecordId: '1' }],
          schemaKeys: ['barcode', 'entry_time'],
          stats: { sourceRows: 12, redemptions: 1, skippedWithoutEntryTime: 0 },
          baseUrl: 'http://127.0.0.1:60888',
          applyRedemptions: false,
        };
      },
    }),
    configProvider: async () => ({
      watchFolder: root,
      endpoint: 'https://tbgame.ru/api/integrations/dolphin/redemptions',
      timezoneOffset: '+03:00',
      deviceId: 'dolphin-test-device-0002',
      appVersion: '1.1.0',
    }),
    tokenProvider: async () => 'test-token-that-is-long-enough',
    logger: { info() {}, warn() {}, error() {} },
  });

  try {
    await agent.runOnce();
    assert.equal(agent.status().sourceApi.status, 'diagnostic');
    assert.equal(agent.status().sourceApi.sourceRows, 12);
    assert.equal(agent.status().queueSize, 0);
    assert.equal(sent.length, 0);
    assert.equal(heartbeats.length, 1);
    assert.equal(heartbeats[0].sourceApi.status, 'diagnostic');
    assert.equal('apiKey' in heartbeats[0].sourceApi, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('applies each local API redemption only once after server activation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'termburg-dolphin-api-active-'));
  const sent = [];
  const serverClient = {
    async sourceConfig() { return { enabled: true, applyRedemptions: true, lookbackDays: 2 }; },
    async heartbeat() { return { ok: true }; },
    async send(rows) {
      sent.push(rows);
      return { results: rows.map(row => ({ ...row, status: 'redeemed' })) };
    },
  };
  const agent = new DolphinSyncAgent({
    stateStore: createAgentStateStore(path.join(root, 'state.json')),
    readFile: readDolphinFile,
    clientFactory: () => serverClient,
    sourceClientFactory: () => ({
      async fetchRedemptions() {
        return {
          rows: [{ code: 'TB-B5FDD15D', redeemedAt: '2026-08-31T14:10:00+03:00', sourceRecordId: '1' }],
          schemaKeys: ['barcode', 'entry_time'],
          stats: { sourceRows: 1, redemptions: 1, skippedWithoutEntryTime: 0 },
          baseUrl: 'http://127.0.0.1:60888',
          applyRedemptions: true,
        };
      },
    }),
    configProvider: async () => ({
      watchFolder: root,
      endpoint: 'https://tbgame.ru/api/integrations/dolphin/redemptions',
      timezoneOffset: '+03:00',
      deviceId: 'dolphin-test-device-0003',
      appVersion: '1.1.0',
    }),
    tokenProvider: async () => 'test-token-that-is-long-enough',
    logger: { info() {}, warn() {}, error() {} },
  });

  try {
    await agent.runOnce();
    await agent.runOnce();
    assert.equal(sent.length, 1);
    assert.equal(agent.status().redeemed, 1);
    assert.equal(agent.status().queueSize, 0);
    assert.equal(agent.status().sourceApi.status, 'active');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('probes CAMP once per day and reports only the diagnostic profile in heartbeat', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'termburg-camp-api-diagnostic-'));
  const heartbeats = [];
  const receivedConfigs = [];
  let probeCount = 0;
  let now = Date.parse('2026-09-14T10:00:00.000Z');
  const sourceConfig = {
    enabled: false,
    baseUrls: ['http://10.10.0.250:60888'],
    apiKey: 'local-api-key-for-test-only',
    camp: {
      enabled: true,
      initialDate: '2023-09-01',
      endpoints: {
        guestTypes: '/api/v1/camp/guesttypes',
        services: '/api/v1/camp/services',
        accounts: '/api/v1/camp/accounts',
      },
    },
  };
  const agent = new DolphinSyncAgent({
    stateStore: createAgentStateStore(path.join(root, 'state.json')),
    readFile: readDolphinFile,
    clientFactory: () => ({
      async sourceConfig() { return sourceConfig; },
      async heartbeat(_token, value) {
        heartbeats.push(value);
        return { ok: true };
      },
    }),
    campClientFactory: config => {
      receivedConfigs.push(config);
      return {
        async probe() {
          probeCount += 1;
          return {
            status: 'diagnostic',
            initialDate: '2023-09-01',
            currentDate: '2026-09-14',
            resources: {
              guestTypes: {
                status: 'ok',
                probes: [{ dateExchange: '2023-09-01', rowCount: 182, schemaHash: 'a'.repeat(64), schema: [] }],
                errors: [],
              },
              services: { status: 'ok', probes: [], errors: [] },
              accounts: { status: 'ok', probes: [], errors: [] },
            },
          };
        },
      };
    },
    configProvider: async () => ({
      watchFolder: root,
      endpoint: 'https://tbgame.ru/api/integrations/dolphin/redemptions',
      timezoneOffset: '+03:00',
      deviceId: 'dolphin-test-device-camp-0001',
      appVersion: '1.1.12',
    }),
    tokenProvider: async () => 'test-token-that-is-long-enough',
    logger: { info() {}, warn() {}, error() {} },
    now: () => now,
  });

  try {
    await agent.runOnce();
    now += 5 * 60 * 1000;
    await agent.runOnce();

    assert.equal(probeCount, 1);
    assert.equal(receivedConfigs[0].apiKey, 'local-api-key-for-test-only');
    assert.equal(receivedConfigs[0].initialDate, '2023-09-01');
    assert.equal(agent.status().campApi.status, 'diagnostic');
    assert.equal(heartbeats.length, 2);
    assert.equal(heartbeats[1].campApi.resources.guestTypes.probes[0].rowCount, 182);
    assert.equal('apiKey' in heartbeats[1].campApi, false);
    assert.doesNotMatch(JSON.stringify(heartbeats[1].campApi), /local-api-key/);

    now += 24 * 60 * 60 * 1000;
    await agent.runOnce();
    assert.equal(probeCount, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('does not hammer CAMP after a partial diagnostic result', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'termburg-camp-api-partial-'));
  let probeCount = 0;
  let now = Date.parse('2026-09-14T10:00:00.000Z');
  const agent = new DolphinSyncAgent({
    stateStore: createAgentStateStore(path.join(root, 'state.json')),
    readFile: readDolphinFile,
    clientFactory: () => ({
      async sourceConfig() {
        return {
          baseUrls: ['http://10.10.0.250:60888'],
          apiKey: 'local-api-key-for-test-only',
          camp: { enabled: true, initialDate: '2023-09-01', endpoints: {} },
        };
      },
      async heartbeat() { return { ok: true }; },
    }),
    campClientFactory: () => ({
      async probe() {
        probeCount += 1;
        return {
          status: 'partial',
          initialDate: '2023-09-01',
          currentDate: '2026-09-14',
          resources: {
            guestTypes: { status: 'ok', probes: [], errors: [] },
            services: { status: 'error', probes: [], errors: ['CAMP API не ответил за 10 секунд.'] },
            accounts: { status: 'ok', probes: [], errors: [] },
          },
        };
      },
    }),
    configProvider: async () => ({
      watchFolder: root,
      endpoint: 'https://tbgame.ru/api/integrations/dolphin/redemptions',
      timezoneOffset: '+03:00',
      deviceId: 'dolphin-test-device-camp-0002',
      appVersion: '1.1.12',
    }),
    tokenProvider: async () => 'test-token-that-is-long-enough',
    logger: { info() {}, warn() {}, error() {} },
    now: () => now,
  });

  try {
    await agent.runOnce();
    now += 5 * 60 * 1000;
    await agent.runOnce();
    assert.equal(probeCount, 1);
    assert.equal(agent.status().campApi.status, 'partial');

    await agent.runOnce({ forceCamp: true });
    assert.equal(probeCount, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
