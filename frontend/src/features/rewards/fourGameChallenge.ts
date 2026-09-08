import type { FourGameChallengeProgress, GameRewardSource } from '../../types/game.ts';

export const FOUR_GAME_CHALLENGE_ID = 'four-games-v1' as const;

export const FOUR_GAME_CHALLENGE_SOURCES = [
  'game2048',
  'bubbles',
  'pet',
  'match3',
] as const satisfies readonly GameRewardSource[];
export const FOUR_GAME_CHALLENGE_TARGET = 4;

const FOUR_GAME_CHALLENGE_SOURCE_SET = new Set<string>(FOUR_GAME_CHALLENGE_SOURCES);

interface FourGameCompletionEvidence {
  currentLevel?: unknown;
  levels?: unknown;
  game2048LevelsCompleted?: unknown;
  bubbleLevelsCompleted?: unknown;
  pet?: unknown;
  petDeparture?: unknown;
}

function isGameRewardSource(value: unknown): value is GameRewardSource {
  return typeof value === 'string' && FOUR_GAME_CHALLENGE_SOURCE_SET.has(value);
}

export function createFourGameChallengeProgress(): FourGameChallengeProgress {
  return {
    version: 1,
    completedGames: [],
    stageCounts: {
      game2048: 0,
      bubbles: 0,
      pet: 0,
      match3: 0,
    },
  };
}

function normalizeStageCount(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(FOUR_GAME_CHALLENGE_TARGET, Math.floor(numeric)));
}

export function normalizeFourGameChallengeProgress(value: unknown): FourGameChallengeProgress {
  if (!value || typeof value !== 'object') return createFourGameChallengeProgress();

  const completedGames = Array.isArray((value as { completedGames?: unknown }).completedGames)
    ? (value as { completedGames: unknown[] }).completedGames
    : [];
  const completedSet = new Set(completedGames.filter(isGameRewardSource));
  const incomingCounts = (value as { stageCounts?: unknown }).stageCounts;
  const countSource = incomingCounts && typeof incomingCounts === 'object' && !Array.isArray(incomingCounts)
    ? incomingCounts as Partial<Record<GameRewardSource, unknown>>
    : {};
  const stageCounts = Object.fromEntries(FOUR_GAME_CHALLENGE_SOURCES.map(source => [
    source,
    Math.max(normalizeStageCount(countSource[source]), completedSet.has(source) ? 1 : 0),
  ])) as Record<GameRewardSource, number>;

  return {
    version: 1,
    completedGames: FOUR_GAME_CHALLENGE_SOURCES.filter(source => stageCounts[source] > 0),
    stageCounts,
  };
}

export function mergeFourGameChallengeProgress(
  ...progresses: readonly unknown[]
): FourGameChallengeProgress {
  const stageCounts = createFourGameChallengeProgress().stageCounts;

  for (const progress of progresses) {
    const normalized = normalizeFourGameChallengeProgress(progress);
    for (const source of FOUR_GAME_CHALLENGE_SOURCES) {
      stageCounts[source] = Math.max(stageCounts[source], normalized.stageCounts[source]);
    }
  }

  return {
    version: 1,
    completedGames: FOUR_GAME_CHALLENGE_SOURCES.filter(source => stageCounts[source] > 0),
    stageCounts,
  };
}

export function setFourGameStageCount(
  progress: unknown,
  source: unknown,
  completedStages: unknown,
): FourGameChallengeProgress {
  const normalized = normalizeFourGameChallengeProgress(progress);
  if (!isGameRewardSource(source)) return normalized;
  const nextCount = Math.max(normalized.stageCounts[source], normalizeStageCount(completedStages));
  if (nextCount === normalized.stageCounts[source]) return normalized;
  return mergeFourGameChallengeProgress(normalized, {
    version: 1,
    completedGames: [source],
    stageCounts: { ...createFourGameChallengeProgress().stageCounts, [source]: nextCount },
  });
}

export function addFourGameCompletion(
  progress: unknown,
  source: unknown,
): FourGameChallengeProgress {
  const normalized = normalizeFourGameChallengeProgress(progress);
  return setFourGameStageCount(normalized, source, 1);
}

function getCompletedMatch3Levels(evidence: FourGameCompletionEvidence): number {
  const currentLevel = Number(evidence.currentLevel);
  const currentLevelCount = Number.isFinite(currentLevel) ? Math.max(0, Math.floor(currentLevel) - 1) : 0;
  if (!evidence.levels || typeof evidence.levels !== 'object' || Array.isArray(evidence.levels)) {
    return normalizeStageCount(currentLevelCount);
  }
  const completedLevelCount = Object.values(evidence.levels).filter(level => (
    Boolean(level)
    && typeof level === 'object'
    && (level as { completed?: unknown }).completed === true
  )).length;
  return normalizeStageCount(Math.max(currentLevelCount, completedLevelCount));
}

export function getPetChallengeStageCount(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  const experience = Number((value as { experience?: unknown }).experience);
  const companionExperience = Number((value as { companionExperience?: unknown }).companionExperience);
  const safeExperience = Number.isFinite(experience) ? Math.max(0, experience) : 0;
  const safeCompanionExperience = Number.isFinite(companionExperience)
    ? Math.max(0, companionExperience)
    : 0;
  return normalizeStageCount(Math.floor(Math.max(0, safeExperience - safeCompanionExperience) / 100));
}

export function backfillFourGameChallengeProgress(
  value: unknown,
  evidence: FourGameCompletionEvidence,
): FourGameChallengeProgress {
  let progress = normalizeFourGameChallengeProgress(value);
  const completed2048 = Number(evidence.game2048LevelsCompleted);
  const completedBubbles = Number(evidence.bubbleLevelsCompleted);

  progress = setFourGameStageCount(progress, 'game2048', completed2048);
  progress = setFourGameStageCount(progress, 'bubbles', completedBubbles);
  progress = setFourGameStageCount(progress, 'match3', getCompletedMatch3Levels(evidence));
  progress = setFourGameStageCount(progress, 'pet', Math.max(
    getPetChallengeStageCount(evidence.pet),
    getPetChallengeStageCount(evidence.petDeparture),
  ));

  return progress;
}

export function getFourGameChallengeCount(progress: unknown): number {
  const normalized = normalizeFourGameChallengeProgress(progress);
  return Math.min(
    FOUR_GAME_CHALLENGE_TARGET,
    FOUR_GAME_CHALLENGE_SOURCES.reduce((total, source) => total + normalized.stageCounts[source], 0),
  );
}

export function isFourGameChallengeComplete(progress: unknown): boolean {
  return getFourGameChallengeCount(progress) >= FOUR_GAME_CHALLENGE_TARGET;
}
