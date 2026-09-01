import type { PlayerProgress } from '@/types/game';

export const MAX_LIVES = 5;
export const LIFE_REGEN_MS = 15 * 60 * 1000;
export const LIFE_PRICE = 10;

export function syncLifeProgress(
  progress: PlayerProgress,
  now = Date.now(),
): PlayerProgress {
  const safeLives = Math.max(0, Math.min(MAX_LIVES, Math.floor(progress.lives)));

  if (safeLives >= MAX_LIVES) {
    if (progress.lives === MAX_LIVES && progress.nextLifeAt === null) return progress;
    return { ...progress, lives: MAX_LIVES, nextLifeAt: null };
  }

  if (!progress.nextLifeAt || !Number.isFinite(progress.nextLifeAt)) {
    return { ...progress, lives: safeLives, nextLifeAt: now + LIFE_REGEN_MS };
  }

  const nextLifeAt = Math.min(progress.nextLifeAt, now + LIFE_REGEN_MS);

  if (now < nextLifeAt) {
    if (safeLives === progress.lives && nextLifeAt === progress.nextLifeAt) return progress;
    return { ...progress, lives: safeLives, nextLifeAt };
  }

  const recovered = Math.floor((now - nextLifeAt) / LIFE_REGEN_MS) + 1;
  const lives = Math.min(MAX_LIVES, safeLives + recovered);
  const followingLifeAt = lives < MAX_LIVES
    ? nextLifeAt + recovered * LIFE_REGEN_MS
    : null;

  return { ...progress, lives, nextLifeAt: followingLifeAt };
}

export function spendLifeProgress(
  progress: PlayerProgress,
  now = Date.now(),
): PlayerProgress {
  const synced = syncLifeProgress(progress, now);
  if (synced.lives <= 0) return synced;

  return {
    ...synced,
    lives: synced.lives - 1,
    nextLifeAt: synced.nextLifeAt ?? now + LIFE_REGEN_MS,
  };
}

export function buyLifeProgress(
  progress: PlayerProgress,
  now = Date.now(),
): PlayerProgress {
  const synced = syncLifeProgress(progress, now);
  if (synced.lives >= MAX_LIVES || synced.currency < LIFE_PRICE) return synced;

  const lives = synced.lives + 1;

  return {
    ...synced,
    currency: synced.currency - LIFE_PRICE,
    lives,
    nextLifeAt: lives >= MAX_LIVES ? null : synced.nextLifeAt,
  };
}
