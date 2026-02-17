import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Lock, Coins } from 'lucide-react';
import { useGameContext } from '@/store/GameContext';
import { bathhouses } from '@/data/bathhouses';
import { cn } from '@/utils/cn';

// Positions of bathhouses on the 768x1376 image (%)
// Symmetric around center axis (50%), offset ±22%
const MAP_POSITIONS = [
  { x: 50, y: 92 },  // 1 — center
  { x: 28, y: 83 },  // 2 — left
  { x: 72, y: 73 },  // 3 — right
  { x: 28, y: 65 },  // 4 — left
  { x: 72, y: 56 },  // 5 — right
  { x: 28, y: 47 },  // 6 — left
  { x: 72, y: 38 },  // 7 — right
  { x: 50, y: 29 },  // 8 — center (crystal)
  { x: 28, y: 20 },  // 9 — left
  { x: 72, y: 11 },  // 10 — right
] as const;

export function BathhouseMap() {
  const navigate = useNavigate();
  const { progress } = useGameContext();

  return (
    <div className="h-full relative bg-[#080c08] overflow-hidden flex flex-col">
      {/* Header — over the map */}
      <div className="absolute top-7 left-4 right-4 flex items-center justify-between z-20">
        <motion.button
          className="bg-black/50 backdrop-blur-sm border border-white/20 rounded-full p-2.5"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/games')}
        >
          <ArrowLeft size={16} className="text-white/80" />
        </motion.button>

        <motion.div
          className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-primary/30 rounded-full px-3 py-1.5"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Coins size={14} className="text-primary" />
          <span className="text-primary font-bold text-sm">{progress.currency}</span>
        </motion.div>
      </div>

      {/* Dark gradient for top UI */}
      <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/50 to-transparent z-10" />

      {/* Scrollable map */}
      <div className="flex-1 overflow-y-auto phone-scroll">
        <div
          className="relative w-full"
          style={{ paddingBottom: '179.2%' /* 1376/768 * 100 */ }}
        >
          <img
            src="/images/ui/bathhouse-map-bg.jpg"
            alt="Карта бань"
            className="absolute inset-0 w-full h-full"
            draggable={false}
          />

          {/* Bathhouse hotspots */}
          {bathhouses.map((bh, idx) => {
            const pos = MAP_POSITIONS[idx];
            if (!pos) return null;
            const unlocked = bh.levelsRange[0] <= progress.currentLevel;
            const completed = bh.levelsRange[1] < progress.currentLevel;
            const current = unlocked && !completed;

            return (
              <motion.button
                key={bh.id}
                className="absolute flex flex-col items-center z-10"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  width: '18%',
                  height: '7%',
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => unlocked && navigate(`/games/match3/levels/${bh.id}`)}
                disabled={!unlocked}
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

                {/* Level range label */}
                {unlocked && (
                  <div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2"
                    style={{ transform: 'translateX(-50%) translateY(100%)' }}
                  >
                    <span
                      className={cn(
                        'text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap',
                        completed
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-black/50 text-white/70',
                      )}
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                    >
                      {bh.levelsRange[0]}–{bh.levelsRange[1]}
                    </span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
