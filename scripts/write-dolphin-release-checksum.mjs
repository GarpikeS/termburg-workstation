import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const config = JSON.parse(await fs.readFile(path.join(repoRoot, 'dolphin-agent', 'electron-builder.json'), 'utf8'));
const version = config.extraMetadata.version;
const directory = path.join(repoRoot, 'release', 'dolphin-agent');
const artifacts = [
  `Termburg-Dolphin-Setup-${version}.exe`,
  `Termburg-Dolphin-${version}-portable.exe`,
];

for (const name of artifacts) {
  const filePath = path.join(directory, name);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  await fs.writeFile(`${filePath}.sha256`, `${hash.digest('hex')}  ${name}\n`, 'utf8');
  console.log(`Dolphin checksum written: ${name}.sha256`);
}
