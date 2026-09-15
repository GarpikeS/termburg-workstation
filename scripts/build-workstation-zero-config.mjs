import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stageWorkstationSiteSyncSecrets } from './workstation-site-sync-secrets.mjs';
import { stageWorkstationScheduleAuth } from './workstation-schedule-auth-secrets.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const generatedDirectory = path.join(repoRoot, 'workstation', 'generated');
const enrollmentFile = path.join(generatedDirectory, 'enrollment-token.json');
const profileFile = path.join(generatedDirectory, 'device-profile.json');
const releaseDirectory = path.join(repoRoot, 'release', 'workstation');
const builderConfigPath = path.join(repoRoot, 'workstation', 'electron-builder.json');
const builderConfig = JSON.parse(await fs.readFile(builderConfigPath, 'utf8'));
const workstationVersion = String(builderConfig?.extraMetadata?.version || '');
if (!/^\d+\.\d+\.\d+$/.test(workstationVersion)) throw new Error('Invalid Workstation version.');
const locationArgument = process.argv.find(argument => argument.startsWith('--location='));
const locationCode = locationArgument?.slice('--location='.length).trim().toLowerCase() || 'moscow';
const locationProfiles = {
  moscow: {
    profile: { version: 1, locationCode: 'moscow', locationName: 'Термбург · Печатники' },
    siteSyncLocationIds: ['1'],
    artifactLabel: 'Moscow',
  },
  zelenogorsk: {
    profile: { version: 1, locationCode: 'zelenogorsk', locationName: 'Зеленогорск' },
    siteSyncLocationIds: ['2'],
    artifactLabel: 'Zelenogorsk',
  },
};
const locationConfiguration = locationProfiles[locationCode];
if (!locationConfiguration) throw new Error(`Неизвестный профиль Workstation: ${locationCode}.`);
const locationProfile = locationConfiguration.profile;
const enrollmentHashFile = path.join(
  releaseDirectory,
  `workstation-${locationProfile.locationCode}-enrollment.sha256`,
);
const enrollmentToken = randomBytes(32).toString('hex');
const enrollmentTokenHash = createHash('sha256').update(enrollmentToken, 'utf8').digest('hex');
const genericArtifactName = `Termburg-Workstation-Setup-${workstationVersion}.exe`;
const targetArtifactName = `Termburg-Workstation-${locationConfiguration.artifactLabel}-Setup-${workstationVersion}.exe`;
const unpackedDirectory = path.join(releaseDirectory, 'win-unpacked');
const buildArtifactNames = [
  genericArtifactName,
  `${genericArtifactName}.sha256`,
  `${genericArtifactName}.blockmap`,
  targetArtifactName,
  `${targetArtifactName}.sha256`,
  `${targetArtifactName}.blockmap`,
  path.basename(enrollmentHashFile),
];
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
  if (result.status !== 0) throw new Error('Не удалось проверить чистоту Git worktree перед сборкой.');
  if (String(result.stdout || '').trim()) {
    throw new Error('Workstation Setup разрешено собирать только из чистого Git worktree.');
  }
}

async function writePrivateFileAtomically(filePath, content) {
  const temporaryFile = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryFile, content, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporaryFile, filePath);
}

