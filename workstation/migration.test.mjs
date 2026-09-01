import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { migrateMissingFiles } from './migration.mjs';

test('when target files are missing, migration copies only the requested files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-workstation-migration-'));
  const sourceDirectory = path.join(root, 'source');
  const targetDirectory = path.join(root, 'target');
  try {
    await fs.mkdir(sourceDirectory, { recursive: true });
    await fs.writeFile(path.join(sourceDirectory, 'schedule.json'), '{"version":1}', 'utf8');
    await fs.writeFile(path.join(sourceDirectory, 'ignored.txt'), 'secret', 'utf8');
    const migrated = await migrateMissingFiles({
      sourceDirectory,
      targetDirectory,
      fileNames: ['schedule.json'],
      logger: { info() {} },
    });
    assert.deepEqual(migrated, ['schedule.json']);
    assert.equal(await fs.readFile(path.join(targetDirectory, 'schedule.json'), 'utf8'), '{"version":1}');
    await assert.rejects(fs.access(path.join(targetDirectory, 'ignored.txt')));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('when target file already exists, migration preserves it', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-workstation-preserve-'));
  const sourceDirectory = path.join(root, 'source');
  const targetDirectory = path.join(root, 'target');
  try {
    await fs.mkdir(sourceDirectory, { recursive: true });
    await fs.mkdir(targetDirectory, { recursive: true });
    await fs.writeFile(path.join(sourceDirectory, 'state.json'), 'old', 'utf8');
    await fs.writeFile(path.join(targetDirectory, 'state.json'), 'current', 'utf8');
    const migrated = await migrateMissingFiles({
      sourceDirectory,
      targetDirectory,
      fileNames: ['state.json'],
      logger: { info() {} },
    });
    assert.deepEqual(migrated, []);
    assert.equal(await fs.readFile(path.join(targetDirectory, 'state.json'), 'utf8'), 'current');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('when migration file name escapes the directory, migration rejects it', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-workstation-safe-'));
  try {
    await assert.rejects(
      migrateMissingFiles({
        sourceDirectory: root,
        targetDirectory: path.join(root, 'target'),
        fileNames: ['../credentials.bin'],
      }),
      /Unsafe migration file name/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
