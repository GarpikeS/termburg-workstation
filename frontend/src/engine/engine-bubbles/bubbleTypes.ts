export const BubbleColor = {
  Water: 'water',
  Leaf: 'leaf',
  Steam: 'steam',
  Fire: 'fire',
  Stone: 'stone',
} as const;

export type BubbleColor = (typeof BubbleColor)[keyof typeof BubbleColor];

export const ALL_BUBBLE_COLORS: BubbleColor[] = Object.values(BubbleColor) as BubbleColor[];

export const BUBBLE_HEX_COLORS: Record<BubbleColor, string> = {
  water: '#6AABDA',
  leaf: '#5DB879',
  steam: '#9B7EC8',
  fire: '#D4956A',
  stone: '#8E8E9E',
};

export interface Bubble {
  id: number;
  color: BubbleColor;
  row: number;
  col: number;
  x: number;
  y: number;
}

export interface FlyingBubble {
  color: BubbleColor;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface BubbleGridState {
  bubbles: Bubble[];
  nextId: number;
}
