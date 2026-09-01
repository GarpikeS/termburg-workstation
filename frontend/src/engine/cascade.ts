import type { Grid, Position, TokenType } from '@/types/game';
import { gridRows, gridCols, createCell } from './grid';
import { findMatches, getMatchedPositions } from './matcher';

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

export interface FillEmptyOptions {
  /** Keep freshly spawned tokens from completing an automatic line of three. */
  avoidAutomaticMatches?: boolean;
  /** Resolve remaining gravity-made lines before they can extend a long cascade. */
  stabilizeAfterCascade?: boolean;
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

function completesLine(grid: Grid, row: number, col: number, type: TokenType): boolean {
  const rows = gridRows(grid);
  const cols = gridCols(grid);
  const countDirection = (dr: number, dc: number) => {
    let count = 0;
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < rows && c >= 0 && c < cols) {
      const cell = grid[r][c];
      if (!cell || cell.special || cell.type !== type) break;
      count++;
      r += dr;
      c += dc;
    }
    return count;
  };

  const horizontal = 1 + countDirection(0, -1) + countDirection(0, 1);
  const vertical = 1 + countDirection(-1, 0) + countDirection(1, 0);
  return horizontal >= 3 || vertical >= 3;
}

function chooseSpawnType(
  grid: Grid,
  row: number,
  col: number,
  tokenTypes: TokenType[],
  avoidAutomaticMatches: boolean,
): TokenType {
  const choices = avoidAutomaticMatches
    ? tokenTypes.filter(type => !completesLine(grid, row, col, type))
    : tokenTypes;
  const pool = choices.length > 0 ? choices : tokenTypes;
  return pool[Math.floor(Math.random() * pool.length)];
}

function stabilizeMatchedLines(
  grid: Grid,
  tokenTypes: TokenType[],
  spawned: SpawnEntry[],
): void {
  const maximumRepairs = gridRows(grid) * gridCols(grid);
  for (let repair = 0; repair < maximumRepairs; repair++) {
    const matched = getMatchedPositions(findMatches(grid));
    if (matched.length === 0) return;

    // Prefer the highest tile so the corrective appearance reads like part of
    // the refill rather than a change to the player's settled lower board.
    const position = [...matched].sort((a, b) => a.row - b.row)[0];
    grid[position.row][position.col] = null;
    const type = chooseSpawnType(
      grid,
      position.row,
      position.col,
      tokenTypes,
      true,
    );
    grid[position.row][position.col] = createCell(type);
    spawned.push({ row: position.row, col: position.col, type });
  }
}

/** Fill empty cells at the top with new random tokens. Returns spawned entries for animation. */
export function fillEmpty(
  grid: Grid,
  tokenTypes: TokenType[],
  options: FillEmptyOptions = {},
): SpawnEntry[] {
  const rows = gridRows(grid);
  const cols = gridCols(grid);
  const spawned: SpawnEntry[] = [];

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (grid[r][c] === null) {
        const type = chooseSpawnType(
          grid,
          r,
          c,
          tokenTypes,
          options.avoidAutomaticMatches === true,
        );
        grid[r][c] = createCell(type);
        spawned.push({ col: c, row: r, type });
      }
    }
  }

  if (options.stabilizeAfterCascade) {
    stabilizeMatchedLines(grid, tokenTypes, spawned);
  }

  return spawned;
}
