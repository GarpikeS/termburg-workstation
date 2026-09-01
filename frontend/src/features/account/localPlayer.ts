const PLAYER_ID_KEY = 'termliny-player-id';

function createPlayerId(): string {
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(3);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  const fallbackPart = Math.random().toString(16).slice(2, 8).padEnd(6, '0');
  return fallbackPart.toUpperCase();
}

export function getLocalPlayerId(): string {
  try {
    const saved = localStorage.getItem(PLAYER_ID_KEY)?.trim().toUpperCase();
    if (saved && /^[A-F0-9]{6}$/.test(saved)) return saved;

    const next = createPlayerId();
    localStorage.setItem(PLAYER_ID_KEY, next);
    return next;
  } catch {
    return 'ГОСТЬ';
  }
}

export function getLocalPlayerLabel(): string {
  return `Игрок ${getLocalPlayerId()}`;
}
