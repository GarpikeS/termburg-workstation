import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const generatedDirectory = path.join(repoRoot, 'workstation', 'generated');
const enrollmentFile = path.join(generatedDirectory, 'enrollment-token.json');
const releaseDirectory = path.join(repoRoot, 'release', 'workstation');
const enrollmentHashFile = path.join(releaseDirectory, 'workstation-enrollment.sha256');
const enrollmentToken = randomBytes(32).toString('hex');
const enrollmentTokenHash = createHash('sha256').update(enrollmentToken, 'utf8').digest('hex');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} завершился с кодом ${result.status}.`);
}

function runNodeScript(relativePath) {
  run(process.execPath, [path.join(repoRoot, relativePath)]);
}

try {
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm --prefix frontend run build']);
  runNodeScript('scripts/run-workstation-tests.mjs');
  await fs.mkdir(generatedDirectory, { recursive: true });
  await fs.mkdir(releaseDirectory, { recursive: true });
  await fs.writeFile(enrollmentFile, `${JSON.stringify({ version: 1, enrollmentToken })}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });

  run(process.env.ComSpec || 'cmd.exe', [
    '/d',
    '/s',
    '/c',
    'electron-builder --config workstation/electron-builder.json --win --x64',
  ]);
  runNodeScript('scripts/test-workstation-packaged.mjs');

  await fs.writeFile(enrollmentHashFile, `${enrollmentTokenHash}\n`, { encoding: 'utf8', mode: 0o600 });
  runNodeScript('scripts/write-workstation-release-checksum.mjs');
  runNodeScript('scripts/cleanup-workstation-releases.mjs');
  console.log('Workstation installer built; one-time enrollment secret was not printed.');
} finally {
  await fs.rm(enrollmentFile, { force: true });
  await fs.rm(generatedDirectory, { recursive: true, force: true });
}
