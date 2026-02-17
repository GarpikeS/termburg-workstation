import { cn } from '@/utils/cn';
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'font-heading rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-primary text-white shadow-lg shadow-primary/30 hover:brightness-110',
        variant === 'secondary' && 'bg-dark-surface-warm text-white border border-dark-border hover:bg-dark-surface',
        variant === 'ghost' && 'bg-transparent text-white/70 hover:text-white hover:bg-white/10',
        size === 'sm' && 'px-4 py-2 text-sm',
        size === 'md' && 'px-6 py-3 text-base',
        size === 'lg' && 'px-8 py-4 text-lg',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
