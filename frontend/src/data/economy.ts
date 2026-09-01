import type { DailyGameRewards, GameRewardSource } from '../types/game.ts';

export const STANDARD_WIN_REWARD = 10;
export const PET_DAILY_REWARD = 10;
export const DAILY_GAME_REWARD_LIMIT = 30;
export const DAILY_TOTAL_REWARD_LIMIT = 120;

export const SLAVICH_MILESTONE_REWARDS = [
  { tile: 512, reward: 5 },
  { tile: 1024, reward: 10 },
  { tile: 2048, reward: 15 },
] as const;

export function getSlavichMilestoneRewards(maxTile: number, rewarded: ReadonlySet<number>) {
  return SLAVICH_MILESTONE_REWARDS.filter(({ tile }) => maxTile >= tile && !rewarded.has(tile));
}

export const GAME_REWARD_SOURCES: readonly GameRewardSource[] = [
  'match3',
  'game2048',
  'bubbles',
  'pet',
];

export const GAME_REWARD_LABELS: Record<GameRewardSource, string> = {
  match3: 'Хоровод',
  game2048: 'Славич',
  bubbles: 'Бирюльки',
  pet: 'Пестун',
};

export function getRewardDateKey(now = Date.now()): string {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createDailyGameRewards(now = Date.now()): DailyGameRewards {
  return {
    date: getRewardDateKey(now),
    earned: {
      match3: 0,
      game2048: 0,
      bubbles: 0,
      pet: 0,
    },
  };
}

function normalizeEarned(value: unknown): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(DAILY_GAME_REWARD_LIMIT, Math.floor(Number(value))))
    : 0;
}

export function normalizeDailyGameRewards(
  rewards: DailyGameRewards | null | undefined,
  now = Date.now(),
): DailyGameRewards {
  const currentDate = getRewardDateKey(now);
  if (!rewards || rewards.date !== currentDate || !rewards.earned) {
    return createDailyGameRewards(now);
  }

  return {
    date: currentDate,
    earned: {
      match3: normalizeEarned(rewards.earned.match3),
      game2048: normalizeEarned(rewards.earned.game2048),
      bubbles: normalizeEarned(rewards.earned.bubbles),
      pet: normalizeEarned(rewards.earned.pet),
    },
  };
}

export function getDailyRewardTotal(rewards: DailyGameRewards | null | undefined, now = Date.now()): number {
  const current = normalizeDailyGameRewards(rewards, now);
  return GAME_REWARD_SOURCES.reduce((total, source) => total + current.earned[source], 0);
}

export function awardDailyGameReward(
  rewards: DailyGameRewards | null | undefined,
  source: GameRewardSource,
  requested: number,
  now = Date.now(),
): { awarded: number; rewards: DailyGameRewards } {
  const current = normalizeDailyGameRewards(rewards, now);
  const safeRequested = Number.isFinite(requested) ? Math.max(0, Math.floor(requested)) : 0;
  const gameRoom = DAILY_GAME_REWARD_LIMIT - current.earned[source];
  const totalRoom = DAILY_TOTAL_REWARD_LIMIT - getDailyRewardTotal(current, now);
  const awarded = Math.max(0, Math.min(safeRequested, gameRoom, totalRoom));

  if (awarded === 0) return { awarded, rewards: current };

  return {
    awarded,
    rewards: {
      ...current,
      earned: {
        ...current.earned,
        [source]: current.earned[source] + awarded,
      },
    },
  };
}
