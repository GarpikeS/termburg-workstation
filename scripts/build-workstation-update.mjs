import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const generatedDirectory = path.join(repoRoot, 'workstation', 'generated');
const releaseDirectory = path.join(repoRoot, 'release', 'workstation-update');
const unpackedDirectory = path.join(repoRoot, 'release', 'workstation-update', 'win-unpacked');
const fullBuildUnpackedDirectory = path.join(repoRoot, 'release', 'workstation', 'win-unpacked');
const builderConfigPath = path.join(repoRoot, 'workstation', 'electron-builder.update.json');
const updateArtifactPattern = /^Termburg-Workstation-Update-(\d+)\.(\d+)\.(\d+)\.exe(?:\.sha256|\.blockmap)?$/;
let currentArtifactName = '';
let buildSucceeded = false;

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} завершился с кодом ${result.status}.`);
}

function runNodeScript(relativePath, args = []) {
  run(process.execPath, [path.join(repoRoot, relativePath), ...args]);
}

function assertCleanGitWorktree() {
  const result = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error('Could not verify a clean Git worktree before the update build.');
  if (String(result.stdout || '').trim()) {
    throw new Error('Public Workstation update must be built from a clean Git worktree.');
  }
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
  const builderConfig = JSON.parse(await fs.readFile(builderConfigPath, 'utf8'));
  const expectedVersion = String(builderConfig?.extraMetadata?.version || '');
  if (!/^\d+\.\d+\.\d+$/.test(expectedVersion)) throw new Error('Workstation update version is invalid.');
  assertCleanGitWorktree();
  currentArtifactName = `Termburg-Workstation-Update-${expectedVersion}.exe`;
  await fs.mkdir(releaseDirectory, { recursive: true });
  for (const staleFile of [currentArtifactName, `${currentArtifactName}.sha256`, `${currentArtifactName}.blockmap`]) {
    await fs.rm(path.join(releaseDirectory, staleFile), { force: true });
  }
  await fs.rm(unpackedDirectory, { recursive: true, force: true });
  await fs.rm(fullBuildUnpackedDirectory, { recursive: true, force: true });
  await cleanupUpdateArtifacts();
  await fs.rm(generatedDirectory, { recursive: true, force: true });
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm --prefix frontend run build']);
  runNodeScript('scripts/run-workstation-tests.mjs');
  run(process.env.ComSpec || 'cmd.exe', [
    '/d',
    '/s',
    '/c',
    'npm exec -- electron-builder --config workstation/electron-builder.update.json --win --x64',
  ]);
  runNodeScript('scripts/audit-workstation-package.mjs', [
    `--unpacked-directory=${unpackedDirectory}`,
    '--without-generated',
  ]);
  runNodeScript('scripts/test-workstation-packaged.mjs', [
    `--unpacked-directory=${unpackedDirectory}`,
    '--without-enrollment',
    '--without-site-sync',
    '--preserve-existing-profile',
    `--expected-version=${expectedVersion}`,
  ]);
  runNodeScript('scripts/write-workstation-update-checksum.mjs');
  await cleanupUpdateArtifacts();
  buildSucceeded = true;
  console.log('Public Workstation update built without embedded credentials or a Dolphin enrollment token.');
} finally {
  await fs.rm(generatedDirectory, { recursive: true, force: true });
  await fs.rm(unpackedDirectory, { recursive: true, force: true });
  if (!buildSucceeded && currentArtifactName) {
    await Promise.all([
      currentArtifactName,
      `${currentArtifactName}.sha256`,
      `${currentArtifactName}.blockmap`,
    ].map(fileName => fs.rm(path.join(releaseDirectory, fileName), { force: true })));
  }
}
