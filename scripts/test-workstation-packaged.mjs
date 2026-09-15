import { promises as fs } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const unpackedArgument = process.argv.find(argument => argument.startsWith('--unpacked-directory='));
const unpackedDirectory = unpackedArgument
  ? path.resolve(unpackedArgument.slice('--unpacked-directory='.length))
  : path.join(repoRoot, 'release', 'workstation', 'win-unpacked');
const enrollmentExpected = !process.argv.includes('--without-enrollment');
const expectedLocationArgument = process.argv.find(argument => argument.startsWith('--expected-location='));
const expectedLocation = expectedLocationArgument?.slice('--expected-location='.length) || '';
const expectedSiteLocationArgument = process.argv.find(argument => argument.startsWith('--expected-site-location='));
const expectedSiteLocationIds = expectedSiteLocationArgument
  ? expectedSiteLocationArgument.slice('--expected-site-location='.length).split(',').filter(Boolean).sort()
  : ['1', '2'];
const siteSyncExpected = !process.argv.includes('--without-site-sync');
const expectedAuthAccountArgument = process.argv.find(argument => argument.startsWith('--expected-auth-account='));
const expectedAuthAccount = expectedAuthAccountArgument?.slice('--expected-auth-account='.length) || '';
const expectedRemovedAuthArgument = process.argv.find(argument => argument.startsWith('--expected-removed-auth-account='));
const expectedRemovedAuthAccount = expectedRemovedAuthArgument?.slice('--expected-removed-auth-account='.length) || '';
const expectedVersionArgument = process.argv.find(argument => argument.startsWith('--expected-version='));
const expectedVersion = expectedVersionArgument?.slice('--expected-version='.length) || '';
const preserveExistingProfile = process.argv.includes('--preserve-existing-profile');

