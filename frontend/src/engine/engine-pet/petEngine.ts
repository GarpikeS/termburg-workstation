import type { PetState } from '@/types/game';

export type PetAction = 'feed' | 'play' | 'rest' | 'wash';
export type PetMood = 'ecstatic' | 'happy' | 'content' | 'sad' | 'critical';

// Base decay per minute — modified by stage
const BASE_DECAY: Record<string, number> = {
  hunger: 1.2,
  happiness: 0.8,
  energy: 1.0,
  cleanliness: 0.6,
};

// Stage multipliers for decay
const STAGE_DECAY_MULT: Record<PetState['stage'], number> = {
  baby: 0.7,   // baby decays slower (easier)
  teen: 1.0,
  adult: 1.3,  // adult decays faster (harder)
};

// Base action effects
const ACTION_EFFECTS: Record<PetAction, Record<string, number>> = {
  feed: { hunger: 30, happiness: 5, energy: 5, cleanliness: -3 },
  play: { happiness: 35, energy: -20, hunger: -12, cleanliness: -5 },
  rest: { energy: 30, happiness: 5, hunger: -5, cleanliness: 0 },
  wash: { cleanliness: 35, happiness: 8, energy: -5, hunger: -3 },
};

// Stage bonuses for actions (babies get more from feeding, adults from play)
const STAGE_ACTION_BONUS: Record<PetState['stage'], Partial<Record<PetAction, number>>> = {
  baby: { feed: 10, wash: 5 },
  teen: { play: 5 },
  adult: { play: 10, rest: 5 },
};

// Cooldown per action in ms
const ACTION_COOLDOWNS: Record<PetAction, number> = {
  feed: 3 * 60 * 1000,   // 3 min
  play: 5 * 60 * 1000,   // 5 min
  rest: 4 * 60 * 1000,   // 4 min
  wash: 3 * 60 * 1000,   // 3 min
};

// Base coin reward per action
const BASE_COINS: Record<PetAction, number> = {
  feed: 2,
  play: 5,
  rest: 2,
  wash: 3,
};

// Character-specific stat bonuses (reduce decay of a stat)
const CHARACTER_BONUSES: Record<string, { stat: string; reduction: number }> = {
  yaromir: { stat: 'all', reduction: 0.15 },        // legendary: -15% all decay
  valkiriya: { stat: 'hunger', reduction: 0.30 },    // healer: food lasts longer
  pereslav: { stat: 'happiness', reduction: 0.25 },  // cheerful: stays happy
  kazimir: { stat: 'energy', reduction: 0.25 },      // wind: more energy
  vedagor: { stat: 'cleanliness', reduction: 0.30 }, // wise cat: stays clean
  milovan: { stat: 'happiness', reduction: 0.20 },   // love: happy protector
  lelya: { stat: 'hunger', reduction: 0.20 },        // water: well-fed
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
    cooldowns: {},
  };
}

function getDecayRate(stat: string, pet: PetState): number {
  const base = BASE_DECAY[stat] ?? 1.0;
  const stageMult = STAGE_DECAY_MULT[pet.stage];
  const bonus = CHARACTER_BONUSES[pet.characterId];

  let reduction = 0;
  if (bonus) {
    if (bonus.stat === 'all' || bonus.stat === stat) {
      reduction = bonus.reduction;
    }
  }

  return base * stageMult * (1 - reduction);
}

export function applyDecay(pet: PetState, elapsedMinutes: number): PetState {
  // Cap elapsed to prevent massive drops (e.g. after 24h away)
  const capped = Math.min(elapsedMinutes, 480); // max 8 hours of decay

  return {
    ...pet,
    hunger: Math.max(0, pet.hunger - getDecayRate('hunger', pet) * capped),
    happiness: Math.max(0, pet.happiness - getDecayRate('happiness', pet) * capped),
    energy: Math.max(0, pet.energy - getDecayRate('energy', pet) * capped),
    cleanliness: Math.max(0, pet.cleanliness - getDecayRate('cleanliness', pet) * capped),
    lastUpdated: Date.now(),
  };
}

