import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Trophy, Star, Target, Award, Sparkles } from 'lucide-react';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';

const achievements = [
  { name: 'Новичок', desc: 'Пройти 1 уровень', icon: Trophy, color: '#6AABDA', target: 1 },
  { name: 'Коллекционер', desc: 'Заработать 100 валюты', icon: Star, color: '#D4956A', target: 100 },
  { name: 'Мастер уровней', desc: 'Пройти 5 уровней', icon: Target, color: '#5DB879', target: 5 },
  { name: 'Перфекционист', desc: '3 звезды на всех', icon: Award, color: '#9B7EC8', target: 100 },
];

export function ProfileScreen() {
  const navigate = useNavigate();
  const { progress } = useGameContext();

  const completedLevels = Object.values(progress.levels).filter(l => l.completed).length;
  const totalStars = Object.values(progress.levels).reduce((sum, l) => sum + l.stars, 0);

  return (
    <div className="h-full flex flex-col bg-dark-surface pb-20">
      {/* Header */}
      <div className="pt-10 pb-4 px-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/menu')} className="text-white/50 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-sm font-bold text-primary tracking-wider uppercase">Профиль</h2>
          <CurrencyDisplay amount={progress.currency} />
        </div>
      </div>
      <div className="gold-separator" />

      <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-5">
        {/* Profile card */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
              <User size={28} className="text-primary" />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-white">Игрок</h3>
              <p className="text-white/40 text-xs mt-0.5">Уровень {progress.currentLevel}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{completedLevels}</p>
            <p className="text-white/40 text-[10px]">Уровней</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{totalStars}</p>
            <p className="text-white/40 text-[10px]">Звёзд</p>
          </div>
        </div>

        <div className="gold-separator" />

        {/* Achievements */}
        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-primary mb-3">Достижения</h3>
          <div className="space-y-2.5">
            {achievements.map(a => {
              const earned = a.name === 'Новичок' ? completedLevels >= a.target
                : a.name === 'Коллекционер' ? progress.currency >= a.target
                : a.name === 'Мастер уровней' ? completedLevels >= a.target
                : false;
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

        <div className="gold-separator" />

        {/* AI recommendations */}
        <div className="bg-white/5 border border-primary/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles size={18} className="text-primary" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-sm text-white/90">AI-Рекомендации</h4>
              <p className="text-white/40 text-xs">Персональные советы скоро</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
