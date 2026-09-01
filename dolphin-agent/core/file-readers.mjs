import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { MAX_SOURCE_FILE_BYTES, MAX_SOURCE_ROWS, SUPPORTED_EXTENSIONS } from './constants.mjs';
import { decodeTabularBuffer, parseDelimited } from './delimited.mjs';

const execFileAsync = promisify(execFile);

export class SourceFileError extends Error {
  constructor(message, code = 'SOURCE_FILE_ERROR') {
    super(message);
    this.name = 'SourceFileError';
    this.code = code;
  }
}

function powerShellExecutable() {
  if (process.platform !== 'win32') return 'powershell';
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  return path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

async function readExcel(filePath, excelReaderPath, commandRunner = execFileAsync) {
  if (!excelReaderPath) throw new SourceFileError('Не найден модуль чтения Excel.', 'EXCEL_READER_MISSING');
  try {
    const { stdout } = await commandRunner(powerShellExecutable(), [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      excelReaderPath,
      '-Path',
      filePath,
      '-MaxRows',
      String(MAX_SOURCE_ROWS),
    ], {
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
      encoding: 'utf8',
    });
    const payload = JSON.parse(String(stdout).replace(/^\uFEFF/, '').trim());
    if (!payload?.ok || !Array.isArray(payload.rows)) throw new Error('неверный ответ Excel');
    return payload.rows;
  } catch (error) {
    const details = String(error?.stderr || error?.message || error).trim();
    const excelUnavailable = /cannot create ActiveX component|retrieving the COM class factory|0x80040154|invalid class string/i.test(details);
    throw new SourceFileError(
      excelUnavailable
        ? 'На компьютере нет Microsoft Excel. Настройте выгрузку Dolphin в CSV.'
        : `Не удалось прочитать Excel: ${details.slice(0, 300)}`,
      excelUnavailable ? 'EXCEL_UNAVAILABLE' : 'EXCEL_READ_FAILED',
    );
  }
}

async function readJsonRows(filePath) {
  const value = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const rows = Array.isArray(value) ? value : value?.rows;
  if (!Array.isArray(rows)) throw new SourceFileError('JSON должен содержать массив rows.', 'INVALID_JSON_ROWS');
  return rows;
}

export async function readDolphinFile(filePath, options = {}) {
  const resolved = path.resolve(filePath);
  const extension = path.extname(resolved).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new SourceFileError(`Формат ${extension || 'без расширения'} не поддерживается.`, 'UNSUPPORTED_FILE');
  }
  const stat = await fs.stat(resolved);
  if (!stat.isFile()) throw new SourceFileError('Выбранный путь не является файлом.', 'NOT_A_FILE');
  if (stat.size > MAX_SOURCE_FILE_BYTES) throw new SourceFileError('Файл больше 20 МиБ.', 'FILE_TOO_LARGE');

  let rows;
  if (extension === '.xls' || extension === '.xlsx') {
    rows = await readExcel(resolved, options.excelReaderPath, options.commandRunner);
  } else if (extension === '.json') {
    rows = await readJsonRows(resolved);
  } else {
    rows = parseDelimited(decodeTabularBuffer(await fs.readFile(resolved)), extension === '.tsv' ? '\t' : undefined);
  }

  if (rows.length > MAX_SOURCE_ROWS) throw new SourceFileError(`В файле больше ${MAX_SOURCE_ROWS} строк.`, 'TOO_MANY_ROWS');
  return rows;
}
