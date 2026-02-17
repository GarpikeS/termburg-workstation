import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/utils/cn';

interface ModalProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, children, className }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className={cn(
              'relative z-10 bg-dark-surface-warm rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl border border-white/10',
              className,
            )}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
