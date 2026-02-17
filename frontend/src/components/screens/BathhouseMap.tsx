import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Lock } from 'lucide-react';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';
import { bathhouses } from '@/data/bathhouses';
import { cn } from '@/utils/cn';

export function BathhouseMap() {
  const navigate = useNavigate();
  const { progress } = useGameContext();

  return (
    <div className="h-full flex flex-col bg-dark-surface pb-20 ornament-pattern">
      {/* Header */}
      <div className="pt-10 pb-4 px-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/games')} className="text-white/50 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-base font-bold text-primary tracking-wider uppercase">Карта</h2>
          <CurrencyDisplay amount={progress.currency} />
        </div>
      </div>
      <div className="gold-separator" />

      {/* Map content */}
      <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4">
        <div className="relative" style={{ minHeight: 650 }}>
          {/* Path SVG */}
          <svg className="absolute inset-0 w-full h-full" style={{ minHeight: 650 }}>
            <defs>
              <linearGradient id="pathG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#BA9B4F" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#D9CBA1" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            {bathhouses.slice(0, -1).map((bh, i) => {
              const next = bathhouses[i + 1];
              return (
                <line
                  key={i}
                  x1={`${bh.position.x}%`} y1={`${bh.position.y}%`}
                  x2={`${next.position.x}%`} y2={`${next.position.y}%`}
                  stroke="url(#pathG)" strokeWidth={2} strokeDasharray="6,4"
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {bathhouses.map(bh => {
            const unlocked = bh.levelsRange[0] <= progress.currentLevel;
            return (
              <motion.button
                key={bh.id}
                className="absolute flex flex-col items-center gap-1.5"
                style={{ left: `${bh.position.x}%`, top: `${bh.position.y}%`, transform: 'translate(-50%, -50%)' }}
                whileTap={unlocked ? { scale: 0.95 } : undefined}
                onClick={() => unlocked && navigate(`/games/match3/levels/${bh.id}`)}
                disabled={!unlocked}
              >
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all',
                  unlocked
                    ? 'bg-primary/20 border-primary/50 shadow-lg shadow-primary/20'
                    : 'bg-white/5 border-white/10 opacity-40',
                )}>
                  {unlocked ? (
                    <span className="text-primary font-bold text-sm">{bh.id}</span>
                  ) : (
                    <Lock size={14} className="text-white/30" />
                  )}
                </div>
                <span className={cn(
                  'text-[9px] font-medium text-center max-w-[70px] leading-tight',
                  unlocked ? 'text-white/60' : 'text-white/20',
                )}>
                  {bh.name}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
