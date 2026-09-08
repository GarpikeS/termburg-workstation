import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Lock } from 'lucide-react';
import { useGameContext } from '@/store/GameContext';
import { bathhouses, getBathhouseEntryLevel } from '@/data/bathhouses';
import { GAME_LEVEL_TOTAL, clampGameLevel } from '@/data/gameProgression';
import { SceneCanvas } from '@/components/ui/SceneCanvas';
import { LivesDisplay } from '@/components/ui/LivesDisplay';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';

export function BathhouseMap() {
  const navigate = useNavigate();
  const { progress } = useGameContext();
  const displayedLevel = clampGameLevel(progress.currentLevel);

  return (
    <div className="h-full relative bg-[#080c08] overflow-hidden flex flex-col">
      {/* Header — over the map */}
      <div className="safe-top-overlay absolute left-4 right-4 grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1.5 z-20">
        <motion.button
          type="button"
          aria-label="Назад к играм"
          className="col-start-1 row-start-1 min-w-11 min-h-11 bg-black/50 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/games')}
        >
          <ArrowLeft size={16} className="text-white/80" />
        </motion.button>

        <motion.div
          className="col-span-3 row-start-2 min-w-[8.5rem] justify-self-center rounded-xl border border-primary/30 bg-black/60 px-3 py-1.5 text-center backdrop-blur-sm"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          data-match3-map-progress
        >
          <span className="block truncate text-[8px] font-semibold uppercase tracking-[0.12em] text-white/55">
            Хоровод
          </span>
          <strong className="mt-0.5 block whitespace-nowrap text-[11px] font-bold tabular-nums text-primary">
            Уровень {displayedLevel} из {GAME_LEVEL_TOTAL}
          </strong>
        </motion.div>

        <motion.div
          className="col-start-3 row-start-1 flex items-center gap-1.5"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <LivesDisplay lives={progress.lives} nextLifeAt={progress.nextLifeAt} className="px-2" />
          <CurrencyDisplay amount={progress.currency} className="min-h-11 border border-primary/30 bg-black/50 px-2 backdrop-blur-sm" />
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
            const entryLevel = getBathhouseEntryLevel(bh, progress.currentLevel);
            const unlocked = entryLevel !== null;
            const completed = bh.levelsRange[1] < progress.currentLevel;
            const current = unlocked && !completed;
            const accessibleLabel = !unlocked
              ? `${bh.name}, закрыто. Открывается на уровне ${bh.levelsRange[0]} из ${GAME_LEVEL_TOTAL}`
              : completed
                ? `${bh.name}, пройдено. Повторить уровень ${entryLevel} из ${GAME_LEVEL_TOTAL}`
                : `${bh.name}. Играть: уровень ${entryLevel} из ${GAME_LEVEL_TOTAL}`;

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
                onClick={() => entryLevel !== null && navigate(`/games/match3/play/${entryLevel}`)}
                disabled={!unlocked}
                aria-label={accessibleLabel}
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
