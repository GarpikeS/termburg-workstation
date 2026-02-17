import { type BubbleColor, ALL_BUBBLE_COLORS } from './bubbleTypes';
import type { Bubble } from './bubbleTypes';
import { hexToPixel, GRID_COLS } from './hexGrid';

export interface BubbleLevel {
  id: number;
  name: string;
  rows: number;
  colors: BubbleColor[];
  reward: number;
}

function generateLevel(id: number): BubbleLevel {
  const rows = Math.min(3 + Math.floor(id / 4), 8);
  const numColors = Math.min(2 + Math.floor(id / 5), 5);
  const colors = ALL_BUBBLE_COLORS.slice(0, numColors);
  const reward = 10 + id * 5;
  return { id, name: `Уровень ${id}`, rows, colors, reward };
}

const levels: BubbleLevel[] = Array.from({ length: 20 }, (_, i) => generateLevel(i + 1));

export function getBubbleLevel(id: number): BubbleLevel | undefined {
  return levels.find(l => l.id === id);
}

let _nextBubbleId = 1;
export function resetBubbleIdCounter() { _nextBubbleId = 1; }

export function generateBubbles(level: BubbleLevel, fieldWidth: number): Bubble[] {
  _nextBubbleId = 1;
  const bubbles: Bubble[] = [];

  for (let row = 0; row < level.rows; row++) {
    const maxCols = row % 2 === 1 ? GRID_COLS - 1 : GRID_COLS;
    for (let col = 0; col < maxCols; col++) {
      const color = level.colors[Math.floor(Math.random() * level.colors.length)];
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
