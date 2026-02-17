import { TokenType, type LevelConfig } from '@/types/game';

const W = TokenType.Water;
const L = TokenType.Leaf;
const S = TokenType.Stone;
const St = TokenType.Steam;
const F = TokenType.Fire;
const Wd = TokenType.Wood;

export const levels: LevelConfig[] = [
  // Levels 1-5: Yaromir, 7x7, 3 token types, tutorial
  {
    id: 1, rows: 7, cols: 7, tokenTypes: [W, L, S], moves: 30,
    objectives: [{ type: W, target: 15 }],
    starThresholds: [500, 1000, 2000], reward: 50, characterId: 'yaromir',
  },
  {
    id: 2, rows: 7, cols: 7, tokenTypes: [W, L, S], moves: 28,
    objectives: [{ type: L, target: 18 }],
    starThresholds: [600, 1200, 2200], reward: 50, characterId: 'yaromir',
  },
  {
    id: 3, rows: 7, cols: 7, tokenTypes: [W, L, S], moves: 27,
    objectives: [{ type: S, target: 15 }],
    starThresholds: [700, 1400, 2500], reward: 60, characterId: 'yaromir',
  },
  {
    id: 4, rows: 7, cols: 7, tokenTypes: [W, L, S], moves: 26,
    objectives: [{ type: W, target: 20 }],
    starThresholds: [800, 1600, 2800], reward: 60, characterId: 'yaromir',
  },
  {
    id: 5, rows: 7, cols: 7, tokenTypes: [W, L, S], moves: 25,
    objectives: [{ type: L, target: 20 }],
    starThresholds: [900, 1800, 3000], reward: 70, characterId: 'yaromir',
  },

  // Levels 6-10: Valkiriya, 7x7, 4 token types, 2 objectives
  {
    id: 6, rows: 7, cols: 7, tokenTypes: [W, L, S, St], moves: 25,
    objectives: [{ type: W, target: 12 }, { type: St, target: 10 }],
    starThresholds: [1000, 2000, 3500], reward: 80, characterId: 'valkiriya',
  },
  {
    id: 7, rows: 7, cols: 7, tokenTypes: [W, L, S, St], moves: 24,
    objectives: [{ type: L, target: 15 }, { type: S, target: 12 }],
    starThresholds: [1100, 2200, 3800], reward: 80, characterId: 'valkiriya',
  },
  {
    id: 8, rows: 7, cols: 7, tokenTypes: [W, L, S, St], moves: 23,
    objectives: [{ type: St, target: 15 }, { type: W, target: 15 }],
    starThresholds: [1200, 2400, 4000], reward: 90, characterId: 'valkiriya',
  },
  {
    id: 9, rows: 7, cols: 7, tokenTypes: [W, L, S, St], moves: 22,
    objectives: [{ type: S, target: 18 }, { type: L, target: 12 }],
    starThresholds: [1300, 2600, 4200], reward: 90, characterId: 'valkiriya',
  },
  {
    id: 10, rows: 7, cols: 7, tokenTypes: [W, L, S, St], moves: 20,
    objectives: [{ type: W, target: 18 }, { type: St, target: 15 }],
    starThresholds: [1500, 3000, 4500], reward: 100, characterId: 'valkiriya',
  },

  // Levels 11-15: Pereslav, 8x8, 5 token types
  {
    id: 11, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F], moves: 20,
    objectives: [{ type: F, target: 12 }, { type: W, target: 15 }],
    starThresholds: [1500, 3000, 5000], reward: 110, characterId: 'pereslav',
  },
  {
    id: 12, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F], moves: 20,
    objectives: [{ type: S, target: 18 }, { type: St, target: 12 }],
    starThresholds: [1600, 3200, 5200], reward: 110, characterId: 'pereslav',
  },
  {
    id: 13, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F], moves: 20,
    objectives: [{ type: L, target: 20 }, { type: F, target: 15 }],
    starThresholds: [1700, 3400, 5500], reward: 120, characterId: 'pereslav',
  },
  {
    id: 14, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F], moves: 20,
    objectives: [{ type: W, target: 20 }, { type: S, target: 18 }],
    starThresholds: [1800, 3600, 5800], reward: 120, characterId: 'pereslav',
  },
  {
    id: 15, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F], moves: 20,
    objectives: [{ type: St, target: 20 }, { type: F, target: 18 }],
    starThresholds: [2000, 4000, 6000], reward: 130, characterId: 'pereslav',
  },

  // Levels 16-20: Kazimir, 8x8, 5 types, harder
  {
    id: 16, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F], moves: 18,
    objectives: [{ type: F, target: 20 }, { type: W, target: 15 }, { type: L, target: 10 }],
    starThresholds: [2000, 4000, 6500], reward: 140, characterId: 'kazimir',
  },
  {
    id: 17, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F], moves: 18,
    objectives: [{ type: S, target: 22 }, { type: St, target: 18 }],
    starThresholds: [2200, 4400, 7000], reward: 140, characterId: 'kazimir',
  },
  {
    id: 18, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F], moves: 18,
    objectives: [{ type: W, target: 25 }, { type: F, target: 20 }],
    starThresholds: [2400, 4800, 7500], reward: 150, characterId: 'kazimir',
  },
  {
    id: 19, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F], moves: 18,
    objectives: [{ type: L, target: 22 }, { type: S, target: 20 }, { type: St, target: 15 }],
    starThresholds: [2600, 5200, 8000], reward: 150, characterId: 'kazimir',
  },
  {
    id: 20, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F], moves: 18,
    objectives: [{ type: F, target: 25 }, { type: W, target: 22 }],
    starThresholds: [2800, 5600, 8500], reward: 160, characterId: 'kazimir',
  },

  // Levels 21-25: Vedagor/Milovan, 8x8, 6 types
  {
    id: 21, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F, Wd], moves: 18,
    objectives: [{ type: Wd, target: 15 }, { type: W, target: 20 }],
    starThresholds: [3000, 6000, 9000], reward: 170, characterId: 'vedagor',
  },
  {
    id: 22, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F, Wd], moves: 17,
    objectives: [{ type: Wd, target: 18 }, { type: F, target: 18 }, { type: L, target: 15 }],
    starThresholds: [3200, 6400, 9500], reward: 170, characterId: 'vedagor',
  },
  {
    id: 23, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F, Wd], moves: 16,
    objectives: [{ type: S, target: 20 }, { type: St, target: 18 }],
    starThresholds: [3400, 6800, 10000], reward: 180, characterId: 'milovan',
  },
  {
    id: 24, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F, Wd], moves: 16,
    objectives: [{ type: Wd, target: 20 }, { type: W, target: 22 }, { type: F, target: 15 }],
    starThresholds: [3600, 7200, 10500], reward: 180, characterId: 'milovan',
  },
  {
    id: 25, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F, Wd], moves: 15,
    objectives: [{ type: L, target: 25 }, { type: Wd, target: 20 }],
    starThresholds: [3800, 7600, 11000], reward: 190, characterId: 'milovan',
  },

  // Levels 26-30: Lelya, 8x8, 6 types, hardcore
  {
    id: 26, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F, Wd], moves: 15,
    objectives: [{ type: W, target: 25 }, { type: St, target: 22 }, { type: Wd, target: 18 }],
    starThresholds: [4000, 8000, 12000], reward: 200, characterId: 'lelya',
  },
  {
    id: 27, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F, Wd], moves: 14,
    objectives: [{ type: F, target: 25 }, { type: L, target: 22 }],
    starThresholds: [4200, 8400, 12500], reward: 200, characterId: 'lelya',
  },
  {
    id: 28, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F, Wd], moves: 13,
    objectives: [{ type: S, target: 28 }, { type: Wd, target: 22 }, { type: St, target: 20 }],
    starThresholds: [4500, 9000, 13000], reward: 220, characterId: 'lelya',
  },
  {
    id: 29, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F, Wd], moves: 13,
    objectives: [{ type: W, target: 30 }, { type: F, target: 25 }],
    starThresholds: [4800, 9600, 14000], reward: 220, characterId: 'lelya',
  },
  {
    id: 30, rows: 8, cols: 8, tokenTypes: [W, L, S, St, F, Wd], moves: 12,
    objectives: [{ type: W, target: 25 }, { type: L, target: 25 }, { type: F, target: 20 }],
    starThresholds: [5000, 10000, 15000], reward: 250, characterId: 'lelya',
  },
];

export function getLevelConfig(id: number): LevelConfig | undefined {
  return levels.find(l => l.id === id);
}
