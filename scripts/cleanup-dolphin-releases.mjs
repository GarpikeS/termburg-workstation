import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const directory = path.join(repoRoot, 'release', 'dolphin-agent');
const versionPattern = /Termburg-Dolphin-(?:Setup-)?(\d+)\.(\d+)\.(\d+)(?:-portable)?\.exe(?:\.sha256|\.blockmap)?$/;
const entries = await fs.readdir(directory, { withFileTypes: true });
const versions = new Map();

for (const entry of entries) {
  if (!entry.isFile()) continue;
  const match = entry.name.match(versionPattern);
  if (!match) continue;
  const version = `${match[1]}.${match[2]}.${match[3]}`;
  const score = Number(match[1]) * 1_000_000 + Number(match[2]) * 1_000 + Number(match[3]);
  if (!versions.has(version)) versions.set(version, { score, files: [] });
  versions.get(version).files.push(entry.name);
}

const keep = new Set([...versions.entries()]
  .sort((left, right) => right[1].score - left[1].score)
  .slice(0, 2)
  .map(([version]) => version));
let removed = 0;
for (const [version, record] of versions) {
  if (keep.has(version)) continue;
  for (const name of record.files) {
    await fs.rm(path.join(directory, name), { force: true });
    removed += 1;
  }
}
console.log(`Dolphin versions kept: ${[...keep].join(', ') || 'none'}`);
console.log(`Obsolete Dolphin artifacts removed: ${removed}`);
