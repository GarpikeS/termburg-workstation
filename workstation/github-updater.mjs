import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const RELEASES_API = 'https://api.github.com/repos/GarpikeS/termburg-workstation/releases?per_page=20';
const REQUEST_TIMEOUT_MS = 12_000;
const DOWNLOAD_TIMEOUT_MS = 180_000;
const UPDATE_ASSET_PATTERN = /^Termburg-Workstation-Update-(\d+)\.(\d+)\.(\d+)\.exe$/;

export function parseWorkstationVersion(value) {
  const match = String(value || '').match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1, 4).map(Number) : null;
}

export function compareWorkstationVersions(left, right) {
  const a = parseWorkstationVersion(left);
  const b = parseWorkstationVersion(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    const difference = a[index] - b[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

function releaseVersion(release, asset) {
  const assetMatch = UPDATE_ASSET_PATTERN.exec(asset?.name || '');
  if (assetMatch) return assetMatch.slice(1, 4).join('.');
  const tagVersion = parseWorkstationVersion(release?.tag_name || release?.name);
  return tagVersion ? tagVersion.join('.') : '';
}

export function findWorkstationUpdate(releases, currentVersion) {
  const candidates = [];
  for (const release of Array.isArray(releases) ? releases : []) {
    if (release?.draft || release?.prerelease || !String(release?.tag_name || '').startsWith('workstation-v')) continue;
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const installerAsset = assets.find(asset => UPDATE_ASSET_PATTERN.test(asset?.name || ''));
    if (!installerAsset?.browser_download_url) continue;
    const version = releaseVersion(release, installerAsset);
    if (!version || compareWorkstationVersions(version, currentVersion) <= 0) continue;
    const checksumAsset = assets.find(asset => asset?.name === `${installerAsset.name}.sha256`);
    candidates.push({
      version,
      releaseName: release.name || release.tag_name,
      installerAsset,
      checksumAsset,
    });
  }
  return candidates.sort((left, right) => compareWorkstationVersions(right.version, left.version))[0] || null;
}

async function fetchWithTimeout(url, { timeoutMs, fetchImpl, headers = {} }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json, application/json, text/plain',
        'User-Agent': 'Termburg-Workstation-Updater',
        ...headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readChecksum(asset, fetchImpl, logger) {
  if (!asset?.browser_download_url) return '';
  const response = await fetchWithTimeout(asset.browser_download_url, {
    timeoutMs: REQUEST_TIMEOUT_MS,
    fetchImpl,
  });
  if (!response.ok) {
    logger.info('Workstation update checksum unavailable', { status: response.status });
    return '';
  }
  const match = (await response.text()).match(/\b[a-fA-F0-9]{64}\b/);
  return match ? match[0].toLowerCase() : '';
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url, destination, fetchImpl) {
  const response = await fetchWithTimeout(url, {
    timeoutMs: DOWNLOAD_TIMEOUT_MS,
    fetchImpl,
    headers: { Accept: 'application/octet-stream' },
  });
  if (!response.ok || !response.body) throw new Error(`WORKSTATION_UPDATE_DOWNLOAD_FAILED_${response.status}`);
  const temporaryFile = `${destination}.${process.pid}.tmp`;
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporaryFile));
    await rm(destination, { force: true });
    await rename(temporaryFile, destination);
  } finally {
    await rm(temporaryFile, { force: true });
  }
}

async function cleanupDownloadedUpdates(updateDirectory, keepFile) {
  const entries = await readdir(updateDirectory, { withFileTypes: true }).catch(() => []);
  const installers = entries
    .filter(entry => entry.isFile() && UPDATE_ASSET_PATTERN.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const keep = new Set([path.basename(keepFile), ...installers.slice(0, 2)]);
  await Promise.all(installers
    .filter(fileName => !keep.has(fileName))
    .map(fileName => rm(path.join(updateDirectory, fileName), { force: true })));
}

export async function checkForWorkstationUpdate({
  currentVersion,
  updateDirectory,
  logger = console,
  releasesApi = RELEASES_API,
  fetchImpl = fetch,
} = {}) {
  if (!currentVersion || !updateDirectory) return { updateReady: false, reason: 'missing-config' };
  const response = await fetchWithTimeout(releasesApi, {
    timeoutMs: REQUEST_TIMEOUT_MS,
    fetchImpl,
  });
  if (!response.ok) {
    logger.info('Workstation update check skipped', { status: response.status });
    return { updateReady: false, reason: `release-api-${response.status}` };
  }
  const update = findWorkstationUpdate(await response.json(), currentVersion);
  if (!update) return { updateReady: false, reason: 'current-version' };
  const expectedSha256 = await readChecksum(update.checksumAsset, fetchImpl, logger);
  if (!expectedSha256) {
    logger.error('Workstation update skipped: checksum asset is missing', { version: update.version });
    return { updateReady: false, reason: 'missing-checksum' };
  }

  await mkdir(updateDirectory, { recursive: true });
  const targetFile = path.join(updateDirectory, update.installerAsset.name);
  if (!await fileExists(targetFile) || await sha256File(targetFile) !== expectedSha256) {
    logger.info('Downloading Workstation update', { version: update.version, release: update.releaseName });
    await downloadFile(update.installerAsset.browser_download_url, targetFile, fetchImpl);
  }
  if (await sha256File(targetFile) !== expectedSha256) {
    await rm(targetFile, { force: true });
    logger.error('Workstation update checksum mismatch', { version: update.version });
    return { updateReady: false, reason: 'checksum-mismatch' };
  }
  await cleanupDownloadedUpdates(updateDirectory, targetFile);
  return { updateReady: true, version: update.version, targetFile };
}

function quotePowerShellLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function buildInstallerLauncherCommand(installerPath, currentPid = process.pid, relaunchPath = process.execPath) {
  const pid = Number(currentPid);
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('Invalid Workstation process id.');
  const installer = quotePowerShellLiteral(path.resolve(installerPath));
  const relaunch = quotePowerShellLiteral(path.resolve(relaunchPath));
  return [
    `$ErrorActionPreference='Stop'`,
    `$runningProcess=Get-Process -Id ${pid} -ErrorAction SilentlyContinue`,
    `if($null -ne $runningProcess){$runningProcess | Wait-Process -ErrorAction SilentlyContinue}`,
    `$installerProcess=Start-Process -FilePath ${installer} -ArgumentList '/S' -PassThru -Wait`,
    `if($null -ne $installerProcess.ExitCode -and $installerProcess.ExitCode -ne 0){exit $installerProcess.ExitCode}`,
    `if(Test-Path -LiteralPath ${relaunch}){Start-Process -FilePath ${relaunch}}`,
  ].join('; ');
}

export async function launchWorkstationInstaller({
  installerPath,
  currentPid = process.pid,
  relaunchPath = process.execPath,
  platform = process.platform,
  spawnImpl = spawn,
} = {}) {
  if (platform !== 'win32') throw new Error('Workstation automatic updates are supported only on Windows.');
  const command = buildInstallerLauncherCommand(installerPath, currentPid, relaunchPath);
  const encodedCommand = Buffer.from(command, 'utf16le').toString('base64');
  const child = spawnImpl('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-EncodedCommand', encodedCommand,
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  child.unref();
  return { command, pid: child.pid };
}
