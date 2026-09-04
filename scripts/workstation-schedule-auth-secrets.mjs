import { promises as fs } from 'node:fs';
import path from 'node:path';

export const EMBEDDED_SCHEDULE_AUTH_FILE = 'schedule-auth-defaults.json';

export async function stageWorkstationScheduleAuthCleanup({ generatedDirectory, removedAccounts = ['testtb'] }) {
  const safeRemovedAccounts = [...new Set(removedAccounts.filter(username => username === 'testtb'))];
  if (safeRemovedAccounts.length === 0) throw new Error('No supported schedule accounts selected for removal.');
  const embedded = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    managedAccounts: [],
    removeAccounts: safeRemovedAccounts,
    accounts: {},
  };
  await fs.mkdir(generatedDirectory, { recursive: true });
  const outputFile = path.join(generatedDirectory, EMBEDDED_SCHEDULE_AUTH_FILE);
  await fs.writeFile(outputFile, `${JSON.stringify(embedded)}\n`, { encoding: 'utf8', mode: 0o600 });
  return { outputFile, removedAccounts: safeRemovedAccounts };
}

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
