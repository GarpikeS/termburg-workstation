import { cn } from '@/utils/cn';
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'white';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'font-heading rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-primary text-white shadow-lg shadow-primary/30 hover:brightness-110',
        variant === 'secondary' && 'bg-secondary text-foreground hover:bg-secondary/80',
        variant === 'ghost' && 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted',
        variant === 'white' && 'bg-white text-primary shadow-xl hover:bg-white/90',
        size === 'sm' && 'px-4 py-2 text-sm',
        size === 'md' && 'px-6 py-3 text-base',
        size === 'lg' && 'px-8 py-4 text-lg h-16',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
