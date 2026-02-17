import { cn } from '@/utils/cn';
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer select-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-primary text-dark-surface shadow-sm hover:bg-primary-light hover:shadow-md',
        variant === 'secondary' && 'bg-white/10 text-white/80 border border-white/10 hover:bg-white/15',
        variant === 'accent' && 'bg-accent text-white shadow-sm hover:bg-accent-light hover:shadow-md',
        variant === 'outline' && 'border-2 border-primary text-primary hover:bg-primary hover:text-dark-surface',
        variant === 'ghost' && 'text-white/50 hover:text-white hover:bg-white/5',
        size === 'sm' && 'px-4 py-2 text-sm rounded-lg',
        size === 'md' && 'px-6 py-2.5 text-base rounded-xl',
        size === 'lg' && 'px-8 py-3.5 text-lg rounded-xl',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
