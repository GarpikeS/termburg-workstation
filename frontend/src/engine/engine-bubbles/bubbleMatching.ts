import type { Bubble } from './bubbleTypes.ts';
import { getNeighbors } from './hexGrid.ts';

function getBubbleAt(bubbles: Bubble[], row: number, col: number): Bubble | undefined {
  return bubbles.find(b => b.row === row && b.col === col);
}

// BFS to find connected group of same color
export function findColorGroup(bubbles: Bubble[], startRow: number, startCol: number): Bubble[] {
  const start = getBubbleAt(bubbles, startRow, startCol);
  if (!start) return [];

  const visited = new Set<string>();
  const group: Bubble[] = [];
  const queue: [number, number][] = [[startRow, startCol]];
  const key = (r: number, c: number) => `${r},${c}`;

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const k = key(r, c);
    if (visited.has(k)) continue;
    visited.add(k);

    const bubble = getBubbleAt(bubbles, r, c);
    if (!bubble || bubble.color !== start.color) continue;

    group.push(bubble);

    for (const [nr, nc] of getNeighbors(r, c)) {
      if (!visited.has(key(nr, nc))) {
        queue.push([nr, nc]);
      }
    }
  }

  return group;
}

// Find bubbles not connected to top row (floating/orphan)
export function findFloating(bubbles: Bubble[]): Bubble[] {
  const visited = new Set<string>();
  const queue: [number, number][] = [];
  const key = (r: number, c: number) => `${r},${c}`;

  // Start BFS from all top-row bubbles
  for (const b of bubbles) {
    if (b.row === 0) {
      queue.push([b.row, b.col]);
    }
  }

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const k = key(r, c);
    if (visited.has(k)) continue;
    visited.add(k);

    const bubble = getBubbleAt(bubbles, r, c);
    if (!bubble) continue;

    for (const [nr, nc] of getNeighbors(r, c)) {
      if (!visited.has(key(nr, nc)) && getBubbleAt(bubbles, nr, nc)) {
        queue.push([nr, nc]);
      }
    }
  }

  return bubbles.filter(b => !visited.has(key(b.row, b.col)));
}

// Check if bubble overlaps with any existing bubble
export function checkCollision(bubbles: readonly Bubble[], x: number, y: number, radius: number): Bubble | null {
  for (const b of bubbles) {
    const dx = b.x - x;
    const dy = b.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius * 2) return b;
  }
  return null;
}

// Check if all bubbles cleared
export function isLevelCleared(bubbles: Bubble[]): boolean {
  return bubbles.length === 0;
}
