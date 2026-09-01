import type { PlayerProgress } from '@/types/game';
import { MAX_LIVES, syncLifeProgress } from './lives';
import { normalizePetState } from '@/engine/engine-pet/petEngine';
import { createDailyGameRewards, normalizeDailyGameRewards } from '@/data/economy';

const STORAGE_KEY = 'termliny-progress';

const DEFAULT_PROGRESS: PlayerProgress = {
  currentLevel: 1,
  levels: {},
  currency: 0,
  dailyGameRewards: createDailyGameRewards(),
  lives: MAX_LIVES,
  nextLifeAt: null,
  selectedCharacter: 'yaromir',
  tutorialCompleted: false,
  tutorialFlags: [],
  best2048Score: 0,
  bubbleLevelsCompleted: 0,
  pet: null,
  petDeparture: null,
  unlockedCharacters: ['yaromir'],
  inventory: {},
  rewardClaims: [],
  cart: [],
  orders: [],
};

export function createDefaultProgress(): PlayerProgress {
  return {
    ...DEFAULT_PROGRESS,
    levels: {},
    dailyGameRewards: createDailyGameRewards(),
    tutorialFlags: [],
    unlockedCharacters: ['yaromir'],
    inventory: {},
    rewardClaims: [],
    cart: [],
    orders: [],
  };
}

export function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProgress();
    const parsed = { ...DEFAULT_PROGRESS, ...JSON.parse(raw) } as PlayerProgress;
    if (!Array.isArray(parsed.tutorialFlags)) {
      parsed.tutorialFlags = [];
    }
    if (!Array.isArray(parsed.rewardClaims)) {
      parsed.rewardClaims = [];
    } else {
      parsed.rewardClaims = parsed.rewardClaims.filter(claim => (
        claim
        && claim.rewardId === 'ticket-free'
        && typeof claim.id === 'string'
        && typeof claim.code === 'string'
        && Number.isFinite(claim.purchasedAt)
        && Number.isFinite(claim.expiresAt)
        && Number.isFinite(claim.nextPurchaseAt)
        && (claim.status === undefined || ['active', 'redeemed', 'expired'].includes(claim.status))
        && (claim.redeemedAt === undefined || Number.isFinite(claim.redeemedAt))
      ));
    }
    if (
      !parsed.petDeparture
      || typeof parsed.petDeparture.name !== 'string'
      || typeof parsed.petDeparture.characterId !== 'string'
      || !['hunger', 'happiness', 'energy', 'cleanliness'].includes(parsed.petDeparture.depletedStat)
    ) {
      parsed.petDeparture = null;
    }
    if (parsed.pet) parsed.pet = normalizePetState(parsed.pet);
    parsed.dailyGameRewards = normalizeDailyGameRewards(parsed.dailyGameRewards);
    return syncLifeProgress(parsed);
  } catch {
    return createDefaultProgress();
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
