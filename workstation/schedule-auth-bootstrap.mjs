import { promises as fs } from 'node:fs';
import path from 'node:path';

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
  if (parsed?.schemaVersion !== 1 || !parsed?.accounts?.moscow || !parsed?.accounts?.zelenogorsk) {
    throw new Error('Invalid embedded schedule authentication defaults.');
  }
  const managedAccounts = Array.isArray(parsed.managedAccounts)
    ? parsed.managedAccounts.filter(username => ['moscow', 'zelenogorsk'].includes(username))
    : ['moscow'];
  if (managedAccounts.length === 0) throw new Error('Embedded schedule authentication has no managed accounts.');
  const next = current?.schemaVersion === 1 && current?.accounts
    ? {
        ...current,
        updatedAt: new Date().toISOString(),
        accounts: managedAccounts.reduce(
          (accounts, username) => ({ ...accounts, [username]: parsed.accounts[username] }),
          { ...current.accounts },
        ),
      }
    : parsed;
  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  const temporaryFile = `${targetFile}.${process.pid}.tmp`;
  await fs.writeFile(temporaryFile, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporaryFile, targetFile);
  logger.info?.('Embedded schedule authentication applied.', { managedAccounts });
  return { embedded: true, applied: true, managedAccounts };
}