async function fileSha256(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function finalizeLocationArtifact() {
  const sourceName = genericArtifactName;
  const targetName = targetArtifactName;
  const sourcePath = path.join(releaseDirectory, sourceName);
  const targetPath = path.join(releaseDirectory, targetName);
  await fs.rm(targetPath, { force: true });
  await fs.rename(sourcePath, targetPath);
  await fs.rm(path.join(releaseDirectory, `${sourceName}.sha256`), { force: true });
  try {
    await fs.rename(
      path.join(releaseDirectory, `${sourceName}.blockmap`),
      path.join(releaseDirectory, `${targetName}.blockmap`),
    );
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const checksum = await fileSha256(targetPath);
  await fs.writeFile(path.join(releaseDirectory, `${targetName}.sha256`), `${checksum}  ${targetName}\n`, 'utf8');

  const entries = await fs.readdir(releaseDirectory);
  const versions = [...new Set(entries.map(name => {
    const match = name.match(/^Termburg-Workstation-(?:Moscow-|Zelenogorsk-)?Setup-(\d+)\.(\d+)\.(\d+)\.exe(?:\.sha256|\.blockmap)?$/);
    return match ? `${match[1]}.${match[2]}.${match[3]}` : '';
  }).filter(Boolean))].sort((left, right) => {
    const score = value => value.split('.').reduce((total, part) => total * 1000 + Number(part), 0);
    return score(right) - score(left);
  });
  const obsolete = new Set(versions.slice(2));
  for (const name of entries) {
    const match = name.match(/^Termburg-Workstation-(?:Moscow-|Zelenogorsk-)?Setup-(\d+\.\d+\.\d+)\.exe(?:\.sha256|\.blockmap)?$/);
    if (match && obsolete.has(match[1])) await fs.rm(path.join(releaseDirectory, name), { force: true });
  }
  console.log(`${locationProfile.locationName} Workstation installer built: ${targetName}`);
  return { targetName, targetPath };
}

try {
  assertCleanGitWorktree();
  await fs.rm(generatedDirectory, { recursive: true, force: true });
  await fs.mkdir(releaseDirectory, { recursive: true });
  for (const staleFile of buildArtifactNames) {
    await fs.rm(path.join(releaseDirectory, staleFile), { force: true });
  }
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm --prefix frontend run build']);
  runNodeScript('scripts/run-workstation-tests.mjs');
  await fs.rm(generatedDirectory, { recursive: true, force: true });
  await fs.mkdir(generatedDirectory, { recursive: true });
  await fs.writeFile(enrollmentFile, `${JSON.stringify({ version: 1, enrollmentToken })}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await fs.writeFile(profileFile, `${JSON.stringify(locationProfile)}\n`, { encoding: 'utf8', mode: 0o600 });
  const siteSync = await stageWorkstationSiteSyncSecrets({
    repoRoot,
    generatedDirectory,
    locationIds: locationConfiguration.siteSyncLocationIds,
  });
  console.log(`Embedded schedule connections prepared for locations: ${siteSync.locationIds.join(', ')}.`);
  const scheduleAuth = await stageWorkstationScheduleAuth({
    generatedDirectory,
    managedAccount: locationProfile.locationCode,
  });
  console.log(`Embedded schedule access prepared for: ${scheduleAuth.managedAccounts.join(', ')}.`);

  run(process.env.ComSpec || 'cmd.exe', [
    '/d',
    '/s',
    '/c',
    'electron-builder --config workstation/electron-builder.json --win --x64',
  ]);
  runNodeScript('scripts/audit-workstation-package.mjs', [
    `--unpacked-directory=${unpackedDirectory}`,
    `--expected-location=${locationProfile.locationCode}`,
    `--expected-site-location=${locationConfiguration.siteSyncLocationIds.join(',')}`,
    `--expected-auth-account=${locationProfile.locationCode}`,
  ]);
  run(process.execPath, [
    path.join(repoRoot, 'scripts', 'test-workstation-packaged.mjs'),
    `--expected-location=${locationProfile.locationCode}`,
    `--expected-site-location=${locationConfiguration.siteSyncLocationIds.join(',')}`,
    `--expected-auth-account=${locationProfile.locationCode}`,
    `--expected-version=${workstationVersion}`,
  ]);

  await finalizeLocationArtifact();
  await writePrivateFileAtomically(enrollmentHashFile, `${enrollmentTokenHash}\n`);
  buildSucceeded = true;
  console.log(`${locationProfile.locationName} installer built; one-time enrollment secret was not printed.`);
} finally {
  await fs.rm(enrollmentFile, { force: true });
  await fs.rm(generatedDirectory, { recursive: true, force: true });
  await fs.rm(unpackedDirectory, { recursive: true, force: true });
  if (!buildSucceeded) {
    await Promise.all(buildArtifactNames.map(fileName => fs.rm(path.join(releaseDirectory, fileName), { force: true })));
    await fs.rm(`${enrollmentHashFile}.${process.pid}.tmp`, { force: true });
  }
}
