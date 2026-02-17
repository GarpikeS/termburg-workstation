import type { PlayerProgress } from '@/types/game';

const STORAGE_KEY = 'termliny-progress';

const DEFAULT_PROGRESS: PlayerProgress = {
  currentLevel: 1,
  levels: {},
  currency: 0,
  selectedCharacter: 'yaromir',
  tutorialCompleted: false,
  best2048Score: 0,
  bubbleLevelsCompleted: 0,
  pet: null,
  unlockedCharacters: ['yaromir'],
  cart: [],
  orders: [],
};

export function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = { ...DEFAULT_PROGRESS, ...JSON.parse(raw) };
    // Migrate: add cooldowns to existing pets
    if (parsed.pet && !parsed.pet.cooldowns) {
      parsed.pet = { ...parsed.pet, cooldowns: {} };
    }
    return parsed;
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(progress: PlayerProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // localStorage full or unavailable
  }
}

export function resetProgress(): void {
  localStorage.removeItem(STORAGE_KEY);
}
