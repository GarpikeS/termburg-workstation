import type { Bathhouse } from '@/types/game';

// Реальные зоны Термбурга
// Количество уровней: 1-4 по 10, 5 - 12, 6-8 по 10, 9 - 14, 10 - 20 = 116 всего
export const bathhouses: Bathhouse[] = [
  { id: 1, name: 'Русская баня', color: '#8B6F47', levelsRange: [1, 10], position: { x: 50, y: 88 } },
  { id: 2, name: 'Финская сауна', color: '#C4956C', levelsRange: [11, 20], position: { x: 25, y: 78 } },
  { id: 3, name: 'Турецкий хаммам', color: '#6DB4C9', levelsRange: [21, 30], position: { x: 72, y: 68 } },
  { id: 4, name: 'Сибирская парная', color: '#7FA99B', levelsRange: [31, 40], position: { x: 30, y: 57 } },
  { id: 5, name: 'Баня-бочка', color: '#A67C52', levelsRange: [41, 52], position: { x: 68, y: 47 } },
  { id: 6, name: 'Липовая сауна', color: '#D4B896', levelsRange: [53, 62], position: { x: 28, y: 37 } },
  { id: 7, name: 'Травяная сауна', color: '#6EAA5E', levelsRange: [63, 72], position: { x: 70, y: 28 } },
  { id: 8, name: 'Инфракрасная сауна', color: '#E88B5C', levelsRange: [73, 82], position: { x: 35, y: 19 } },
  { id: 9, name: 'Соляная парная', color: '#E8B4D4', levelsRange: [83, 96], position: { x: 65, y: 11 } },
  { id: 10, name: 'Мультикаменная баня', color: '#8B8D8F', levelsRange: [97, 116], position: { x: 50, y: 4 } },
];

export function getBathhouseById(id: number): Bathhouse | undefined {
  return bathhouses.find(b => b.id === id);
}

export function getBathhouseForLevel(levelId: number): Bathhouse | undefined {
  return bathhouses.find(b => levelId >= b.levelsRange[0] && levelId <= b.levelsRange[1]);
}
