// Even-row offset hex grid
// Odd rows are offset to the right by half a cell

export const BUBBLE_RADIUS = 16;
export const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
export const GRID_COLS = 9;
export const GRID_ROWS = 12;
export const ROW_HEIGHT = BUBBLE_DIAMETER * 0.866; // sqrt(3)/2

export function hexToPixel(row: number, col: number, fieldWidth: number): { x: number; y: number } {
  const offset = row % 2 === 1 ? BUBBLE_RADIUS : 0;
  const startX = (fieldWidth - GRID_COLS * BUBBLE_DIAMETER) / 2;
  const x = startX + col * BUBBLE_DIAMETER + BUBBLE_RADIUS + offset;
  const y = row * ROW_HEIGHT + BUBBLE_RADIUS;
  return { x, y };
}

export function pixelToHex(px: number, py: number, fieldWidth: number): { row: number; col: number } {
  const row = Math.round((py - BUBBLE_RADIUS) / ROW_HEIGHT);
  const clampedRow = Math.max(0, Math.min(GRID_ROWS - 1, row));
  const maxCols = clampedRow % 2 === 1 ? GRID_COLS - 1 : GRID_COLS;
  const offset = clampedRow % 2 === 1 ? BUBBLE_RADIUS : 0;
  const startX = (fieldWidth - GRID_COLS * BUBBLE_DIAMETER) / 2;
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

export function findAttachmentCell(
  px: number,
  py: number,
  fieldWidth: number,
  occupiedCells: Array<{ row: number; col: number }>,
  hitCell?: { row: number; col: number } | null,
): { row: number; col: number; x: number; y: number } | null {
  const occupied = new Set(occupiedCells.map(cell => `${cell.row},${cell.col}`));
  const candidates: Array<{ row: number; col: number; x: number; y: number }> = [];

  for (let row = 0; row < GRID_ROWS; row += 1) {
    const maxCols = row % 2 === 1 ? GRID_COLS - 1 : GRID_COLS;
    for (let col = 0; col < maxCols; col += 1) {
      if (occupied.has(`${row},${col}`)) continue;
      const attached = row === 0 || getNeighbors(row, col).some(([neighborRow, neighborCol]) => occupied.has(`${neighborRow},${neighborCol}`));
      if (!attached) continue;
      candidates.push({ row, col, ...hexToPixel(row, col, fieldWidth) });
    }
  }

  if (candidates.length === 0) return null;
  const hitNeighbors = hitCell
    ? new Set(getNeighbors(hitCell.row, hitCell.col).map(([row, col]) => `${row},${col}`))
    : null;

  candidates.sort((a, b) => {
    const aTouchesHit = hitNeighbors?.has(`${a.row},${a.col}`) ? 0 : 1;
    const bTouchesHit = hitNeighbors?.has(`${b.row},${b.col}`) ? 0 : 1;
    if (aTouchesHit !== bTouchesHit) return aTouchesHit - bTouchesHit;
    const aDistance = (a.x - px) ** 2 + (a.y - py) ** 2;
    const bDistance = (b.x - px) ** 2 + (b.y - py) ** 2;
    return aDistance - bDistance;
  });

  return candidates[0];
}
