import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Droplets, Grid3x3, Circle, Heart, Sparkles } from 'lucide-react';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';
import { getTermlinById, ELEMENT_COLORS } from '@/data/termliny';

type GameKey = 'match3' | 'game2048' | 'bubbles' | 'pet';

const games: {
  id: string;
  name: string;
  gameKey: GameKey;
  icon: typeof Droplets;
  path: string;
  color: string;
  border: string;
  getStat: (p: { currentLevel: number; best2048Score: number; bubbleLevelsCompleted: number; pet: unknown }) => string;
}[] = [
  {
    id: 'match3',
    name: 'Match-3',
    gameKey: 'match3',
    icon: Droplets,
    path: '/games/match3',
    color: '#D4956A',
    border: 'border-[#D4956A]/30',
    getStat: (p) => `Уровень ${p.currentLevel}`,
  },
  {
    id: '2048',
    name: '2048',
    gameKey: 'game2048',
    icon: Grid3x3,
    path: '/games/2048',
    color: '#6AABDA',
    border: 'border-[#6AABDA]/30',
    getStat: (p) => p.best2048Score > 0 ? `Рекорд: ${p.best2048Score}` : 'Новая игра',
  },
  {
    id: 'bubbles',
    name: 'Шарики',
    gameKey: 'bubbles',
    icon: Circle,
    path: '/games/bubbles',
    color: '#5DB879',
    border: 'border-[#5DB879]/30',
    getStat: (p) => p.bubbleLevelsCompleted > 0 ? `Уровней: ${p.bubbleLevelsCompleted}` : 'Новая игра',
  },
  {
    id: 'pet',
    name: 'Тамагочи',
    gameKey: 'pet',
    icon: Heart,
    path: '/games/pet',
    color: '#9B7EC8',
    border: 'border-[#9B7EC8]/30',
    getStat: (p) => p.pet ? 'Мой питомец' : 'Усыновить',
  },
];

export function GameHub() {
  const navigate = useNavigate();
  const { progress } = useGameContext();
  const character = getTermlinById(progress.selectedCharacter);
  const charColor = character ? (ELEMENT_COLORS[character.element] ?? '#BA9B4F') : '#BA9B4F';

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
          {games.map((game, i) => {
            const abilityText = character?.ability[game.gameKey];
            return (
              <motion.button
                key={game.id}
                className={`bg-white/5 border ${game.border} rounded-2xl p-4 text-center transition-all hover:bg-white/8`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate(game.path)}
              >
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center"
                  style={{ backgroundColor: `${game.color}20` }}
                >
                  <game.icon size={24} style={{ color: game.color }} />
                </div>
                <p className="text-white font-bold text-sm">{game.name}</p>
                <p className="text-white/40 text-[10px] mt-0.5">{game.getStat(progress)}</p>
                {/* Character bonus for this game */}
                {abilityText && (
                  <div className="flex items-center justify-center gap-1 mt-1.5">
                    <Sparkles size={8} style={{ color: charColor }} />
                    <span className="text-[8px] leading-tight" style={{ color: `${charColor}AA` }}>
                      {abilityText}
                    </span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Selected character info */}
        {character && (
          <motion.div
            className="mt-4 flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <img
              src={character.image}
              alt={character.name}
              className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0"
              style={{ borderColor: charColor }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-white/80 text-xs font-medium truncate">{character.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Sparkles size={9} style={{ color: charColor }} />
                <span className="text-[10px] text-white/40">{character.ability.name} — {character.ability.description}</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
