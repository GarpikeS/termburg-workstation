import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { getStars, getReward } from '@/engine/scorer';
import type { LevelConfig } from '@/types/game';

interface WinPopupProps {
  open: boolean;
  score: number;
  levelConfig: LevelConfig;
  onNext: () => void;
  onMap: () => void;
}

export function WinPopup({ open, score, levelConfig, onNext, onMap }: WinPopupProps) {
  const stars = getStars(score, levelConfig.starThresholds);
  const reward = getReward(stars, levelConfig.reward);

  return (
    <Modal open={open}>
      <div className="text-center space-y-4">
        <h2 className="font-heading text-2xl text-primary">Победа!</h2>

        <StarRating stars={stars} size={36} animated className="justify-center" />

        <div className="space-y-1">
          <p className="text-white/80 text-lg tabular-nums">{score.toLocaleString()} очков</p>
          {reward > 0 && (
            <p className="text-primary font-medium">+{reward} Термлинов</p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onMap} className="flex-1">
            Карта
          </Button>
          {levelConfig.id < 30 && (
            <Button onClick={onNext} className="flex-1">
              Дальше
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
