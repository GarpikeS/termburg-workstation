import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Utensils, Gamepad2, Moon, Droplets, AlertTriangle, Sparkles } from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { CharacterAbilityBar } from '@/components/game/CharacterAbilityBar';
import { usePet } from '@/hooks/usePet';
import { useGameContext } from '@/store/GameContext';
import { termliny, ELEMENT_COLORS, getTermlinById } from '@/data/termliny';
import { MOOD_LABELS, MOOD_COLORS, STAGE_LABELS, STAGE_SIZES, type PetAction } from '@/engine/engine-pet/petEngine';
import { cn } from '@/utils/cn';

const actions: { action: PetAction; label: string; icon: typeof Utensils; color: string; stat: string }[] = [
  { action: 'feed', label: 'Покормить', icon: Utensils, color: '#D4956A', stat: 'hunger' },
  { action: 'play', label: 'Поиграть', icon: Gamepad2, color: '#5DB879', stat: 'happiness' },
  { action: 'rest', label: 'Отдыхать', icon: Moon, color: '#9B7EC8', stat: 'energy' },
  { action: 'wash', label: 'Помыть', icon: Droplets, color: '#6AABDA', stat: 'cleanliness' },
];

const stats = [
  { key: 'hunger' as const, label: 'Сытость', color: '#D4956A' },
  { key: 'happiness' as const, label: 'Счастье', color: '#5DB879' },
  { key: 'energy' as const, label: 'Энергия', color: '#9B7EC8' },
  { key: 'cleanliness' as const, label: 'Чистота', color: '#6AABDA' },
];

