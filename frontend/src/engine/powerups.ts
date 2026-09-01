import type {
  Grid,
  MatchGroup,
  Objective,
  Position,
  SpecialType,
  TokenType,
} from '@/types/game';
import { SpecialType as Special } from '@/types/game';
import { gridCols, gridRows } from './grid';

export interface SpecialCreation {
  special: SpecialType;
  position: Position;
  tokenType: TokenType;
}

export interface PowerUpActivation {
  special: SpecialType;
  origin: Position;
  target?: Position;
  affectedPositions: Position[];
}

const positionKey = (position: Position) => `${position.row},${position.col}`;

function includesPosition(group: MatchGroup, position: Position): boolean {
  return group.positions.some(pos => pos.row === position.row && pos.col === position.col);
}

export function hasMatchIntersection(matches: MatchGroup[]): boolean {
  const horizontal = matches.filter(match => match.shape === 'horizontal');
  const vertical = matches.filter(match => match.shape === 'vertical');

  return horizontal.some(rowMatch => (
    vertical.some(colMatch => (
      rowMatch.type === colMatch.type
      && rowMatch.positions.some(position => includesPosition(colMatch, position))
    ))
  ));
}

export function detectSpecialCreation(
  matches: MatchGroup[],
  preferredPosition?: Position,
): SpecialCreation | undefined {
  const horizontal = matches.filter(match => match.shape === 'horizontal');
  const vertical = matches.filter(match => match.shape === 'vertical');

  // A perpendicular T/L match of five or more produces a powder barrel.
  for (const rowMatch of horizontal) {
    for (const colMatch of vertical) {
      if (rowMatch.type !== colMatch.type) continue;
      const intersection = rowMatch.positions.find(pos => includesPosition(colMatch, pos));
      if (!intersection) continue;

      const unique = new Set(
        [...rowMatch.positions, ...colMatch.positions].map(positionKey),
      );
      if (unique.size >= 5) {
        return {
          special: Special.Barrel,
          position: intersection,
          tokenType: rowMatch.type,
        };
      }
    }
  }

  const square = matches.find(match => match.shape === 'square');
  if (!square) return undefined;

  const position = preferredPosition && includesPosition(square, preferredPosition)
    ? preferredPosition
    : square.positions[0];

  return {
    special: Special.Helicopter,
    position,
    tokenType: square.type,
  };
}

function uniquePositions(positions: Position[]): Position[] {
  const seen = new Set<string>();
  return positions.filter(position => {
    const key = positionKey(position);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isInside(grid: Grid, position: Position): boolean {
  return position.row >= 0 && position.row < gridRows(grid)
    && position.col >= 0 && position.col < gridCols(grid);
}

function chooseHelicopterTarget(
  grid: Grid,
  objectives: Objective[],
  excluded: Set<string>,
): Position | undefined {
  const remainingByType = new Map(
    objectives
      .filter(objective => objective.current < objective.target)
      .map(objective => [objective.type, objective.target - objective.current]),
  );
  const candidates: Array<{ position: Position; priority: number }> = [];

  for (let row = 0; row < gridRows(grid); row++) {
    for (let col = 0; col < gridCols(grid); col++) {
      const position = { row, col };
      const cell = grid[row][col];
      if (!cell || cell.special || excluded.has(positionKey(position))) continue;
      candidates.push({
        position,
        priority: remainingByType.get(cell.type) ?? 0,
      });
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0]?.position;
}

export function planPowerUpActivation(
  grid: Grid,
  origin: Position,
  objectives: Objective[],
): PowerUpActivation | undefined {
  const cell = grid[origin.row]?.[origin.col];
  if (!cell?.special) return undefined;

  if (cell.special === Special.Barrel) {
    const affected: Position[] = [];
    for (let row = origin.row - 2; row <= origin.row + 2; row++) {
      for (let col = origin.col - 2; col <= origin.col + 2; col++) {
        const position = { row, col };
        if (isInside(grid, position)) affected.push(position);
      }
    }
    return {
      special: cell.special,
      origin,
      affectedPositions: affected,
    };
  }

  const takeoff = [
    origin,
    { row: origin.row - 1, col: origin.col },
    { row: origin.row + 1, col: origin.col },
    { row: origin.row, col: origin.col - 1 },
    { row: origin.row, col: origin.col + 1 },
  ].filter(position => isInside(grid, position));
  const excluded = new Set(takeoff.map(positionKey));
  const target = chooseHelicopterTarget(grid, objectives, excluded);

  return {
    special: cell.special,
    origin,
    target,
    affectedPositions: uniquePositions(target ? [...takeoff, target] : takeoff),
  };
}
