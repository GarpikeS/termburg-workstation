import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Utensils, Gamepad2, Moon, Droplets } from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { usePet } from '@/hooks/usePet';
import { termliny, ELEMENT_COLORS, getTermlinById } from '@/data/termliny';
import { MOOD_LABELS, STAGE_LABELS, type PetAction } from '@/engine/engine-pet/petEngine';
import { cn } from '@/utils/cn';

const actions: { action: PetAction; label: string; icon: typeof Utensils; color: string }[] = [
  { action: 'feed', label: 'Покормить', icon: Utensils, color: '#D4956A' },
  { action: 'play', label: 'Поиграть', icon: Gamepad2, color: '#5DB879' },
  { action: 'rest', label: 'Отдыхать', icon: Moon, color: '#9B7EC8' },
  { action: 'wash', label: 'Помыть', icon: Droplets, color: '#6AABDA' },
];

const stats = [
  { key: 'hunger' as const, label: 'Сытость', color: '#D4956A' },
  { key: 'happiness' as const, label: 'Счастье', color: '#5DB879' },
  { key: 'energy' as const, label: 'Энергия', color: '#9B7EC8' },
  { key: 'cleanliness' as const, label: 'Чистота', color: '#6AABDA' },
];

export function TamagotchiScreen() {
  const navigate = useNavigate();
  const { pet, mood, adopt, doAction } = usePet();

  // Adoption screen
  if (!pet) {
    return (
      <div className="h-full flex flex-col bg-dark-surface">
        <div className="pt-10 pb-4 px-5">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/games')} className="text-white/50 hover:text-primary transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h2 className="font-heading text-sm font-bold text-primary tracking-wider uppercase">Тамагочи</h2>
            <div className="w-5" />
          </div>
        </div>
        <div className="gold-separator" />

        <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4">
          <p className="text-white/60 text-sm text-center mb-4">Выбери своего питомца-Термлина!</p>
          <div className="grid grid-cols-2 gap-3">
            {termliny.map((t, i) => {
              const color = ELEMENT_COLORS[t.element] ?? '#BA9B4F';
              return (
                <motion.button
                  key={t.id}
                  className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center hover:border-white/20 transition-all"
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

  // Get expression based on mood
  const expression = termlin?.expressions?.[
    mood === 'happy' ? 0 : mood === 'content' ? Math.min(1, termlin.expressions.length - 1) : termlin.expressions.length - 1
  ] ?? '';

  return (
    <div className="h-full flex flex-col bg-dark-surface">
      {/* Header */}
      <div className="pt-10 pb-3 px-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/games')} className="text-white/50 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-sm font-bold text-primary tracking-wider uppercase">
            {termlin?.name ?? 'Питомец'}
          </h2>
          <div className="w-5" />
        </div>
      </div>
      <div className="gold-separator" />

      <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-4">
        {/* Pet avatar */}
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="relative">
            <img
              src={termlin?.image ?? ''}
              alt={termlin?.name ?? ''}
              className="w-32 h-32 rounded-full object-cover border-3"
              style={{ borderColor: color }}
            />
            <span
              className={cn(
                'absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold',
                mood === 'happy' ? 'bg-green-500/20 text-green-400' :
                mood === 'content' ? 'bg-blue-500/20 text-blue-400' :
                mood === 'sad' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400',
              )}
            >
              {MOOD_LABELS[mood]}
            </span>
          </div>
          <p className="text-white/40 text-xs mt-3">{STAGE_LABELS[pet.stage]}</p>
          {expression && (
            <p className="text-white/30 text-xs mt-1 italic">«{expression}»</p>
          )}
        </motion.div>

        {/* Stats */}
        <div className="space-y-3">
          {stats.map(s => (
            <div key={s.key}>
              <div className="flex justify-between mb-1">
                <span className="text-white/50 text-xs">{s.label}</span>
                <span className="text-white/40 text-xs">{Math.round(pet[s.key])}%</span>
              </div>
              <ProgressBar current={pet[s.key]} max={100} color={s.color} />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-4 gap-2">
          {actions.map(a => (
            <motion.button
              key={a.action}
              className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center gap-1.5 hover:border-white/20 transition-all"
              whileTap={{ scale: 0.93 }}
              onClick={() => doAction(a.action)}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${a.color}20` }}
              >
                <a.icon size={18} style={{ color: a.color }} />
              </div>
              <span className="text-white/60 text-[10px] font-medium">{a.label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
