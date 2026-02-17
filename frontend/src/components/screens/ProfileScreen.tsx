import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Star, Target, Award, Grid3x3, Circle, Heart } from 'lucide-react';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';
import { getTermlinById, ELEMENT_COLORS } from '@/data/termliny';
import { STAGE_LABELS } from '@/engine/engine-pet/petEngine';

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

  const stat: Stat = {
    completedLevels,
    totalStars,
    threeStarLevels,
    currency: progress.currency,
    best2048: progress.best2048Score,
    bubbleLevels: progress.bubbleLevelsCompleted,
    petAdult: progress.pet?.stage === 'adult',
  };

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

      <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-5">
        {/* Profile card with character avatar */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-4">
            {character ? (
              <img
                src={character.image}
                alt={character.name}
                className="w-16 h-16 rounded-full object-cover border-2"
                style={{ borderColor: color }}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                <Trophy size={28} className="text-primary" />
              </div>
            )}
            <div>
              <h3 className="font-heading text-base font-bold text-white">
                {character?.name ?? 'Игрок'}
              </h3>
              <p className="text-white/40 text-xs mt-0.5">
                {character?.title ?? `Уровень ${progress.currentLevel}`}
              </p>
            </div>
          </div>
        </div>

        {/* All games stats */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{completedLevels}</p>
            <p className="text-white/40 text-[10px]">Уровней Match-3</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{totalStars}</p>
            <p className="text-white/40 text-[10px]">Звёзд</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{progress.best2048Score}</p>
            <p className="text-white/40 text-[10px]">Рекорд 2048</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{progress.bubbleLevelsCompleted}</p>
            <p className="text-white/40 text-[10px]">Уровней шариков</p>
          </div>
        </div>

        {/* Pet info */}
        {progress.pet && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
            {(() => {
              const petChar = getTermlinById(progress.pet!.characterId);
              return petChar ? (
                <img src={petChar.image} alt={petChar.name} className="w-10 h-10 rounded-full object-cover" />
              ) : null;
            })()}
            <div>
              <p className="text-white/90 font-medium text-sm">Питомец</p>
              <p className="text-white/40 text-xs">{STAGE_LABELS[progress.pet.stage]}</p>
            </div>
          </div>
        )}

        <div className="gold-separator" />

        {/* Achievements */}
        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-primary mb-3">Достижения</h3>
          <div className="space-y-2.5">
            {achievements.map(a => {
              const earned = a.check(stat);
              return (
                <div key={a.name} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${earned ? '' : 'opacity-30 grayscale'}`}
                    style={{ backgroundColor: `${a.color}20` }}
                  >
                    <a.icon size={18} style={{ color: a.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-white/90">{a.name}</p>
                    <p className="text-white/40 text-xs">{a.desc}</p>
                  </div>
                  {earned && <span className="text-primary text-xs font-bold">Получено</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
