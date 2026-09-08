import { Heart, Sparkles } from 'lucide-react';
import type { PetState } from '@/types/game';
import type { PetCompanionRewardResult } from '@/engine/engine-pet/petCompanion';
import { getTermlinById } from '@/data/termliny';
import { cn } from '@/utils/cn';

interface PetCompanionChipProps {
  pet: PetState;
  className?: string;
}

export function PetCompanionChip({ pet, className }: PetCompanionChipProps) {
  const termlin = getTermlinById(pet.characterId);

  return (
    <span
      className={cn('inline-flex min-w-0 items-center justify-center gap-1 text-[9px] font-semibold text-white/65', className)}
      role="img"
      aria-label={`С вами играет ${pet.name}`}
      title={`С вами играет ${pet.name}`}
      style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', letterSpacing: 'normal', textTransform: 'none' }}
      data-pet-companion
    >
      <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full border border-primary/45 bg-black/40">
        {termlin?.image ? <img src={termlin.image} alt="" className="h-full w-full object-cover" /> : <Heart size={11} className="m-1 text-primary" />}
      </span>
      <span className="hidden max-w-[92px] truncate min-[360px]:inline">с {pet.name}</span>
    </span>
  );
}

interface PetCompanionRewardSummaryProps {
  pet: PetState;
  reward: PetCompanionRewardResult | null;
}

export function PetCompanionRewardSummary({ pet, reward }: PetCompanionRewardSummaryProps) {
  const termlin = getTermlinById(pet.characterId);

  return (
    <div
      className="mx-auto flex w-full max-w-[290px] items-center gap-3 rounded-xl border border-[#5DB879]/25 bg-[#5DB879]/10 px-3 py-2 text-left"
      role={reward ? 'status' : undefined}
      aria-live={reward ? 'polite' : undefined}
      aria-atomic={reward ? 'true' : undefined}
      data-pet-companion-reward
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#76D494]/45 bg-black/35">
        {termlin?.image ? <img src={termlin.image} alt="" className="h-full w-full object-cover" /> : <Sparkles size={17} className="text-[#76D494]" />}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-xs text-[#9BE6B1]">{pet.name}</strong>
        <span className="mt-0.5 block text-[11px] leading-snug text-white/65">
          {!reward
            ? 'Сохраняем награду питомцу…'
            : reward.awarded
              ? `Питомцу: +${reward.experience} опыта · +${reward.bond} к привязанности`
              : 'Награда питомцу не начислена'}
        </span>
      </span>
    </div>
  );
}
