import type { PlayerProgress } from '@/types/game';
import { MAX_LIVES, syncLifeProgress } from './lives';
import { normalizePetState } from '@/engine/engine-pet/petEngine';
import { createDailyGameRewards, normalizeDailyGameRewards } from '@/data/economy';
import {
  FOUR_GAME_CHALLENGE_ID,
  backfillFourGameChallengeProgress,
  createFourGameChallengeProgress,
} from '@/features/rewards/fourGameChallenge';
import {
  GAME_LEVEL_TOTAL,
  SLAVICH_LEVEL_TOTAL,
  SLAVICH_PROGRESS_VERSION,
  migrateLegacySlavichCompletedLevels,
} from '@/data/gameProgression';

const STORAGE_KEY = 'termliny-progress';
const STORAGE_OWNER_KEY = 'termliny-progress-owner';
export const GUEST_PROGRESS_OWNER = 'guest';
export const UNKNOWN_ACCOUNT_PROGRESS_OWNER = 'account:unknown';

function normalizeProgressOwner(value: string | null): string | null {
  if (value === GUEST_PROGRESS_OWNER) return value;
  if (value?.startsWith('account:') && value.length <= 120) return value;
  return null;
}

export function accountProgressOwner(accountId: string): string {
  return `account:${accountId}`;
}

const DEFAULT_PROGRESS: PlayerProgress = {
  currentLevel: 1,
  levels: {},
  currency: 0,
  dailyGameRewards: createDailyGameRewards(),
  fourGameChallenge: createFourGameChallengeProgress(),
  lives: MAX_LIVES,
  nextLifeAt: null,
  selectedCharacter: 'yaromir',
  tutorialCompleted: false,
  tutorialFlags: [],
  best2048Score: 0,
  game2048ProgressVersion: SLAVICH_PROGRESS_VERSION,
  game2048LevelsCompleted: 0,
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
    fourGameChallenge: createFourGameChallengeProgress(),
    tutorialFlags: [],
    unlockedCharacters: ['yaromir'],
    inventory: {},
    rewardClaims: [],
    cart: [],
    orders: [],
  };
}

interface NormalizeProgressOptions {
  preserveDailyGameRewards?: boolean;
  preserveRewardClaims?: boolean;
}

