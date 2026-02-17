import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { PlayerProgress, LevelProgress } from '@/types/game';
import { loadProgress, saveProgress } from './storage';

interface GameContextValue {
  progress: PlayerProgress;
  completeLevelAction: (levelId: number, stars: number, score: number, reward: number) => void;
  addCurrency: (amount: number) => void;
  spendCurrency: (amount: number) => boolean;
  selectCharacter: (id: string) => void;
  setTutorialCompleted: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<PlayerProgress>(loadProgress);

  const update = useCallback((updater: (prev: PlayerProgress) => PlayerProgress) => {
    setProgress(prev => {
      const next = updater(prev);
      saveProgress(next);
      return next;
    });
  }, []);

  const completeLevelAction = useCallback((levelId: number, stars: number, score: number, reward: number) => {
    update(prev => {
      const existing: LevelProgress = prev.levels[levelId] ?? { stars: 0, bestScore: 0, completed: false };
      const newStars = Math.max(existing.stars, stars);
      const newBest = Math.max(existing.bestScore, score);
      const earnedReward = stars > existing.stars ? reward : (existing.completed ? 0 : reward);

      return {
        ...prev,
        currentLevel: Math.max(prev.currentLevel, levelId + 1),
        currency: prev.currency + earnedReward,
        levels: {
          ...prev.levels,
          [levelId]: { stars: newStars, bestScore: newBest, completed: true },
        },
      };
    });
  }, [update]);

  const addCurrency = useCallback((amount: number) => {
    update(prev => ({ ...prev, currency: prev.currency + amount }));
  }, [update]);

  const spendCurrency = useCallback((amount: number): boolean => {
    let success = false;
    update(prev => {
      if (prev.currency >= amount) {
        success = true;
        return { ...prev, currency: prev.currency - amount };
      }
      return prev;
    });
    return success;
  }, [update]);

  const selectCharacter = useCallback((id: string) => {
    update(prev => ({ ...prev, selectedCharacter: id }));
  }, [update]);

  const setTutorialCompleted = useCallback(() => {
    update(prev => ({ ...prev, tutorialCompleted: true }));
  }, [update]);

  return (
    <GameContext.Provider value={{
      progress,
      completeLevelAction,
      addCurrency,
      spendCurrency,
      selectCharacter,
      setTutorialCompleted,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameContext must be used within GameProvider');
  return ctx;
}