export function isOnCooldown(pet: PetState, action: PetAction): boolean {
  const cd = pet.cooldowns[action];
  if (!cd) return false;
  return Date.now() < cd;
}

export function getCooldownRemaining(pet: PetState, action: PetAction): number {
  const cd = pet.cooldowns[action];
  if (!cd) return 0;
  return Math.max(0, cd - Date.now());
}

export function applyAction(pet: PetState, action: PetAction): { pet: PetState; coins: number } | null {
  if (isOnCooldown(pet, action)) return null;

  const effects = ACTION_EFFECTS[action];
  const stageBonus = STAGE_ACTION_BONUS[pet.stage][action] ?? 0;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  // Mood-based coin bonus
  const mood = getMood(pet);
  const moodMult = mood === 'ecstatic' ? 2.0 : mood === 'happy' ? 1.5 : mood === 'content' ? 1.0 : mood === 'sad' ? 0.5 : 0.25;
  const coins = Math.round(BASE_COINS[action] * moodMult);

  // Main stat gets stage bonus
  const mainEffect = (stat: string) => {
    const base = effects[stat] ?? 0;
    if (base > 0 && stat === getMainStat(action)) return base + stageBonus;
    return base;
  };

  return {
    pet: {
      ...pet,
      hunger: clamp(pet.hunger + mainEffect('hunger')),
      happiness: clamp(pet.happiness + mainEffect('happiness')),
      energy: clamp(pet.energy + mainEffect('energy')),
      cleanliness: clamp(pet.cleanliness + mainEffect('cleanliness')),
      lastUpdated: Date.now(),
      cooldowns: {
        ...pet.cooldowns,
        [action]: Date.now() + ACTION_COOLDOWNS[action],
      },
    },
    coins,
  };
}

function getMainStat(action: PetAction): string {
  const map: Record<PetAction, string> = {
    feed: 'hunger',
    play: 'happiness',
    rest: 'energy',
    wash: 'cleanliness',
  };
  return map[action];
}

export function getMood(pet: PetState): PetMood {
  const avg = (pet.hunger + pet.happiness + pet.energy + pet.cleanliness) / 4;
  if (avg >= 85) return 'ecstatic';
  if (avg >= 65) return 'happy';
  if (avg >= 40) return 'content';
  if (avg >= 18) return 'sad';
  return 'critical';
}

export function updateAge(pet: PetState): PetState {
  const now = Date.now();
  const newAge = pet.age + (now - pet.lastUpdated) / 60000;
  const stage: PetState['stage'] = newAge >= 4320 ? 'adult' : newAge >= 1440 ? 'teen' : 'baby';
  return { ...pet, age: newAge, stage };
}

export function getStatWarning(pet: PetState): string | null {
  if (pet.hunger < 15) return 'Питомец очень голоден!';
  if (pet.happiness < 15) return 'Питомец очень грустит!';
  if (pet.energy < 15) return 'Питомец без сил!';
  if (pet.cleanliness < 15) return 'Питомцу нужна ванна!';
  return null;
}

export const MOOD_LABELS: Record<PetMood, string> = {
  ecstatic: 'В восторге',
  happy: 'Счастлив',
  content: 'Доволен',
  sad: 'Грустит',
  critical: 'Плохо',
};

export const MOOD_COLORS: Record<PetMood, string> = {
  ecstatic: '#FFD700',
  happy: '#5DB879',
  content: '#6AABDA',
  sad: '#D4956A',
  critical: '#E85C5C',
};

export const STAGE_LABELS: Record<PetState['stage'], string> = {
  baby: 'Малыш',
  teen: 'Подросток',
  adult: 'Взрослый',
};

export const STAGE_SIZES: Record<PetState['stage'], number> = {
  baby: 96,
  teen: 112,
  adult: 128,
};
