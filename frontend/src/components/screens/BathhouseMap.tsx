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
    <div className="h-full flex flex-col bg-gradient-to-b from-primary/5 to-accent/5 pb-24 relative overflow-hidden">
      {/* Decorative blurs */}
      <div className="absolute top-10 left-0 w-32 h-32 rounded-full bg-primary opacity-10 blur-3xl" />
      <div className="absolute top-20 right-0 w-40 h-40 rounded-full bg-accent opacity-10 blur-3xl" />
      <div className="absolute bottom-40 left-10 w-36 h-36 rounded-full bg-secondary opacity-10 blur-3xl" />

      {/* Header */}
      <div className="bg-gradient-to-b from-primary to-accent pt-12 pb-6 px-6 rounded-b-4xl shadow-xl relative z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/menu')}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="font-heading text-lg text-white font-bold">Карта</h2>
          <CurrencyDisplay amount={progress.currency} light />
        </div>
      </div>

      {/* Map content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 relative z-10">
        <div className="relative" style={{ minHeight: 600 }}>
          {/* Path lines */}
          <svg className="absolute inset-0 w-full h-full" style={{ minHeight: 600 }}>
            <defs>
              <linearGradient id="pathGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7FA99B" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#C4956C" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            {bathhouses.slice(0, -1).map((bh, i) => {
              const next = bathhouses[i + 1];
              return (
                <line
                  key={i}
                  x1={`${bh.position.x}%`}
                  y1={`${bh.position.y}%`}
                  x2={`${next.position.x}%`}
                  y2={`${next.position.y}%`}
                  stroke="url(#pathGrad)"
                  strokeWidth={3}
                  strokeDasharray="10,5"
                />
              );
            })}
          </svg>

          {/* Bathhouse nodes */}
          {bathhouses.map(bh => {
            const unlocked = bh.levelsRange[0] <= progress.currentLevel;
            return (
              <motion.button
                key={bh.id}
                className="absolute flex flex-col items-center gap-1"
                style={{
                  left: `${bh.position.x}%`,
                  top: `${bh.position.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                whileTap={unlocked ? { scale: 0.95 } : undefined}
                onClick={() => unlocked && navigate(`/levels/${bh.id}`)}
                disabled={!unlocked}
              >
                <div
                  className={cn(
                    'w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all',
                    unlocked ? '' : 'opacity-40 grayscale',
                  )}
                  style={{ backgroundColor: unlocked ? bh.color : '#8B8D8F' }}
                >
                  {unlocked ? (
                    <span className="text-white font-bold text-lg">{bh.id}</span>
                  ) : (
                    <Lock size={18} className="text-white/60" />
                  )}
                </div>
                <span className={cn(
                  'text-[10px] font-medium text-center max-w-[80px] leading-tight',
                  unlocked ? 'text-foreground' : 'text-muted-foreground',
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
