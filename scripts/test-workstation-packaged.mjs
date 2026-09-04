import { promises as fs } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const unpackedArgument = process.argv.find(argument => argument.startsWith('--unpacked-directory='));
const unpackedDirectory = unpackedArgument
  ? path.resolve(unpackedArgument.slice('--unpacked-directory='.length))
  : path.join(repoRoot, 'release', 'workstation', 'win-unpacked');
const enrollmentExpected = !process.argv.includes('--without-enrollment');
const expectedLocationArgument = process.argv.find(argument => argument.startsWith('--expected-location='));
const expectedLocation = expectedLocationArgument?.slice('--expected-location='.length) || '';
const expectedAuthAccountArgument = process.argv.find(argument => argument.startsWith('--expected-auth-account='));
const expectedAuthAccount = expectedAuthAccountArgument?.slice('--expected-auth-account='.length) || '';
const expectedAuthPassword = String(process.env.TERMBURG_TEST_PROFILE_PASSWORD || '');
const scrypt = promisify(scryptCallback);

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
  if (expectedAuthAccount) {
    await fs.mkdir(userDataPath, { recursive: true });
    await fs.writeFile(path.join(userDataPath, 'schedule-auth.json'), JSON.stringify({
      schemaVersion: 1,
      accounts: {
        moscow: smokeAccount('moscow', '1'),
        zelenogorsk: smokeAccount('zelenogorsk', '2'),
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
  if (result.ok !== true
    || result.mode !== 'workstation'
    || result.dolphinSkipped !== true
    || result.dolphinPackage?.enrollmentReady !== enrollmentExpected
    || result.dolphinPackage?.excelReaderReady !== true
    || (expectedLocation && result.dolphinPackage?.deviceProfile?.locationCode !== expectedLocation)
    || (!expectedLocation && result.dolphinPackage?.deviceProfile !== null)
    || (expectedLocation && result.authBootstrap?.applied !== true)
    || (expectedLocation && !result.authBootstrap?.managedAccounts?.includes(expectedLocation))
    || (expectedAuthAccount && result.authBootstrap?.embedded !== true)
    || (expectedAuthAccount && result.authBootstrap?.applied !== true)
    || (expectedAuthAccount && !result.authBootstrap?.managedAccounts?.includes(expectedAuthAccount))
    || (!expectedLocation && !expectedAuthAccount && result.authBootstrap?.embedded !== false)
    || result.siteSyncBootstrap?.embedded !== true
    || result.siteSyncBootstrap?.applied !== true
    || result.siteSyncBootstrap?.locationIds?.length !== 2
    || result.port !== port) {
    throw new Error(`Unexpected packaged Workstation result: ${JSON.stringify(result)}`);
  }
  const storedSiteSync = JSON.parse(await fs.readFile(path.join(userDataPath, 'site-sync.json'), 'utf8'));
  if (!storedSiteSync.locations?.['1']?.token || !storedSiteSync.locations?.['2']?.token) {
    throw new Error('Packaged Workstation did not provision both schedule site tokens.');
  }
  if (expectedAuthAccount) {
    const storedAuth = JSON.parse(await fs.readFile(path.join(userDataPath, 'schedule-auth.json'), 'utf8'));
    const account = storedAuth.accounts?.[expectedAuthAccount];
    if (!account || storedAuth.accounts.moscow.hash !== 'smoke-moscow-hash') {
      throw new Error('Packaged Workstation did not merge the hidden schedule account safely.');
    }
    if (expectedAuthPassword) {
      const actual = await scrypt(
        expectedAuthPassword,
        Buffer.from(account.salt, 'base64'),
        account.scrypt.keyLength,
        {
          N: account.scrypt.N,
          r: account.scrypt.r,
          p: account.scrypt.p,
          maxmem: account.scrypt.maxmem,
        },
      );
      const expected = Buffer.from(account.hash, 'base64');
      if (expected.length !== actual.length || !timingSafeEqual(expected, Buffer.from(actual))) {
        throw new Error('Packaged Workstation hidden schedule account password does not match.');
      }
    }
  }
  console.log(`Packaged Workstation smoke test passed on port ${port}.`);
} finally {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}
