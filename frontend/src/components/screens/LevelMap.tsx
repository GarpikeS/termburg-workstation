import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Lock, Star } from 'lucide-react';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';
import { getLevelsForBathhouse } from '@/data/levels';
import { getBathhouseById } from '@/data/bathhouses';
import { cn } from '@/utils/cn';

const difficultyColors = {
  classic: 'bg-[#7FA99B]',
  premium: 'bg-[#C4956C]',
  vip: 'bg-[#E88B5C]',
};

export function LevelMap() {
  const navigate = useNavigate();
  const { bathhouseId } = useParams<{ bathhouseId: string }>();
  const { progress } = useGameContext();
  const bhId = Number(bathhouseId) || 1;
  const bathhouse = getBathhouseById(bhId);
  const bLevels = getLevelsForBathhouse(bhId);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-primary/5 to-accent/5 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary to-accent pt-12 pb-6 px-6 rounded-b-4xl shadow-xl">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/map')}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="font-heading text-lg text-white font-bold">
            {bathhouse?.name ?? 'Уровни'}
          </h2>
          <CurrencyDisplay amount={progress.currency} light />
        </div>
      </div>

      {/* Levels path */}
      <div className="flex-1 overflow-y-auto px-6 py-6 relative">
        {/* Center path line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-accent to-secondary transform -translate-x-1/2 opacity-20" />

        <div className="space-y-6 relative z-10">
          {bLevels.map((level, i) => {
            const lp = progress.levels[level.id];
            const unlocked = level.id <= progress.currentLevel;
            const stars = lp?.stars ?? 0;
            const isLeft = i % 2 === 0;

            return (
              <div
                key={level.id}
                className={cn('flex items-center gap-4', isLeft ? 'flex-row' : 'flex-row-reverse')}
              >
                {/* Level card */}
                <motion.button
                  className={cn(
                    'w-64 bg-card rounded-2xl p-4 shadow-md relative',
                    !unlocked && 'opacity-40',
                  )}
                  whileTap={unlocked ? { scale: 0.98 } : undefined}
                  onClick={() => unlocked && navigate(`/game/${level.id}`)}
                  disabled={!unlocked}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center shadow-lg',
                        unlocked ? '' : 'bg-muted',
                      )}
                      style={unlocked ? { backgroundColor: bathhouse?.color } : undefined}
                    >
                      {unlocked ? (
                        <span className="text-white font-bold">{level.id}</span>
                      ) : (
                        <Lock size={18} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-sm text-foreground">{level.name}</p>
                      <span className={cn(
                        'inline-block text-[10px] font-bold text-white px-2 py-0.5 rounded-full mt-1',
                        difficultyColors[level.difficulty],
                      )}>
                        {level.difficulty}
                      </span>
                    </div>
                  </div>
                  {unlocked && (
                    <div className="flex gap-0.5 mt-2 ml-15">
                      {[0, 1, 2].map(s => (
                        <Star
                          key={s}
                          size={14}
                          className={s < stars ? 'fill-termo-gold text-termo-gold' : 'text-muted'}
                        />
                      ))}
                    </div>
                  )}
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
