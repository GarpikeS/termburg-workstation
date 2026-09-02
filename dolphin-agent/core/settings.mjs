import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DEFAULT_ENDPOINT } from './constants.mjs';

function deviceIdPrefix(value) {
  const prefix = String(value || 'dolphin').trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(prefix) && prefix.length <= 40
    ? prefix
    : 'dolphin';
}

export function defaultSettings(downloadsFolder, options = {}) {
  return {
    version: 1,
    endpoint: DEFAULT_ENDPOINT,
    watchFolder: downloadsFolder,
    timezoneOffset: '+03:00',
    autoSync: true,
    autoStart: true,
    deviceId: `${deviceIdPrefix(options.deviceIdPrefix)}-${randomUUID()}`,
  };
}

function sanitizeEndpoint(value) {
  try {
    const url = new URL(String(value || DEFAULT_ENDPOINT));
    if (url.protocol !== 'https:') return DEFAULT_ENDPOINT;
    return url.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_ENDPOINT;
  }
}

export function sanitizeSettings(value, defaults) {
  const source = value && typeof value === 'object' ? value : {};
  const timezoneOffset = /^[-+]\d{2}:\d{2}$/.test(source.timezoneOffset || '')
    ? source.timezoneOffset
    : defaults.timezoneOffset;
  const deviceId = /^[a-zA-Z0-9-]{16,80}$/.test(source.deviceId || '')
    ? source.deviceId
    : defaults.deviceId;
  return {
    ...defaults,
    endpoint: sanitizeEndpoint(source.endpoint),
    watchFolder: typeof source.watchFolder === 'string' && source.watchFolder.trim()
      ? path.resolve(source.watchFolder.trim())
      : defaults.watchFolder,
    timezoneOffset,
    autoSync: source.autoSync !== false,
    autoStart: source.autoStart !== false,
    deviceId,
  };
}

export async function loadSettings(filePath, defaults) {
  try {
    return sanitizeSettings(JSON.parse(await fs.readFile(filePath, 'utf8')), defaults);
  } catch (error) {
    if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    return sanitizeSettings({}, defaults);
  }
}

export async function saveSettings(filePath, value, defaults) {
  const settings = sanitizeSettings(value, defaults);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  await fs.copyFile(temporaryPath, filePath);
  await fs.rm(temporaryPath, { force: true });
  return settings;
}
