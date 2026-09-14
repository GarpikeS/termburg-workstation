import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createAgentStateStore,
  createDefaultAgentState,
} from './state-store.mjs';

test('loading a pre-accountSales state does not synthesize a false resource error', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'termburg-camp-state-migration-'));
  const stateFile = path.join(root, 'state.json');
  const legacyState = createDefaultAgentState();
  legacyState.campApi = {
    ...legacyState.campApi,
    status: 'diagnostic',
    lastAttemptAt: 1_789_380_000_000,
    resources: {
      guestTypes: { status: 'ok', probes: [], errors: [] },
      services: { status: 'ok', probes: [], errors: [] },
      accounts: { status: 'ok', probes: [], errors: [] },
    },
  };

  try {
    await fs.writeFile(stateFile, JSON.stringify(legacyState), 'utf8');
    const loaded = await createAgentStateStore(stateFile).load();

    assert.equal(loaded.campApi.status, 'diagnostic');
    assert.equal(Object.hasOwn(loaded.campApi.resources, 'accountSales'), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('persisting diagnostic state keeps only allowlisted fields and no CAMP values', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'termburg-camp-state-privacy-'));
  const stateFile = path.join(root, 'state.json');
  const state = createDefaultAgentState();
  state.apiKey = 'root-secret-key';
  state.sourceApi.apiKey = 'source-secret-key';
  state.campApi.apiKey = 'camp-secret-key';
  state.campApi.lastError = 'Ошибка для клиента Иван Иванов, телефон +7 999 555-44-33';
  state.campApi.resources = {
    accountSales: {
      status: 'ok',
      apiKey: 'resource-secret-key',
      probes: [{
        dateExchange: '2026-09-14',
        baseUrl: 'http://10.10.0.250:60888',
        queryStyle: 'standard',
        payloadType: 'array',
        containerPath: '$.accountSales',
        rowCount: 1,
        profiledRows: 1,
        schemaHash: 'a'.repeat(64),
        schema: [
          { path: 'SUMMA', types: ['number'], observed: 1, nulls: 0, value: 444.25 },
          { path: 'Имя клиента', types: ['string'], observed: 1, nulls: 0 },
        ],
        rawRows: [{ SUMMA: 444.25, DESCRIPTION: 'Иван Иванов' }],
      }],
      errors: ['CAMP API вернул данные клиента Иван Иванов, телефон +7 999 555-44-33'],
    },
    unexpectedResource: { rawRows: ['private-value'] },
  };

  try {
    const stored = await createAgentStateStore(stateFile).save(state);
    const serialized = await fs.readFile(stateFile, 'utf8');

    assert.deepEqual(stored.campApi.resources.accountSales.probes[0].schema, [{
      path: 'SUMMA',
      types: ['number'],
      observed: 1,
      nulls: 0,
    }]);
    assert.equal('baseUrl' in stored.campApi.resources.accountSales.probes[0], false);
    assert.equal(stored.campApi.lastError, 'Ошибка CAMP API без безопасного описания.');
    assert.deepEqual(stored.campApi.resources.accountSales.errors, ['Ошибка CAMP API без безопасного описания.']);
    assert.equal(Object.hasOwn(stored.campApi.resources, 'unexpectedResource'), false);
    assert.doesNotMatch(serialized, /root-secret|source-secret|camp-secret|resource-secret|444\.25|79995554433|Иван Иванов|Имя клиента|private-value|rawRows/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
