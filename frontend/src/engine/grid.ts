import type { Grid, Cell, Position, TokenType } from '@/types/game';
import { randomElement } from '@/utils/random';

let nextId = 1;

export function createCell(type: TokenType): Cell {
  return { type, id: nextId++ };
}

export function createGrid(rows: number, cols: number, tokenTypes: TokenType[]): Grid {
  const grid: Grid = [];

  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      let type: TokenType;
      // Keep picking random types until no initial match
      do {
        type = randomElement(tokenTypes);
      } while (wouldCreateMatch(grid, r, c, type));
      grid[r][c] = createCell(type);
    }
  }

  return grid;
}

function wouldCreateMatch(grid: Grid, row: number, col: number, type: TokenType): boolean {
  // Check horizontal (2 to the left)
  if (
    col >= 2 &&
    grid[row][col - 1]?.type === type &&
    grid[row][col - 2]?.type === type
  ) {
    return true;
  }

  // Check vertical (2 above)
  if (
    row >= 2 &&
    grid[row - 1]?.[col]?.type === type &&
    grid[row - 2]?.[col]?.type === type
  ) {
    return true;
  }

  return false;
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

export function getCell(grid: Grid, pos: Position): Cell | null {
  return grid[pos.row]?.[pos.col] ?? null;
}

export function setCell(grid: Grid, pos: Position, cell: Cell | null): void {
  grid[pos.row][pos.col] = cell;
}

export function swapCells(grid: Grid, a: Position, b: Position): void {
  const temp = grid[a.row][a.col];
  grid[a.row][a.col] = grid[b.row][b.col];
  grid[b.row][b.col] = temp;
}

export function areAdjacent(a: Position, b: Position): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

export function gridRows(grid: Grid): number {
  return grid.length;
}

export function gridCols(grid: Grid): number {
  return grid[0]?.length ?? 0;
}
