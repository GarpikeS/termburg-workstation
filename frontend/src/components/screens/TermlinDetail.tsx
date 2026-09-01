import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Sparkles, Check, Lock, CircleCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useGameContext } from '@/store/GameContext';
import {
  getTermlinById,
  ELEMENT_COLORS,
  getTermlinUnlockValue,
  isTermlinRequirementMet,
  isTermlinUnlocked,
} from '@/data/termliny';
import { cn } from '@/utils/cn';

export function TermlinDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { progress, selectCharacter } = useGameContext();
  const termlin = getTermlinById(id ?? '');

  if (!termlin) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-surface">
        <p className="text-white/50">Персонаж не найден</p>
      </div>
    );
  }

  const isSelected = progress.selectedCharacter === termlin.id;
  const unlocked = isTermlinUnlocked(termlin, progress);
  const color = ELEMENT_COLORS[termlin.element] ?? '#BA9B4F';

  const sections = [
    { title: 'История', content: termlin.history },
    { title: 'Характер', content: termlin.character },
    { title: 'Привычки', content: termlin.habits },
    { title: 'Поговорки', content: termlin.expressions.join(' • ') },
    { title: 'Приметы', content: termlin.omens },
  ];

  return (
    <div className="h-full flex flex-col bg-dark-surface">
      {/* Header */}
      <div className="screen-safe-header pb-4 px-5">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Назад к термлинам" onClick={() => navigate('/collection')} className="min-w-11 min-h-11 flex items-center justify-center text-white/50 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-sm font-bold text-primary tracking-wider uppercase">{termlin.name}</h2>
          <div className="w-5" />
        </div>
      </div>
      <div className="gold-separator" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-4">
        {/* Avatar + info */}
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <img
            src={termlin.image}
            alt={termlin.name}
            className="w-28 h-28 rounded-full object-cover border-3"
            style={{ borderColor: color }}
          />
          <h3 className="font-heading text-lg font-bold text-white mt-3">{termlin.name}</h3>
          <p className="text-white/50 text-sm">{termlin.title}</p>
          <span
            className="mt-2 px-3 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {termlin.element}
          </span>
        </motion.div>

        {/* Ability card */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
              <Sparkles size={18} style={{ color }} />
            </div>
            <div>
              <p className="font-bold text-sm text-white/90">{termlin.ability.name}</p>
              <p className="text-white/40 text-xs">{termlin.ability.description}</p>
            </div>
          </div>
        </div>

        {!unlocked && (
          <section className="rounded-xl border border-primary/35 bg-primary/[0.08] p-4" aria-labelledby="unlock-title">
            <div className="flex items-center gap-2 text-primary">
              <Lock size={18} aria-hidden="true" />
              <h4 id="unlock-title" className="font-heading text-sm">Как открыть</h4>
            </div>
            <div className="mt-3 space-y-3">
              {termlin.unlockRequirements.map(requirement => {
                const current = Math.min(getTermlinUnlockValue(requirement, progress), requirement.target);
                const complete = isTermlinRequirementMet(requirement, progress);
                return (
                  <div key={`${requirement.source}-${requirement.target}`}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex items-center gap-2 text-white/75">
                        {complete && <CircleCheck size={15} className="text-emerald-300" aria-hidden="true" />}
                        {requirement.label}
                      </span>
                      <strong className={complete ? 'text-emerald-300' : 'text-primary'}>{current}/{requirement.target}</strong>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={cn('h-full rounded-full', complete ? 'bg-emerald-400' : 'bg-primary')}
                        style={{ width: `${Math.min(100, (current / requirement.target) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-white/45">Термлин откроется автоматически, когда все условия будут выполнены.</p>
          </section>
        )}

        {/* Sections */}
        {sections.map(s => (
          <div key={s.title} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h4 className="font-heading text-xs font-semibold uppercase tracking-wider text-primary mb-2">{s.title}</h4>
            <p className="text-white/60 text-sm leading-relaxed">{s.content}</p>
          </div>
        ))}

        {/* Select button */}
        <Button
          className="w-full"
          onClick={() => selectCharacter(termlin.id)}
          disabled={isSelected || !unlocked}
        >
          {!unlocked ? (
            <span className="flex items-center gap-2 justify-center"><Lock size={16} /> Сначала выполни условия</span>
          ) : isSelected ? (
            <span className="flex items-center gap-2 justify-center"><Check size={16} /> Выбран</span>
          ) : (
            'Выбрать героем'
          )}
        </Button>
      </div>
    </div>
  );
}
