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
  water: '#6DB4C9',
  leaf: '#6EAA5E',
  stone: '#8B8D8F',
  steam: '#B8C9D9',
  fire: '#E88B5C',
  wood: '#8B6F47',
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

export type Difficulty = 'classic' | 'premium' | 'vip';

export interface LevelConfig {
  id: number;
  name: string;
  difficulty: Difficulty;
  bathhouseId: number;
  rows: number;
  cols: number;
  tokenTypes: TokenType[];
  moves: number;
  objectives: { type: TokenType; target: number }[];
  starThresholds: [number, number, number];
  reward: number;
  characterId: string;
}

export interface Bathhouse {
  id: number;
  name: string;
  color: string;
  levelsRange: [number, number];
  position: { x: number; y: number };
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
