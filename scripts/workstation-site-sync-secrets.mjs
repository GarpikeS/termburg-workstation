import { promises as fs } from 'node:fs';
import path from 'node:path';
import { normalizeEmbeddedSiteSync } from '../workstation/site-sync-bootstrap.mjs';

export const EMBEDDED_SITE_SYNC_FILE = 'site-sync-defaults.json';

function candidateFiles() {
  const explicit = String(process.env.TERMBURG_SITE_SYNC_FILE || '').trim();
  const appData = String(process.env.APPDATA || '').trim();
  return [
    explicit,
    appData ? path.join(appData, 'Термбург Рабочее место', 'site-sync.json') : '',
    appData ? path.join(appData, 'Термбург Расписание', 'site-sync.json') : '',
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

export async function stageWorkstationSiteSyncSecrets({ repoRoot, generatedDirectory }) {
  const sourceFile = await firstExistingFile(candidateFiles());
  if (!sourceFile) {
    throw new Error('Schedule site tokens were not found. Set TERMBURG_SITE_SYNC_FILE or configure site-sync.json locally.');
  }
  const source = JSON.parse(await fs.readFile(sourceFile, 'utf8'));
  const embedded = normalizeEmbeddedSiteSync({ version: 1, locations: source.locations });
  await fs.mkdir(generatedDirectory, { recursive: true });
  const outputFile = path.join(generatedDirectory, EMBEDDED_SITE_SYNC_FILE);
  await fs.writeFile(outputFile, `${JSON.stringify(embedded)}\n`, { encoding: 'utf8', mode: 0o600 });
  return { sourceFile: path.relative(repoRoot, sourceFile), outputFile, locationIds: Object.keys(embedded.locations) };
}
