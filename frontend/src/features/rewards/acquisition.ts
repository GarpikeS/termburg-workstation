const SOURCE_KEY = 'termliny-entry-source';
const DEFAULT_SOURCE = 'direct';

function cleanSource(value: string | null): string {
  const normalized = value?.trim().toLowerCase() ?? '';
  return /^[a-z0-9_-]{2,80}$/.test(normalized) ? normalized : DEFAULT_SOURCE;
}

export function rememberEntrySource(search: string): void {
  const source = cleanSource(new URLSearchParams(search).get('source'));
  if (source === DEFAULT_SOURCE) return;
  localStorage.setItem(SOURCE_KEY, source);
}

export function getEntrySource(): string {
  return cleanSource(localStorage.getItem(SOURCE_KEY));
}
