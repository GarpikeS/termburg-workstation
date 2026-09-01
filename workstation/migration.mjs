import { constants as fsConstants, promises as fs } from 'node:fs';
import path from 'node:path';

export async function migrateMissingFiles({ sourceDirectory, targetDirectory, fileNames, logger = console }) {
  await fs.mkdir(targetDirectory, { recursive: true });
  const migrated = [];

  for (const fileName of fileNames) {
    if (!fileName || path.basename(fileName) !== fileName) {
      throw new Error(`Unsafe migration file name: ${fileName}`);
    }
    const sourcePath = path.join(sourceDirectory, fileName);
    const targetPath = path.join(targetDirectory, fileName);
    try {
      await fs.copyFile(sourcePath, targetPath, fsConstants.COPYFILE_EXCL);
      migrated.push(fileName);
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'EEXIST') throw error;
    }
  }

  if (migrated.length > 0) {
    logger.info?.('Existing Termburg data migrated', { sourceDirectory, targetDirectory, files: migrated });
  }
  return migrated;
}
