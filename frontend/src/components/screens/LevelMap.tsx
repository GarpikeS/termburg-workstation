import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Lock, Star } from 'lucide-react';
import { useGameContext } from '@/store/GameContext';
import { getLevelsForBathhouse } from '@/data/levels';
import { getBathhouseById } from '@/data/bathhouses';
import { cn } from '@/utils/cn';

// Конфигурация для каждой бани: позиции медальонов и флаг квадратности
const BATH_CONFIGS: Record<number, { positions: { x: number; y: number }[]; isSquare: boolean }> = {
  // bath-1: Русская баня — вертикальное изображение, 10 уровней
  1: {
    isSquare: false,
    positions: [
      { x: 28, y: 91 }, { x: 72, y: 82 }, { x: 28, y: 73 }, { x: 72, y: 64 },
      { x: 28, y: 55 }, { x: 72, y: 46 }, { x: 28, y: 37 }, { x: 72, y: 28 },
      { x: 28, y: 19 }, { x: 50, y: 8 },
    ],
  },
  // bath-2: Финская сауна — вертикальное, 10 уровней
  2: {
    isSquare: false,
    positions: [
      { x: 28, y: 91 }, { x: 72, y: 82 }, { x: 28, y: 73 }, { x: 72, y: 64 },
      { x: 28, y: 55 }, { x: 72, y: 46 }, { x: 28, y: 37 }, { x: 72, y: 28 },
      { x: 28, y: 19 }, { x: 50, y: 8 },
    ],
  },
  // bath-3: Турецкий хаммам — квадратное, 10 уровней
  3: {
    isSquare: true,
    positions: [
      { x: 30, y: 88 }, { x: 70, y: 80 }, { x: 30, y: 70 }, { x: 70, y: 60 },
      { x: 30, y: 50 }, { x: 70, y: 40 }, { x: 30, y: 30 }, { x: 70, y: 20 },
      { x: 50, y: 12 }, { x: 50, y: 4 },
    ],
  },
  // bath-4: Сибирская парная — вертикальное, 10 уровней
  4: {
    isSquare: false,
    positions: [
      { x: 28, y: 91 }, { x: 72, y: 82 }, { x: 28, y: 73 }, { x: 72, y: 64 },
      { x: 28, y: 55 }, { x: 72, y: 46 }, { x: 28, y: 37 }, { x: 72, y: 28 },
      { x: 28, y: 19 }, { x: 50, y: 8 },
    ],
  },
  // bath-5: Баня-бочка — квадратное, 12 уровней
  5: {
    isSquare: true,
    positions: [
      { x: 25, y: 92 }, { x: 75, y: 86 }, { x: 25, y: 78 }, { x: 75, y: 70 },
      { x: 30, y: 62 }, { x: 70, y: 54 }, { x: 32, y: 46 }, { x: 68, y: 38 },
      { x: 35, y: 30 }, { x: 65, y: 24 }, { x: 42, y: 16 }, { x: 50, y: 6 },
    ],
  },
  // bath-6: Липовая сауна — квадратное, 10 уровней (идентично 7, 8)
  6: {
    isSquare: true,
    positions: [
      { x: 28, y: 92 }, { x: 72, y: 84 }, { x: 28, y: 74 }, { x: 72, y: 64 },
      { x: 30, y: 54 }, { x: 70, y: 44 }, { x: 32, y: 34 }, { x: 68, y: 26 },
      { x: 42, y: 16 }, { x: 50, y: 6 },
    ],
  },
  // bath-7: Травяная сауна — квадратное, 10 уровней
  7: {
    isSquare: true,
    positions: [
      { x: 28, y: 92 }, { x: 72, y: 84 }, { x: 28, y: 74 }, { x: 72, y: 64 },
      { x: 30, y: 54 }, { x: 70, y: 44 }, { x: 32, y: 34 }, { x: 68, y: 26 },
      { x: 42, y: 16 }, { x: 50, y: 6 },
    ],
  },
  // bath-8: Инфракрасная сауна — квадратное, 10 уровней
  8: {
    isSquare: true,
    positions: [
      { x: 28, y: 92 }, { x: 72, y: 84 }, { x: 28, y: 74 }, { x: 72, y: 64 },
      { x: 30, y: 54 }, { x: 70, y: 44 }, { x: 32, y: 34 }, { x: 68, y: 26 },
      { x: 42, y: 16 }, { x: 50, y: 6 },
    ],
  },
  // bath-9: Соляная парная — квадратное, 14 уровней
  9: {
    isSquare: true,
    positions: [
      { x: 25, y: 95 }, { x: 75, y: 90 }, { x: 27, y: 83 }, { x: 73, y: 76 },
      { x: 30, y: 68 }, { x: 70, y: 60 }, { x: 33, y: 52 }, { x: 67, y: 44 },
      { x: 36, y: 36 }, { x: 64, y: 29 }, { x: 40, y: 22 }, { x: 60, y: 16 },
      { x: 45, y: 10 }, { x: 50, y: 4 },
    ],
  },
  // bath-10: Мультикаменная баня — квадратное, 20 уровней
  10: {
    isSquare: true,
    positions: [
      { x: 24, y: 96 }, { x: 76, y: 93 }, { x: 26, y: 88 }, { x: 74, y: 84 },
      { x: 28, y: 78 }, { x: 72, y: 73 }, { x: 30, y: 67 }, { x: 70, y: 62 },
      { x: 32, y: 56 }, { x: 68, y: 51 }, { x: 34, y: 45 }, { x: 66, y: 40 },
      { x: 36, y: 34 }, { x: 64, y: 29 }, { x: 38, y: 24 }, { x: 62, y: 19 },
      { x: 42, y: 14 }, { x: 58, y: 10 }, { x: 48, y: 6 }, { x: 50, y: 2 },
    ],
  },
};

