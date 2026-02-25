import { type BubbleColor, ALL_BUBBLE_COLORS } from './bubbleTypes';
import type { Bubble } from './bubbleTypes';
import { hexToPixel, GRID_COLS } from './hexGrid';

export interface BubbleLevel {
  id: number;
  name: string;
  rows: number;
  colors: BubbleColor[];
  shots: number;
  reward: number;
  pattern?: 'random' | 'striped' | 'checkered' | 'clustered' | 'pyramid';
}

// Названия уровней по банной тематике
const levelNames = [
  'Парилка',
  'Предбанник',
  'Купель',
  'Веничная',
  'Каменка',
  'Полок',
  'Банный жар',
  'Травяная',
  'Ледяная купель',
  'Контрастная',
  'Турецкая',
  'Финская',
  'Русская баня',
  'Хаммам',
  'Офуро',
  'Сауна',
  'Римские термы',
  'Японская баня',
  'Ирландская баня',
  'Сандуновская',
  'Горячий источник',
  'Банные чары',
  'Пар костей не ломит',
  'Легкий пар',
  'С легким паром',
  'Жаркий полок',
  'Банный день',
  'Парься на здоровье',
  'Дубовый жар',
  'Берёзовый рай',
  'Эвкалиптовый туман',
  'Можжевеловый лес',
  'Крапивный массаж',
  'Пихтовый аромат',
  'Липовый мёд',
  'Веничный мастер',
  'Банщик года',
  'Парильщик',
  'Любитель бани',
  'Знаток веников',
  'Термальный король',
  'Повелитель пара',
  'Банный гуру',
  'Мастер парения',
  'Хранитель традиций',
  'Банная легенда',
  'Непревзойдённый',
  'Великий парильщик',
  'Термбург чемпион',
  'Абсолютный мастер',
];

function generateLevel(id: number): BubbleLevel {
  // Прогрессия сложности
  const rows = Math.min(3 + Math.floor(id / 3), 10);
  const numColors = Math.min(2 + Math.floor(id / 6), 8);
  const shots = Math.max(30 - Math.floor(id / 3), 15);
  const reward = 10 + id * 8;

  // Выбор паттерна на основе уровня
  const patterns: Array<'random' | 'striped' | 'checkered' | 'clustered' | 'pyramid'> =
    ['random', 'striped', 'checkered', 'clustered', 'pyramid'];
  const pattern = patterns[id % patterns.length];

  const colors = ALL_BUBBLE_COLORS.slice(0, numColors);
  const name = levelNames[id - 1] || `Уровень ${id}`;

  return { id, name, rows, colors, shots, reward, pattern };
}

// 50 уровней
const levels: BubbleLevel[] = Array.from({ length: 50 }, (_, i) => generateLevel(i + 1));

export function getBubbleLevel(id: number): BubbleLevel | undefined {
  return levels.find(l => l.id === id);
}

export function getTotalLevels(): number {
  return levels.length;
}

let _nextBubbleId = 1;
export function resetBubbleIdCounter() { _nextBubbleId = 1; }

export function generateBubbles(level: BubbleLevel, fieldWidth: number): Bubble[] {
  _nextBubbleId = 1;
  const bubbles: Bubble[] = [];

  for (let row = 0; row < level.rows; row++) {
    const maxCols = row % 2 === 1 ? GRID_COLS - 1 : GRID_COLS;

    for (let col = 0; col < maxCols; col++) {
      let color: BubbleColor;

      switch (level.pattern) {
        case 'striped':
          // Полосатый паттерн
          color = level.colors[row % level.colors.length];
          break;
        case 'checkered':
          // Шахматный паттерн
          color = level.colors[(row + col) % level.colors.length];
          break;
        case 'clustered':
          // Кластеры - группы одного цвета
          const clusterIdx = Math.floor(col / 3) + Math.floor(row / 2) * 3;
          color = level.colors[clusterIdx % level.colors.length];
          break;
        case 'pyramid':
          // Пирамида - цвет зависит от расстояния от центра
          const center = maxCols / 2;
          const dist = Math.abs(col - center);
          color = level.colors[Math.floor(dist) % level.colors.length];
          break;
        default:
          // Случайный
          color = level.colors[Math.floor(Math.random() * level.colors.length)];
      }

      const { x, y } = hexToPixel(row, col, fieldWidth);
      bubbles.push({
        id: _nextBubbleId++,
        color,
        row,
        col,
        x,
        y,
      });
    }
  }

  return bubbles;
}

export function nextBubbleId(): number {
  return _nextBubbleId++;
}
