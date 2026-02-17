import { TokenType, type LevelConfig, type Difficulty } from '@/types/game';

const W = TokenType.Water;
const L = TokenType.Leaf;
const S = TokenType.Stone;
const St = TokenType.Steam;
const F = TokenType.Fire;
const Wd = TokenType.Wood;

function lvl(
  id: number, name: string, difficulty: Difficulty, bathhouseId: number,
  rows: number, cols: number, tokenTypes: TokenType[], moves: number,
  objectives: { type: TokenType; target: number }[],
  starThresholds: [number, number, number], reward: number, characterId: string,
): LevelConfig {
  return { id, name, difficulty, bathhouseId, rows, cols, tokenTypes, moves, objectives, starThresholds, reward, characterId };
}

export const levels: LevelConfig[] = [
  // Bathhouse 1: Classic Baths (1-10)
  lvl(1, 'Лесная купель', 'classic', 1, 8, 8, [W, St, L], 20, [{ type: W, target: 20 }, { type: St, target: 15 }], [500, 1000, 2000], 50, 'ai-concierge'),
  lvl(2, 'Лесной огонь', 'classic', 1, 8, 8, [F, Wd, L], 18, [{ type: F, target: 25 }, { type: Wd, target: 20 }], [600, 1200, 2200], 50, 'ai-concierge'),
  lvl(3, 'Гармония', 'classic', 1, 8, 8, [St, S, W], 18, [{ type: St, target: 20 }, { type: S, target: 18 }], [700, 1400, 2500], 60, 'ai-concierge'),
  lvl(4, 'Листопад', 'classic', 1, 8, 8, [L, W, St], 18, [{ type: L, target: 25 }, { type: W, target: 15 }], [700, 1500, 2600], 60, 'ai-concierge'),
  lvl(5, 'Тёплый ручей', 'classic', 1, 8, 8, [W, St, S], 17, [{ type: W, target: 22 }, { type: St, target: 18 }], [800, 1600, 2800], 70, 'ai-concierge'),
  lvl(6, 'Берёзовый пар', 'classic', 1, 8, 8, [St, L, W], 17, [{ type: St, target: 25 }, { type: L, target: 20 }], [900, 1800, 3000], 70, 'ai-concierge'),
  lvl(7, 'Каменный ключ', 'classic', 1, 8, 8, [S, W, St], 16, [{ type: S, target: 22 }, { type: W, target: 18 }], [1000, 2000, 3200], 80, 'ai-concierge'),
  lvl(8, 'Утренний туман', 'classic', 1, 8, 8, [St, W, L, S], 16, [{ type: St, target: 20 }, { type: W, target: 20 }], [1100, 2200, 3500], 80, 'ai-concierge'),
  lvl(9, 'Дубовый веник', 'classic', 1, 8, 8, [Wd, L, W, St], 15, [{ type: Wd, target: 18 }, { type: L, target: 18 }], [1200, 2400, 3800], 90, 'ai-concierge'),
  lvl(10, 'Первый жар', 'classic', 1, 8, 8, [F, St, W, S], 15, [{ type: F, target: 20 }, { type: St, target: 18 }], [1300, 2600, 4000], 100, 'ai-concierge'),

  // Bathhouse 2: Forest Bath (11-20)
  lvl(11, 'Хвойный дух', 'classic', 2, 8, 8, [L, Wd, W], 18, [{ type: L, target: 25 }, { type: Wd, target: 20 }], [1200, 2400, 4000], 80, 'term-master'),
  lvl(12, 'Грибной дождь', 'classic', 2, 8, 8, [W, L, S], 17, [{ type: W, target: 22 }, { type: L, target: 20 }], [1300, 2600, 4200], 80, 'term-master'),
  lvl(13, 'Мшистый камень', 'classic', 2, 8, 8, [S, L, Wd], 17, [{ type: S, target: 25 }, { type: L, target: 18 }], [1400, 2800, 4500], 90, 'term-master'),
  lvl(14, 'Лесной родник', 'classic', 2, 8, 8, [W, L, St, Wd], 16, [{ type: W, target: 25 }, { type: L, target: 22 }], [1500, 3000, 4800], 90, 'term-master'),
  lvl(15, 'Кедровая роща', 'premium', 2, 8, 8, [Wd, L, St, W], 16, [{ type: Wd, target: 25 }, { type: St, target: 18 }], [1600, 3200, 5000], 100, 'term-master'),
  lvl(16, 'Дикий мёд', 'premium', 2, 8, 8, [F, L, Wd, W], 15, [{ type: F, target: 20 }, { type: L, target: 25 }], [1700, 3400, 5200], 100, 'term-master'),
  lvl(17, 'Берлога', 'premium', 2, 8, 8, [Wd, S, St, L], 15, [{ type: Wd, target: 28 }, { type: S, target: 20 }], [1800, 3600, 5500], 110, 'term-master'),
  lvl(18, 'Звериная тропа', 'premium', 2, 8, 8, [L, W, Wd, F], 14, [{ type: L, target: 28 }, { type: Wd, target: 22 }], [1900, 3800, 5800], 110, 'term-master'),
  lvl(19, 'Чаща', 'premium', 2, 8, 8, [Wd, L, S, St, W], 14, [{ type: Wd, target: 25 }, { type: L, target: 25 }], [2000, 4000, 6000], 120, 'term-master'),
  lvl(20, 'Древний дуб', 'premium', 2, 8, 8, [Wd, L, W, St, F], 13, [{ type: Wd, target: 30 }, { type: L, target: 25 }], [2200, 4400, 6500], 130, 'term-master'),

  // Bathhouse 3: Stone Bath (21-30)
  lvl(21, 'Гранитный зал', 'classic', 3, 8, 8, [S, W, St], 18, [{ type: S, target: 28 }, { type: W, target: 20 }], [1500, 3000, 5000], 100, 'ai-concierge'),
  lvl(22, 'Мраморный пол', 'classic', 3, 8, 8, [S, St, L], 17, [{ type: S, target: 25 }, { type: St, target: 22 }], [1600, 3200, 5200], 100, 'ai-concierge'),
  lvl(23, 'Каменный свод', 'premium', 3, 8, 8, [S, W, F, St], 16, [{ type: S, target: 28 }, { type: F, target: 18 }], [1700, 3400, 5500], 110, 'ai-concierge'),
  lvl(24, 'Горячий грот', 'premium', 3, 8, 8, [F, S, St, W], 16, [{ type: F, target: 25 }, { type: S, target: 22 }], [1800, 3600, 5800], 110, 'ai-concierge'),
  lvl(25, 'Жемчужная пещера', 'premium', 3, 8, 8, [W, S, St, L], 15, [{ type: W, target: 28 }, { type: S, target: 25 }], [2000, 4000, 6000], 120, 'ai-concierge'),
  lvl(26, 'Базальтовый жар', 'premium', 3, 8, 8, [S, F, St, Wd], 15, [{ type: S, target: 30 }, { type: F, target: 22 }], [2100, 4200, 6500], 120, 'ai-concierge'),
  lvl(27, 'Солевая комната', 'premium', 3, 8, 8, [S, W, St, L, F], 14, [{ type: S, target: 28 }, { type: W, target: 25 }], [2200, 4400, 7000], 130, 'ai-concierge'),
  lvl(28, 'Горный обвал', 'vip', 3, 8, 8, [S, F, Wd, W, St], 14, [{ type: S, target: 30 }, { type: F, target: 25 }], [2400, 4800, 7500], 140, 'ai-concierge'),
  lvl(29, 'Сталактитовый зал', 'vip', 3, 8, 8, [S, W, St, L, F], 13, [{ type: S, target: 32 }, { type: W, target: 28 }], [2500, 5000, 8000], 140, 'ai-concierge'),
  lvl(30, 'Каменное сердце', 'vip', 3, 8, 8, [S, W, St, L, F, Wd], 12, [{ type: S, target: 30 }, { type: F, target: 25 }, { type: W, target: 20 }], [2800, 5600, 8500], 150, 'ai-concierge'),

  // Bathhouse 4: Stone Steam (31-40)
  lvl(31, 'Паровой камень', 'classic', 4, 8, 8, [St, S, W], 17, [{ type: St, target: 28 }, { type: S, target: 22 }], [1800, 3600, 5500], 110, 'term-master'),
  lvl(32, 'Туманное озеро', 'classic', 4, 8, 8, [St, W, L], 16, [{ type: St, target: 25 }, { type: W, target: 25 }], [1900, 3800, 5800], 110, 'term-master'),
  lvl(33, 'Облачный пик', 'premium', 4, 8, 8, [St, S, W, L], 16, [{ type: St, target: 30 }, { type: S, target: 22 }], [2000, 4000, 6000], 120, 'term-master'),
  lvl(34, 'Гейзер', 'premium', 4, 8, 8, [St, W, F, S], 15, [{ type: St, target: 28 }, { type: F, target: 20 }], [2100, 4200, 6500], 120, 'term-master'),
  lvl(35, 'Горячий источник', 'premium', 4, 8, 8, [W, St, F, L], 15, [{ type: W, target: 28 }, { type: St, target: 25 }], [2200, 4400, 7000], 130, 'term-master'),
  lvl(36, 'Парная долина', 'premium', 4, 8, 8, [St, S, W, Wd, L], 14, [{ type: St, target: 30 }, { type: Wd, target: 20 }], [2400, 4800, 7500], 130, 'term-master'),
  lvl(37, 'Кипящий котёл', 'vip', 4, 8, 8, [F, St, W, S, L], 14, [{ type: F, target: 25 }, { type: St, target: 28 }], [2500, 5000, 8000], 140, 'term-master'),
  lvl(38, 'Огненный пар', 'vip', 4, 8, 8, [F, St, S, W, Wd], 13, [{ type: F, target: 28 }, { type: St, target: 25 }], [2600, 5200, 8500], 140, 'term-master'),
  lvl(39, 'Вулканический пар', 'vip', 4, 8, 8, [F, St, S, W, L, Wd], 13, [{ type: F, target: 30 }, { type: St, target: 28 }], [2800, 5600, 9000], 150, 'term-master'),
  lvl(40, 'Паровое ядро', 'vip', 4, 8, 8, [St, F, S, W, L, Wd], 12, [{ type: St, target: 32 }, { type: F, target: 28 }, { type: S, target: 20 }], [3000, 6000, 9500], 160, 'term-master'),

  // Bathhouse 5: Mountain Baths (41-50)
  lvl(41, 'Горный воздух', 'premium', 5, 8, 8, [W, S, St, L], 16, [{ type: W, target: 28 }, { type: S, target: 25 }], [2200, 4400, 7000], 130, 'ar-guide'),
  lvl(42, 'Альпийский луг', 'premium', 5, 8, 8, [L, W, St, S], 15, [{ type: L, target: 30 }, { type: W, target: 22 }], [2300, 4600, 7200], 130, 'ar-guide'),
  lvl(43, 'Ледниковая вода', 'premium', 5, 8, 8, [W, S, St, F], 15, [{ type: W, target: 30 }, { type: S, target: 25 }], [2400, 4800, 7500], 140, 'ar-guide'),
  lvl(44, 'Горный ручей', 'premium', 5, 8, 8, [W, L, S, St, F], 14, [{ type: W, target: 28 }, { type: L, target: 25 }], [2500, 5000, 8000], 140, 'ar-guide'),
  lvl(45, 'Скальный уступ', 'vip', 5, 8, 8, [S, F, W, St, Wd], 14, [{ type: S, target: 30 }, { type: F, target: 25 }], [2600, 5200, 8500], 150, 'ar-guide'),
  lvl(46, 'Горное эхо', 'vip', 5, 8, 8, [St, W, S, L, F], 13, [{ type: St, target: 28 }, { type: W, target: 28 }], [2800, 5600, 9000], 150, 'ar-guide'),
  lvl(47, 'Пещерный водопад', 'vip', 5, 8, 8, [W, S, St, L, Wd], 13, [{ type: W, target: 32 }, { type: S, target: 25 }], [3000, 6000, 9500], 160, 'ar-guide'),
  lvl(48, 'Ветер вершин', 'vip', 5, 8, 8, [St, W, L, S, F, Wd], 12, [{ type: St, target: 30 }, { type: L, target: 25 }], [3200, 6400, 10000], 160, 'ar-guide'),
  lvl(49, 'Лавовый грот', 'vip', 5, 8, 8, [F, S, W, St, Wd, L], 12, [{ type: F, target: 30 }, { type: S, target: 28 }], [3400, 6800, 10500], 170, 'ar-guide'),
  lvl(50, 'Вершина мира', 'vip', 5, 8, 8, [W, L, S, St, F, Wd], 11, [{ type: W, target: 30 }, { type: F, target: 25 }, { type: S, target: 20 }], [3500, 7000, 11000], 180, 'ar-guide'),

  // Bathhouses 6-10: generate remaining 50 levels with increasing difficulty
  ...generateBathhouse(6, 'Японская баня', 51, [W, St, L, S, F, Wd], 'ai-concierge'),
  ...generateBathhouse(7, 'Турецкая баня', 61, [F, St, S, W, L, Wd], 'term-master'),
  ...generateBathhouse(8, 'Ледяная купель', 71, [W, S, St, L, F, Wd], 'ar-guide'),
  ...generateBathhouse(9, 'Каменные бассейны', 81, [S, W, St, F, L, Wd], 'ai-concierge'),
  ...generateBathhouse(10, 'Минеральная баня', 91, [W, L, S, St, F, Wd], 'term-master'),
];

