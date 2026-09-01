import { AnimatePresence, motion } from 'motion/react';
import { Hand, Sparkles } from 'lucide-react';
import type { Position, SpecialType } from '@/types/game';

export type Match3TutorialStep =
  | {
      id: string;
      kind: 'swap';
      title: string;
      message: string;
      from: Position;
      to: Position;
    }
  | {
      id: string;
      kind: 'special';
      title: string;
      message: string;
      special: SpecialType;
      target: Position;
    }
  | {
      id: string;
      kind: 'ability';
      title: string;
      message: string;
    };

interface Match3CoachProps {
  step: Match3TutorialStep | null;
  characterImage?: string;
}

export function Match3Coach({ step, characterImage }: Match3CoachProps) {
  return (
    <AnimatePresence mode="wait">
      {step && (
        <motion.aside
          key={step.id}
          className={`match3-coach match3-coach--${step.kind}`}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <span className="match3-coach__icon" aria-hidden="true">
            {step.kind === 'special' ? (
              <img src={`/images/tokens/${step.special}.svg`} alt="" />
            ) : step.kind === 'ability' && characterImage ? (
              <img src={characterImage} alt="" />
            ) : step.kind === 'ability' ? (
              <Sparkles size={20} />
            ) : (
              <Hand size={20} />
            )}
          </span>
          <span className="match3-coach__copy">
            <strong>{step.title}</strong>
            <span>{step.message}</span>
          </span>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
