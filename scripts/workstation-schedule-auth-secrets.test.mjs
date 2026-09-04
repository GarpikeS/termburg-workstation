import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  stageWorkstationScheduleAuth,
  stageWorkstationScheduleAuthCleanup,
} from './workstation-schedule-auth-secrets.mjs';

const storedAccount = (username, locationId) => ({
  username,
  locationId,
  salt: 'synthetic-salt',
  hash: 'synthetic-derived-password-hash',
  scrypt: { N: 1024, r: 8, p: 1, maxmem: 16_777_216, keyLength: 64 },
});

test('stages a cleanup directive without embedding any password or account hash', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-auth-cleanup-'));
  try {
    const result = await stageWorkstationScheduleAuthCleanup({ generatedDirectory: root });
    const content = await fs.readFile(result.outputFile, 'utf8');
    const stored = JSON.parse(content);
    assert.deepEqual(stored.managedAccounts, []);
    assert.deepEqual(stored.removeAccounts, ['testtb']);
    assert.deepEqual(stored.accounts, {});
    assert.equal(content.includes('password'), false);
    assert.equal(content.includes('hash'), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('stages only protected schedule credentials for the selected complex', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-auth-secrets-'));
  try {
    const sourceFile = path.join(root, 'source.json');
    const generatedDirectory = path.join(root, 'generated');
    await fs.writeFile(sourceFile, JSON.stringify({
      schemaVersion: 1,
      password: 'synthetic-plaintext-must-not-be-copied',
      accounts: {
        moscow: storedAccount('moscow', '1'),
        zelenogorsk: storedAccount('zelenogorsk', '2'),
      },
    }), 'utf8');
    const result = await stageWorkstationScheduleAuth({
      generatedDirectory,
      managedAccount: 'zelenogorsk',
      sourceFile,
    });
    const content = await fs.readFile(result.outputFile, 'utf8');
    const stored = JSON.parse(content);
    assert.deepEqual(stored.managedAccounts, ['zelenogorsk']);
    assert.equal(content.includes('synthetic-plaintext-must-not-be-copied'), false);
    assert.equal(stored.accounts.zelenogorsk.hash, 'synthetic-derived-password-hash');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
