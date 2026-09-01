import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const releaseDirectory = path.join(repoRoot, 'release', 'workstation');
const versionPattern = /Termburg-Workstation-Setup-(\d+)\.(\d+)\.(\d+)\.exe(?:\.sha256|\.blockmap)?$/;
const entries = await readdir(releaseDirectory, { withFileTypes: true });
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
    await rm(path.join(releaseDirectory, name), { force: true });
    removed += 1;
  }
}
console.log(`Workstation versions kept: ${[...keep].join(', ') || 'none'}`);
console.log(`Obsolete Workstation artifacts removed: ${removed}`);
