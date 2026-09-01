import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const generatedDirectory = path.join(repoRoot, 'dolphin-agent', 'generated');
const enrollmentFile = path.join(generatedDirectory, 'enrollment-token.json');
const releaseDirectory = path.join(repoRoot, 'release', 'dolphin-agent');
const enrollmentHashFile = path.join(releaseDirectory, 'dolphin-enrollment.sha256');
const enrollmentToken = randomBytes(32).toString('hex');
const enrollmentTokenHash = createHash('sha256').update(enrollmentToken, 'utf8').digest('hex');

function runNodeScript(relativePath) {
  const result = spawnSync(process.execPath, [path.join(repoRoot, relativePath)], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`${relativePath} завершился с кодом ${result.status}.`);
}

try {
  await fs.mkdir(generatedDirectory, { recursive: true });
  await fs.mkdir(releaseDirectory, { recursive: true });
  await fs.writeFile(enrollmentFile, `${JSON.stringify({ version: 1, enrollmentToken })}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });

  const shell = process.env.ComSpec || 'cmd.exe';
  const build = spawnSync(shell, [
    '/d',
    '/s',
    '/c',
    'electron-builder --config dolphin-agent/electron-builder.json --win --x64',
  ], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (build.status !== 0) throw new Error(`electron-builder завершился с кодом ${build.status}.`);

  await fs.writeFile(enrollmentHashFile, `${enrollmentTokenHash}\n`, { encoding: 'utf8', mode: 0o600 });
  runNodeScript('scripts/write-dolphin-release-checksum.mjs');
  runNodeScript('scripts/cleanup-dolphin-releases.mjs');
  console.log('Zero-config Dolphin installer built; one-time enrollment secret was not printed.');
} finally {
  await fs.rm(enrollmentFile, { force: true });
  await fs.rm(generatedDirectory, { recursive: true, force: true });
}
