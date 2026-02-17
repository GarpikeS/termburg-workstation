import { motion } from 'motion/react';
import { Star } from 'lucide-react';
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
        {/* Big star icon */}
        <motion.div
          className="w-20 h-20 bg-gradient-to-br from-[#C4956C] to-[#E88B5C] rounded-full flex items-center justify-center mx-auto shadow-xl"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        >
          <Star size={36} className="text-white fill-white" />
        </motion.div>

        <h2 className="font-heading text-2xl text-primary font-bold">Победа!</h2>

        <StarRating stars={stars} size={36} animated className="justify-center" />

        <div className="space-y-1">
          <p className="text-foreground text-lg font-bold tabular-nums">{score.toLocaleString()} очков</p>
          {reward > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 inline-block">
              <p className="text-primary font-bold">+{reward} Термлинов</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onMap} className="flex-1">Карта</Button>
          {levelConfig.id < 100 && (
            <Button onClick={onNext} className="flex-1">Дальше</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
