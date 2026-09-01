import { useState, useCallback, useRef } from 'react';
import type {
  GameState, LevelConfig, Position, AnimationPhase,
  Objective, Grid, MatchGroup,
} from '@/types/game';
import { SpecialType } from '@/types/game';
import { createGrid, createSpecialCell, cloneGrid, swapCells, areAdjacent } from '@/engine/grid';
import { findMatches, getMatchedPositions, countMatchesByType } from '@/engine/matcher';
import { removeMatched, applyGravity, fillEmpty } from '@/engine/cascade';
import { calculateMatchScoreBreakdown } from '@/engine/scorer';
import { shuffleGrid, shuffleIfNeeded } from '@/engine/shuffle';
import type { FallMove, SpawnEntry } from '@/engine/cascade';
import {
  detectSpecialCreation,
  hasMatchIntersection,
  planPowerUpActivation,
  type SpecialCreation,
} from '@/engine/powerups';

export interface AnimationData {
  swapFrom?: Position;
  swapTo?: Position;
  matchedPositions?: Position[];
  fallMoves?: FallMove[];
  spawnEntries?: SpawnEntry[];
  scoreGained?: number;
  combo?: number;
  matchSize?: number;
  matchedCount?: number;
  sizeBonus?: number;
  matchGroups?: MatchGroup[];
  isIntersection?: boolean;
  specialCreation?: SpecialCreation;
  createdSpecial?: SpecialType;
  activatedSpecial?: SpecialType;
  activationOrigin?: Position;
  activationTarget?: Position;
  affectedPositions?: Position[];
}

interface UseGameReturn {
  state: GameState;
  animData: AnimationData;
  handleCellClick: (pos: Position) => void;
  handleSwipe: (pos: Position, dx: number, dy: number) => void;
  setPhase: (phase: AnimationPhase) => void;
  advanceAnimation: () => void;
  resetGame: (config: LevelConfig) => void;
  destroyCell: (pos: Position) => void;
  activateBoosterBomb: (pos: Position) => void;
  shuffleBoard: () => void;
  addMoves: (amount: number) => void;
}

const chooseEarlyCascadeLimit = (): 3 | 4 => (Math.random() < 0.2 ? 4 : 3);

function initState(config: LevelConfig): GameState {
  const grid = createGrid(config.rows, config.cols, config.tokenTypes);
  return {
    grid,
    score: 0,
    movesLeft: config.moves,
    objectives: config.objectives.map(o => ({ ...o, current: 0 })),
    combo: 0,
    phase: 'idle',
    selectedCell: null,
    levelConfig: config,
    isWon: false,
    isLost: false,
  };
}

