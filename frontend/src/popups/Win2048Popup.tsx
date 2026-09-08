import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SLAVICH_LEVEL_TOTAL } from '@/data/gameProgression';
import type { PetState } from '@/types/game';
import type { PetCompanionRewardResult } from '@/engine/engine-pet/petCompanion';
import { PetCompanionRewardSummary } from '@/components/game/PetCompanion';

interface Win2048PopupProps {
  open: boolean;
  level: number;
  score: number;
  earnedReward: number | null;
  companionPet?: PetState | null;
  companionReward?: PetCompanionRewardResult | null;
  onCompanionExit?: () => void;
  onContinue: () => void;
  onRestart: () => void;
}

export function Win2048Popup({ open, level, score, earnedReward, companionPet, companionReward, onCompanionExit, onContinue, onRestart }: Win2048PopupProps) {
  return (
    <Modal open={open} ariaLabelledBy="game-2048-win-title">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
          <Trophy size={32} className="text-primary" />
        </div>
        <h2 id="game-2048-win-title" className="font-heading text-xl font-bold text-primary">
          Уровень {level} из {SLAVICH_LEVEL_TOTAL} пройден!
        </h2>
        <p className="text-white/50 text-sm mt-2">Очки: {score}</p>
        <p className="text-white/55 text-sm mt-2 font-semibold">
          {earnedReward === null
            ? `${companionPet ? 'Вам: ' : ''}Прогресс сохранён`
            : earnedReward > 0
              ? `${companionPet ? 'Вам: ' : ''}+${earnedReward} термокоинов`
              : companionPet
                ? 'Вам: термокоины не начислены — дневной лимит достигнут'
                : 'Лимит Славича на сегодня достигнут'}
        </p>
        {companionPet && <div className="mt-3"><PetCompanionRewardSummary pet={companionPet} reward={companionReward ?? null} /></div>}
        <div className="space-y-2 mt-5">
          <Button className="w-full" onClick={onContinue}>
            {level < SLAVICH_LEVEL_TOTAL ? `Продолжить — уровень ${level + 1}` : 'Продолжить игру'}
          </Button>
          {onCompanionExit && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={onCompanionExit}
              aria-label={companionPet ? `Вернуться к питомцу ${companionPet.name}` : 'Вернуться к питомцу'}
            >
              К питомцу
            </Button>
          )}
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2 text-white/50 text-sm hover:text-white/80 transition-colors"
          >
            Начать уровень заново
          </button>
        </div>
      </div>
    </Modal>
  );
}
