import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  readPetCompanionSession,
  type PetCompanionGame,
  type PetCompanionRewardResult,
} from '@/engine/engine-pet/petCompanion';
import { useGameContext } from '@/store/GameContext';

export function usePetCompanion(game: PetCompanionGame, isWon: boolean) {
  const location = useLocation();
  const { progress, rewardPetCompanionWin } = useGameContext();
  const session = useMemo(
    () => readPetCompanionSession(location.state, game),
    [game, location.state],
  );
  const pet = session && progress.pet?.adoptionId === session.adoptionId
    ? progress.pet
    : null;
  const attemptedSessionRef = useRef<string | null>(null);
  const [reward, setReward] = useState<PetCompanionRewardResult | null>(null);

  useEffect(() => {
    if (!isWon || !session || !pet || attemptedSessionRef.current === session.id) return;
    attemptedSessionRef.current = session.id;
    const result = rewardPetCompanionWin(session);
    queueMicrotask(() => setReward(result));
  }, [isWon, pet, rewardPetCompanionWin, session]);

  return {
    session: pet ? session : null,
    pet,
    reward,
    exitPath: pet ? '/games/pet' : null,
  };
}
