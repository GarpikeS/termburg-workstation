import { Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';

interface CurrencyDisplayProps {
  amount: number;
  className?: string;
}

export function CurrencyDisplay({ amount, className }: CurrencyDisplayProps) {
  return (
    <div className={cn('flex items-center gap-1.5 bg-primary/20 rounded-full px-3 py-1', className)}>
      <Sparkles size={12} className="text-primary" />
      <span className="text-primary font-bold text-xs">{amount.toLocaleString()}</span>
    </div>
  );
}
