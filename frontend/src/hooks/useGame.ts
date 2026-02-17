import { useState, useCallback, useRef } from 'react';
import type {
  GameState, LevelConfig, Position, AnimationPhase,
  Objective, Grid, MatchGroup,
} from '@/types/game';
import { createGrid, cloneGrid, swapCells, areAdjacent } from '@/engine/grid';
import { findMatches, getMatchedPositions, countMatchesByType } from '@/engine/matcher';
import { removeMatched, applyGravity, fillEmpty } from '@/engine/cascade';
import { calculateMatchScore } from '@/engine/scorer';
import { findPossibleMoves } from '@/engine/hints';
import { shuffleIfNeeded } from '@/engine/shuffle';
import type { FallMove, SpawnEntry } from '@/engine/cascade';

export interface AnimationData {
  swapFrom?: Position;
  swapTo?: Position;
  matchedPositions?: Position[];
  fallMoves?: FallMove[];
  spawnEntries?: SpawnEntry[];
  scoreGained?: number;
  combo?: number;
}

interface UseGameReturn {
  state: GameState;
  animData: AnimationData;
  handleCellClick: (pos: Position) => void;
  handleSwipe: (pos: Position, dx: number, dy: number) => void;
  setPhase: (phase: AnimationPhase) => void;
  advanceAnimation: () => void;
  resetGame: (config: LevelConfig) => void;
}

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
  const comboRef = useRef(0);

  const resetGame = useCallback((config: LevelConfig) => {
    setState(initState(config));
    setAnimData({});
    pendingGrid.current = null;
    comboRef.current = 0;
  }, []);

  const checkWinLose = useCallback((objectives: Objective[], movesLeft: number) => {
    const allDone = objectives.every(o => o.current >= o.target);
    if (allDone) return { isWon: true, isLost: false };
    if (movesLeft <= 0) return { isWon: false, isLost: true };
    return { isWon: false, isLost: false };
  }, []);

  const startSwap = useCallback((from: Position, to: Position) => {
    setState(prev => {
      if (prev.phase !== 'idle' || prev.isWon || prev.isLost) return prev;

      const newGrid = cloneGrid(prev.grid);
      swapCells(newGrid, from, to);
      pendingGrid.current = newGrid;

      // Check if swap produces a match
      const matches = findMatches(newGrid);

      if (matches.length > 0) {
        comboRef.current = 0;
        setAnimData({ swapFrom: from, swapTo: to });
        return { ...prev, phase: 'swap' as AnimationPhase, selectedCell: null };
      } else {
        // Swap back
        setAnimData({ swapFrom: from, swapTo: to });
        pendingGrid.current = null;
        return { ...prev, phase: 'swap_back' as AnimationPhase, selectedCell: null };
      }
    });
  }, []);

  const handleCellClick = useCallback((pos: Position) => {
    setState(prev => {
      if (prev.phase !== 'idle' || prev.isWon || prev.isLost) return prev;

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
  }, [startSwap]);

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

  const advanceAnimation = useCallback(() => {
    setState(prev => {
      const { phase } = prev;

      if (phase === 'swap') {
        // Apply the swap, move to match phase
        const grid = pendingGrid.current ?? prev.grid;
        const matches = findMatches(grid);
        const matched = getMatchedPositions(matches);
        setAnimData({ matchedPositions: matched });
        return {
          ...prev,
          grid,
          phase: 'match' as AnimationPhase,
          movesLeft: prev.movesLeft - 1,
        };
      }

      if (phase === 'swap_back') {
        setAnimData({});
        return { ...prev, phase: 'idle' as AnimationPhase };
      }

      if (phase === 'match') {
        // Remove matched, calculate score
        const grid = cloneGrid(prev.grid);
        const matches = findMatches(grid);
        const matched = getMatchedPositions(matches);
        const combo = comboRef.current;
        const scoreGained = calculateMatchScore(matches, combo);

        // Update objectives
        const typeCounts = countMatchesByType(matches);
        const objectives = prev.objectives.map(o => {
          const added = typeCounts.get(o.type) ?? 0;
          return { ...o, current: o.current + added };
        });

        removeMatched(grid, matched);
        comboRef.current = combo + 1;

        setAnimData({ scoreGained, combo });
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
        const spawnEntries = fillEmpty(grid, prev.levelConfig.tokenTypes);
        setAnimData({ spawnEntries });
        return { ...prev, grid, phase: 'spawn' as AnimationPhase };
      }

      if (phase === 'spawn') {
        // Check for cascading matches
        const matches = findMatches(prev.grid);
        if (matches.length > 0) {
          const matched = getMatchedPositions(matches);
          setAnimData({ matchedPositions: matched });
          return { ...prev, phase: 'match' as AnimationPhase };
        }

        // No more cascades — check for possible moves
        const grid = cloneGrid(prev.grid);
        const shuffled = shuffleIfNeeded(grid, prev.levelConfig.tokenTypes);

        // Check win/lose
        const { isWon, isLost } = checkWinLose(prev.objectives, prev.movesLeft);

        setAnimData({});
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
  }, [checkWinLose]);

  return {
    state,
    animData,
    handleCellClick,
    handleSwipe,
    setPhase,
    advanceAnimation,
    resetGame,
  };
}
