import type { Objective } from '@/types/game';
import { ObjectiveDisplay } from './ObjectiveDisplay';
import { Pause } from 'lucide-react';

interface GameHUDProps {
  level: number;
  score: number;
  movesLeft: number;
  objectives: Objective[];
  onPause: () => void;
}

export function GameHUD({ level, score, movesLeft, objectives, onPause }: GameHUDProps) {
  return (
    <div className="w-full max-w-md mx-auto px-4 py-2 space-y-2">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="text-white/60 text-sm font-heading">
          Уровень {level}
        </div>
        <div className="text-primary font-bold text-lg tabular-nums">
          {score.toLocaleString()}
        </div>
        <button
          onClick={onPause}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-dark-surface-warm/60 hover:bg-dark-surface-warm text-white/70 hover:text-white transition-colors"
        >
          <Pause size={18} />
        </button>
      </div>

      {/* Moves + Objectives */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-dark-surface-warm/60 rounded-lg px-3 py-1.5">
          <span className="text-white/50 text-xs">Ходы</span>
          <span className="text-white font-bold text-lg tabular-nums leading-none">{movesLeft}</span>
        </div>
        <ObjectiveDisplay objectives={objectives} />
      </div>
    </div>
  );
}
