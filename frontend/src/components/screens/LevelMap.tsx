import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Lock, Star } from 'lucide-react';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';
import { getLevelsForBathhouse } from '@/data/levels';
import { getBathhouseById } from '@/data/bathhouses';
import { cn } from '@/utils/cn';

export function LevelMap() {
  const navigate = useNavigate();
  const { bathhouseId } = useParams<{ bathhouseId: string }>();
  const { progress } = useGameContext();
  const bhId = Number(bathhouseId) || 1;
  const bathhouse = getBathhouseById(bhId);
  const bLevels = getLevelsForBathhouse(bhId);

  return (
    <div className="h-full flex flex-col bg-dark-surface pb-20">
      {/* Header */}
      <div className="pt-10 pb-4 px-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/games/match3')} className="text-white/50 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-sm font-bold text-primary tracking-wider uppercase">
            {bathhouse?.name ?? 'Уровни'}
          </h2>
          <CurrencyDisplay amount={progress.currency} />
        </div>
      </div>
      <div className="gold-separator" />

      {/* Levels */}
      <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 relative">
        {/* Center path */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px gold-separator transform -translate-x-1/2 opacity-30" style={{ height: '100%', background: 'linear-gradient(180deg, transparent, #BA9B4F 20%, #D9CBA1 50%, #BA9B4F 80%, transparent)' }} />

        <div className="space-y-4 relative z-10">
          {bLevels.map((level, i) => {
            const lp = progress.levels[level.id];
            const unlocked = level.id <= progress.currentLevel;
            const stars = lp?.stars ?? 0;
            const isLeft = i % 2 === 0;

            return (
              <div key={level.id} className={cn('flex items-center gap-3', isLeft ? 'flex-row' : 'flex-row-reverse')}>
                <motion.button
                  className={cn(
                    'flex-shrink-0 bg-white/5 border rounded-xl p-3 transition-all w-[55%]',
                    unlocked ? 'border-white/10 hover:border-primary/30' : 'border-white/5 opacity-30',
                  )}
                  whileTap={unlocked ? { scale: 0.98 } : undefined}
                  onClick={() => unlocked && navigate(`/games/match3/play/${level.id}`)}
                  disabled={!unlocked}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      unlocked ? 'bg-primary/20' : 'bg-white/5',
                    )}>
                      {unlocked ? (
                        <span className="text-primary font-bold text-sm">{level.id}</span>
                      ) : (
                        <Lock size={14} className="text-white/20" />
                      )}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-white/80 text-xs font-medium truncate">{level.name}</p>
                      <div className="flex gap-0.5 mt-1">
                        {[0, 1, 2].map(s => (
                          <Star key={s} size={10} className={s < stars ? 'fill-primary text-primary' : 'text-white/15'} />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.button>
                <div className="flex-1" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
