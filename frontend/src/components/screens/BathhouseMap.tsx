import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Lock, Droplets, TreePine, Mountain, Wind, Waves, Moon, Flame, Snowflake, Gem, Sparkles } from 'lucide-react';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';
import { bathhouses } from '@/data/bathhouses';
import { cn } from '@/utils/cn';

const BATH_ICONS = [Droplets, TreePine, Mountain, Wind, Waves, Moon, Flame, Snowflake, Gem, Sparkles];

export function BathhouseMap() {
  const navigate = useNavigate();
  const { progress } = useGameContext();

  // Build curved SVG path between nodes
  const buildPath = () => {
    const points = bathhouses.map(bh => ({
      x: bh.position.x,
      y: bh.position.y,
    }));

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i];
      const n = points[i + 1];
      const cpx1 = p.x;
      const cpy1 = (p.y + n.y) / 2;
      const cpx2 = n.x;
      const cpy2 = (p.y + n.y) / 2;
      d += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${n.x} ${n.y}`;
    }
    return d;
  };

  return (
    <div className="h-full flex flex-col bg-dark-surface pb-20 ornament-pattern">
      {/* Header */}
      <div className="pt-10 pb-4 px-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/games')} className="text-white/50 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-base font-bold text-primary tracking-wider uppercase">Карта бань</h2>
          <CurrencyDisplay amount={progress.currency} />
        </div>
      </div>
      <div className="gold-separator" />

      {/* Map content */}
      <div className="flex-1 overflow-y-auto phone-scroll px-4 py-4">
        <div className="relative" style={{ minHeight: 700 }}>
          {/* Path SVG — curved */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ minHeight: 700 }}
          >
            <defs>
              <linearGradient id="pathGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#BA9B4F" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#D4956A" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <path
              d={buildPath()}
              fill="none"
              stroke="url(#pathGrad)"
              strokeWidth={0.6}
              strokeDasharray="2,1.5"
              strokeLinecap="round"
            />
          </svg>

          {/* Nodes */}
          {bathhouses.map((bh, idx) => {
            const unlocked = bh.levelsRange[0] <= progress.currentLevel;
            const completed = bh.levelsRange[1] < progress.currentLevel;
            const current = unlocked && !completed;
            const Icon = BATH_ICONS[idx] ?? Droplets;

            return (
              <motion.button
                key={bh.id}
                className="absolute flex flex-col items-center"
                style={{
                  left: `${bh.position.x}%`,
                  top: `${bh.position.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.06 }}
                whileTap={unlocked ? { scale: 0.93 } : undefined}
                onClick={() => unlocked && navigate(`/games/match3/levels/${bh.id}`)}
                disabled={!unlocked}
              >
                {/* Glow ring for current */}
                {current && (
                  <motion.div
                    className="absolute rounded-full"
                    style={{
                      width: 56,
                      height: 56,
                      border: `2px solid ${bh.color}`,
                      opacity: 0.3,
                    }}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                )}

                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all',
                  unlocked
                    ? completed
                      ? 'border-green-500/50 bg-green-500/15'
                      : 'shadow-lg'
                    : 'bg-white/5 border-white/10 opacity-40',
                )}
                  style={unlocked && !completed ? {
                    borderColor: `${bh.color}80`,
                    backgroundColor: `${bh.color}20`,
                    boxShadow: `0 0 15px ${bh.color}25`,
                  } : undefined}
                >
                  {unlocked ? (
                    <Icon size={18} style={{ color: completed ? '#5DB879' : bh.color }} />
                  ) : (
                    <Lock size={14} className="text-white/30" />
                  )}
                </div>
                <span className={cn(
                  'text-[9px] font-medium text-center max-w-[80px] leading-tight mt-1.5',
                  unlocked ? 'text-white/70' : 'text-white/20',
                )}>
                  {bh.name}
                </span>
                {unlocked && (
                  <span className="text-[8px] text-white/30 mt-0.5">
                    {bh.levelsRange[0]}–{bh.levelsRange[1]}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
