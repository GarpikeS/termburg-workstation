import type { Bathhouse } from '@/types/game';

export const bathhouses: Bathhouse[] = [
  { id: 1, name: 'Классические бани', color: '#7FA99B', levelsRange: [1, 10], position: { x: 50, y: 80 } },
  { id: 2, name: 'Лесная баня', color: '#8B6F47', levelsRange: [11, 20], position: { x: 30, y: 65 } },
  { id: 3, name: 'Каменная баня', color: '#C4956C', levelsRange: [21, 30], position: { x: 70, y: 55 } },
  { id: 4, name: 'Каменный пар', color: '#8B8D8F', levelsRange: [31, 40], position: { x: 40, y: 45 } },
  { id: 5, name: 'Горные купели', color: '#E88B5C', levelsRange: [41, 50], position: { x: 65, y: 35 } },
  { id: 6, name: 'Японская баня', color: '#6DB4C9', levelsRange: [51, 60], position: { x: 25, y: 30 } },
  { id: 7, name: 'Турецкая баня', color: '#C4956C', levelsRange: [61, 70], position: { x: 75, y: 20 } },
  { id: 8, name: 'Ледяная купель', color: '#6EAA5E', levelsRange: [71, 80], position: { x: 45, y: 15 } },
  { id: 9, name: 'Каменные бассейны', color: '#B8C9D9', levelsRange: [81, 90], position: { x: 60, y: 8 } },
  { id: 10, name: 'Минеральная баня', color: '#E88B5C', levelsRange: [91, 100], position: { x: 50, y: 2 } },
];

export function getBathhouseById(id: number): Bathhouse | undefined {
  return bathhouses.find(b => b.id === id);
}

export function getBathhouseForLevel(levelId: number): Bathhouse | undefined {
  return bathhouses.find(b => levelId >= b.levelsRange[0] && levelId <= b.levelsRange[1]);
}
