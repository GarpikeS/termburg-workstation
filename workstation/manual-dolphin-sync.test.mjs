import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

test('manual Workstation check forces CAMP diagnostics and business aggregates', async () => {
  const source = await readFile(path.join(repoRoot, 'desktop', 'main.mjs'), 'utf8');
  const handler = source.match(/async function runDolphinNow\(\) \{[\s\S]*?\n\}/)?.[0] || '';

  assert.match(handler, /runOnce\(\{\s*forceCamp:\s*true,\s*forceBusiness:\s*true\s*\}\)/);
});
