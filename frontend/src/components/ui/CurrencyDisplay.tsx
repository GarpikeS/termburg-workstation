import { cn } from '@/utils/cn';

interface CurrencyDisplayProps {
  amount: number;
  className?: string;
}

export function CurrencyDisplay({ amount, className }: CurrencyDisplayProps) {
  return (
    <div className={cn('flex items-center gap-1.5 bg-primary/20 rounded-full px-3 py-1', className)}>
      <span className="text-sm">🌿</span>
      <span className="text-primary font-bold text-xs">{amount.toLocaleString()}</span>
    </div>
  );
}
