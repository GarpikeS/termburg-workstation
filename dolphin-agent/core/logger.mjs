import { appendFileSync, existsSync, renameSync, rmSync, statSync } from 'node:fs';
import { LOG_ROTATE_BYTES } from './constants.mjs';

function serialize(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export function createFileLogger(filePath, options = {}) {
  const maxBytes = options.maxBytes || LOG_ROTATE_BYTES;
  function rotateIfNeeded() {
    try {
      if (!existsSync(filePath) || statSync(filePath).size < maxBytes) return;
      const backup = `${filePath}.1`;
      if (existsSync(backup)) rmSync(backup, { force: true });
      renameSync(filePath, backup);
    } catch {
      // Logging must never stop synchronization.
    }
  }
  function write(level, ...values) {
    rotateIfNeeded();
    const line = `${new Date().toISOString()} ${level.toUpperCase()} ${values.map(serialize).join(' ')}\n`;
    try { appendFileSync(filePath, line, 'utf8'); } catch { /* no-op */ }
    if (options.console) console[level === 'error' ? 'error' : 'log'](line.trim());
  }
  return {
    info: (...values) => write('info', ...values),
    warn: (...values) => write('warn', ...values),
    error: (...values) => write('error', ...values),
  };
}
