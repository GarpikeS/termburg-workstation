import type { Grid, MatchGroup, Position, TokenType } from '@/types/game';
import { gridRows, gridCols } from './grid';

export function findMatches(grid: Grid): MatchGroup[] {
  const rows = gridRows(grid);
  const cols = gridCols(grid);
  const matched = new Set<string>();
  const groups: MatchGroup[] = [];

  const key = (r: number, c: number) => `${r},${c}`;

  // Horizontal scan
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const cell = grid[r][c];
      if (!cell) { c++; continue; }

      let end = c + 1;
      while (end < cols && grid[r][end]?.type === cell.type) {
        end++;
      }

      const len = end - c;
      if (len >= 3) {
        const positions: Position[] = [];
        for (let i = c; i < end; i++) {
          positions.push({ row: r, col: i });
          matched.add(key(r, i));
        }
        groups.push({ positions, type: cell.type });
      }

      c = end;
    }
  }

  // Vertical scan
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const cell = grid[r][c];
      if (!cell) { r++; continue; }

      let end = r + 1;
      while (end < rows && grid[end][c]?.type === cell.type) {
        end++;
      }

      const len = end - r;
      if (len >= 3) {
        const positions: Position[] = [];
        for (let i = r; i < end; i++) {
          positions.push({ row: i, col: c });
          matched.add(key(i, c));
        }
        groups.push({ positions, type: cell.type });
      }

      r = end;
    }
  }

  return groups;
}

export function getMatchedPositions(matches: MatchGroup[]): Position[] {
  const seen = new Set<string>();
  const result: Position[] = [];

  for (const group of matches) {
    for (const pos of group.positions) {
      const k = `${pos.row},${pos.col}`;
      if (!seen.has(k)) {
        seen.add(k);
        result.push(pos);
      }
    }
  }

  return result;
}

export function countMatchesByType(matches: MatchGroup[]): Map<TokenType, number> {
  const counts = new Map<TokenType, number>();
  const seen = new Set<string>();

  for (const group of matches) {
    for (const pos of group.positions) {
      const k = `${pos.row},${pos.col}`;
      if (!seen.has(k)) {
        seen.add(k);
        counts.set(group.type, (counts.get(group.type) ?? 0) + 1);
      }
    }
  }

  return counts;
}
