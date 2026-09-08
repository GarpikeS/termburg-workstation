export const GAME_LEVEL_TOTAL = 50;

export const SLAVICH_LEVEL_TOTAL = 4;
export const SLAVICH_PROGRESS_VERSION = 2 as const;
export const SLAVICH_LEVEL_TARGETS = [800, 1600, 2400, 3200] as const;
const LEGACY_SLAVICH_LEVEL_SCORE_STEP = 64;

export function clampGameLevel(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(GAME_LEVEL_TOTAL, Math.floor(value)));
}

export function getNextPlayableLevel(completedLevels: number): number {
  if (!Number.isFinite(completedLevels)) return 1;
  return clampGameLevel(Math.floor(completedLevels) + 1);
}

export function clampSlavichLevel(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(SLAVICH_LEVEL_TOTAL, Math.floor(value)));
}

export function getNextPlayableSlavichLevel(completedLevels: number): number {
  if (!Number.isFinite(completedLevels)) return 1;
  return clampSlavichLevel(Math.floor(completedLevels) + 1);
}

export function getSlavichLevelTarget(level: number): number {
  return SLAVICH_LEVEL_TARGETS[clampSlavichLevel(level) - 1];
}

export function isSlavichLevelComplete(score: number, level: number): boolean {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  return safeScore >= getSlavichLevelTarget(level);
}

export function migrateLegacySlavichCompletedLevels(
  completedLevels: number,
  bestScore: number,
): number {
  const safeLegacyLevels = Number.isFinite(completedLevels)
    ? Math.max(0, Math.min(GAME_LEVEL_TOTAL, Math.floor(completedLevels)))
    : 0;
  const safeBestScore = Number.isFinite(bestScore) ? Math.max(0, Math.floor(bestScore)) : 0;
  const legacyScoreEvidence = Math.max(
    safeBestScore,
    safeLegacyLevels * LEGACY_SLAVICH_LEVEL_SCORE_STEP,
  );
  const completedMilestones = SLAVICH_LEVEL_TARGETS.filter(target => target <= legacyScoreEvidence).length;
  // Anyone who had already cleared a legacy micro-level keeps a visible first
  // stage instead of completing the new stage 1 without seeing progress move.
  return safeLegacyLevels > 0 ? Math.max(1, completedMilestones) : completedMilestones;
}