function formatCooldown(ms: number): string {
  if (ms <= 0) return '';
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}с`;
}

export function TamagotchiScreen() {
  const navigate = useNavigate();
  const { progress } = useGameContext();
  const { pet, mood, adopt, doAction, warning, cooldowns } = usePet();

  // Adoption screen
  if (!pet) {
    return (
      <div className="h-full flex flex-col bg-dark-surface" style={{ backgroundImage: 'url(/images/ui/game-pet-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="pt-10 pb-4 px-5 bg-black/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/games')} className="text-white/80 hover:text-primary transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h2 className="font-heading text-sm font-bold text-primary tracking-wider uppercase">Тамагочи</h2>
            <div className="w-5" />
          </div>
        </div>
        <div className="gold-separator" />

        <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 bg-black/30">
          <p className="text-white/70 text-sm text-center mb-1">Выбери своего питомца-Термлина!</p>
          <p className="text-white/40 text-[10px] text-center mb-4">Каждый персонаж даёт уникальный бонус</p>
          <div className="grid grid-cols-2 gap-3">
            {termliny.map((t, i) => {
              const color = ELEMENT_COLORS[t.element] ?? '#BA9B4F';
              return (
                <motion.button
                  key={t.id}
                  className={cn(
                    'bg-black/40 backdrop-blur-sm border border-white/15 rounded-2xl p-3 text-center hover:border-white/20 transition-all',
                    t.isLegendary && 'border-yellow-500/30',
                  )}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => adopt(t.id)}
                >
                  <img
                    src={t.image}
                    alt={t.name}
                    className="w-16 h-16 rounded-full object-cover mx-auto border-2"
                    style={{ borderColor: color }}
                  />
                  <p className="text-white/90 font-bold text-xs mt-2">{t.name}</p>
                  <p className="text-white/40 text-[10px]">{t.title}</p>
                  {t.ability.pet && (
                    <p className="text-[9px] mt-1" style={{ color }}>
                      {t.ability.pet}
                    </p>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const termlin = getTermlinById(pet.characterId);
  const color = termlin ? (ELEMENT_COLORS[termlin.element] ?? '#BA9B4F') : '#BA9B4F';
  const moodColor = MOOD_COLORS[mood];
  const avatarSize = STAGE_SIZES[pet.stage];

  // Expression based on mood
  const expressions = termlin?.expressions ?? [];
  const expression = expressions.length > 0
    ? expressions[
        mood === 'ecstatic' ? 0
        : mood === 'happy' ? Math.min(1, expressions.length - 1)
        : mood === 'content' ? Math.min(Math.floor(expressions.length / 2), expressions.length - 1)
        : expressions.length - 1
      ]
    : '';

  const avgStat = (pet.hunger + pet.happiness + pet.energy + pet.cleanliness) / 4;

  return (
    <div className="h-full flex flex-col bg-dark-surface" style={{ backgroundImage: 'url(/images/ui/game-pet-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {/* Header */}
      <div className="pt-8 pb-2 px-4 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/games')} className="text-white/80 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-sm font-bold text-primary tracking-wider uppercase">
            {termlin?.name ?? 'Питомец'}
          </h2>
          <CurrencyDisplay amount={progress.currency} />
        </div>
      </div>
      <div className="gold-separator" />

      <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-4 bg-black/30">
        {/* Warning */}
        <AnimatePresence>
          {warning && (
            <motion.div
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
              <span className="text-red-400 text-xs">{warning}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pet avatar */}
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div
            className="relative"
            style={{
              background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
              padding: 16,
              borderRadius: '50%',
            }}
          >
            <motion.img
              src={termlin?.image ?? ''}
              alt={termlin?.name ?? ''}
              className="rounded-full object-cover border-3"
              style={{
                width: avatarSize,
                height: avatarSize,
                borderColor: color,
                boxShadow: `0 0 ${mood === 'ecstatic' ? 40 : 20}px ${color}30`,
              }}
              animate={mood === 'ecstatic' ? { scale: [1, 1.03, 1] } : undefined}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            {/* Mood badge */}
            <span
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold border"
              style={{
                backgroundColor: `${moodColor}20`,
                borderColor: `${moodColor}40`,
                color: moodColor,
              }}
            >
              {MOOD_LABELS[mood]}
            </span>
          </div>

          {/* Stage & overall */}
          <div className="flex items-center gap-3 mt-3">
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: `${color}15`, color }}
            >
              {STAGE_LABELS[pet.stage]}
            </span>
            <span className="text-white/30 text-[10px]">
              Общее: {Math.round(avgStat)}%
            </span>
          </div>

          {/* Expression */}
          {expression && (
            <motion.p
              className="text-white/30 text-xs mt-2 italic"
              key={expression}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              «{expression}»
            </motion.p>
          )}

          {/* Character ability - shown in bottom bar */}
        </motion.div>

        {/* Stats */}
        <div className="space-y-3 bg-black/40 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
          {stats.map(s => {
            const val = pet[s.key];
            const low = val < 20;
            return (
              <div key={s.key}>
                <div className="flex justify-between mb-1">
                  <span className={cn('text-xs', low ? 'text-red-400 font-medium' : 'text-white/50')}>
                    {s.label}
                  </span>
                  <span className={cn('text-xs', low ? 'text-red-400' : 'text-white/40')}>
                    {Math.round(val)}%
                  </span>
                </div>
                <ProgressBar current={val} max={100} color={low ? '#E85C5C' : s.color} />
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-4 gap-2">
          {actions.map(a => {
            const cd = cooldowns[a.action] ?? 0;
            const onCd = cd > 0;
            return (
              <motion.button
                key={a.action}
                className={cn(
                  'bg-black/40 backdrop-blur-sm border border-white/15 rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all',
                  onCd ? 'opacity-50' : 'hover:border-white/20',
                )}
                whileTap={onCd ? undefined : { scale: 0.93 }}
                onClick={() => doAction(a.action)}
                disabled={onCd}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center relative"
                  style={{ backgroundColor: `${a.color}20` }}
                >
                  <a.icon size={18} style={{ color: a.color }} />
                </div>
                <span className="text-white/60 text-[10px] font-medium">{a.label}</span>
                {onCd && (
                  <span className="text-white/30 text-[9px] tabular-nums">
                    {formatCooldown(cd)}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Character ability bar */}
      <CharacterAbilityBar game="pet" />
    </div>
  );
}
