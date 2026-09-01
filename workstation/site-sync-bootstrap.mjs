import { promises as fs } from 'node:fs';
import path from 'node:path';

const REQUIRED_LOCATION_IDS = ['1', '2'];

function validateEndpoint(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ''));
  } catch {
    throw new Error('Invalid embedded schedule endpoint.');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('Embedded schedule endpoint must use HTTPS.');
  }
  return parsed.toString();
}

function validateLocation(value, locationId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Missing embedded schedule connection for location ${locationId}.`);
  }
  const token = typeof value.token === 'string' ? value.token.trim() : '';
  if (token.length < 20 || token.length > 256) {
    throw new Error(`Invalid embedded schedule token for location ${locationId}.`);
  }
  return {
    endpoint: validateEndpoint(value.endpoint),
    authMode: value.authMode === 'x-api-key' ? 'x-api-key' : 'bearer',
    complexCode: String(value.complexCode || '').trim().slice(0, 80),
    token,
  };
}

export function normalizeEmbeddedSiteSync(value) {
  if (!value || typeof value !== 'object' || value.version !== 1) {
    throw new Error('Invalid embedded schedule connection file.');
  }
  const sourceLocations = value.locations && typeof value.locations === 'object'
    ? value.locations
    : {};
  const locations = {};
  for (const locationId of REQUIRED_LOCATION_IDS) {
    locations[locationId] = validateLocation(sourceLocations[locationId], locationId);
  }
  return { version: 1, locations };
}

async function readJsonOrFallback(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return fallback;
    throw error;
  }
}

export async function applyEmbeddedSiteSyncDefaults({ embeddedFile, targetFile, logger = console }) {
  let embeddedValue;
  try {
    embeddedValue = JSON.parse(await fs.readFile(embeddedFile, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      logger.warn?.('Embedded schedule connections are not present in this build.');
      return { embedded: false, applied: false, locationIds: [] };
    }
    throw error;
  }

  const embedded = normalizeEmbeddedSiteSync(embeddedValue);
  const currentValue = await readJsonOrFallback(targetFile, { locations: {} });
  const current = currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)
    ? currentValue
    : { locations: {} };
  const currentLocations = current.locations && typeof current.locations === 'object'
    ? current.locations
    : {};
  const locations = { ...currentLocations };

  for (const locationId of REQUIRED_LOCATION_IDS) {
    const previous = currentLocations[locationId] && typeof currentLocations[locationId] === 'object'
      ? currentLocations[locationId]
      : {};
    locations[locationId] = {
      ...previous,
      ...embedded.locations[locationId],
    };
  }

  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  const temporaryFile = `${targetFile}.${process.pid}.tmp`;
  await fs.writeFile(temporaryFile, `${JSON.stringify({ ...current, locations }, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await fs.rename(temporaryFile, targetFile);
  logger.info?.('Embedded schedule connections applied.', { locationIds: REQUIRED_LOCATION_IDS });
  return { embedded: true, applied: true, locationIds: [...REQUIRED_LOCATION_IDS] };
}
