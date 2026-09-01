import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Lock } from 'lucide-react';
import { useGameContext } from '@/store/GameContext';
import { bathhouses } from '@/data/bathhouses';
import { SceneCanvas } from '@/components/ui/SceneCanvas';
import { LivesDisplay } from '@/components/ui/LivesDisplay';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';

export function BathhouseMap() {
  const navigate = useNavigate();
  const { progress } = useGameContext();

  return (
    <div className="h-full relative bg-[#080c08] overflow-hidden flex flex-col">
      {/* Header — over the map */}
      <div className="safe-top-overlay absolute left-4 right-4 flex items-center justify-between z-20">
        <motion.button
          type="button"
          aria-label="Назад к играм"
          className="min-w-11 min-h-11 bg-black/50 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/games')}
        >
          <ArrowLeft size={16} className="text-white/80" />
        </motion.button>

        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <LivesDisplay lives={progress.lives} nextLifeAt={progress.nextLifeAt} />
          <CurrencyDisplay amount={progress.currency} className="min-h-11 border border-primary/30 bg-black/50 backdrop-blur-sm" />
        </motion.div>
      </div>

      {/* Dark gradient for top UI */}
      <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/50 to-transparent z-10" />

      <div className="flex-1 min-h-0">
        <SceneCanvas
          src="/images/ui/bathhouse-map-bg.webp"
          alt="Карта бань"
          sourceWidth={768}
          sourceHeight={1376}
        >
          {bathhouses.map((bh, idx) => {
            const pos = bh.position;
            const unlocked = bh.levelsRange[0] <= progress.currentLevel;
            const completed = bh.levelsRange[1] < progress.currentLevel;
            const current = unlocked && !completed;

            return (
              <div
                key={bh.id}
                className="absolute z-10"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  width: '18%',
                  height: '9%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
              <motion.button
                type="button"
                className="w-full h-full min-w-11 min-h-11 flex flex-col items-center"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => unlocked && navigate(`/games/match3/levels/${bh.id}`)}
                disabled={!unlocked}
                aria-label={`${bh.name}${unlocked ? '' : ', закрыто'}`}
              >
                {/* Glow for current level */}
                {current && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ boxShadow: `0 0 20px 6px ${bh.color}60` }}
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                )}

                {/* Lock overlay for locked bathhouses */}
                {!unlocked && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/60 rounded-full p-1.5">
                      <Lock size={12} className="text-white/40" />
                    </div>
                  </div>
                )}

              </motion.button>
              </div>
            );
          })}
        </SceneCanvas>
      </div>
    </div>
  );
}
