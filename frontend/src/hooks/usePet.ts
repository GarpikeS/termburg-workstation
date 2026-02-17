import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameContext } from '@/store/GameContext';
import {
  createPet, applyDecay, applyAction, updateAge, getMood,
  isOnCooldown, getCooldownRemaining, getStatWarning,
  type PetAction, type PetMood,
} from '@/engine/engine-pet/petEngine';

export function usePet() {
  const { progress, updatePet, addCurrency } = useGameContext();
  const pet = progress.pet;
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [warning, setWarning] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

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
      if (pet) {
        const decayed = applyDecay(pet, 1);
        const aged = updateAge(decayed);
        updatePet(aged);
      }
    }, 60000);
    return () => clearInterval(intervalRef.current);
  }, [pet, updatePet]);

  // Update cooldown display every second
  useEffect(() => {
    if (!pet) return;
    const actions: PetAction[] = ['feed', 'play', 'rest', 'wash'];
    const updateCds = () => {
      const cds: Record<string, number> = {};
      for (const a of actions) {
        cds[a] = getCooldownRemaining(pet, a);
      }
      setCooldowns(cds);
    };
    updateCds();
    const id = setInterval(updateCds, 1000);
    return () => clearInterval(id);
  }, [pet]);

  // Check warnings
  useEffect(() => {
    if (!pet) return;
    setWarning(getStatWarning(pet));
  }, [pet]);

  const adopt = useCallback((characterId: string) => {
    updatePet(createPet(characterId));
  }, [updatePet]);

  const doAction = useCallback((action: PetAction): boolean => {
    if (!pet) return false;
    if (isOnCooldown(pet, action)) return false;
    const result = applyAction(pet, action);
    if (!result) return false;
    const aged = updateAge(result.pet);
    updatePet(aged);
    if (result.coins > 0) addCurrency(result.coins);
    return true;
  }, [pet, updatePet, addCurrency]);

  const mood: PetMood = pet ? getMood(pet) : 'happy';

  return { pet, mood, adopt, doAction, warning, cooldowns };
}
