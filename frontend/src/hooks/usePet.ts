import { useEffect, useRef, useCallback } from 'react';
import { useGameContext } from '@/store/GameContext';
import { createPet, applyDecay, applyAction, updateAge, getMood, type PetAction, type PetMood } from '@/engine/engine-pet/petEngine';

export function usePet() {
  const { progress, updatePet, addCurrency } = useGameContext();
  const pet = progress.pet;
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // On mount: apply decay from lastUpdated
  useEffect(() => {
    if (!pet) return;
    const elapsed = (Date.now() - pet.lastUpdated) / 60000;
    if (elapsed > 1) {
      const decayed = applyDecay(pet, elapsed);
      const aged = updateAge(decayed);
      updatePet(aged);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick every 60 seconds
  useEffect(() => {
    if (!pet) return;
    intervalRef.current = setInterval(() => {
      // Re-read pet from progress won't work here, so just apply 1 min decay
      // The component will re-render with new pet from context
      if (pet) {
        const decayed = applyDecay(pet, 1);
        const aged = updateAge(decayed);
        updatePet(aged);
      }
    }, 60000);
    return () => clearInterval(intervalRef.current);
  }, [pet, updatePet]);

  const adopt = useCallback((characterId: string) => {
    updatePet(createPet(characterId));
  }, [updatePet]);

  const doAction = useCallback((action: PetAction) => {
    if (!pet) return;
    const { pet: newPet, coins } = applyAction(pet, action);
    const aged = updateAge(newPet);
    updatePet(aged);
    if (coins > 0) addCurrency(coins);
  }, [pet, updatePet, addCurrency]);

  const mood: PetMood = pet ? getMood(pet) : 'happy';

  return { pet, mood, adopt, doAction };
}
