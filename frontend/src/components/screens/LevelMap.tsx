import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Lock, Star } from 'lucide-react';
import { useGameContext } from '@/store/GameContext';
import { getLevelsForBathhouse } from '@/data/levels';
import { getBathhouseById } from '@/data/bathhouses';
import { cn } from '@/utils/cn';

// Конфигурация для каждой бани: позиции кругов и флаг квадратности
const BATH_CONFIGS: Record<number, { positions: { x: number; y: number }[]; isSquare: boolean }> = {
  // bath-1: Русская баня — вертикальное изображение, 10 кругов
  1: {
    isSquare: false,
    positions: [
      { x: 25, y: 92 }, { x: 75, y: 84 }, { x: 25, y: 75 }, { x: 75, y: 66 },
      { x: 25, y: 58 }, { x: 75, y: 50 }, { x: 25, y: 42 }, { x: 75, y: 34 },
      { x: 25, y: 25 }, { x: 50, y: 12 },
    ],
  },
  // bath-2: Финская сауна — вертикальное, 10 кругов
  2: {
    isSquare: false,
    positions: [
      { x: 30, y: 93 }, { x: 70, y: 85 }, { x: 30, y: 75 }, { x: 70, y: 65 },
      { x: 30, y: 55 }, { x: 70, y: 45 }, { x: 30, y: 36 }, { x: 70, y: 27 },
      { x: 30, y: 18 }, { x: 50, y: 8 },
    ],
  },
  // bath-3: Турецкий хаммам — квадратное, 10 кругов
  3: {
    isSquare: true,
    positions: [
      { x: 30, y: 90 }, { x: 70, y: 82 }, { x: 32, y: 72 }, { x: 68, y: 62 },
      { x: 34, y: 52 }, { x: 66, y: 42 }, { x: 38, y: 32 }, { x: 62, y: 22 },
      { x: 50, y: 12 }, { x: 50, y: 5 },
    ],
  },
  // bath-4: Сибирская парная — вертикальное, 10 кругов
  4: {
    isSquare: false,
    positions: [
      { x: 25, y: 92 }, { x: 75, y: 83 }, { x: 25, y: 72 }, { x: 75, y: 62 },
      { x: 25, y: 52 }, { x: 75, y: 42 }, { x: 25, y: 32 }, { x: 75, y: 22 },
      { x: 25, y: 13 }, { x: 60, y: 5 },
    ],
  },
  // bath-5: Баня-бочка — квадратное, 12 кругов
  5: {
    isSquare: true,
    positions: [
      { x: 25, y: 93 }, { x: 75, y: 87 }, { x: 28, y: 79 }, { x: 72, y: 71 },
      { x: 30, y: 63 }, { x: 70, y: 55 }, { x: 32, y: 47 }, { x: 68, y: 39 },
      { x: 36, y: 31 }, { x: 64, y: 25 }, { x: 44, y: 17 }, { x: 50, y: 8 },
    ],
  },
  // bath-6: Липовая сауна — квадратное, 10 кругов
  6: {
    isSquare: true,
    positions: [
      { x: 28, y: 92 }, { x: 72, y: 84 }, { x: 30, y: 74 }, { x: 70, y: 64 },
      { x: 32, y: 54 }, { x: 68, y: 44 }, { x: 36, y: 34 }, { x: 64, y: 26 },
      { x: 44, y: 16 }, { x: 50, y: 6 },
    ],
  },
  // bath-7: Травяная сауна — квадратное, 10 кругов
  7: {
    isSquare: true,
    positions: [
      { x: 28, y: 92 }, { x: 72, y: 84 }, { x: 30, y: 74 }, { x: 70, y: 64 },
      { x: 32, y: 54 }, { x: 68, y: 44 }, { x: 36, y: 34 }, { x: 64, y: 26 },
      { x: 44, y: 16 }, { x: 50, y: 6 },
    ],
  },
  // bath-8: Инфракрасная сауна — квадратное, 10 кругов
  8: {
    isSquare: true,
    positions: [
      { x: 28, y: 92 }, { x: 72, y: 84 }, { x: 30, y: 74 }, { x: 70, y: 64 },
      { x: 32, y: 54 }, { x: 68, y: 44 }, { x: 36, y: 34 }, { x: 64, y: 26 },
      { x: 44, y: 16 }, { x: 50, y: 6 },
    ],
  },
  // bath-9: Соляная парная — квадратное, 14 кругов
  9: {
    isSquare: true,
    positions: [
      { x: 26, y: 95 }, { x: 74, y: 90 }, { x: 28, y: 84 }, { x: 72, y: 78 },
      { x: 30, y: 71 }, { x: 70, y: 64 }, { x: 32, y: 56 }, { x: 68, y: 48 },
      { x: 35, y: 40 }, { x: 65, y: 33 }, { x: 38, y: 26 }, { x: 62, y: 20 },
      { x: 45, y: 13 }, { x: 50, y: 6 },
    ],
  },
  // bath-10: Мультикаменная баня — квадратное, 20 кругов
  10: {
    isSquare: true,
    positions: [
      { x: 30, y: 96 }, { x: 70, y: 94 }, { x: 28, y: 89 }, { x: 72, y: 85 },
      { x: 30, y: 80 }, { x: 70, y: 75 }, { x: 32, y: 69 }, { x: 68, y: 64 },
      { x: 34, y: 58 }, { x: 66, y: 53 }, { x: 36, y: 47 }, { x: 64, y: 42 },
      { x: 38, y: 36 }, { x: 62, y: 31 }, { x: 40, y: 26 }, { x: 60, y: 21 },
      { x: 43, y: 16 }, { x: 57, y: 12 }, { x: 48, y: 7 }, { x: 50, y: 3 },
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

            // Размер зоны клика
            const isMany = config.positions.length > 12;
            const clickSize = isMany ? 'w-10 h-10' : 'w-14 h-14';

            return (
              <motion.button
                key={level.id}
                className={cn('absolute z-10', clickSize)}
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
                    className="absolute inset-0 rounded-full"
                    style={{ boxShadow: `0 0 25px 10px ${bathhouse?.color ?? '#BA9B4F'}90` }}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                )}

                {/* Номер уровня в правом нижнем углу под кругом */}
                <div
                  className={cn(
                    'absolute flex items-center justify-center',
                    isMany ? 'w-5 h-5 -right-1 -bottom-1' : 'w-6 h-6 -right-1 -bottom-1',
                    unlocked
                      ? 'bg-gradient-to-br from-primary to-primary/80 border-2 border-white/30'
                      : 'bg-black/70 border border-white/20',
                    'rounded-full shadow-lg',
                  )}
                >
                  {unlocked ? (
                    <span className={cn('text-white font-bold drop-shadow', isMany ? 'text-[10px]' : 'text-xs')}>
                      {idx + 1}
                    </span>
                  ) : (
                    <Lock size={isMany ? 8 : 10} className="text-white/50" />
                  )}
                </div>

                {/* Stars под номером */}
                {unlocked && (
                  <div className={cn(
                    'absolute flex gap-0.5',
                    isMany ? '-bottom-4 right-0' : '-bottom-5 right-0',
                  )}>
                    {[0, 1, 2].map(s => (
                      <Star
                        key={s}
                        size={isMany ? 6 : 7}
                        className={cn(
                          s < stars ? 'fill-yellow-400 text-yellow-400' : 'text-white/30',
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