export function useGame(initialConfig: LevelConfig): UseGameReturn {
  const [state, setState] = useState<GameState>(() => initState(initialConfig));
  const [animData, setAnimData] = useState<AnimationData>({});
  const pendingGrid = useRef<Grid | null>(null);
  const pendingPowerUpPosition = useRef<Position | null>(null);
  const lastSwapGrid = useRef<Grid | null>(null);
  const lastSwapSource = useRef<Position | null>(null);
  const lastSwapTarget = useRef<Position | null>(null);
  const earlyCascadeLimit = useRef<3 | 4>(3);

  const getMatchAnimationData = useCallback((
    grid: Grid,
    combo: number,
    preferredPosition?: Position,
    squareAnchors?: Position[],
    previousGrid?: Grid,
  ): AnimationData => {
    const matches = findMatches(grid, {
      includeSquares: Boolean(squareAnchors?.length),
      squareAnchors,
      previousGrid,
    });
    const matchedPositions = getMatchedPositions(matches);
    const score = calculateMatchScoreBreakdown(matches, combo);
    const specialCreation = detectSpecialCreation(matches, preferredPosition);

    return {
      matchedPositions,
      matchedCount: matchedPositions.length,
      matchSize: score.largestMatch,
      sizeBonus: score.sizeBonus,
      matchGroups: matches,
      isIntersection: hasMatchIntersection(matches),
      specialCreation,
      createdSpecial: specialCreation?.special,
    };
  }, []);

  const getPowerUpAnimationData = useCallback((
    grid: Grid,
    objectives: Objective[],
    origin: Position,
  ): AnimationData | undefined => {
    const activation = planPowerUpActivation(grid, origin, objectives);
    if (!activation) return undefined;

    return {
      activatedSpecial: activation.special,
      activationOrigin: activation.origin,
      activationTarget: activation.target,
      affectedPositions: activation.affectedPositions,
    };
  }, []);

  const resetGame = useCallback((config: LevelConfig) => {
    setState(initState(config));
    setAnimData({});
    pendingGrid.current = null;
    pendingPowerUpPosition.current = null;
    lastSwapGrid.current = null;
    lastSwapSource.current = null;
    lastSwapTarget.current = null;
    earlyCascadeLimit.current = 3;
  }, []);

  const checkWinLose = useCallback((objectives: Objective[], movesLeft: number) => {
    const allDone = objectives.every(o => o.current >= o.target);
    if (allDone) return { isWon: true, isLost: false };
    if (movesLeft <= 0) return { isWon: false, isLost: true };
    return { isWon: false, isLost: false };
  }, []);

  const startSwap = useCallback((from: Position, to: Position) => {
    lastSwapSource.current = from;
    lastSwapTarget.current = to;
    setState(prev => {
      if (prev.phase !== 'idle' || prev.isWon || prev.isLost) return prev;
      lastSwapGrid.current = prev.grid;

      const newGrid = cloneGrid(prev.grid);
      swapCells(newGrid, from, to);

      // Check if swap produces a match
      const matches = findMatches(newGrid, {
        includeSquares: true,
        squareAnchors: [from, to],
        previousGrid: prev.grid,
      });
      setAnimData({ swapFrom: from, swapTo: to });
      const swappedPowerUpPosition = newGrid[to.row]?.[to.col]?.special
        ? to
        : newGrid[from.row]?.[from.col]?.special
          ? from
          : undefined;

      if (swappedPowerUpPosition || matches.length > 0) {
        earlyCascadeLimit.current = chooseEarlyCascadeLimit();
        pendingGrid.current = null;
        pendingPowerUpPosition.current = swappedPowerUpPosition ?? null;
        return {
          ...prev,
          grid: newGrid,
          combo: 0,
          phase: 'swap' as AnimationPhase,
          selectedCell: null,
        };
      } else {
        // Keep the original grid so the rejected swap can visibly travel back.
        pendingGrid.current = prev.grid;
        pendingPowerUpPosition.current = null;
        return {
          ...prev,
          grid: newGrid,
          phase: 'swap' as AnimationPhase,
          selectedCell: null,
        };
      }
    });
  }, []);

  const activatePowerUp = useCallback((position: Position) => {
    setState(prev => {
      if (prev.phase !== 'idle' || prev.isWon || prev.isLost) return prev;
      const activationData = getPowerUpAnimationData(prev.grid, prev.objectives, position);
      if (!activationData) return prev;

      earlyCascadeLimit.current = chooseEarlyCascadeLimit();
      setAnimData(activationData);
      return {
        ...prev,
        combo: 0,
        movesLeft: prev.movesLeft - 1,
        phase: 'powerup' as AnimationPhase,
        selectedCell: null,
      };
    });
  }, [getPowerUpAnimationData]);

  const handleCellClick = useCallback((pos: Position) => {
    setState(prev => {
      if (prev.phase !== 'idle' || prev.isWon || prev.isLost) return prev;

      if (prev.grid[pos.row]?.[pos.col]?.special) {
        setTimeout(() => activatePowerUp(pos), 0);
        return { ...prev, selectedCell: null };
      }

      if (!prev.selectedCell) {
        return { ...prev, selectedCell: pos };
      }

      if (prev.selectedCell.row === pos.row && prev.selectedCell.col === pos.col) {
        return { ...prev, selectedCell: null };
      }

      if (areAdjacent(prev.selectedCell, pos)) {
        // Schedule swap (will be called outside setState)
        setTimeout(() => startSwap(prev.selectedCell!, pos), 0);
        return prev;
      }

      return { ...prev, selectedCell: pos };
    });
  }, [activatePowerUp, startSwap]);

  const handleSwipe = useCallback((pos: Position, dx: number, dy: number) => {
    const to: Position = { row: pos.row + dy, col: pos.col + dx };
    setState(prev => {
      if (prev.phase !== 'idle' || prev.isWon || prev.isLost) return prev;
      if (to.row < 0 || to.row >= prev.levelConfig.rows || to.col < 0 || to.col >= prev.levelConfig.cols) return prev;
      setTimeout(() => startSwap(pos, to), 0);
      return prev;
    });
  }, [startSwap]);

  const setPhase = useCallback((phase: AnimationPhase) => {
    setState(prev => ({ ...prev, phase }));
  }, []);

  const destroyCell = useCallback((pos: Position) => {
    setState(prev => {
      if (prev.phase !== 'idle' || prev.isWon || prev.isLost) return prev;
      const cell = prev.grid[pos.row]?.[pos.col];
      if (!cell) return prev;

      earlyCascadeLimit.current = chooseEarlyCascadeLimit();
      const grid = cloneGrid(prev.grid);
      grid[pos.row][pos.col] = null;
      applyGravity(grid);
      fillEmpty(grid, prev.levelConfig.tokenTypes, {
        avoidAutomaticMatches: prev.levelConfig.id <= 10,
      });
      shuffleIfNeeded(grid);

      const objectives = prev.objectives.map(objective => (
        !cell.special && objective.type === cell.type
          ? { ...objective, current: objective.current + 1 }
          : objective
      ));
      const matches = findMatches(grid);
      const matchData = matches.length > 0 ? getMatchAnimationData(grid, 0) : undefined;
      const { isWon, isLost } = checkWinLose(objectives, prev.movesLeft);

      setAnimData(matchData ?? {});
      return {
        ...prev,
        grid,
        objectives,
        score: prev.score + 50,
        selectedCell: null,
        combo: 0,
        phase: matchData ? 'match_hold' as AnimationPhase : 'idle' as AnimationPhase,
        isWon,
        isLost,
      };
    });
  }, [checkWinLose, getMatchAnimationData]);

  const activateBoosterBomb = useCallback((pos: Position) => {
    setState(prev => {
      if (prev.phase !== 'idle' || prev.isWon || prev.isLost) return prev;
      const affectedPositions: Position[] = [];
      for (let row = Math.max(0, pos.row - 1); row <= Math.min(prev.levelConfig.rows - 1, pos.row + 1); row++) {
        for (let col = Math.max(0, pos.col - 1); col <= Math.min(prev.levelConfig.cols - 1, pos.col + 1); col++) {
          if (prev.grid[row]?.[col]) affectedPositions.push({ row, col });
        }
      }
      setAnimData({
        activatedSpecial: SpecialType.Barrel,
        activationOrigin: pos,
        affectedPositions,
      });
      return { ...prev, selectedCell: null, combo: 0, phase: 'powerup' as AnimationPhase };
    });
  }, []);

  const shuffleBoard = useCallback(() => {
    setState(prev => {
      if (prev.phase !== 'idle' || prev.isWon || prev.isLost) return prev;
      const grid = cloneGrid(prev.grid);
      earlyCascadeLimit.current = chooseEarlyCascadeLimit();
      shuffleGrid(grid);
      setAnimData({});
      return { ...prev, grid, selectedCell: null, combo: 0 };
    });
  }, []);

  const addMoves = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setState(prev => {
      if (prev.phase !== 'idle' || prev.isWon || prev.isLost) return prev;
      return { ...prev, movesLeft: prev.movesLeft + Math.floor(amount) };
    });
  }, []);

  const advanceAnimation = useCallback(() => {
    setState(prev => {
      const { phase } = prev;

      if (phase === 'swap') {
        if (pendingGrid.current) {
          const originalGrid = pendingGrid.current;
          return {
            ...prev,
            grid: originalGrid,
            phase: 'swap_back' as AnimationPhase,
          };
        }

        if (pendingPowerUpPosition.current) {
          const activationData = getPowerUpAnimationData(
            prev.grid,
            prev.objectives,
            pendingPowerUpPosition.current,
          );
          if (activationData) {
            setAnimData(activationData);
            return {
              ...prev,
              combo: 0,
              phase: 'powerup' as AnimationPhase,
              movesLeft: prev.movesLeft - 1,
            };
          }
        }

        // The moved gems are now in place. Hold the completed line before removal.
        setAnimData(getMatchAnimationData(
          prev.grid,
          prev.combo,
          lastSwapTarget.current ?? undefined,
          lastSwapSource.current && lastSwapTarget.current
            ? [lastSwapSource.current, lastSwapTarget.current]
            : undefined,
          lastSwapGrid.current ?? undefined,
        ));
        return {
          ...prev,
          phase: 'match_hold' as AnimationPhase,
          movesLeft: prev.movesLeft - 1,
        };
      }

      if (phase === 'swap_back') {
        pendingGrid.current = null;
        lastSwapGrid.current = null;
        lastSwapSource.current = null;
        lastSwapTarget.current = null;
        setAnimData({});
        return { ...prev, phase: 'idle' as AnimationPhase };
      }

      if (phase === 'match_hold') {
        return { ...prev, phase: 'match' as AnimationPhase };
      }

      if (phase === 'powerup') {
        const affectedPositions = animData.affectedPositions ?? [];
        const grid = cloneGrid(prev.grid);
        const typeCounts = new Map<string, number>();
        let clearedCount = 0;

        for (const position of affectedPositions) {
          const cell = grid[position.row]?.[position.col];
          if (!cell) continue;
          clearedCount++;
          if (!cell.special) {
            typeCounts.set(cell.type, (typeCounts.get(cell.type) ?? 0) + 1);
          }
        }

        const objectives = prev.objectives.map(objective => ({
          ...objective,
          current: objective.current + (typeCounts.get(objective.type) ?? 0),
        }));
        removeMatched(grid, affectedPositions);
        const scoreGained = clearedCount * 50;
        pendingPowerUpPosition.current = null;
        lastSwapGrid.current = null;
        lastSwapSource.current = null;
        lastSwapTarget.current = null;
        setAnimData({
          scoreGained,
          combo: prev.combo,
          matchedCount: clearedCount,
          activatedSpecial: animData.activatedSpecial,
        });

        return {
          ...prev,
          grid,
          objectives,
          score: prev.score + scoreGained,
          combo: prev.combo + 1,
          phase: 'score' as AnimationPhase,
        };
      }

      if (phase === 'match') {
        // Remove matched, calculate score
        const grid = cloneGrid(prev.grid);
        const matches = animData.matchGroups ?? findMatches(grid);
        const matched = getMatchedPositions(matches);
        const combo = prev.combo;
        const score = calculateMatchScoreBreakdown(matches, combo);
        const scoreGained = score.total;
        const specialCreation = animData.specialCreation
          ?? detectSpecialCreation(matches, lastSwapTarget.current ?? undefined);

        // Update objectives
        const typeCounts = countMatchesByType(matches);
        const objectives = prev.objectives.map(o => {
          const added = typeCounts.get(o.type) ?? 0;
          return { ...o, current: o.current + added };
        });

        removeMatched(grid, matched);
        if (specialCreation) {
          grid[specialCreation.position.row][specialCreation.position.col] = createSpecialCell(
            specialCreation.tokenType,
            specialCreation.special,
          );
        }
        lastSwapGrid.current = null;
        lastSwapSource.current = null;
        lastSwapTarget.current = null;

        setAnimData({
          scoreGained,
          combo,
          matchedCount: matched.length,
          matchSize: score.largestMatch,
          sizeBonus: score.sizeBonus,
          isIntersection: animData.isIntersection,
          specialCreation,
          createdSpecial: specialCreation?.special,
        });
        return {
          ...prev,
          grid,
          score: prev.score + scoreGained,
          objectives,
          combo: combo + 1,
          phase: 'score' as AnimationPhase,
        };
      }

      if (phase === 'score') {
        // Apply gravity
        const grid = cloneGrid(prev.grid);
        const fallMoves = applyGravity(grid);
        setAnimData({ fallMoves });
        return { ...prev, grid, phase: 'fall' as AnimationPhase };
      }

      if (phase === 'fall') {
        // Fill empty cells
        const grid = cloneGrid(prev.grid);
        const spawnEntries = fillEmpty(grid, prev.levelConfig.tokenTypes, {
          // The first bathhouse teaches deliberate moves; refills should not
          // repeatedly solve the board for the player.
          avoidAutomaticMatches: prev.levelConfig.id <= 10,
          // combo=1 is the player's match. Early levels may naturally continue
          // for three cascades, with a rare fourth, but never run away further.
          stabilizeAfterCascade: prev.levelConfig.id <= 10
            && (prev.combo - 1) >= earlyCascadeLimit.current,
        });
        setAnimData({ spawnEntries });
        return { ...prev, grid, phase: 'spawn' as AnimationPhase };
      }

      if (phase === 'spawn') {
        // Check for cascading matches
        const matches = findMatches(prev.grid);
        if (matches.length > 0) {
          setAnimData(getMatchAnimationData(prev.grid, prev.combo));
          return { ...prev, phase: 'match_hold' as AnimationPhase };
        }

        // No more cascades — check for possible moves
        const grid = cloneGrid(prev.grid);
        const shuffled = shuffleIfNeeded(grid);

        // Check win/lose
        const { isWon, isLost } = checkWinLose(prev.objectives, prev.movesLeft);

        setAnimData({});
        pendingPowerUpPosition.current = null;
        lastSwapGrid.current = null;
        lastSwapSource.current = null;
        lastSwapTarget.current = null;
        return {
          ...prev,
          grid: shuffled ? grid : prev.grid,
          phase: 'idle' as AnimationPhase,
          isWon,
          isLost,
        };
      }

      return prev;
    });
  }, [animData, checkWinLose, getMatchAnimationData, getPowerUpAnimationData]);

  return {
    state,
    animData,
    handleCellClick,
    handleSwipe,
    setPhase,
    advanceAnimation,
    resetGame,
    destroyCell,
    activateBoosterBomb,
    shuffleBoard,
    addMoves,
  };
}
