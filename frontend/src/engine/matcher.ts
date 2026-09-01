import type { Grid, MatchGroup, Position, TokenType } from '@/types/game';
import { gridRows, gridCols } from './grid';

export interface FindMatchOptions {
  includeSquares?: boolean;
  squareAnchors?: Position[];
  previousGrid?: Grid;
}

function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

export function findMatches(
  grid: Grid,
  options: FindMatchOptions = {},
): MatchGroup[] {
  const rows = gridRows(grid);
  const cols = gridCols(grid);
  const groups: MatchGroup[] = [];

  // Horizontal scan
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const cell = grid[r][c];
      if (!cell || cell.special) { c++; continue; }

      let end = c + 1;
      while (end < cols && !grid[r][end]?.special && grid[r][end]?.type === cell.type) {
        end++;
      }

      const len = end - c;
      if (len >= 3) {
        const positions: Position[] = [];
        for (let i = c; i < end; i++) {
          positions.push({ row: r, col: i });
        }
        groups.push({ positions, type: cell.type, shape: 'horizontal' });
      }

      c = end;
    }
  }

  // Vertical scan
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const cell = grid[r][c];
      if (!cell || cell.special) { r++; continue; }

      let end = r + 1;
      while (end < rows && !grid[end][c]?.special && grid[end][c]?.type === cell.type) {
        end++;
      }

      const len = end - r;
      if (len >= 3) {
        const positions: Position[] = [];
        for (let i = r; i < end; i++) {
          positions.push({ row: i, col: c });
        }
        groups.push({ positions, type: cell.type, shape: 'vertical' });
      }

      r = end;
    }
  }

  // A square is a player-created power-up pattern, not a cascade match.
  // Only inspect it for the swapped cells supplied by the caller.
  if (options.includeSquares) {
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const cell = grid[r][c];
        if (!cell || cell.special) continue;

        const positions: Position[] = [
          { row: r, col: c },
          { row: r, col: c + 1 },
          { row: r + 1, col: c },
          { row: r + 1, col: c + 1 },
        ];
        const anchoredToSwap = !options.squareAnchors?.length
          || options.squareAnchors.some(anchor => (
            positions.some(position => samePosition(position, anchor))
          ));
        if (!anchoredToSwap) continue;

        const isSquare = positions.every(pos => {
          const candidate = grid[pos.row][pos.col];
          return candidate && !candidate.special && candidate.type === cell.type;
        });
        const existedBeforeSwap = options.previousGrid
          ? positions.every(pos => {
              const previous = options.previousGrid?.[pos.row]?.[pos.col];
              return previous && !previous.special && previous.type === cell.type;
            })
          : false;

        if (isSquare && !existedBeforeSwap) {
          groups.push({ positions, type: cell.type, shape: 'square' });
        }
      }
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
