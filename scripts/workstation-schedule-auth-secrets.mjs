import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

export const EMBEDDED_SCHEDULE_AUTH_FILE = 'schedule-auth-defaults.json';
const scrypt = promisify(scryptCallback);
const TEST_ACCOUNT_USERNAME = 'testtb';
const TEST_ACCOUNT_LOCATION_ID = '1';
const SCRYPT_OPTIONS = { N: 2 ** 17, r: 8, p: 1, maxmem: 192 * 1024 * 1024, keyLength: 64 };

function candidateFiles() {
  const explicit = String(process.env.TERMBURG_SCHEDULE_AUTH_FILE || '').trim();
  const appData = String(process.env.APPDATA || '').trim();
  return [
    explicit,
    appData ? path.join(appData, 'Термбург Рабочее место', 'schedule-auth.json') : '',
    appData ? path.join(appData, 'Термбург Расписание', 'schedule-auth.json') : '',
  ].filter(Boolean);
}

async function firstExistingFile(filePaths) {
  for (const filePath of filePaths) {
    try {
      await fs.access(filePath);
      return filePath;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return '';
}

function validAccount(account, username) {
  return account?.username === username
    && typeof account?.locationId === 'string'
    && typeof account?.salt === 'string'
    && typeof account?.hash === 'string'
    && account?.scrypt
    && typeof account.scrypt === 'object';
}

export async function stageWorkstationScheduleAuth({ generatedDirectory, managedAccount, sourceFile = '' }) {
  if (!['moscow', 'zelenogorsk'].includes(managedAccount)) {
    throw new Error('Unknown schedule authentication account.');
  }
  const resolvedSource = sourceFile || await firstExistingFile(candidateFiles());
  if (!resolvedSource) throw new Error('Schedule authentication store was not found.');
  const source = JSON.parse(await fs.readFile(resolvedSource, 'utf8'));
  if (source?.schemaVersion !== 1
    || !validAccount(source?.accounts?.moscow, 'moscow')
    || !validAccount(source?.accounts?.zelenogorsk, 'zelenogorsk')) {
    throw new Error('Schedule authentication store is invalid.');
  }
  const embedded = {
    schemaVersion: 1,
    updatedAt: source.updatedAt || new Date().toISOString(),
    managedAccounts: [managedAccount],
    accounts: source.accounts,
  };
  await fs.mkdir(generatedDirectory, { recursive: true });
  const outputFile = path.join(generatedDirectory, EMBEDDED_SCHEDULE_AUTH_FILE);
  await fs.writeFile(outputFile, `${JSON.stringify(embedded)}\n`, { encoding: 'utf8', mode: 0o600 });
  return { outputFile, managedAccounts: embedded.managedAccounts };
}

export async function stageWorkstationTestScheduleAuth({ generatedDirectory, password }) {
  if (typeof password !== 'string' || password.length === 0 || password.length > 128) {
    throw new Error('Test schedule profile password is missing or invalid.');
  }
  const salt = randomBytes(16).toString('base64');
  const derived = await scrypt(password, Buffer.from(salt, 'base64'), SCRYPT_OPTIONS.keyLength, {
    N: SCRYPT_OPTIONS.N,
    r: SCRYPT_OPTIONS.r,
    p: SCRYPT_OPTIONS.p,
    maxmem: SCRYPT_OPTIONS.maxmem,
  });
  const embedded = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    managedAccounts: [TEST_ACCOUNT_USERNAME],
    accounts: {
      [TEST_ACCOUNT_USERNAME]: {
        username: TEST_ACCOUNT_USERNAME,
        locationId: TEST_ACCOUNT_LOCATION_ID,
        salt,
        hash: Buffer.from(derived).toString('base64'),
        scrypt: SCRYPT_OPTIONS,
      },
    },
  };
  await fs.mkdir(generatedDirectory, { recursive: true });
  const outputFile = path.join(generatedDirectory, EMBEDDED_SCHEDULE_AUTH_FILE);
  await fs.writeFile(outputFile, `${JSON.stringify(embedded)}\n`, { encoding: 'utf8', mode: 0o600 });
  return { outputFile, managedAccounts: embedded.managedAccounts };
}