function generateBathhouse(
  bathhouseId: number, _name: string, startId: number,
  types: TokenType[], characterId: string,
): LevelConfig[] {
  const names = [
    'Рассвет', 'Полдень', 'Закат', 'Сумерки', 'Полночь',
    'Восход', 'Зенит', 'Штиль', 'Шторм', 'Финал',
  ];
  const difficulties: Difficulty[] = [
    'classic', 'classic', 'premium', 'premium', 'premium',
    'vip', 'vip', 'vip', 'vip', 'vip',
  ];

  return names.map((n, i) => {
    const id = startId + i;
    const tokenCount = Math.min(3 + Math.floor(i / 2), 6);
    const usedTypes = types.slice(0, tokenCount);
    const moves = Math.max(10, 16 - Math.floor(i / 2));
    const baseTarget = 22 + i * 2;
    const objectives = [
      { type: usedTypes[0], target: baseTarget },
      { type: usedTypes[1], target: Math.max(15, baseTarget - 5) },
    ];
    if (i >= 7) {
      objectives.push({ type: usedTypes[2], target: Math.max(12, baseTarget - 10) });
    }
    const baseScore = 2500 + bathhouseId * 300 + i * 200;
    return lvl(
      id, n, difficulties[i], bathhouseId,
      8, 8, usedTypes, moves, objectives,
      [baseScore, baseScore * 2, baseScore * 3],
      120 + bathhouseId * 10 + i * 5,
      characterId,
    );
  });
}

export function getLevelConfig(id: number): LevelConfig | undefined {
  return levels.find(l => l.id === id);
}

export function getLevelsForBathhouse(bathhouseId: number): LevelConfig[] {
  return levels.filter(l => l.bathhouseId === bathhouseId);
}
