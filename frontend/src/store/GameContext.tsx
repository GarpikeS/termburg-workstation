import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { PlayerProgress, LevelProgress, PetState, CartItem, Order } from '@/types/game';
import { loadProgress, saveProgress } from './storage';

interface GameContextValue {
  progress: PlayerProgress;
  completeLevelAction: (levelId: number, stars: number, score: number, reward: number) => void;
  addCurrency: (amount: number) => void;
  spendCurrency: (amount: number) => boolean;
  selectCharacter: (id: string) => void;
  setTutorialCompleted: () => void;
  update2048Score: (score: number) => void;
  completeBubbleLevel: () => void;
  updatePet: (pet: PetState | null) => void;
  unlockCharacter: (id: string) => void;
  addToCart: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  updateCartQty: (productId: string, quantity: number) => void;
  placeOrder: (order: Omit<Order, 'id' | 'createdAt' | 'status'>) => string;
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

  const update2048Score = useCallback((score: number) => {
    update(prev => ({
      ...prev,
      best2048Score: Math.max(prev.best2048Score, score),
    }));
  }, [update]);

  const completeBubbleLevel = useCallback(() => {
    update(prev => ({
      ...prev,
      bubbleLevelsCompleted: prev.bubbleLevelsCompleted + 1,
    }));
  }, [update]);

  const updatePet = useCallback((pet: PetState | null) => {
    update(prev => ({ ...prev, pet }));
  }, [update]);

  const unlockCharacter = useCallback((id: string) => {
    update(prev => {
      if (prev.unlockedCharacters.includes(id)) return prev;
      return { ...prev, unlockedCharacters: [...prev.unlockedCharacters, id] };
    });
  }, [update]);

  const addToCart = useCallback((productId: string) => {
    update(prev => {
      const existing = prev.cart.find(c => c.productId === productId);
      if (existing) {
        return {
          ...prev,
          cart: prev.cart.map(c =>
            c.productId === productId ? { ...c, quantity: c.quantity + 1 } : c,
          ),
        };
      }
      return { ...prev, cart: [...prev.cart, { productId, quantity: 1 }] };
    });
  }, [update]);

  const removeFromCart = useCallback((productId: string) => {
    update(prev => ({
      ...prev,
      cart: prev.cart.filter(c => c.productId !== productId),
    }));
  }, [update]);

  const updateCartQty = useCallback((productId: string, quantity: number) => {
    update(prev => {
      if (quantity <= 0) {
        return { ...prev, cart: prev.cart.filter(c => c.productId !== productId) };
      }
      return {
        ...prev,
        cart: prev.cart.map(c =>
          c.productId === productId ? { ...c, quantity } : c,
        ),
      };
    });
  }, [update]);

  const placeOrder = useCallback((orderData: Omit<Order, 'id' | 'createdAt' | 'status'>): string => {
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    update(prev => ({
      ...prev,
      cart: [],
      orders: [
        ...prev.orders,
        {
          ...orderData,
          id: orderId,
          createdAt: Date.now(),
          status: 'pending' as const,
        },
      ],
    }));
    return orderId;
  }, [update]);

  return (
    <GameContext.Provider value={{
      progress,
      completeLevelAction,
      addCurrency,
      spendCurrency,
      selectCharacter,
      setTutorialCompleted,
      update2048Score,
      completeBubbleLevel,
      updatePet,
      unlockCharacter,
      addToCart,
      removeFromCart,
      updateCartQty,
      placeOrder,
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
