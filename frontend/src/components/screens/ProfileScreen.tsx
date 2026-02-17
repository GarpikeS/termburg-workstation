import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Trophy, Star, Target, Award, Grid3x3, Circle, Heart, Droplets, Sparkles, Settings } from 'lucide-react';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useGameContext } from '@/store/GameContext';
import { getTermlinById, ELEMENT_COLORS } from '@/data/termliny';
import { STAGE_LABELS, MOOD_LABELS, getMood } from '@/engine/engine-pet/petEngine';
import { cn } from '@/utils/cn';

const achievements = [
  { name: 'Новичок', desc: 'Пройти 1 уровень', icon: Trophy, color: '#6AABDA', check: (p: Stat) => p.completedLevels >= 1 },
  { name: 'Коллекционер', desc: 'Заработать 100 монет', icon: Star, color: '#D4956A', check: (p: Stat) => p.currency >= 100 },
  { name: 'Мастер уровней', desc: 'Пройти 5 уровней', icon: Target, color: '#5DB879', check: (p: Stat) => p.completedLevels >= 5 },
  { name: 'Перфекционист', desc: '3 звезды на 10 уровнях', icon: Award, color: '#9B7EC8', check: (p: Stat) => p.threeStarLevels >= 10 },
  { name: 'Рекордсмен', desc: 'Набрать 512 в 2048', icon: Grid3x3, color: '#6AABDA', check: (p: Stat) => p.best2048 >= 512 },
  { name: 'Снайпер', desc: 'Пройти 5 уровней шариков', icon: Circle, color: '#5DB879', check: (p: Stat) => p.bubbleLevels >= 5 },
  { name: 'Заботливый', desc: 'Вырастить взрослого питомца', icon: Heart, color: '#E87CA0', check: (p: Stat) => p.petAdult },
];

interface Stat {
  completedLevels: number;
  totalStars: number;
  threeStarLevels: number;
  currency: number;
  best2048: number;
  bubbleLevels: number;
  petAdult: boolean;
}

