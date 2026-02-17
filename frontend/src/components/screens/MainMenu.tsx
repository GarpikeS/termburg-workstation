import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { User, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useGameContext } from '@/store/GameContext';

const gameModes = [
  { name: 'Классик', desc: 'Стандартные уровни', gradient: 'from-[#7FA99B] to-[#6DB4C9]', badge: 'Классик' },
  { name: 'Премиум', desc: 'Сложные задания', gradient: 'from-[#C4956C] to-[#E8DCC4]', badge: 'Премиум' },
  { name: 'VIP', desc: 'Экстра-хардкор', gradient: 'from-[#E88B5C] to-[#C4956C]', badge: 'VIP' },
];

export function MainMenu() {
  const navigate = useNavigate();
  const { progress } = useGameContext();

  return (
    <div className="h-full flex flex-col bg-background pb-24 overflow-y-auto">
      {/* Header with gradient */}
      <div className="bg-gradient-to-b from-primary to-accent pt-12 pb-8 px-6 rounded-b-4xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <User size={32} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-lg">Термлины</h2>
            <p className="text-white/70 text-sm">Уровень {progress.currentLevel}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
              <Sparkles size={12} className="text-white" />
              <span className="text-white font-bold text-xs">{progress.currency}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
              <Zap size={12} className="text-white" />
              <span className="text-white font-bold text-xs">5</span>
            </div>
          </div>
        </div>

        <Button variant="white" size="lg" onClick={() => navigate('/map')} className="w-full text-lg">
          Начать игру
        </Button>
      </div>

      {/* Game modes */}
      <div className="px-6 py-6 space-y-4">
        <h3 className="font-heading text-xl font-bold text-foreground">Режимы игры</h3>
        <div className="grid grid-cols-3 gap-3">
          {gameModes.map(mode => (
            <motion.button
              key={mode.name}
              className="rounded-2xl overflow-hidden shadow-md"
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/map')}
            >
              <div className={`bg-gradient-to-br ${mode.gradient} p-4 text-center`}>
                <span className="inline-block bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-2">
                  {mode.badge}
                </span>
                <p className="text-white font-bold text-sm">{mode.name}</p>
                <p className="text-white/70 text-[10px] mt-0.5">{mode.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>

        {/* AR promo */}
        <div className="bg-gradient-to-br from-secondary to-[#D4C5A0] rounded-2xl p-5">
          <h4 className="font-heading text-lg font-bold text-foreground mb-1">AR-Опыт</h4>
          <p className="text-muted-foreground text-sm">Скоро: дополненная реальность в термальном мире</p>
        </div>
      </div>
    </div>
  );
}
