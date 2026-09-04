import { promises as fs } from 'node:fs';
import path from 'node:path';

const MANAGED_ACCOUNTS = ['moscow', 'zelenogorsk'];
const REMOVABLE_ACCOUNTS = ['testtb'];

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
    ? [...new Set(parsed.managedAccounts.filter(username => MANAGED_ACCOUNTS.includes(username)))]
    : ['moscow'];
  const removedAccounts = Array.isArray(parsed.removeAccounts)
    ? [...new Set(parsed.removeAccounts.filter(username => REMOVABLE_ACCOUNTS.includes(username)))]
    : [];
  if (managedAccounts.some(username => !parsed.accounts[username])) {
    throw new Error('Embedded schedule authentication has invalid managed accounts.');
  }
  if (managedAccounts.length === 0 && removedAccounts.length === 0) {
    throw new Error('Embedded schedule authentication has no actions.');
  }

  const currentIsValid = current?.schemaVersion === 1 && current?.accounts && typeof current.accounts === 'object';
  if (!currentIsValid && managedAccounts.length === 0) {
    return { embedded: true, applied: false, managedAccounts, removedAccounts, reason: 'target-unconfigured' };
  }

  const next = currentIsValid
    ? { ...current, accounts: { ...current.accounts } }
    : { schemaVersion: 1, accounts: {} };
  for (const username of managedAccounts) next.accounts[username] = parsed.accounts[username];
  const actuallyRemoved = removedAccounts.filter(username => Object.hasOwn(next.accounts, username));
  for (const username of removedAccounts) delete next.accounts[username];
  if (managedAccounts.length === 0 && actuallyRemoved.length === 0) {
    return { embedded: true, applied: false, managedAccounts, removedAccounts };
  }
  next.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  const temporaryFile = `${targetFile}.${process.pid}.tmp`;
  await fs.writeFile(temporaryFile, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporaryFile, targetFile);
  logger.info?.('Embedded schedule authentication applied.', { managedAccounts, removedAccounts: actuallyRemoved });
  return { embedded: true, applied: true, managedAccounts, removedAccounts: actuallyRemoved };
}
