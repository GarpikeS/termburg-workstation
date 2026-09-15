import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createScheduleAuth } from './schedule-auth.mjs';

const testScrypt = { N: 1024, r: 8, p: 1, maxmem: 16 * 1024 * 1024 };

test('a location-scoped store is configured and accepts its only account', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-schedule-auth-scoped-'));
  try {
    const authFile = path.join(root, 'schedule-auth.json');
    const setupAuth = createScheduleAuth({ authFile, scryptOptions: testScrypt });
    await setupAuth.setup({
      moscowPassword: 'Moscow-pass-2026',
      zelenogorskPassword: 'Zelenogorsk-pass-2026',
    });
    const fullStore = JSON.parse(await fs.readFile(authFile, 'utf8'));
    await fs.writeFile(authFile, JSON.stringify({
      ...fullStore,
      accounts: { moscow: fullStore.accounts.moscow },
    }), 'utf8');

    const scopedAuth = createScheduleAuth({ authFile, scryptOptions: testScrypt });
    await scopedAuth.ready;
    const status = await scopedAuth.status({ headers: {} });
    assert.equal(status.configured, true);

    const login = await scopedAuth.login({ username: 'moscow', password: 'Moscow-pass-2026' }, '127.0.0.1');
    assert.deepEqual(login.user, { username: 'moscow', locationId: '1' });
    await assert.rejects(
      scopedAuth.login({ username: 'zelenogorsk', password: 'Zelenogorsk-pass-2026' }, '127.0.0.1'),
      error => error?.code === 'AUTH_INVALID_CREDENTIALS' && error?.status === 401,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('production startup removes a persisted test account and refuses its login', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-schedule-auth-test-cleanup-'));
  try {
    const authFile = path.join(root, 'schedule-auth.json');
    const legacyAuth = createScheduleAuth({
      authFile,
      scryptOptions: testScrypt,
      testProfile: { username: 'testtb', password: '2026', locationId: 'test', version: 1 },
    });
    await legacyAuth.setup({
      moscowPassword: 'Moscow-pass-2026',
      zelenogorskPassword: 'Zelenogorsk-pass-2026',
    });
    assert.ok(JSON.parse(await fs.readFile(authFile, 'utf8')).accounts.testtb);

    const productionAuth = createScheduleAuth({ authFile, scryptOptions: testScrypt });
    await productionAuth.ready;
    const cleaned = JSON.parse(await fs.readFile(authFile, 'utf8'));
    assert.equal(cleaned.accounts.testtb, undefined);
    assert.equal(cleaned.managedTestProfileVersion, undefined);
    await assert.rejects(
      productionAuth.login({ username: 'testtb', password: '2026' }, '127.0.0.1'),
      error => error?.code === 'AUTH_INVALID_CREDENTIALS' && error?.status === 401,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
