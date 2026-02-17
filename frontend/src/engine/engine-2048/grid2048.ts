export interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  mergedFrom?: [number, number]; // IDs of tiles that merged into this one
  isNew?: boolean;
}

export type Grid2048 = (Tile | null)[][];

let _nextTileId = 1;
export function resetTileIdCounter() { _nextTileId = 1; }
export function nextTileId() { return _nextTileId++; }

export function createEmptyGrid(): Grid2048 {
  return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => null));
}

export function cloneGrid(grid: Grid2048): Grid2048 {
  return grid.map(row => row.map(cell => cell ? { ...cell } : null));
}

function getEmptyCells(grid: Grid2048): [number, number][] {
  const empty: [number, number][] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (!grid[r][c]) empty.push([r, c]);
    }
  }
  return empty;
}

export function spawnTile(grid: Grid2048): Grid2048 {
  const empty = getEmptyCells(grid);
  if (empty.length === 0) return grid;
  const [row, col] = empty[Math.floor(Math.random() * empty.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  const newGrid = cloneGrid(grid);
  newGrid[row][col] = { id: nextTileId(), value, row, col, isNew: true };
  return newGrid;
}

export function initGrid(): Grid2048 {
  let grid = createEmptyGrid();
  grid = spawnTile(grid);
  grid = spawnTile(grid);
  return grid;
}
