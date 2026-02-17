import type { Objective } from '@/types/game';
import { TOKEN_COLORS } from '@/types/game';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Pause } from 'lucide-react';
import { Droplets, Leaf, Mountain, Wind, Flame, TreeDeciduous, Sparkles } from 'lucide-react';
import type { ComponentType } from 'react';
import type { Termlin } from '@/data/termliny';
import { ELEMENT_COLORS } from '@/data/termliny';

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
  character?: Termlin;
  abilityReady?: boolean;
  onAbility?: () => void;
}

export function GameHUD({ levelName, score, movesLeft, objectives, onPause, character, abilityReady, onAbility }: GameHUDProps) {
  return (
    <div className="bg-dark-surface-warm border-b border-white/10 text-white px-4 py-3">
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onPause}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
        >
          <Pause size={18} className="text-white/70" />
        </button>
        <h3 className="font-heading text-sm font-bold text-primary tracking-wider uppercase">{levelName}</h3>
        {character ? (
          <div className="flex items-center gap-2">
            <img
              src={character.image}
              alt={character.name}
              className="w-8 h-8 rounded-full object-cover border"
              style={{ borderColor: ELEMENT_COLORS[character.element] ?? '#BA9B4F' }}
            />
            {abilityReady && onAbility && (
              <button
                onClick={onAbility}
                className="w-8 h-8 rounded-lg flex items-center justify-center animate-pulse"
                style={{ backgroundColor: `${ELEMENT_COLORS[character.element] ?? '#BA9B4F'}30` }}
              >
                <Sparkles size={14} style={{ color: ELEMENT_COLORS[character.element] ?? '#BA9B4F' }} />
              </button>
            )}
          </div>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* Stats bar */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
        <div className="text-center">
          <p className="text-white/40 text-[10px] uppercase">Ходы</p>
          <p className="text-2xl font-bold tabular-nums text-white">{movesLeft}</p>
        </div>
        <div className="text-center">
          <p className="text-white/40 text-[10px] uppercase">Очки</p>
          <p className="text-2xl font-bold tabular-nums text-primary">{score.toLocaleString()}</p>
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
                style={{ backgroundColor: `${TOKEN_COLORS[obj.type]}30` }}
              >
                {Icon && <Icon size={16} />}
              </div>
              <div className="flex-1">
                <ProgressBar
                  current={obj.current}
                  max={obj.target}
                  color={done ? '#5DB879' : TOKEN_COLORS[obj.type]}
                  className="h-2 bg-white/10"
                />
              </div>
              <span className="text-xs tabular-nums font-bold min-w-[40px] text-right text-white/70">
                {Math.min(obj.current, obj.target)}/{obj.target}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
