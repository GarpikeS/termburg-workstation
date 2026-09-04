import { promises as fs } from 'node:fs';
import path from 'node:path';

const REQUIRED_ACCOUNTS = ['moscow', 'zelenogorsk'];
const SUPPORTED_MANAGED_ACCOUNTS = [...REQUIRED_ACCOUNTS, 'testtb'];

function validAccount(account, username) {
  return account?.username === username
    && typeof account?.locationId === 'string'
    && typeof account?.salt === 'string'
    && typeof account?.hash === 'string'
    && account?.scrypt
    && typeof account.scrypt === 'object';
}

function hasRequiredAccounts(store) {
  return store?.schemaVersion === 1
    && store?.accounts
    && REQUIRED_ACCOUNTS.every(username => validAccount(store.accounts[username], username));
}

export async function applyEmbeddedScheduleAuthDefaults({ embeddedFile, targetFile, logger = console }) {
  let current = null;
  try {
    current = JSON.parse(await fs.readFile(targetFile, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }

  let content;
  try {
    content = await fs.readFile(embeddedFile, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { embedded: false, applied: false };
    throw error;
  }

  const parsed = JSON.parse(content);
  if (parsed?.schemaVersion !== 1 || !parsed?.accounts || typeof parsed.accounts !== 'object') {
    throw new Error('Invalid embedded schedule authentication defaults.');
  }
  const managedAccounts = Array.isArray(parsed.managedAccounts)
    ? [...new Set(parsed.managedAccounts.filter(username => SUPPORTED_MANAGED_ACCOUNTS.includes(username)))]
    : ['moscow'];
  if (managedAccounts.length === 0
    || managedAccounts.some(username => !validAccount(parsed.accounts[username], username))) {
    throw new Error('Embedded schedule authentication has invalid managed accounts.');
  }

  const embeddedIsComplete = hasRequiredAccounts(parsed);
  const currentIsComplete = hasRequiredAccounts(current);
  if (!embeddedIsComplete && !currentIsComplete) {
    logger.info?.('Embedded optional schedule authentication is waiting for the main accounts.', { managedAccounts });
    return { embedded: true, applied: false, managedAccounts, reason: 'target-unconfigured' };
  }

  const next = currentIsComplete
    ? {
        ...current,
        updatedAt: new Date().toISOString(),
        accounts: managedAccounts.reduce(
          (accounts, username) => ({ ...accounts, [username]: parsed.accounts[username] }),
          { ...current.accounts },
        ),
      }
    : {
        ...parsed,
        managedAccounts: undefined,
      };
  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  const temporaryFile = `${targetFile}.${process.pid}.tmp`;
  await fs.writeFile(temporaryFile, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporaryFile, targetFile);
  logger.info?.('Embedded schedule authentication applied.', { managedAccounts });
  return { embedded: true, applied: true, managedAccounts };
}
