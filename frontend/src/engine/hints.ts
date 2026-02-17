import type { Grid, SwapAction } from '@/types/game';
import { gridRows, gridCols, cloneGrid, swapCells } from './grid';
import { findMatches } from './matcher';

/** Find all possible moves that produce a match. Returns array of swap actions. */
export function findPossibleMoves(grid: Grid): SwapAction[] {
  const rows = gridRows(grid);
  const cols = gridCols(grid);
  const moves: SwapAction[] = [];

  const directions: [number, number][] = [
    [0, 1],  // right
    [1, 0],  // down
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue;

      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;

        if (nr >= rows || nc >= cols || !grid[nr][nc]) continue;

        const testGrid = cloneGrid(grid);
        swapCells(testGrid, { row: r, col: c }, { row: nr, col: nc });

        const matches = findMatches(testGrid);
        if (matches.length > 0) {
          moves.push({
            from: { row: r, col: c },
            to: { row: nr, col: nc },
          });
        }
      }
    }
  }

  return moves;
}

/** Get a single hint move (first available) */
export function getHint(grid: Grid): SwapAction | null {
  const moves = findPossibleMoves(grid);
  return moves.length > 0 ? moves[0] : null;
}
