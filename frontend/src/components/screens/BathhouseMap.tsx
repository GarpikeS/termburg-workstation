import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Lock } from 'lucide-react';
import { useGameContext } from '@/store/GameContext';
import { bathhouses } from '@/data/bathhouses';
import { cn } from '@/utils/cn';

// Positions of bathhouses on the 768x1376 image (%)
// Нечётные слева (1,3,5,7,9), чётные справа (2,4,6,8,10)
const MAP_POSITIONS = [
  { x: 22, y: 83 },  // 1 — Русская баня (слева внизу)
  { x: 60, y: 75 },  // 2 — Финская сауна (справа)
  { x: 22, y: 67 },  // 3 — Турецкий хаммам (слева)
  { x: 60, y: 59 },  // 4 — Сибирская парная (справа)
  { x: 22, y: 51 },  // 5 — Баня-бочка (слева)
  { x: 60, y: 45 },  // 6 — Липовая сауна (справа)
  { x: 22, y: 35 },  // 7 — Травяная сауна (слева)
  { x: 60, y: 29 },  // 8 — Инфракрасная сауна (справа)
  { x: 22, y: 19 },  // 9 — Соляная парная (слева)
  { x: 60, y: 13 },  // 10 — Мультикаменная баня (справа вверху)
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
          <span className="text-base">🌿</span>
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
                  height: '9%',
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

                              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
