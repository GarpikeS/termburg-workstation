import type { Grid, Position, TokenType } from '@/types/game';
import { gridRows, gridCols, createCell } from './grid';

export interface FallMove {
  from: Position;
  to: Position;
  distance: number;
}

export interface SpawnEntry {
  col: number;
  row: number;
  type: TokenType;
}

/** Remove matched cells (set to null) */
export function removeMatched(grid: Grid, positions: Position[]): void {
  for (const pos of positions) {
    grid[pos.row][pos.col] = null;
  }
}

/** Apply gravity: move cells down to fill gaps. Returns list of moves for animation. */
export function applyGravity(grid: Grid): FallMove[] {
  const rows = gridRows(grid);
  const cols = gridCols(grid);
  const moves: FallMove[] = [];

  for (let c = 0; c < cols; c++) {
    // Process from bottom to top
    let writeRow = rows - 1;

    for (let r = rows - 1; r >= 0; r--) {
      if (grid[r][c] !== null) {
        if (r !== writeRow) {
          grid[writeRow][c] = grid[r][c];
          grid[r][c] = null;
          moves.push({
            from: { row: r, col: c },
            to: { row: writeRow, col: c },
            distance: writeRow - r,
          });
        }
        writeRow--;
      }
    }
  }

  return moves;
}

/** Fill empty cells at the top with new random tokens. Returns spawned entries for animation. */
export function fillEmpty(grid: Grid, tokenTypes: TokenType[]): SpawnEntry[] {
  const rows = gridRows(grid);
  const cols = gridCols(grid);
  const spawned: SpawnEntry[] = [];

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (grid[r][c] === null) {
        const type = tokenTypes[Math.floor(Math.random() * tokenTypes.length)];
        grid[r][c] = createCell(type);
        spawned.push({ col: c, row: r, type });
      }
    }
  }

  return spawned;
}