export function LevelMap() {
  const navigate = useNavigate();
  const { bathhouseId } = useParams<{ bathhouseId: string }>();
  const { progress } = useGameContext();
  const bhId = Number(bathhouseId) || 1;
  const bathhouse = getBathhouseById(bhId);
  const bLevels = getLevelsForBathhouse(bhId);

  // Конфигурация бани
  const config = BATH_CONFIGS[bhId] ?? BATH_CONFIGS[1];
  const bathImage = `/images/levels/bath-${bhId}.jpg`;

  return (
    <div className="h-full relative bg-[#080c08] overflow-hidden flex flex-col">
      {/* Header — over the map */}
      <div className="absolute top-7 left-4 right-4 flex items-center justify-between z-20">
        <motion.button
          className="bg-black/50 backdrop-blur-sm border border-white/20 rounded-full p-2.5"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/games/match3')}
        >
          <ArrowLeft size={16} className="text-white/80" />
        </motion.button>

        <motion.div
          className="bg-black/50 backdrop-blur-sm border border-primary/30 rounded-full px-3 py-1.5"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-primary font-bold text-sm">{bathhouse?.name ?? 'Уровни'}</span>
        </motion.div>

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

      {/* Map container - full screen for square images, scrollable for vertical */}
      <div className={cn(
        config.isSquare ? 'flex-1 relative' : 'flex-1 overflow-y-auto phone-scroll'
      )}>
        <div
          className={cn(
            'relative w-full',
            config.isSquare ? 'h-full' : ''
          )}
          style={config.isSquare ? undefined : { paddingBottom: '179.2%' }}
        >
          <img
            src={bathImage}
            alt={bathhouse?.name ?? 'Карта уровней'}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />

          {/* Level medallion hotspots */}
          {config.positions.map((pos, idx) => {
            const level = bLevels[idx];
            if (!level) return null;
            const lp = progress.levels[level.id];
            const unlocked = level.id <= progress.currentLevel;
            const stars = lp?.stars ?? 0;
            const current = level.id === progress.currentLevel;

            // Размер медальона меньше для карт с большим количеством уровней
            const isMany = config.positions.length > 12;
            const medalSize = isMany ? 'w-8 h-8' : 'w-10 h-10';
            const fontSize = isMany ? 'text-xs' : 'text-sm';

            return (
              <motion.button
                key={level.id}
                className="absolute flex flex-col items-center justify-center z-10"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => unlocked && navigate(`/games/match3/play/${level.id}`)}
                disabled={!unlocked}
              >
                {/* Glow for current level */}
                {current && (
                  <motion.div
                    className={cn('absolute rounded-full', isMany ? '-inset-2' : '-inset-3')}
                    style={{ boxShadow: `0 0 20px 8px ${bathhouse?.color ?? '#BA9B4F'}80` }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                )}

                {/* Medallion circle */}
                <div
                  className={cn(
                    medalSize, 'rounded-full flex items-center justify-center border-2',
                    unlocked
                      ? 'bg-gradient-to-br from-primary/90 to-primary/50 border-primary/70'
                      : 'bg-black/50 border-white/20',
                  )}
                  style={{
                    boxShadow: unlocked
                      ? `0 0 10px ${bathhouse?.color ?? '#BA9B4F'}60, inset 0 -2px 4px rgba(0,0,0,0.3)`
                      : 'none',
                  }}
                >
                  {unlocked ? (
                    <span className={cn('text-white font-bold drop-shadow-lg', fontSize)}>
                      {idx + 1}
                    </span>
                  ) : (
                    <Lock size={isMany ? 10 : 12} className="text-white/50" />
                  )}
                </div>

                {/* Stars под медальоном */}
                {unlocked && (
                  <div className="flex gap-0.5 mt-0.5 absolute -bottom-3">
                    {[0, 1, 2].map(s => (
                      <Star
                        key={s}
                        size={isMany ? 6 : 8}
                        className={cn(
                          s < stars ? 'fill-yellow-400 text-yellow-400' : 'text-white/40',
                          'drop-shadow',
                        )}
                      />
                    ))}
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
