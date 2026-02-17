import { motion, AnimatePresence } from 'motion/react';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Win2048PopupProps {
  open: boolean;
  score: number;
  onContinue: () => void;
  onRestart: () => void;
}

export function Win2048Popup({ open, score, onContinue, onRestart }: Win2048PopupProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-dark-surface border border-primary/30 rounded-2xl p-6 w-[85%] max-w-sm text-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
          >
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Trophy size={32} className="text-primary" />
            </div>
            <h3 className="font-heading text-2xl font-bold text-primary">2048!</h3>
            <p className="text-white/50 text-sm mt-2">Очки: {score}</p>
            <p className="text-white/40 text-xs mt-1">+50 монет!</p>
            <div className="space-y-2 mt-5">
              <Button className="w-full" onClick={onContinue}>Продолжить</Button>
              <button
                onClick={onRestart}
                className="w-full py-2 text-white/50 text-sm hover:text-white/80 transition-colors"
              >
                Заново
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
