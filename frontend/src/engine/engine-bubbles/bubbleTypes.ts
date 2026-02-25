// Типы веников для банной тематики
export const BubbleColor = {
  Birch: 'birch',       // Берёзовый
  Oak: 'oak',           // Дубовый
  Eucalyptus: 'eucalyptus', // Эвкалиптовый
  Linden: 'linden',     // Липовый
  Juniper: 'juniper',   // Можжевеловый
  Nettle: 'nettle',     // Крапивный
  Fir: 'fir',           // Пихтовый
  Mixed: 'mixed',       // Смешанный
} as const;

export type BubbleColor = (typeof BubbleColor)[keyof typeof BubbleColor];

export const ALL_BUBBLE_COLORS: BubbleColor[] = Object.values(BubbleColor) as BubbleColor[];

// Цвета для веников
export const BUBBLE_HEX_COLORS: Record<BubbleColor, string> = {
  birch: '#8BC34A',     // Светло-зелёный (берёза)
  oak: '#6D4C41',       // Коричневый (дуб)
  eucalyptus: '#26A69A', // Бирюзовый (эвкалипт)
  linden: '#FFEB3B',    // Жёлтый (липа)
  juniper: '#2E7D32',   // Тёмно-зелёный (можжевельник)
  nettle: '#7CB342',    // Зелёный (крапива)
  fir: '#1B5E20',       // Ёлочный зелёный (пихта)
  mixed: '#9C27B0',     // Фиолетовый (смешанный)
};

// Названия веников
export const BUBBLE_NAMES: Record<BubbleColor, string> = {
  birch: 'Берёзовый',
  oak: 'Дубовый',
  eucalyptus: 'Эвкалипт',
  linden: 'Липовый',
  juniper: 'Можжевельник',
  nettle: 'Крапивный',
  fir: 'Пихтовый',
  mixed: 'Смешанный',
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