export function normalizeProgress(
  value: unknown,
  { preserveDailyGameRewards = false, preserveRewardClaims = false }: NormalizeProgressOptions = {},
): PlayerProgress {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const parsed = { ...DEFAULT_PROGRESS, ...source } as PlayerProgress;
  parsed.currentLevel = Math.max(1, Math.min(GAME_LEVEL_TOTAL + 1, Math.floor(Number(parsed.currentLevel) || 1)));
  parsed.best2048Score = Math.max(0, Math.floor(Number(parsed.best2048Score) || 0));
  const storedSlavichVersion = Number(source.game2048ProgressVersion);
  const storedSlavichLevels = Math.max(
    0,
    Math.min(GAME_LEVEL_TOTAL, Math.floor(Number(source.game2048LevelsCompleted) || 0)),
  );
  const hasCurrentSlavichProgress = storedSlavichVersion === SLAVICH_PROGRESS_VERSION;
  parsed.game2048LevelsCompleted = hasCurrentSlavichProgress
    ? Math.min(SLAVICH_LEVEL_TOTAL, storedSlavichLevels)
    : migrateLegacySlavichCompletedLevels(storedSlavichLevels, parsed.best2048Score);
  parsed.game2048ProgressVersion = SLAVICH_PROGRESS_VERSION;
  parsed.bubbleLevelsCompleted = Math.max(0, Math.min(GAME_LEVEL_TOTAL, Math.floor(Number(parsed.bubbleLevelsCompleted) || 0)));
  const storedLevels = parsed.levels && typeof parsed.levels === 'object' && !Array.isArray(parsed.levels)
    ? parsed.levels
    : {};
  parsed.levels = Object.fromEntries(
    Object.entries(storedLevels).filter(([id]) => {
      const numericId = Number(id);
      return Number.isInteger(numericId) && numericId >= 1 && numericId <= GAME_LEVEL_TOTAL;
    }),
  );
  if (!Array.isArray(parsed.tutorialFlags)) parsed.tutorialFlags = [];
  if (!preserveRewardClaims || !Array.isArray(parsed.rewardClaims)) parsed.rewardClaims = [];
  if (
    !parsed.petDeparture
    || typeof parsed.petDeparture.name !== 'string'
    || typeof parsed.petDeparture.characterId !== 'string'
    || !['hunger', 'happiness', 'energy', 'cleanliness'].includes(parsed.petDeparture.depletedStat)
  ) {
    parsed.petDeparture = null;
  } else {
    parsed.petDeparture = {
      ...parsed.petDeparture,
      experience: Number.isFinite(parsed.petDeparture.experience)
        ? Math.max(0, Math.floor(parsed.petDeparture.experience ?? 0))
        : 0,
      companionExperience: Number.isFinite(parsed.petDeparture.companionExperience)
        ? Math.min(
            Math.max(0, Math.floor(parsed.petDeparture.experience ?? 0)),
            Math.max(0, Math.floor(parsed.petDeparture.companionExperience ?? 0)),
          )
        : 0,
    };
  }
  if (parsed.pet) parsed.pet = normalizePetState(parsed.pet);
  if (!preserveDailyGameRewards) {
    parsed.dailyGameRewards = normalizeDailyGameRewards(parsed.dailyGameRewards);
  }
  parsed.fourGameChallenge = backfillFourGameChallengeProgress(parsed.fourGameChallenge, {
    ...parsed,
    // A completed legacy micro-level keeps one campaign credit, but cannot
    // unlock all four credits merely because the old counter was large.
    game2048LevelsCompleted: Math.max(
      parsed.game2048LevelsCompleted,
      !hasCurrentSlavichProgress && storedSlavichLevels > 0 ? 1 : 0,
    ),
  });
  return syncLifeProgress(parsed);
}

export function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProgress();
    const storedValue = JSON.parse(raw) as Record<string, unknown> | null;
    const storedClaims: unknown[] = Array.isArray(storedValue?.rewardClaims) ? storedValue.rewardClaims : [];
    const hadAccountCampaignClaim = storedClaims.some(claim => (
      Boolean(claim)
      && typeof claim === 'object'
      && (claim as { campaignId?: unknown }).campaignId === FOUR_GAME_CHALLENGE_ID
    ));
    const owner = normalizeProgressOwner(localStorage.getItem(STORAGE_OWNER_KEY))
      ?? (hadAccountCampaignClaim ? UNKNOWN_ACCOUNT_PROGRESS_OWNER : GUEST_PROGRESS_OWNER);
    const normalized = normalizeProgress(storedValue);
    saveProgress(normalized, owner);
    return normalized;
  } catch {
    return createDefaultProgress();
  }
}

export function loadProgressOwner(): string {
  try {
    return normalizeProgressOwner(localStorage.getItem(STORAGE_OWNER_KEY)) ?? GUEST_PROGRESS_OWNER;
  } catch {
    return UNKNOWN_ACCOUNT_PROGRESS_OWNER;
  }
}

export function saveProgress(progress: PlayerProgress, owner = GUEST_PROGRESS_OWNER): void {
  try {
    const safeOwner = normalizeProgressOwner(owner) ?? GUEST_PROGRESS_OWNER;
    const persisted = {
      ...progress,
      // Reward codes are server-owned secrets and are restored after the viewer is identified.
      rewardClaims: [],
    };
    localStorage.setItem(STORAGE_OWNER_KEY, safeOwner);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // localStorage full or unavailable
  }
}

export function resetProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_OWNER_KEY);
  } catch {
    // localStorage unavailable
  }
}
