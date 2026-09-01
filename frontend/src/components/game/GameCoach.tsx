import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Hand } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface GameCoachStep {
  id: string;
  title: string;
  message: string;
  icon: ReactNode;
}

interface GameCoachProps {
  step: GameCoachStep | null;
  className?: string;
}

export function GameCoach({ step, className }: GameCoachProps) {
  return (
    <AnimatePresence mode="wait">
      {step && (
        <motion.aside
          key={step.id}
          className={cn('game-coach', className)}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <span className="game-coach__icon" aria-hidden="true">{step.icon}</span>
          <span className="game-coach__copy">
            <strong>{step.title}</strong>
            <span>{step.message}</span>
          </span>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

interface CoachGestureProps {
  kind: 'swipe' | 'aim' | 'tap';
  className?: string;
}

const GESTURES = {
  swipe: { x: [-50, 50, -50], y: [0, 0, 0] },
  aim: { x: [0, -44, 0], y: [0, -92, 0] },
  tap: { x: [0, 0, 0], y: [0, 5, 0] },
};

export function CoachGesture({ kind, className }: CoachGestureProps) {
  return (
    <motion.span
      className={cn('game-coach-gesture', `game-coach-gesture--${kind}`, className)}
      aria-hidden="true"
      animate={GESTURES[kind]}
      transition={{ duration: kind === 'tap' ? 1.05 : 1.65, repeat: Infinity, ease: 'easeInOut' }}
    >
      <span className="game-coach-gesture__halo" />
      <Hand size={27} strokeWidth={2.1} />
    </motion.span>
  );
}
