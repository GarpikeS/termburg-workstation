import { promises as fs } from 'node:fs';

const LOCATION_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeDeviceProfile(value) {
  const locationCode = String(value?.locationCode || '').trim().toLowerCase();
  if (!LOCATION_PATTERN.test(locationCode) || locationCode.length > 32) return null;
  return {
    version: 1,
    locationCode,
    locationName: String(value?.locationName || locationCode).trim().slice(0, 80),
    deviceIdPrefix: `dolphin-${locationCode}`,
  };
}

export async function readEmbeddedDeviceProfile(filePath) {
  try {
    return normalizeDeviceProfile(JSON.parse(await fs.readFile(filePath, 'utf8')));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}
