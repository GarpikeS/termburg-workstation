import { promises as fs } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const unpackedDirectory = path.join(repoRoot, 'release', 'workstation', 'win-unpacked');

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Packaged Workstation smoke test timed out.'));
    }, timeoutMs);
    child.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', code => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`Packaged Workstation exited with code ${code}.`));
    });
  });
}

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'term-workstation-smoke-'));
try {
  const executable = (await fs.readdir(unpackedDirectory))
    .find(name => name.toLowerCase().endsWith('.exe'));
  if (!executable) throw new Error('Packaged Workstation executable was not found.');
  const outputPath = path.join(temporaryDirectory, 'result.json');
  const userDataPath = path.join(temporaryDirectory, 'user-data');
  const port = await freePort();
  const child = spawn(path.join(unpackedDirectory, executable), [
    '--no-update',
    '--skip-dolphin',
    '--validate-dolphin-package',
    `--schedule-port=${port}`,
    `--user-data-dir=${userDataPath}`,
    `--smoke-test-output=${outputPath}`,
  ], { stdio: 'ignore', windowsHide: true });
  await waitForExit(child, 30_000);
  const result = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  if (result.ok !== true
    || result.mode !== 'workstation'
    || result.dolphinSkipped !== true
    || result.dolphinPackage?.enrollmentReady !== true
    || result.dolphinPackage?.excelReaderReady !== true
    || result.port !== port) {
    throw new Error(`Unexpected packaged Workstation result: ${JSON.stringify(result)}`);
  }
  console.log(`Packaged Workstation smoke test passed on port ${port}.`);
} finally {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}
