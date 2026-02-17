import { useState, useCallback, useEffect, useRef } from 'react';
import { initGrid, spawnTile, resetTileIdCounter } from '@/engine/engine-2048/grid2048';
import type { Grid2048 } from '@/engine/engine-2048/grid2048';
import { applyMove, canMove, hasWon, type Direction } from '@/engine/engine-2048/moves2048';
import { useGameContext } from '@/store/GameContext';

interface Game2048State {
  grid: Grid2048;
  score: number;
  bestScore: number;
  isWon: boolean;
  isLost: boolean;
  continueMode: boolean;
}

export function useGame2048() {
  const { progress, update2048Score, addCurrency } = useGameContext();
  const [state, setState] = useState<Game2048State>(() => {
    resetTileIdCounter();
    return {
      grid: initGrid(),
      score: 0,
      bestScore: progress.best2048Score,
      isWon: false,
      isLost: false,
      continueMode: false,
    };
  });

  const wonRewardGiven = useRef(false);

  const move = useCallback((direction: Direction) => {
    setState(prev => {
      if (prev.isLost || (prev.isWon && !prev.continueMode)) return prev;

      const { grid: newGrid, scoreGained, moved } = applyMove(prev.grid, direction);
      if (!moved) return prev;

      const afterSpawn = spawnTile(newGrid);
      const newScore = prev.score + scoreGained;
      const newBest = Math.max(prev.bestScore, newScore);
      const won = !prev.continueMode && hasWon(afterSpawn);
      const lost = !canMove(afterSpawn);

      return {
        grid: afterSpawn,
        score: newScore,
        bestScore: newBest,
        isWon: won,
        isLost: lost,
        continueMode: prev.continueMode,
      };
    });
  }, []);

  // Save best score
  useEffect(() => {
    if (state.score > 0) {
      update2048Score(state.score);
    }
  }, [state.score, update2048Score]);

  // Reward for reaching 2048
  useEffect(() => {
    if (state.isWon && !wonRewardGiven.current) {
      wonRewardGiven.current = true;
      addCurrency(50);
    }
  }, [state.isWon, addCurrency]);

  const continueGame = useCallback(() => {
    setState(prev => ({ ...prev, isWon: false, continueMode: true }));
  }, []);

  const restart = useCallback(() => {
    resetTileIdCounter();
    wonRewardGiven.current = false;
    setState(prev => ({
      grid: initGrid(),
      score: 0,
      bestScore: prev.bestScore,
      isWon: false,
      isLost: false,
      continueMode: false,
    }));
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        move(dir);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [move]);

  return { state, move, continueGame, restart };
}
