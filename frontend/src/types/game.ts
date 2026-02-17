export const TokenType = {
  Water: 'water',
  Leaf: 'leaf',
  Stone: 'stone',
  Steam: 'steam',
  Fire: 'fire',
  Wood: 'wood',
} as const;

export type TokenType = (typeof TokenType)[keyof typeof TokenType];

export const TOKEN_COLORS: Record<TokenType, string> = {
  water: '#6AABDA',
  leaf: '#5DB879',
  stone: '#8E8E9E',
  steam: '#9B7EC8',
  fire: '#D4956A',
  wood: '#A0784C',
};

export const ALL_TOKEN_TYPES: TokenType[] = Object.values(TokenType) as TokenType[];

export interface Position {
  row: number;
  col: number;
}

export interface Cell {
  type: TokenType;
  id: number;
}

export type Grid = (Cell | null)[][];

export interface MatchGroup {
  positions: Position[];
  type: TokenType;
}

export interface SwapAction {
  from: Position;
  to: Position;
}

export type AnimationPhase =
  | 'idle'
  | 'swap'
  | 'swap_back'
  | 'match'
  | 'score'
  | 'fall'
  | 'spawn'
  | 'cascade_check';

export interface AnimationState {
  phase: AnimationPhase;
  startTime: number;
  duration: number;
  data?: unknown;
}

export interface Objective {
  type: TokenType;
  target: number;
  current: number;
}

export interface LevelConfig {
  id: number;
  rows: number;
  cols: number;
  tokenTypes: TokenType[];
  moves: number;
  objectives: { type: TokenType; target: number }[];
  starThresholds: [number, number, number]; // 1★, 2★, 3★ score
  reward: number; // termliny currency
  characterId: string;
}

export interface LevelProgress {
  stars: number;
  bestScore: number;
  completed: boolean;
}

export interface GameState {
  grid: Grid;
  score: number;
  movesLeft: number;
  objectives: Objective[];
  combo: number;
  phase: AnimationPhase;
  selectedCell: Position | null;
  levelConfig: LevelConfig;
  isWon: boolean;
  isLost: boolean;
}

export interface PlayerProgress {
  currentLevel: number;
  levels: Record<number, LevelProgress>;
  currency: number;
  selectedCharacter: string;
  tutorialCompleted: boolean;
}
