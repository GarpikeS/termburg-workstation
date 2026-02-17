import type { Grid, TokenType } from '@/types/game';
import { gridRows, gridCols } from './grid';
import { findMatches } from './matcher';
import { findPossibleMoves } from './hints';
import { shuffleArray } from '@/utils/random';

/**
 * Shuffle the grid if no moves are available.
 * Reshuffles until at least one move exists and no initial matches.
 * Returns true if a shuffle was needed.
 */
export function shuffleIfNeeded(grid: Grid, tokenTypes: TokenType[]): boolean {
  const moves = findPossibleMoves(grid);
  if (moves.length > 0) return false;

  const rows = gridRows(grid);
  const cols = gridCols(grid);

  // Collect all cells
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c]) cells.push(grid[r][c]!);
    }
  }

  // Try shuffling (max 100 attempts)
  for (let attempt = 0; attempt < 100; attempt++) {
    const shuffled = shuffleArray(cells);
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        grid[r][c] = { ...shuffled[idx++] };
      }
    }

    const matches = findMatches(grid);
    if (matches.length > 0) continue; // Don't want initial matches

    const newMoves = findPossibleMoves(grid);
    if (newMoves.length > 0) return true;
  }

  // Fallback: just accept whatever we have
  return true;
}
