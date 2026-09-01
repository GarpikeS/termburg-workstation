import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { applyEmbeddedSiteSyncDefaults } from './site-sync-bootstrap.mjs';

const embedded = {
  version: 1,
  locations: {
    1: {
      endpoint: 'https://termburg.ru/wp-json/termburg/v1/schedule/import',
      authMode: 'bearer',
      complexCode: 'moscow',
      token: 'test-token-for-moscow-123456',
    },
    2: {
      endpoint: 'https://termburg45.ru/wp-json/termburg/v1/schedule/import',
      authMode: 'bearer',
      complexCode: 'zelenogorsk',
      token: 'test-token-for-zelenogorsk-123456',
    },
  },
};

test('embedded connections create a ready site-sync store', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-site-sync-'));
  try {
    const embeddedFile = path.join(root, 'embedded.json');
    const targetFile = path.join(root, 'profile', 'site-sync.json');
    await fs.writeFile(embeddedFile, JSON.stringify(embedded), 'utf8');
    const result = await applyEmbeddedSiteSyncDefaults({
      embeddedFile,
      targetFile,
      logger: { info() {}, warn() {} },
    });
    const stored = JSON.parse(await fs.readFile(targetFile, 'utf8'));
    assert.deepEqual(result.locationIds, ['1', '2']);
    assert.equal(stored.locations['1'].token, embedded.locations['1'].token);
    assert.equal(stored.locations['2'].token, embedded.locations['2'].token);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('embedded connections replace stale tokens and preserve publication history', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-site-sync-'));
  try {
    const embeddedFile = path.join(root, 'embedded.json');
    const targetFile = path.join(root, 'site-sync.json');
    await fs.writeFile(embeddedFile, JSON.stringify(embedded), 'utf8');
    await fs.writeFile(targetFile, JSON.stringify({
      locations: {
        1: { token: 'stale-token-that-is-long-enough', lastPublishedAt: '2026-08-31T12:00:00.000Z' },
      },
    }), 'utf8');
    await applyEmbeddedSiteSyncDefaults({ embeddedFile, targetFile, logger: { info() {}, warn() {} } });
    const stored = JSON.parse(await fs.readFile(targetFile, 'utf8'));
    assert.equal(stored.locations['1'].token, embedded.locations['1'].token);
    assert.equal(stored.locations['1'].lastPublishedAt, '2026-08-31T12:00:00.000Z');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('missing embedded connections leave the profile untouched', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-site-sync-'));
  try {
    const targetFile = path.join(root, 'site-sync.json');
    const original = '{"locations":{"1":{"token":"existing-token-value-123456"}}}';
    await fs.writeFile(targetFile, original, 'utf8');
    const result = await applyEmbeddedSiteSyncDefaults({
      embeddedFile: path.join(root, 'missing.json'),
      targetFile,
      logger: { info() {}, warn() {} },
    });
    assert.equal(result.applied, false);
    assert.equal(await fs.readFile(targetFile, 'utf8'), original);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
