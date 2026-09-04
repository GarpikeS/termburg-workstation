import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stageWorkstationSiteSyncSecrets } from './workstation-site-sync-secrets.mjs';
import { stageWorkstationTestScheduleAuth } from './workstation-schedule-auth-secrets.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const generatedDirectory = path.join(repoRoot, 'workstation', 'generated');
const releaseDirectory = path.join(repoRoot, 'release', 'workstation-update');
const unpackedDirectory = path.join(repoRoot, 'release', 'workstation-update', 'win-unpacked');
const fullBuildUnpackedDirectory = path.join(repoRoot, 'release', 'workstation', 'win-unpacked');
const updateArtifactPattern = /^Termburg-Workstation-Update-(\d+)\.(\d+)\.(\d+)\.exe(?:\.sha256|\.blockmap)?$/;

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} завершился с кодом ${result.status}.`);
}

function runNodeScript(relativePath, args = []) {
  run(process.execPath, [path.join(repoRoot, relativePath), ...args]);
}

async function cleanupUpdateArtifacts(keepCount = 2) {
  let entries = [];
  try {
    entries = await fs.readdir(releaseDirectory);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const versions = new Map();
  for (const name of entries) {
    const match = name.match(updateArtifactPattern);
    if (!match) continue;
    const version = `${match[1]}.${match[2]}.${match[3]}`;
    const score = Number(match[1]) * 1_000_000 + Number(match[2]) * 1_000 + Number(match[3]);
    if (!versions.has(version)) versions.set(version, { score, files: [] });
    versions.get(version).files.push(name);
  }
  const keep = new Set([...versions.entries()]
    .sort((left, right) => right[1].score - left[1].score)
    .slice(0, keepCount)
    .map(([version]) => version));
  for (const [version, record] of versions) {
    if (keep.has(version)) continue;
    for (const name of record.files) await fs.rm(path.join(releaseDirectory, name), { force: true });
  }
}

try {
  await fs.rm(unpackedDirectory, { recursive: true, force: true });
  await fs.rm(fullBuildUnpackedDirectory, { recursive: true, force: true });
  await cleanupUpdateArtifacts();
  await fs.rm(generatedDirectory, { recursive: true, force: true });
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm --prefix frontend run build']);
  runNodeScript('scripts/run-workstation-tests.mjs');
  const siteSync = await stageWorkstationSiteSyncSecrets({ repoRoot, generatedDirectory });
  console.log(`Embedded schedule connections prepared for locations: ${siteSync.locationIds.join(', ')}.`);
  const testProfilePassword = String(process.env.TERMBURG_TEST_PROFILE_PASSWORD || '');
  if (testProfilePassword) {
    const scheduleAuth = await stageWorkstationTestScheduleAuth({
      generatedDirectory,
      password: testProfilePassword,
    });
    console.log(`Embedded hidden schedule access prepared for: ${scheduleAuth.managedAccounts.join(', ')}.`);
  }
  run(process.env.ComSpec || 'cmd.exe', [
    '/d',
    '/s',
    '/c',
    'electron-builder --config workstation/electron-builder.update.json --win --x64',
  ]);
  runNodeScript('scripts/test-workstation-packaged.mjs', [
    `--unpacked-directory=${unpackedDirectory}`,
    '--without-enrollment',
    ...(testProfilePassword ? ['--expected-auth-account=testtb'] : []),
  ]);
  runNodeScript('scripts/write-workstation-update-checksum.mjs');
  await cleanupUpdateArtifacts();
  console.log('Public Workstation update built with schedule site connections and without a Dolphin enrollment token.');
} finally {
  await fs.rm(generatedDirectory, { recursive: true, force: true });
}
