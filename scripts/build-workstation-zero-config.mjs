import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stageWorkstationSiteSyncSecrets } from './workstation-site-sync-secrets.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const generatedDirectory = path.join(repoRoot, 'workstation', 'generated');
const enrollmentFile = path.join(generatedDirectory, 'enrollment-token.json');
const profileFile = path.join(generatedDirectory, 'device-profile.json');
const releaseDirectory = path.join(repoRoot, 'release', 'workstation');
const locationArgument = process.argv.find(argument => argument.startsWith('--location='));
const locationCode = locationArgument?.slice('--location='.length).trim().toLowerCase() || '';
const locationProfiles = {
  zelenogorsk: { version: 1, locationCode: 'zelenogorsk', locationName: 'Зеленогорск' },
};
const locationProfile = locationCode ? locationProfiles[locationCode] : null;
if (locationCode && !locationProfile) throw new Error(`Неизвестный профиль Workstation: ${locationCode}.`);
const enrollmentHashFile = path.join(
  releaseDirectory,
  locationProfile ? `workstation-${locationProfile.locationCode}-enrollment.sha256` : 'workstation-enrollment.sha256',
);
const enrollmentToken = randomBytes(32).toString('hex');
const enrollmentTokenHash = createHash('sha256').update(enrollmentToken, 'utf8').digest('hex');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} завершился с кодом ${result.status}.`);
}

function runNodeScript(relativePath) {
  run(process.execPath, [path.join(repoRoot, relativePath)]);
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
  const builderConfig = JSON.parse(await fs.readFile(
    path.join(repoRoot, 'workstation', 'electron-builder.json'),
    'utf8',
  ));
  const version = String(builderConfig?.extraMetadata?.version || '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid Workstation version.');
  const sourceName = `Termburg-Workstation-Setup-${version}.exe`;
  const targetName = `Termburg-Workstation-Zelenogorsk-Setup-${version}.exe`;
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
    const match = name.match(/^Termburg-Workstation-(?:Zelenogorsk-)?Setup-(\d+)\.(\d+)\.(\d+)\.exe(?:\.sha256|\.blockmap)?$/);
    return match ? `${match[1]}.${match[2]}.${match[3]}` : '';
  }).filter(Boolean))].sort((left, right) => {
    const score = value => value.split('.').reduce((total, part) => total * 1000 + Number(part), 0);
    return score(right) - score(left);
  });
  const obsolete = new Set(versions.slice(2));
  for (const name of entries) {
    const match = name.match(/^Termburg-Workstation-(?:Zelenogorsk-)?Setup-(\d+\.\d+\.\d+)\.exe(?:\.sha256|\.blockmap)?$/);
    if (match && obsolete.has(match[1])) await fs.rm(path.join(releaseDirectory, name), { force: true });
  }
  console.log(`Greenogorsk Workstation installer built: ${targetName}`);
}

try {
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm --prefix frontend run build']);
  runNodeScript('scripts/run-workstation-tests.mjs');
  await fs.mkdir(generatedDirectory, { recursive: true });
  await fs.mkdir(releaseDirectory, { recursive: true });
  await fs.writeFile(enrollmentFile, `${JSON.stringify({ version: 1, enrollmentToken })}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  if (locationProfile) {
    await fs.writeFile(profileFile, `${JSON.stringify(locationProfile)}\n`, { encoding: 'utf8', mode: 0o600 });
  }
  const siteSync = await stageWorkstationSiteSyncSecrets({ repoRoot, generatedDirectory });
  console.log(`Embedded schedule connections prepared for locations: ${siteSync.locationIds.join(', ')}.`);

  run(process.env.ComSpec || 'cmd.exe', [
    '/d',
    '/s',
    '/c',
    'electron-builder --config workstation/electron-builder.json --win --x64',
  ]);
  run(process.execPath, [
    path.join(repoRoot, 'scripts', 'test-workstation-packaged.mjs'),
    ...(locationProfile ? [`--expected-location=${locationProfile.locationCode}`] : []),
  ]);

  await fs.writeFile(enrollmentHashFile, `${enrollmentTokenHash}\n`, { encoding: 'utf8', mode: 0o600 });
  if (locationProfile) {
    await finalizeLocationArtifact();
  } else {
    runNodeScript('scripts/write-workstation-release-checksum.mjs');
    runNodeScript('scripts/cleanup-workstation-releases.mjs');
  }
  console.log(`${locationProfile?.locationName || 'Workstation'} installer built; one-time enrollment secret was not printed.`);
} finally {
  await fs.rm(enrollmentFile, { force: true });
  await fs.rm(generatedDirectory, { recursive: true, force: true });
}
