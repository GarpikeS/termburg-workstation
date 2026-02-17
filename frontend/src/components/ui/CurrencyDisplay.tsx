import { Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';

interface CurrencyDisplayProps {
  amount: number;
  className?: string;
  light?: boolean;
}

export function CurrencyDisplay({ amount, className, light }: CurrencyDisplayProps) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 rounded-full px-3 py-1.5',
      light ? 'bg-white/20 backdrop-blur-sm' : 'bg-muted',
      className,
    )}>
      <Sparkles size={14} className={light ? 'text-white' : 'text-termo-gold'} />
      <span className={cn('font-bold text-sm', light ? 'text-white' : 'text-foreground')}>
        {amount.toLocaleString()}
      </span>
    </div>
  );
}
