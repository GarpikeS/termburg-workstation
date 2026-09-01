import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDirectory = path.join(repoRoot, 'release', 'schedule-desktop');
const { version } = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
const artifactName = `Termburg-Schedule-${version}-portable.exe`;
const artifactPath = path.join(releaseDirectory, artifactName);

async function sha256File(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

const entries = await readdir(releaseDirectory);
if (!entries.includes(artifactName)) {
  throw new Error(`Schedule artifact not found: ${artifactPath}`);
}

const sha256 = await sha256File(artifactPath);
await writeFile(path.join(releaseDirectory, `${artifactName}.sha256`), `${sha256}  ${artifactName}\n`, 'utf8');
console.log(`Schedule checksum written: ${artifactName}.sha256`);
