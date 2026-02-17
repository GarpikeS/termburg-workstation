import type { PetState } from '@/types/game';

export type PetAction = 'feed' | 'play' | 'rest' | 'wash';
export type PetMood = 'happy' | 'content' | 'sad' | 'critical';

const DECAY_RATES: Record<string, number> = {
  hunger: 1.5,     // pts per minute
  happiness: 1.0,
  energy: 1.2,
  cleanliness: 0.8,
};

const ACTION_EFFECTS: Record<PetAction, Partial<Record<keyof typeof DECAY_RATES, number>>> = {
  feed: { hunger: 35, happiness: 5 },
  play: { happiness: 40, energy: -15, hunger: -10 },
  rest: { energy: 35, happiness: 5 },
  wash: { cleanliness: 40, happiness: 10 },
};

const ACTION_COINS: Record<PetAction, number> = {
  feed: 2,
  play: 5,
  rest: 2,
  wash: 3,
};

export function createPet(characterId: string): PetState {
  return {
    characterId,
    hunger: 80,
    happiness: 80,
    energy: 80,
    cleanliness: 80,
    age: 0,
    stage: 'baby',
    lastUpdated: Date.now(),
  };
}

export function applyDecay(pet: PetState, elapsedMinutes: number): PetState {
  return {
    ...pet,
    hunger: Math.max(0, pet.hunger - DECAY_RATES.hunger * elapsedMinutes),
    happiness: Math.max(0, pet.happiness - DECAY_RATES.happiness * elapsedMinutes),
    energy: Math.max(0, pet.energy - DECAY_RATES.energy * elapsedMinutes),
    cleanliness: Math.max(0, pet.cleanliness - DECAY_RATES.cleanliness * elapsedMinutes),
    lastUpdated: Date.now(),
  };
}

export function applyAction(pet: PetState, action: PetAction): { pet: PetState; coins: number } {
  const effects = ACTION_EFFECTS[action];
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  return {
    pet: {
      ...pet,
      hunger: clamp(pet.hunger + (effects.hunger ?? 0)),
      happiness: clamp(pet.happiness + (effects.happiness ?? 0)),
      energy: clamp(pet.energy + (effects.energy ?? 0)),
      cleanliness: clamp(pet.cleanliness + (effects.cleanliness ?? 0)),
      lastUpdated: Date.now(),
    },
    coins: ACTION_COINS[action],
  };
}

export function getMood(pet: PetState): PetMood {
  const avg = (pet.hunger + pet.happiness + pet.energy + pet.cleanliness) / 4;
  if (avg >= 70) return 'happy';
  if (avg >= 45) return 'content';
  if (avg >= 20) return 'sad';
  return 'critical';
}

export function getStage(pet: PetState): PetState['stage'] {
  const ageHours = (Date.now() - (pet.lastUpdated - pet.age * 60000)) / (1000 * 60 * 60);
  if (ageHours >= 72) return 'adult';  // 3 days
  if (ageHours >= 24) return 'teen';   // 1 day
  return 'baby';
}

export function updateAge(pet: PetState): PetState {
  const now = Date.now();
  const newAge = pet.age + (now - pet.lastUpdated) / 60000; // age in minutes
  const stage = newAge >= 4320 ? 'adult' as const : newAge >= 1440 ? 'teen' as const : 'baby' as const;
  return { ...pet, age: newAge, stage };
}

export const MOOD_LABELS: Record<PetMood, string> = {
  happy: 'Счастлив',
  content: 'Доволен',
  sad: 'Грустит',
  critical: 'Плохо',
};

export const STAGE_LABELS: Record<PetState['stage'], string> = {
  baby: 'Малыш',
  teen: 'Подросток',
  adult: 'Взрослый',
};
