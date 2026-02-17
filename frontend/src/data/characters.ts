export interface Character {
  id: string;
  name: string;
  image: string;
  description: string;
  unlockLevel: number;
}

export const characters: Character[] = [
  {
    id: 'yaromir',
    name: 'Яромир',
    image: '/images/characters/yaromir.webp',
    description: 'Хранитель терм, мудрый и спокойный',
    unlockLevel: 1,
  },
  {
    id: 'valkiriya',
    name: 'Валькирия',
    image: '/images/characters/valkiriya.webp',
    description: 'Воительница пара, стремительная и ловкая',
    unlockLevel: 6,
  },
  {
    id: 'pereslav',
    name: 'Переслав',
    image: '/images/characters/pereslav.webp',
    description: 'Мастер камня, крепкий и надёжный',
    unlockLevel: 11,
  },
  {
    id: 'kazimir',
    name: 'Казимир',
    image: '/images/characters/kazimir.webp',
    description: 'Повелитель огня, пылкий и решительный',
    unlockLevel: 16,
  },
  {
    id: 'vedagor',
    name: 'Ведагор',
    image: '/images/characters/vedagor.webp',
    description: 'Лесной дух, загадочный и мудрый',
    unlockLevel: 21,
  },
  {
    id: 'milovan',
    name: 'Милован',
    image: '/images/characters/milovan.webp',
    description: 'Целитель вод, добрый и заботливый',
    unlockLevel: 23,
  },
  {
    id: 'lelya',
    name: 'Леля',
    image: '/images/characters/lelya.webp',
    description: 'Дух весны, нежная и могущественная',
    unlockLevel: 26,
  },
];

export function getCharacterById(id: string): Character | undefined {
  return characters.find(c => c.id === id);
}

export function getUnlockedCharacters(currentLevel: number): Character[] {
  return characters.filter(c => c.unlockLevel <= currentLevel);
}
