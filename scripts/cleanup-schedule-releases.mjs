import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDirectory = path.join(repoRoot, 'release', 'schedule-desktop');
const portablePattern = /^Termburg-Schedule-(\d+)\.(\d+)\.(\d+)-portable\.exe$/;
const versionedArtifactPattern = /^Termburg-Schedule-(\d+)\.(\d+)\.(\d+)-portable\.exe(?:\.sha256)?$/;

const entries = await readdir(releaseDirectory, { withFileTypes: true });
const releases = entries
  .filter(entry => entry.isFile())
  .map(entry => {
    const match = portablePattern.exec(entry.name);
    return match ? { name: entry.name, version: match.slice(1).map(Number) } : null;
  })
  .filter(Boolean)
  .sort((left, right) => {
    for (let index = 0; index < 3; index += 1) {
      const difference = right.version[index] - left.version[index];
      if (difference !== 0) return difference;
    }
    return 0;
  });

const keptReleases = releases.slice(0, 2);
const keptVersions = new Set(keptReleases.map(release => release.version.join('.')));
const obsoleteArtifacts = entries
  .filter(entry => entry.isFile())
  .map(entry => {
    const match = versionedArtifactPattern.exec(entry.name);
    return match ? { name: entry.name, version: match.slice(1).map(Number).join('.') } : null;
  })
  .filter(artifact => artifact && !keptVersions.has(artifact.version));

await Promise.all(obsoleteArtifacts.map(artifact => rm(path.join(releaseDirectory, artifact.name), { force: true })));

console.log(`Schedule releases kept: ${keptReleases.map(release => release.name).join(', ') || 'none'}`);
console.log(`Obsolete schedule artifacts removed: ${obsoleteArtifacts.length}`);
