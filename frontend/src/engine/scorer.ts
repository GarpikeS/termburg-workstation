import type { MatchGroup } from '@/types/game';

const BASE_SCORES: Record<number, number> = {
  3: 50,
  4: 150,
  5: 500,
};

export function calculateMatchScore(matches: MatchGroup[], combo: number): number {
  let total = 0;
  const comboMultiplier = 1 + 0.25 * combo;

  for (const group of matches) {
    const len = group.positions.length;
    const base = BASE_SCORES[Math.min(len, 5)] ?? BASE_SCORES[5];
    total += base;
  }

  return Math.round(total * comboMultiplier);
}

export function getStars(score: number, thresholds: [number, number, number]): number {
  if (score >= thresholds[2]) return 3;
  if (score >= thresholds[1]) return 2;
  if (score >= thresholds[0]) return 1;
  return 0;
}

export function getReward(stars: number, baseReward: number): number {
  if (stars === 3) return baseReward;
  if (stars === 2) return Math.round(baseReward * 0.75);
  if (stars === 1) return Math.round(baseReward * 0.5);
  return 0;
}
