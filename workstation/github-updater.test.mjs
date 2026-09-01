import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildInstallerLauncherCommand,
  checkForWorkstationUpdate,
  compareWorkstationVersions,
  findWorkstationUpdate,
  launchWorkstationInstaller,
} from './github-updater.mjs';

function release(version, { checksum = true } = {}) {
  const installerName = `Termburg-Workstation-Update-${version}.exe`;
  return {
    tag_name: `workstation-v${version}`,
    name: `Workstation ${version}`,
    assets: [
      { name: installerName, browser_download_url: `https://downloads.test/${installerName}` },
      ...(checksum ? [{ name: `${installerName}.sha256`, browser_download_url: `https://downloads.test/${installerName}.sha256` }] : []),
    ],
  };
}

test('selects the newest stable Workstation release above current version', () => {
  const update = findWorkstationUpdate([
    release('1.2.0'),
    release('1.10.0'),
    { ...release('2.0.0'), prerelease: true },
  ], '1.1.0');
  assert.equal(update?.version, '1.10.0');
  assert.equal(compareWorkstationVersions('1.10.0', '1.2.0'), 8);
});

test('downloads an update only when its SHA-256 matches', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'workstation-update-'));
  const bytes = Buffer.from('safe-workstation-installer');
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const item = release('1.1.0');
  const fetchImpl = async url => {
    if (url === 'https://api.test/releases') return new Response(JSON.stringify([item]), { status: 200 });
    if (url.endsWith('.sha256')) return new Response(`${checksum}  installer.exe\n`, { status: 200 });
    return new Response(bytes, { status: 200 });
  };
  try {
    const result = await checkForWorkstationUpdate({
      currentVersion: '1.0.0',
      updateDirectory: directory,
      releasesApi: 'https://api.test/releases',
      fetchImpl,
      logger: { info() {}, error() {} },
    });
    assert.equal(result.updateReady, true);
    assert.equal(result.version, '1.1.0');
    assert.deepEqual(await fs.readFile(result.targetFile), bytes);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('rejects a release without a checksum asset', async () => {
  const result = await checkForWorkstationUpdate({
    currentVersion: '1.0.0',
    updateDirectory: path.join(os.tmpdir(), 'unused-workstation-update'),
    releasesApi: 'https://api.test/releases',
    fetchImpl: async () => new Response(JSON.stringify([release('1.1.0', { checksum: false })]), { status: 200 }),
    logger: { info() {}, error() {} },
  });
  assert.deepEqual(result, { updateReady: false, reason: 'missing-checksum' });
});

test('builds a deferred installer launch without exposing shell metacharacters', () => {
  const command = buildInstallerLauncherCommand("C:\\Updates\\Termburg's Update.exe", 4321);
  assert.match(command, /Wait-Process -Id 4321/);
  assert.match(command, /Termburg''s Update\.exe/);
  assert.match(command, /-ArgumentList '\/S'/);
});

test('launches the installer helper as a hidden detached PowerShell process', () => {
  let invocation = null;
  const result = launchWorkstationInstaller({
    installerPath: 'C:\\Updates\\Workstation.exe',
    currentPid: 9876,
    platform: 'win32',
    spawnImpl: (command, args, options) => {
      invocation = { command, args, options };
      return { pid: 2468, unref() {} };
    },
  });
  assert.equal(result.pid, 2468);
  assert.equal(invocation.command, 'powershell.exe');
  assert.equal(invocation.options.detached, true);
  assert.equal(invocation.options.windowsHide, true);
  assert.ok(invocation.args.includes('-EncodedCommand'));
});
