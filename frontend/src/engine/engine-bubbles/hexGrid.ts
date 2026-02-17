// Even-row offset hex grid
// Odd rows are offset to the right by half a cell

export const BUBBLE_RADIUS = 16;
export const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
export const GRID_COLS = 9;
export const GRID_ROWS = 12;
export const ROW_HEIGHT = BUBBLE_DIAMETER * 0.866; // sqrt(3)/2

export function hexToPixel(row: number, col: number, fieldWidth: number): { x: number; y: number } {
  const offset = row % 2 === 1 ? BUBBLE_RADIUS : 0;
  const maxCols = row % 2 === 1 ? GRID_COLS - 1 : GRID_COLS;
  const startX = (fieldWidth - maxCols * BUBBLE_DIAMETER) / 2;
  const x = startX + col * BUBBLE_DIAMETER + BUBBLE_RADIUS + offset;
  const y = row * ROW_HEIGHT + BUBBLE_RADIUS;
  return { x, y };
}

export function pixelToHex(px: number, py: number, fieldWidth: number): { row: number; col: number } {
  const row = Math.round((py - BUBBLE_RADIUS) / ROW_HEIGHT);
  const clampedRow = Math.max(0, Math.min(GRID_ROWS - 1, row));
  const maxCols = clampedRow % 2 === 1 ? GRID_COLS - 1 : GRID_COLS;
  const offset = clampedRow % 2 === 1 ? BUBBLE_RADIUS : 0;
  const startX = (fieldWidth - maxCols * BUBBLE_DIAMETER) / 2;
  const col = Math.round((px - BUBBLE_RADIUS - offset - startX) / BUBBLE_DIAMETER);
  return { row: clampedRow, col: Math.max(0, Math.min(maxCols - 1, col)) };
}

export function getNeighbors(row: number, col: number): [number, number][] {
  const isOdd = row % 2 === 1;
  const neighbors: [number, number][] = [
    [row, col - 1],     // left
    [row, col + 1],     // right
    [row - 1, col],     // top-left (even) or top-center (odd)
    [row - 1, isOdd ? col + 1 : col - 1], // top-right (even) or top-left (odd)
    [row + 1, col],     // bottom-left/center
    [row + 1, isOdd ? col + 1 : col - 1], // bottom-right/left
  ];

  return neighbors.filter(([r, c]) => {
    if (r < 0 || r >= GRID_ROWS) return false;
    const maxC = r % 2 === 1 ? GRID_COLS - 1 : GRID_COLS;
    return c >= 0 && c < maxC;
  });
}

export function snapToHex(px: number, py: number, fieldWidth: number): { row: number; col: number; x: number; y: number } {
  const { row, col } = pixelToHex(px, py, fieldWidth);
  const { x, y } = hexToPixel(row, col, fieldWidth);
  return { row, col, x, y };
}
