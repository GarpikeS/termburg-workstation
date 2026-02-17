import type { Objective } from '@/types/game';
import { TOKEN_COLORS } from '@/types/game';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Pause } from 'lucide-react';
import { Droplets, Leaf, Mountain, Wind, Flame, TreeDeciduous } from 'lucide-react';
import type { ComponentType } from 'react';

const GEM_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  water: Droplets, leaf: Leaf, stone: Mountain,
  steam: Wind, fire: Flame, wood: TreeDeciduous,
};

interface GameHUDProps {
  levelName: string;
  score: number;
  movesLeft: number;
  objectives: Objective[];
  onPause: () => void;
}

export function GameHUD({ levelName, score, movesLeft, objectives, onPause }: GameHUDProps) {
  return (
    <div className="bg-gradient-to-b from-primary to-accent text-white px-4 py-3 rounded-b-3xl shadow-lg">
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onPause}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm"
        >
          <Pause size={18} />
        </button>
        <h3 className="font-heading text-base font-bold">{levelName}</h3>
        <div className="w-9" />
      </div>

      {/* Stats bar */}
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 flex items-center justify-between">
        <div className="text-center">
          <p className="text-white/60 text-[10px] uppercase">Ходы</p>
          <p className="text-2xl font-bold tabular-nums">{movesLeft}</p>
        </div>
        <div className="text-center">
          <p className="text-white/60 text-[10px] uppercase">Очки</p>
          <p className="text-2xl font-bold tabular-nums">{score.toLocaleString()}</p>
        </div>
      </div>

      {/* Goals */}
      <div className="mt-3 space-y-2">
        {objectives.map((obj, i) => {
          const Icon = GEM_ICONS[obj.type];
          const done = obj.current >= obj.target;
          return (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: TOKEN_COLORS[obj.type] }}
              >
                {Icon && <Icon size={16} />}
              </div>
              <div className="flex-1">
                <ProgressBar
                  current={obj.current}
                  max={obj.target}
                  color={done ? '#6EAA5E' : 'white'}
                  className="h-2 bg-white/20"
                />
              </div>
              <span className="text-xs tabular-nums font-bold min-w-[40px] text-right">
                {Math.min(obj.current, obj.target)}/{obj.target}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
