// Thematic tile colors: water → steam → fire → gold
export function getTileColor(value: number): { bg: string; text: string } {
  const colors: Record<number, { bg: string; text: string }> = {
    2:    { bg: '#3a4a5c', text: '#9BBBD4' },    // dark water
    4:    { bg: '#3a5c4a', text: '#7DCA93' },    // dark leaf
    8:    { bg: '#4a3a5c', text: '#B498D8' },    // dark steam
    16:   { bg: '#5c4a3a', text: '#D4A56A' },    // dark fire
    32:   { bg: '#5c3a3a', text: '#D47A6A' },    // warm
    64:   { bg: '#5c503a', text: '#D4C46A' },    // hot
    128:  { bg: '#4a3a2a', text: '#BA9B4F' },    // bronze
    256:  { bg: '#5c4a2a', text: '#D4B44F' },    // silver-gold
    512:  { bg: '#6a5a3a', text: '#E4C45F' },    // gold
    1024: { bg: '#7a6a3a', text: '#F4D46F' },    // bright gold
    2048: { bg: '#8a7a3a', text: '#FFE47F' },    // legendary
  };
  return colors[value] ?? { bg: '#8a7a3a', text: '#FFE47F' };
}

export function getTileFontSize(value: number): string {
  if (value < 100) return 'text-2xl';
  if (value < 1000) return 'text-xl';
  return 'text-lg';
}
