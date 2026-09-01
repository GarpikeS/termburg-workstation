import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stageWorkstationSiteSyncSecrets } from './workstation-site-sync-secrets.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const generatedDirectory = path.join(repoRoot, 'workstation', 'generated');
const unpackedDirectory = path.join(repoRoot, 'release', 'workstation-update', 'win-unpacked');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} завершился с кодом ${result.status}.`);
}

function runNodeScript(relativePath, args = []) {
  run(process.execPath, [path.join(repoRoot, relativePath), ...args]);
}

try {
  await fs.rm(generatedDirectory, { recursive: true, force: true });
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm --prefix frontend run build']);
  runNodeScript('scripts/run-workstation-tests.mjs');
  const siteSync = await stageWorkstationSiteSyncSecrets({ repoRoot, generatedDirectory });
  console.log(`Embedded schedule connections prepared for locations: ${siteSync.locationIds.join(', ')}.`);
  run(process.env.ComSpec || 'cmd.exe', [
    '/d',
    '/s',
    '/c',
    'electron-builder --config workstation/electron-builder.update.json --win --x64',
  ]);
  runNodeScript('scripts/test-workstation-packaged.mjs', [
    `--unpacked-directory=${unpackedDirectory}`,
    '--without-enrollment',
  ]);
  runNodeScript('scripts/write-workstation-update-checksum.mjs');
  console.log('Public Workstation update built with schedule site connections and without a Dolphin enrollment token.');
} finally {
  await fs.rm(generatedDirectory, { recursive: true, force: true });
}