function smokeAccount(username, locationId) {
  return {
    username,
    locationId,
    salt: `smoke-${username}-salt`,
    hash: `smoke-${username}-hash`,
    scrypt: { N: 1024, r: 8, p: 1, maxmem: 16_777_216, keyLength: 64 },
  };
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Packaged Workstation smoke test timed out.'));
    }, timeoutMs);
    child.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', code => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`Packaged Workstation exited with code ${code}.`));
    });
  });
}

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'term-workstation-smoke-'));
try {
  const executable = (await fs.readdir(unpackedDirectory))
    .find(name => name.toLowerCase().endsWith('.exe'));
  if (!executable) throw new Error('Packaged Workstation executable was not found.');
  const outputPath = path.join(temporaryDirectory, 'result.json');
  const userDataPath = path.join(temporaryDirectory, 'user-data');
  let preservedSiteSync = '';
  let preservedScheduleAuth = '';
  if (preserveExistingProfile) {
    await fs.mkdir(userDataPath, { recursive: true });
    preservedSiteSync = JSON.stringify({
      locations: {
        1: { token: 'existing-moscow-site-token-123456', lastPublishedAt: '2026-09-14T12:00:00.000Z' },
        2: { token: 'existing-zelenogorsk-site-token-123456', lastPublishedAt: '2026-09-14T13:00:00.000Z' },
      },
    });
    preservedScheduleAuth = JSON.stringify({
      schemaVersion: 1,
      accounts: {
        moscow: smokeAccount('moscow', '1'),
        zelenogorsk: smokeAccount('zelenogorsk', '2'),
      },
    });
    await fs.writeFile(path.join(userDataPath, 'site-sync.json'), preservedSiteSync, 'utf8');
    await fs.writeFile(path.join(userDataPath, 'schedule-auth.json'), preservedScheduleAuth, 'utf8');
  }
  if (expectedRemovedAuthAccount) {
    await fs.mkdir(userDataPath, { recursive: true });
    await fs.writeFile(path.join(userDataPath, 'schedule-auth.json'), JSON.stringify({
      schemaVersion: 1,
      accounts: {
        moscow: smokeAccount('moscow', '1'),
        zelenogorsk: smokeAccount('zelenogorsk', '2'),
        [expectedRemovedAuthAccount]: smokeAccount(expectedRemovedAuthAccount, ''),
      },
    }), 'utf8');
  }
  const port = await freePort();
  const child = spawn(path.join(unpackedDirectory, executable), [
    '--no-update',
    '--skip-dolphin',
    '--validate-dolphin-package',
    ...(enrollmentExpected ? [] : ['--expect-no-enrollment']),
    `--schedule-port=${port}`,
    `--user-data-dir=${userDataPath}`,
    `--smoke-test-output=${outputPath}`,
  ], { stdio: 'ignore', windowsHide: true });
  await waitForExit(child, 30_000);
  const result = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  const actualSiteLocationIds = [...(result.siteSyncBootstrap?.locationIds || [])].sort();
  const actualManagedAccounts = [...(result.authBootstrap?.managedAccounts || [])].sort();
  if (result.ok !== true
    || result.mode !== 'workstation'
    || (expectedVersion && result.version !== expectedVersion)
    || result.dolphinSkipped !== true
    || result.dolphinPackage?.enrollmentReady !== enrollmentExpected
    || result.dolphinPackage?.excelReaderReady !== true
    || (expectedLocation && result.dolphinPackage?.deviceProfile?.locationCode !== expectedLocation)
    || (!expectedLocation && result.dolphinPackage?.deviceProfile !== null)
    || (expectedAuthAccount && result.authBootstrap?.embedded !== true)
    || (expectedAuthAccount && result.authBootstrap?.applied !== true)
    || (expectedAuthAccount && JSON.stringify(actualManagedAccounts) !== JSON.stringify([expectedAuthAccount]))
    || (expectedRemovedAuthAccount && result.authBootstrap?.embedded !== true)
    || (expectedRemovedAuthAccount && result.authBootstrap?.applied !== true)
    || (expectedRemovedAuthAccount && !result.authBootstrap?.removedAccounts?.includes(expectedRemovedAuthAccount))
    || (!expectedAuthAccount && !expectedRemovedAuthAccount && result.authBootstrap?.embedded !== false)
    || (siteSyncExpected && result.siteSyncBootstrap?.embedded !== true)
    || (siteSyncExpected && result.siteSyncBootstrap?.applied !== true)
    || (siteSyncExpected && JSON.stringify(actualSiteLocationIds) !== JSON.stringify(expectedSiteLocationIds))
    || (!siteSyncExpected && result.siteSyncBootstrap?.embedded !== false)
    || (!siteSyncExpected && result.siteSyncBootstrap?.applied !== false)
    || result.port !== port) {
    throw new Error(`Unexpected packaged Workstation result: ${JSON.stringify(result)}`);
  }
  if (siteSyncExpected) {
    const storedSiteSync = JSON.parse(await fs.readFile(path.join(userDataPath, 'site-sync.json'), 'utf8'));
    const storedLocationIds = Object.keys(storedSiteSync.locations || {}).sort();
    if (JSON.stringify(storedLocationIds) !== JSON.stringify(expectedSiteLocationIds)
      || expectedSiteLocationIds.some(locationId => !storedSiteSync.locations?.[locationId]?.token)
      || (expectedLocation && expectedSiteLocationIds.some(
        locationId => storedSiteSync.locations?.[locationId]?.complexCode !== expectedLocation,
      ))) {
      throw new Error('Packaged Workstation did not provision exactly the expected schedule site tokens.');
    }
  }
  if (expectedAuthAccount) {
    const storedAuth = JSON.parse(await fs.readFile(path.join(userDataPath, 'schedule-auth.json'), 'utf8'));
    const expectedAuthLocationId = expectedAuthAccount === 'moscow' ? '1' : '2';
    if (JSON.stringify(Object.keys(storedAuth.accounts || {}).sort()) !== JSON.stringify([expectedAuthAccount])
      || storedAuth.accounts?.[expectedAuthAccount]?.locationId !== expectedAuthLocationId) {
      throw new Error('Packaged Workstation provisioned unexpected schedule accounts.');
    }
  }
  if (expectedRemovedAuthAccount) {
    const storedAuth = JSON.parse(await fs.readFile(path.join(userDataPath, 'schedule-auth.json'), 'utf8'));
    if (storedAuth.accounts?.[expectedRemovedAuthAccount]
      || storedAuth.accounts?.moscow?.hash !== 'smoke-moscow-hash'
      || storedAuth.accounts?.zelenogorsk?.hash !== 'smoke-zelenogorsk-hash') {
      throw new Error('Packaged Workstation did not remove only the obsolete schedule account.');
    }
  }
  if (preserveExistingProfile) {
    if (await fs.readFile(path.join(userDataPath, 'site-sync.json'), 'utf8') !== preservedSiteSync
      || await fs.readFile(path.join(userDataPath, 'schedule-auth.json'), 'utf8') !== preservedScheduleAuth) {
      throw new Error('Public Workstation update changed the existing schedule connection or account profile.');
    }
  }
  console.log(`Packaged Workstation smoke test passed on port ${port}.`);
} finally {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}
