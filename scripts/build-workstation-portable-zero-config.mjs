import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createScheduleAuth } from '../server/schedule-auth.mjs';
import { stageWorkstationSiteSyncSecrets } from './workstation-site-sync-secrets.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const generatedDirectory = path.join(repoRoot, 'workstation', 'generated');
const releaseDirectory = path.join(repoRoot, 'release', 'workstation-portable');
const enrollmentToken = randomBytes(32).toString('hex');
const enrollmentHash = createHash('sha256').update(enrollmentToken, 'utf8').digest('hex');
const moscowPassword = String(process.env.WORKSTATION_MOSCOW_PASSWORD || '');
if (moscowPassword.length < 7) throw new Error('WORKSTATION_MOSCOW_PASSWORD is required.');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed with ${result.status}.`);
}

try {
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm --prefix frontend run build']);
  run(process.execPath, [path.join(repoRoot, 'scripts', 'run-workstation-tests.mjs')]);
  await fs.mkdir(generatedDirectory, { recursive: true });
  await fs.mkdir(releaseDirectory, { recursive: true });
  await fs.writeFile(path.join(generatedDirectory, 'enrollment-token.json'), `${JSON.stringify({ version: 1, enrollmentToken })}\n`, 'utf8');
  await stageWorkstationSiteSyncSecrets({ repoRoot, generatedDirectory });
  const auth = createScheduleAuth({ authFile: path.join(generatedDirectory, 'schedule-auth-defaults.json') });
  await auth.setup({
    moscowPassword,
    zelenogorskPassword: randomBytes(32).toString('hex'),
  });
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npx electron-builder --config workstation/electron-builder.portable.json --win portable --x64']);
  run(process.execPath, [path.join(repoRoot, 'scripts', 'test-workstation-packaged.mjs'), `--unpacked-directory=${path.join(releaseDirectory, 'win-unpacked')}`]);
  const executable = path.join(releaseDirectory, 'Termburg-Workstation-Portable-1.1.3.exe');
  const executableBytes = await fs.readFile(executable);
  const checksum = createHash('sha256').update(executableBytes).digest('hex');
  await fs.writeFile(`${executable}.sha256`, `${checksum}  ${path.basename(executable)}\n`, 'utf8');
  await fs.writeFile(path.join(releaseDirectory, 'workstation-enrollment.sha256'), `${enrollmentHash}\n`, 'utf8');
  console.log('Portable Workstation built; secrets were not printed.');
} finally {
  await fs.rm(generatedDirectory, { recursive: true, force: true });
}
