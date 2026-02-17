import { useNavigate } from 'react-router-dom';
import { useGameContext } from '@/store/GameContext';
import { levels } from '@/data/levels';
import { StarRating } from '@/components/ui/StarRating';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/utils/cn';

export function LevelMap() {
  const navigate = useNavigate();
  const { progress } = useGameContext();

  return (
    <div className="h-full flex flex-col bg-game-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => navigate('/menu')}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-dark-surface-warm/60 text-white/70 hover:text-white"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="font-heading text-lg text-white">Уровни</h2>
        <CurrencyDisplay amount={progress.currency} />
      </div>

      {/* Level grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid grid-cols-5 gap-3 max-w-md mx-auto pt-2">
          {levels.map(level => {
            const lp = progress.levels[level.id];
            const unlocked = level.id <= progress.currentLevel;
            const stars = lp?.stars ?? 0;

            return (
              <button
                key={level.id}
                disabled={!unlocked}
                onClick={() => navigate(`/game/${level.id}`)}
                className={cn(
                  'relative flex flex-col items-center gap-1 py-3 rounded-xl transition-all',
                  unlocked
                    ? 'bg-dark-surface-warm hover:bg-dark-surface-warm/80 hover:scale-105'
                    : 'bg-dark-surface/50 opacity-40 cursor-not-allowed',
                )}
              >
                <span className={cn(
                  'font-heading text-lg',
                  stars > 0 ? 'text-primary' : unlocked ? 'text-white' : 'text-white/30',
                )}>
                  {level.id}
                </span>
                {unlocked && <StarRating stars={stars} size={10} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
