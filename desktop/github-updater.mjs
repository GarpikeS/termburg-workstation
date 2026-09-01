import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const DEFAULT_OWNER = 'GarpikeS';
const DEFAULT_REPO = 'termliny-game';
const RELEASES_API = `https://api.github.com/repos/${DEFAULT_OWNER}/${DEFAULT_REPO}/releases?per_page=20`;
const REQUEST_TIMEOUT_MS = 12_000;
const DOWNLOAD_TIMEOUT_MS = 180_000;
const PORTABLE_ASSET_PATTERN = /^Termburg-Schedule-(\d+)\.(\d+)\.(\d+)-portable\.exe$/;

function parseVersion(value) {
  const match = String(value || '').match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1, 4).map(Number) : null;
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    const difference = a[index] - b[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

function releaseVersion(release, asset) {
  const assetMatch = PORTABLE_ASSET_PATTERN.exec(asset?.name || '');
  if (assetMatch) return assetMatch.slice(1, 4).join('.');
  const tagVersion = parseVersion(release?.tag_name || release?.name);
  return tagVersion ? tagVersion.join('.') : '';
}

function findPortableUpdate(releases, currentVersion) {
  for (const release of Array.isArray(releases) ? releases : []) {
    if (release?.draft || release?.prerelease || !String(release?.tag_name || '').startsWith('schedule-v')) continue;
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const portableAsset = assets.find(asset => PORTABLE_ASSET_PATTERN.test(asset?.name || ''));
    if (!portableAsset?.browser_download_url) continue;
    const version = releaseVersion(release, portableAsset);
    if (!version || compareVersions(version, currentVersion) <= 0) continue;
    const checksumAsset = assets.find(asset => asset?.name === `${portableAsset.name}.sha256`);
    return {
      version,
      releaseName: release.name || release.tag_name,
      portableAsset,
      checksumAsset,
    };
  }
  return null;
}

async function fetchWithTimeout(url, { timeoutMs, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json, application/json, text/plain',
        'User-Agent': 'Termburg-Schedule-Updater',
        ...headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readChecksum(asset, logger) {
  if (!asset?.browser_download_url) return '';
  const response = await fetchWithTimeout(asset.browser_download_url, { timeoutMs: REQUEST_TIMEOUT_MS });
  if (!response.ok) {
    logger.info('Update checksum unavailable', { status: response.status });
    return '';
  }
  const text = await response.text();
  const match = text.match(/\b[a-fA-F0-9]{64}\b/);
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

async function downloadFile(url, destination) {
  const response = await fetchWithTimeout(url, {
    timeoutMs: DOWNLOAD_TIMEOUT_MS,
    headers: { Accept: 'application/octet-stream' },
  });
  if (!response.ok || !response.body) {
    throw new Error(`UPDATE_DOWNLOAD_FAILED_${response.status}`);
  }
  const tempFile = `${destination}.${process.pid}.tmp`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(tempFile));
  await rm(destination, { force: true });
  await rm(`${destination}.old`, { force: true });
  await stat(tempFile);
  await rename(tempFile, destination);
}

async function cleanupDownloadedUpdates(updateDirectory, keepFile) {
  const entries = await readdir(updateDirectory, { withFileTypes: true }).catch(() => []);
  const portableFiles = entries
    .filter(entry => entry.isFile() && PORTABLE_ASSET_PATTERN.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const keep = new Set([path.basename(keepFile), ...portableFiles.slice(0, 2)]);
  await Promise.all(portableFiles
    .filter(fileName => !keep.has(fileName))
    .map(fileName => rm(path.join(updateDirectory, fileName), { force: true })));
}

export async function checkForPortableUpdate({
  currentVersion,
  updateDirectory,
  logger = console,
  releasesApi = RELEASES_API,
} = {}) {
  if (!currentVersion || !updateDirectory) return { updateReady: false, reason: 'missing-config' };

  const releaseResponse = await fetchWithTimeout(releasesApi, { timeoutMs: REQUEST_TIMEOUT_MS });
  if (!releaseResponse.ok) {
    logger.info('Update check skipped', { status: releaseResponse.status });
    return { updateReady: false, reason: `release-api-${releaseResponse.status}` };
  }

  const update = findPortableUpdate(await releaseResponse.json(), currentVersion);
  if (!update) return { updateReady: false, reason: 'current-version' };

  const expectedSha256 = await readChecksum(update.checksumAsset, logger);
  if (!expectedSha256) {
    logger.error('Update skipped: checksum asset is missing', { version: update.version });
    return { updateReady: false, reason: 'missing-checksum' };
  }

  await mkdir(updateDirectory, { recursive: true });
  const targetFile = path.join(updateDirectory, update.portableAsset.name);
  const alreadyDownloaded = await fileExists(targetFile);
  if (!alreadyDownloaded || await sha256File(targetFile) !== expectedSha256) {
    logger.info('Downloading schedule update', { version: update.version, release: update.releaseName });
    await downloadFile(update.portableAsset.browser_download_url, targetFile);
  }

  const actualSha256 = await sha256File(targetFile);
  if (actualSha256 !== expectedSha256) {
    await rm(targetFile, { force: true });
    logger.error('Update checksum mismatch', { version: update.version });
    return { updateReady: false, reason: 'checksum-mismatch' };
  }

  await cleanupDownloadedUpdates(updateDirectory, targetFile);
  return {
    updateReady: true,
    version: update.version,
    targetFile,
  };
}
