export interface Character {
  id: string;
  name: string;
  gradient: string;
  description: string;
  unlockLevel: number;
}

export const characters: Character[] = [
  {
    id: 'ai-concierge',
    name: 'AI-консьерж',
    gradient: 'from-[#7FA99B] to-[#6DB4C9]',
    description: 'Умный помощник с подсказками',
    unlockLevel: 1,
  },
  {
    id: 'term-master',
    name: 'Терм-мастер',
    gradient: 'from-[#E88B5C] to-[#C4956C]',
    description: 'Мастер горячего пара',
    unlockLevel: 11,
  },
  {
    id: 'ar-guide',
    name: 'AR-гид',
    gradient: 'from-[#C4956C] to-[#E8DCC4]',
    description: 'Проводник виртуальных миров',
    unlockLevel: 41,
  },
];

export function getCharacterById(id: string): Character | undefined {
  return characters.find(c => c.id === id);
}

export function getUnlockedCharacters(currentLevel: number): Character[] {
  return characters.filter(c => c.unlockLevel <= currentLevel);
}
