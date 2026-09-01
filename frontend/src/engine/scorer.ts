import type { MatchGroup } from '@/types/game';

const BASE_MATCH_SCORE = 50;

export interface MatchScoreBreakdown {
  baseScore: number;
  sizeBonus: number;
  comboMultiplier: number;
  total: number;
  largestMatch: number;
}

export function getMatchSizeBonus(length: number): number {
  if (length === 4) return 100;
  if (length >= 5) return 450 + (length - 5) * 250;
  return 0;
}

export function calculateMatchScoreBreakdown(
  matches: MatchGroup[],
  combo: number,
): MatchScoreBreakdown {
  const baseScore = matches.length * BASE_MATCH_SCORE;
  const sizeBonus = matches.reduce(
    (total, group) => total + getMatchSizeBonus(group.positions.length),
    0,
  );
  const comboMultiplier = 1 + 0.25 * combo;
  const largestMatch = matches.reduce(
    (largest, group) => Math.max(largest, group.positions.length),
    0,
  );

  return {
    baseScore,
    sizeBonus,
    comboMultiplier,
    total: Math.round((baseScore + sizeBonus) * comboMultiplier),
    largestMatch,
  };
}

export function calculateMatchScore(matches: MatchGroup[], combo: number): number {
  return calculateMatchScoreBreakdown(matches, combo).total;
}

export function getStars(score: number, thresholds: [number, number, number]): number {
  if (score >= thresholds[2]) return 3;
  if (score >= thresholds[1]) return 2;
  if (score >= thresholds[0]) return 1;
  return 0;
}

export function getReward(stars: number, baseReward: number): number {
  return stars >= 0 ? baseReward : 0;
}
