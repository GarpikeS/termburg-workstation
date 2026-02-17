import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface ModalProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, children, className }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={cn(
          'relative z-10 bg-dark-surface border border-dark-border rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl',
          'animate-[scale-in_0.3s_ease-out]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
