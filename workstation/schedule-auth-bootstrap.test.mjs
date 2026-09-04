import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { applyEmbeddedScheduleAuthDefaults } from './schedule-auth-bootstrap.mjs';

const account = (username, marker) => ({
  username,
  locationId: username === 'zelenogorsk' ? '2' : '1',
  salt: `salt-${marker}`,
  hash: `hash-${marker}`,
  scrypt: { N: 1024, r: 8, p: 1, maxmem: 16_777_216, keyLength: 64 },
});

test('public update adds the hidden test account without replacing complex passwords', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-auth-bootstrap-'));
  try {
    const embeddedFile = path.join(root, 'embedded.json');
    const targetFile = path.join(root, 'schedule-auth.json');
    await fs.writeFile(embeddedFile, JSON.stringify({
      schemaVersion: 1,
      managedAccounts: ['testtb'],
      accounts: { testtb: account('testtb', 'embedded') },
    }), 'utf8');
    await fs.writeFile(targetFile, JSON.stringify({
      schemaVersion: 1,
      accounts: { moscow: account('moscow', 'existing'), zelenogorsk: account('zelenogorsk', 'existing') },
    }), 'utf8');

    const result = await applyEmbeddedScheduleAuthDefaults({
      embeddedFile,
      targetFile,
      logger: { info() {} },
    });
    const stored = JSON.parse(await fs.readFile(targetFile, 'utf8'));
    assert.equal(result.applied, true);
    assert.deepEqual(result.managedAccounts, ['testtb']);
    assert.equal(stored.accounts.moscow.hash, 'hash-existing');
    assert.equal(stored.accounts.zelenogorsk.hash, 'hash-existing');
    assert.equal(stored.accounts.testtb.hash, 'hash-embedded');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('optional hidden account waits until the main schedule access is configured', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-auth-bootstrap-'));
  try {
    const embeddedFile = path.join(root, 'embedded.json');
    const targetFile = path.join(root, 'schedule-auth.json');
    await fs.writeFile(embeddedFile, JSON.stringify({
      schemaVersion: 1,
      managedAccounts: ['testtb'],
      accounts: { testtb: account('testtb', 'embedded') },
    }), 'utf8');

    const result = await applyEmbeddedScheduleAuthDefaults({
      embeddedFile,
      targetFile,
      logger: { info() {} },
    });
    assert.deepEqual(result, {
      embedded: true,
      applied: false,
      managedAccounts: ['testtb'],
      reason: 'target-unconfigured',
    });
    await assert.rejects(fs.access(targetFile));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('Greenogorsk package replaces only the Greenogorsk schedule account', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-auth-bootstrap-'));
  try {
    const embeddedFile = path.join(root, 'embedded.json');
    const targetFile = path.join(root, 'schedule-auth.json');
    await fs.writeFile(embeddedFile, JSON.stringify({
      schemaVersion: 1,
      managedAccounts: ['zelenogorsk'],
      accounts: { moscow: account('moscow', 'embedded'), zelenogorsk: account('zelenogorsk', 'embedded') },
    }), 'utf8');
    await fs.writeFile(targetFile, JSON.stringify({
      schemaVersion: 1,
      accounts: { moscow: account('moscow', 'existing'), zelenogorsk: account('zelenogorsk', 'existing') },
    }), 'utf8');
    const result = await applyEmbeddedScheduleAuthDefaults({
      embeddedFile,
      targetFile,
      logger: { info() {} },
    });
    const stored = JSON.parse(await fs.readFile(targetFile, 'utf8'));
    assert.deepEqual(result.managedAccounts, ['zelenogorsk']);
    assert.equal(stored.accounts.moscow.hash, 'hash-existing');
    assert.equal(stored.accounts.zelenogorsk.hash, 'hash-embedded');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('missing embedded authentication leaves the target untouched', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-auth-bootstrap-'));
  try {
    const targetFile = path.join(root, 'schedule-auth.json');
    const original = '{"schemaVersion":1,"accounts":{}}';
    await fs.writeFile(targetFile, original, 'utf8');
    const result = await applyEmbeddedScheduleAuthDefaults({
      embeddedFile: path.join(root, 'missing.json'),
      targetFile,
      logger: { info() {} },
    });
    assert.equal(result.applied, false);
    assert.equal(await fs.readFile(targetFile, 'utf8'), original);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
