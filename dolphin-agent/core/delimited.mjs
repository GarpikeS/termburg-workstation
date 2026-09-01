function detectEncoding(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf-16le';
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return 'utf-8';
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return 'utf-8';
  } catch {
    return 'windows-1251';
  }
}

export function decodeTabularBuffer(buffer) {
  const encoding = detectEncoding(buffer);
  return new TextDecoder(encoding).decode(buffer).replace(/^\uFEFF/, '');
}

function delimiterScore(line, delimiter) {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    else if (!quoted && line[index] === delimiter) count += 1;
  }
  return count;
}

export function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(line => line.trim()) || '';
  return ['\t', ';', ',']
    .map(delimiter => ({ delimiter, score: delimiterScore(firstLine, delimiter) }))
    .sort((left, right) => right.score - left.score)[0]?.delimiter || ';';
}

export function parseDelimited(text, delimiter = detectDelimiter(text)) {
  const table = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === delimiter) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value.trim())) table.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += character;
  }

  row.push(cell);
  if (row.some(value => value.trim())) table.push(row);
  if (table.length < 2) return [];

  const headers = table[0].map((header, index) => header.trim() || `Колонка ${index + 1}`);
  return table.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}
