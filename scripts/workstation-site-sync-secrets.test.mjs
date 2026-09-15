import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { stageWorkstationSiteSyncSecrets } from './workstation-site-sync-secrets.mjs';

const connection = (complexCode, endpoint) => ({
  endpoint,
  authMode: 'bearer',
  complexCode,
  token: `synthetic-token-for-${complexCode}-1234567890`,
});

test('stages only the selected Moscow schedule connection', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-site-secrets-'));
  const previousSource = process.env.TERMBURG_SITE_SYNC_FILE;
  try {
    const sourceFile = path.join(root, 'site-sync.json');
    const generatedDirectory = path.join(root, 'generated');
    await fs.writeFile(sourceFile, JSON.stringify({
      locations: {
        1: connection('moscow', 'https://termburg.ru/wp-json/termburg/v1/schedule/import'),
        2: connection('zelenogorsk', 'https://termburg45.ru/wp-json/termburg/v1/schedule/import'),
      },
    }), 'utf8');
    process.env.TERMBURG_SITE_SYNC_FILE = sourceFile;
    const result = await stageWorkstationSiteSyncSecrets({
      repoRoot: root,
      generatedDirectory,
      locationIds: ['1'],
    });
    const stored = JSON.parse(await fs.readFile(result.outputFile, 'utf8'));
    assert.deepEqual(result.locationIds, ['1']);
    assert.equal(stored.replaceLocations, true);
    assert.deepEqual(Object.keys(stored.locations), ['1']);
    assert.equal(stored.locations['1'].complexCode, 'moscow');
    assert.equal(stored.locations['2'], undefined);
  } finally {
    if (previousSource === undefined) delete process.env.TERMBURG_SITE_SYNC_FILE;
    else process.env.TERMBURG_SITE_SYNC_FILE = previousSource;
    await fs.rm(root, { recursive: true, force: true });
  }
});
