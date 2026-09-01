import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const releaseDirectory = path.join(repoRoot, 'release', 'workstation');
const builderConfig = JSON.parse(await readFile(path.join(repoRoot, 'workstation', 'electron-builder.json'), 'utf8'));
const version = String(builderConfig?.extraMetadata?.version || '');
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid Workstation version in electron-builder config.');
const artifactName = `Termburg-Workstation-Setup-${version}.exe`;
if (!(await readdir(releaseDirectory)).includes(artifactName)) throw new Error('Workstation installer was not found.');

const hash = createHash('sha256');
await new Promise((resolve, reject) => {
  const stream = createReadStream(path.join(releaseDirectory, artifactName));
  stream.on('data', chunk => hash.update(chunk));
  stream.on('error', reject);
  stream.on('end', resolve);
});
await writeFile(
  path.join(releaseDirectory, `${artifactName}.sha256`),
  `${hash.digest('hex')}  ${artifactName}\n`,
  'utf8',
);
console.log(`Workstation checksum written: ${artifactName}.sha256`);
