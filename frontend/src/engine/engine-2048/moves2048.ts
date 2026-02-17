import type { Tile, Grid2048 } from './grid2048';
import { cloneGrid, nextTileId } from './grid2048';

export type Direction = 'up' | 'down' | 'left' | 'right';

interface SlideResult {
  tiles: (Tile | null)[];
  scoreGained: number;
  moved: boolean;
}

function slideRow(row: (Tile | null)[], targetRow: number, isRow: boolean): SlideResult {
  const filtered = row.filter((t): t is Tile => t !== null);
  const result: (Tile | null)[] = [];
  let scoreGained = 0;
  let moved = false;
  let i = 0;

  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i].value === filtered[i + 1].value) {
      const newValue = filtered[i].value * 2;
      const merged: Tile = {
        id: nextTileId(),
        value: newValue,
        row: isRow ? targetRow : result.length,
        col: isRow ? result.length : targetRow,
        mergedFrom: [filtered[i].id, filtered[i + 1].id],
      };
      result.push(merged);
      scoreGained += newValue;
      i += 2;
    } else {
      result.push({ ...filtered[i] });
      i += 1;
    }
  }

  while (result.length < 4) result.push(null);

  // Check if anything moved
  for (let j = 0; j < 4; j++) {
    const orig = row[j];
    const curr = result[j];
    if ((!orig && curr) || (orig && !curr) || (orig && curr && orig.id !== curr.id)) {
      moved = true;
      break;
    }
  }

  // Update positions
  result.forEach((tile, idx) => {
    if (tile) {
      if (isRow) { tile.row = targetRow; tile.col = idx; }
      else { tile.row = idx; tile.col = targetRow; }
    }
  });

  return { tiles: result, scoreGained, moved };
}

export function applyMove(grid: Grid2048, direction: Direction): { grid: Grid2048; scoreGained: number; moved: boolean } {
  const newGrid = cloneGrid(grid);
  let totalScore = 0;
  let anyMoved = false;

  if (direction === 'left') {
    for (let r = 0; r < 4; r++) {
      const row = newGrid[r];
      const { tiles, scoreGained, moved } = slideRow(row, r, true);
      newGrid[r] = tiles;
      totalScore += scoreGained;
      if (moved) anyMoved = true;
    }
  } else if (direction === 'right') {
    for (let r = 0; r < 4; r++) {
      const row = [...newGrid[r]].reverse();
      const { tiles, scoreGained, moved } = slideRow(row, r, true);
      newGrid[r] = tiles.reverse();
      // Fix positions after reverse
      newGrid[r].forEach((t, c) => { if (t) { t.col = c; } });
      totalScore += scoreGained;
      if (moved) anyMoved = true;
    }
  } else if (direction === 'up') {
    for (let c = 0; c < 4; c++) {
      const col = [newGrid[0][c], newGrid[1][c], newGrid[2][c], newGrid[3][c]];
      const { tiles, scoreGained, moved } = slideRow(col, c, false);
      for (let r = 0; r < 4; r++) newGrid[r][c] = tiles[r];
      totalScore += scoreGained;
      if (moved) anyMoved = true;
    }
  } else {
    for (let c = 0; c < 4; c++) {
      const col = [newGrid[3][c], newGrid[2][c], newGrid[1][c], newGrid[0][c]];
      const { tiles, scoreGained, moved } = slideRow(col, c, false);
      const reversed = tiles.reverse();
      for (let r = 0; r < 4; r++) {
        newGrid[r][c] = reversed[r];
        if (reversed[r]) { reversed[r]!.row = r; reversed[r]!.col = c; }
      }
      totalScore += scoreGained;
      if (moved) anyMoved = true;
    }
  }

  return { grid: newGrid, scoreGained: totalScore, moved: anyMoved };
}

export function canMove(grid: Grid2048): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (!grid[r][c]) return true;
      const val = grid[r][c]!.value;
      if (c < 3 && grid[r][c + 1]?.value === val) return true;
      if (r < 3 && grid[r + 1]?.[c]?.value === val) return true;
    }
  }
  return false;
}

export function hasWon(grid: Grid2048): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] && grid[r][c]!.value >= 2048) return true;
    }
  }
  return false;
}