export function ProfileScreen() {
  const navigate = useNavigate();
  const { progress } = useGameContext();

  const character = getTermlinById(progress.selectedCharacter);
  const color = character ? (ELEMENT_COLORS[character.element] ?? '#BA9B4F') : '#BA9B4F';
  const completedLevels = Object.values(progress.levels).filter(l => l.completed).length;
  const totalStars = Object.values(progress.levels).reduce((sum, l) => sum + l.stars, 0);
  const threeStarLevels = Object.values(progress.levels).filter(l => l.stars >= 3).length;
  const earnedCount = achievements.filter(a => a.check({
    completedLevels, totalStars, threeStarLevels,
    currency: progress.currency,
    best2048: progress.best2048Score,
    bubbleLevels: progress.bubbleLevelsCompleted,
    petAdult: progress.pet?.stage === 'adult',
  })).length;

  const stat: Stat = {
    completedLevels,
    totalStars,
    threeStarLevels,
    currency: progress.currency,
    best2048: progress.best2048Score,
    bubbleLevels: progress.bubbleLevelsCompleted,
    petAdult: progress.pet?.stage === 'adult',
  };

  // XP-like progress: total stars as "experience"
  const xpCurrent = totalStars + completedLevels * 5 + progress.best2048Score + progress.bubbleLevelsCompleted * 10;
  const playerLevel = Math.floor(xpCurrent / 50) + 1;
  const xpInLevel = xpCurrent % 50;

  return (
    <div className="h-full flex flex-col bg-dark-surface pb-20">
      {/* Header */}
      <div className="pt-10 pb-4 px-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/games')} className="text-white/50 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-sm font-bold text-primary tracking-wider uppercase">Профиль</h2>
          <CurrencyDisplay amount={progress.currency} />
        </div>
      </div>
      <div className="gold-separator" />

      <div className="flex-1 overflow-y-auto phone-scroll">
        {/* Hero profile card */}
        <div
          className="relative px-5 pt-6 pb-8"
          style={{
            background: `linear-gradient(180deg, ${color}15 0%, transparent 100%)`,
          }}
        >
          <motion.div
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Avatar with ring */}
            <div className="relative">
              {character ? (
                <img
                  src={character.image}
                  alt={character.name}
                  className="w-24 h-24 rounded-full object-cover border-3 shadow-lg"
                  style={{ borderColor: color, boxShadow: `0 0 30px ${color}30` }}
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center border-3 border-primary/40"
                >
                  <Droplets size={36} className="text-primary" />
                </div>
              )}
              {/* Level badge */}
              <div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold border"
                style={{
                  backgroundColor: `${color}25`,
                  borderColor: `${color}50`,
                  color,
                }}
              >
                Ур. {playerLevel}
              </div>
            </div>

            {/* Name & title */}
            <h3 className="font-heading text-lg font-bold text-white mt-5">
              {character?.name ?? 'Игрок'}
            </h3>
            <p className="text-white/40 text-xs mt-0.5">
              {character?.title ?? 'Новый игрок'}
            </p>

            {/* Element tag */}
            {character && (
              <span
                className="mt-2 px-3 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {character.element}
              </span>
            )}

            {/* XP bar */}
            <div className="w-full max-w-[200px] mt-4">
              <div className="flex justify-between mb-1">
                <span className="text-white/30 text-[10px]">Опыт</span>
                <span className="text-white/30 text-[10px]">{xpInLevel}/50</span>
              </div>
              <ProgressBar current={xpInLevel} max={50} color={color} />
            </div>

            {/* Ability */}
            {character && (
              <div
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl border"
                style={{ backgroundColor: `${color}10`, borderColor: `${color}20` }}
              >
                <Sparkles size={14} style={{ color }} />
                <span className="text-xs font-medium" style={{ color }}>
                  {character.ability.name}
                </span>
                <span className="text-white/30 text-[10px]">
                  {character.ability.description}
                </span>
              </div>
            )}
          </motion.div>
        </div>

        <div className="px-5 space-y-5 pb-5">
          {/* Quick stats row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: completedLevels, label: 'Уровни', icon: Target },
              { value: totalStars, label: 'Звёзды', icon: Star },
              { value: progress.best2048Score, label: '2048', icon: Grid3x3 },
              { value: earnedCount, label: 'Ачивки', icon: Trophy },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <s.icon size={14} className="text-primary mx-auto mb-1" />
                <p className="text-white font-bold text-base">{s.value}</p>
                <p className="text-white/30 text-[9px]">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Game progress cards */}
          <div>
            <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-primary mb-3">Игры</h3>
            <div className="space-y-2">
              {/* Match-3 */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#D4956A]/15 flex items-center justify-center">
                  <Droplets size={18} className="text-[#D4956A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="text-white/90 text-sm font-medium">Match-3</p>
                    <p className="text-white/40 text-xs">{completedLevels} уровней</p>
                  </div>
                  <ProgressBar current={completedLevels} max={100} color="#D4956A" className="mt-1.5" />
                </div>
              </div>

              {/* 2048 */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#6AABDA]/15 flex items-center justify-center">
                  <Grid3x3 size={18} className="text-[#6AABDA]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="text-white/90 text-sm font-medium">2048</p>
                    <p className="text-white/40 text-xs">Рекорд: {progress.best2048Score}</p>
                  </div>
                  <ProgressBar current={Math.min(progress.best2048Score, 2048)} max={2048} color="#6AABDA" className="mt-1.5" />
                </div>
              </div>

              {/* Bubbles */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#5DB879]/15 flex items-center justify-center">
                  <Circle size={18} className="text-[#5DB879]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="text-white/90 text-sm font-medium">Шарики</p>
                    <p className="text-white/40 text-xs">{progress.bubbleLevelsCompleted} уровней</p>
                  </div>
                  <ProgressBar current={progress.bubbleLevelsCompleted} max={20} color="#5DB879" className="mt-1.5" />
                </div>
              </div>

              {/* Pet */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#9B7EC8]/15 flex items-center justify-center">
                  {progress.pet ? (
                    (() => {
                      const petChar = getTermlinById(progress.pet!.characterId);
                      return petChar ? (
                        <img src={petChar.image} alt="" className="w-8 h-8 rounded-md object-cover" />
                      ) : (
                        <Heart size={18} className="text-[#9B7EC8]" />
                      );
                    })()
                  ) : (
                    <Heart size={18} className="text-[#9B7EC8]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="text-white/90 text-sm font-medium">Тамагочи</p>
                    <p className="text-white/40 text-xs">
                      {progress.pet ? `${STAGE_LABELS[progress.pet.stage]} - ${MOOD_LABELS[getMood(progress.pet)]}` : 'Нет питомца'}
                    </p>
                  </div>
                  {progress.pet && (
                    <ProgressBar
                      current={(progress.pet.hunger + progress.pet.happiness + progress.pet.energy + progress.pet.cleanliness) / 4}
                      max={100}
                      color="#9B7EC8"
                      className="mt-1.5"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="gold-separator" />

          {/* Achievements */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-primary">
                Достижения
              </h3>
              <span className="text-white/30 text-xs">{earnedCount}/{achievements.length}</span>
            </div>
            <div className="space-y-2.5">
              {achievements.map(a => {
                const earned = a.check(stat);
                return (
                  <div
                    key={a.name}
                    className={cn(
                      'bg-white/5 border rounded-xl p-3 flex items-center gap-3',
                      earned ? 'border-white/15' : 'border-white/5',
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                        !earned && 'opacity-25 grayscale',
                      )}
                      style={{ backgroundColor: `${a.color}20` }}
                    >
                      <a.icon size={18} style={{ color: a.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-medium text-sm', earned ? 'text-white/90' : 'text-white/40')}>{a.name}</p>
                      <p className="text-white/30 text-xs">{a.desc}</p>
                    </div>
                    {earned && (
                      <motion.span
                        className="text-xs font-bold px-2 py-1 rounded-lg"
                        style={{ backgroundColor: `${a.color}20`, color: a.color }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                      >
                        ✓
                      </motion.span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
