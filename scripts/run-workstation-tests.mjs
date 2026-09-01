import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const testFiles = [
  'workstation/github-updater.test.mjs',
  'workstation/migration.test.mjs',
  'workstation/status.test.mjs',
  'dolphin-agent/core/redemption-extractor.test.mjs',
  'dolphin-agent/core/source-api-client.test.mjs',
  'dolphin-agent/core/sync-agent.test.mjs',
  'dolphin-agent/core/server-client.test.mjs',
  'server/schedule-service.test.mjs',
  'server/wordpress-schedule.test.mjs',
];
const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: repoRoot,
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status || 1);
