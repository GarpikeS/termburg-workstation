import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, Crown } from 'lucide-react';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';
import { termliny, ELEMENT_COLORS } from '@/data/termliny';
import { cn } from '@/utils/cn';

export function TermlinyCollection() {
  const navigate = useNavigate();
  const { progress } = useGameContext();

  return (
    <div className="h-full flex flex-col bg-dark-surface pb-20">
      {/* Header */}
      <div className="pt-10 pb-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/images/ui/splash-logo.svg" alt="" className="w-6 h-6" />
            <div>
              <h2 className="font-heading text-base font-bold text-primary tracking-wider uppercase">Термлины</h2>
              <p className="text-white/40 text-[10px] mt-0.5">
                {progress.unlockedCharacters.length} / {termliny.length} открыто
              </p>
            </div>
          </div>
          <CurrencyDisplay amount={progress.currency} />
        </div>
      </div>
      <div className="gold-separator" />

      {/* Grid */}
      <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          {termliny.map((t, i) => {
            const unlocked = progress.unlockedCharacters.includes(t.id);
            const selected = progress.selectedCharacter === t.id;
            const color = ELEMENT_COLORS[t.element] ?? '#BA9B4F';

            return (
              <motion.button
                key={t.id}
                className={cn(
                  'bg-white/5 border rounded-2xl p-3 text-center transition-all overflow-hidden relative',
                  unlocked ? 'border-white/10 hover:border-white/20' : 'border-white/5',
                  selected && 'ring-2 ring-primary',
                  t.isLegendary && unlocked && 'border-yellow-500/30 bg-yellow-500/5',
                )}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileTap={unlocked ? { scale: 0.96 } : undefined}
                onClick={() => unlocked && navigate(`/collection/${t.id}`)}
                disabled={!unlocked}
              >
                {/* Legendary crown */}
                {t.isLegendary && unlocked && (
                  <div className="absolute top-1.5 right-1.5">
                    <Crown size={14} className="text-yellow-500" />
                  </div>
                )}
                <div className={cn('relative mx-auto mb-2', !unlocked && 'grayscale opacity-40')}>
                  <img
                    src={t.image}
                    alt={t.name}
                    className={cn(
                      'w-20 h-20 rounded-full object-cover mx-auto border-2',
                      t.isLegendary && unlocked && 'border-3',
                    )}
                    style={{
                      borderColor: unlocked ? (t.isLegendary ? '#FFD700' : color) : 'rgba(255,255,255,0.1)',
                      boxShadow: t.isLegendary && unlocked ? '0 0 20px rgba(255,215,0,0.2)' : undefined,
                    }}
                  />
                  {!unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-black/60 rounded-full p-2">
                        <Lock size={16} className="text-white/60" />
                      </div>
                    </div>
                  )}
                </div>
                <p className={cn('font-bold text-xs', unlocked ? 'text-white/90' : 'text-white/30')}>
                  {t.name}
                </p>
                <p className={cn('text-[10px] mt-0.5', unlocked ? 'text-white/40' : 'text-white/20')}>
                  {unlocked ? t.title : `Уровень ${t.unlockLevel}`}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
