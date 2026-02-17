import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Droplets, Grid3x3, Circle, Heart } from 'lucide-react';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';

const games = [
  {
    id: 'match3',
    name: 'Match-3',
    icon: Droplets,
    path: '/games/match3',
    color: '#D4956A',
    border: 'border-[#D4956A]/30',
    getStat: (p: { currentLevel: number }) => `Уровень ${p.currentLevel}`,
  },
  {
    id: '2048',
    name: '2048',
    icon: Grid3x3,
    path: '/games/2048',
    color: '#6AABDA',
    border: 'border-[#6AABDA]/30',
    getStat: (p: { best2048Score: number }) => p.best2048Score > 0 ? `Рекорд: ${p.best2048Score}` : 'Новая игра',
  },
  {
    id: 'bubbles',
    name: 'Шарики',
    icon: Circle,
    path: '/games/bubbles',
    color: '#5DB879',
    border: 'border-[#5DB879]/30',
    getStat: (p: { bubbleLevelsCompleted: number }) => p.bubbleLevelsCompleted > 0 ? `Уровней: ${p.bubbleLevelsCompleted}` : 'Новая игра',
  },
  {
    id: 'pet',
    name: 'Тамагочи',
    icon: Heart,
    path: '/games/pet',
    color: '#9B7EC8',
    border: 'border-[#9B7EC8]/30',
    getStat: (p: { pet: unknown }) => p.pet ? 'Мой питомец' : 'Усыновить',
  },
] as const;

export function GameHub() {
  const navigate = useNavigate();
  const { progress } = useGameContext();

  return (
    <div className="h-full flex flex-col bg-dark-surface pb-20 ornament-pattern">
      {/* Header */}
      <div className="pt-10 pb-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/ui/splash-logo.svg" alt="Термбург" className="w-9 h-9" />
            <div>
              <h1 className="font-heading text-xl font-bold text-primary tracking-[0.1em]">ТЕРМБУРГ</h1>
              <p className="text-white/30 text-[10px] italic">Стресс долой — семья с тобой!</p>
            </div>
          </div>
          <CurrencyDisplay amount={progress.currency} />
        </div>
      </div>
      <div className="gold-separator" />

      {/* Games grid */}
      <div className="flex-1 overflow-y-auto phone-scroll px-5 py-5">
        <div className="grid grid-cols-2 gap-3">
          {games.map((game, i) => (
            <motion.button
              key={game.id}
              className={`bg-white/5 border ${game.border} rounded-2xl p-5 text-center transition-all hover:bg-white/8`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate(game.path)}
            >
              <div
                className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: `${game.color}20` }}
              >
                <game.icon size={28} style={{ color: game.color }} />
              </div>
              <p className="text-white font-bold text-base">{game.name}</p>
              <p className="text-white/40 text-xs mt-1">{game.getStat(progress)}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
