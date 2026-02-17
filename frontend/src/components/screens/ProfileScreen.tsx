import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Trophy, Star, Target, Award, Sparkles } from 'lucide-react';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';

const achievements = [
  { name: 'Новичок', desc: 'Пройти 1 уровень', gradient: 'from-[#7FA99B] to-[#6DB4C9]', icon: Trophy, target: 1 },
  { name: 'Коллекционер', desc: 'Заработать 100 валюты', gradient: 'from-[#C4956C] to-[#E8DCC4]', icon: Star, target: 100 },
  { name: 'Мастер уровней', desc: 'Пройти 5 уровней', gradient: 'from-[#E88B5C] to-[#C4956C]', icon: Target, target: 5 },
  { name: 'Перфекционист', desc: '3 звезды на всех', gradient: 'from-[#6EAA5E] to-[#7FA99B]', icon: Award, target: 100 },
];

export function ProfileScreen() {
  const navigate = useNavigate();
  const { progress } = useGameContext();

  const completedLevels = Object.values(progress.levels).filter(l => l.completed).length;
  const totalStars = Object.values(progress.levels).reduce((sum, l) => sum + l.stars, 0);

  return (
    <div className="h-full flex flex-col bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary to-accent pt-12 pb-16 px-6 rounded-b-4xl shadow-xl relative">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/menu')}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="font-heading text-lg text-white font-bold">Профиль</h2>
          <CurrencyDisplay amount={progress.currency} light />
        </div>
      </div>

      {/* Profile card overlapping header */}
      <div className="px-6 -mt-10 relative z-10">
        <div className="bg-card rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <User size={36} className="text-white" />
            </div>
            <div>
              <h3 className="font-heading text-xl font-bold text-foreground">Игрок</h3>
              <p className="text-muted-foreground text-sm">Уровень {progress.currentLevel}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl p-4 text-center shadow-md">
            <p className="text-3xl font-bold text-primary">{completedLevels}</p>
            <p className="text-muted-foreground text-xs mt-1">Уровней</p>
          </div>
          <div className="bg-card rounded-2xl p-4 text-center shadow-md">
            <p className="text-3xl font-bold text-primary">{totalStars}</p>
            <p className="text-muted-foreground text-xs mt-1">Звёзд</p>
          </div>
        </div>

        {/* Achievements */}
        <div>
          <h3 className="font-heading text-xl font-bold text-foreground mb-3">Достижения</h3>
          <div className="space-y-3">
            {achievements.map(a => {
              const earned = a.name === 'Новичок' ? completedLevels >= a.target
                : a.name === 'Коллекционер' ? progress.currency >= a.target
                : a.name === 'Мастер уровней' ? completedLevels >= a.target
                : false;
              return (
                <div key={a.name} className="bg-card rounded-2xl p-4 shadow-md flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${a.gradient} flex items-center justify-center ${earned ? '' : 'opacity-40 grayscale'}`}>
                    <a.icon size={22} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-foreground">{a.name}</p>
                    <p className="text-muted-foreground text-xs">{a.desc}</p>
                  </div>
                  {earned && <span className="text-primary text-xs font-bold">Получено</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* AI recommendations */}
        <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Sparkles size={22} />
            </div>
            <div>
              <h4 className="font-heading font-bold">AI-Рекомендации</h4>
              <p className="text-white/80 text-sm">Персональные советы скоро</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
