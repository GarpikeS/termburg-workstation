import { cn } from '@/utils/cn';

interface CurrencyDisplayProps {
  amount: number;
  className?: string;
}

export function CurrencyDisplay({ amount, className }: CurrencyDisplayProps) {
  return (
    <div className={cn('flex items-center gap-1.5 bg-dark-surface-warm/80 rounded-full px-3 py-1', className)}>
      <span className="text-primary text-sm">T</span>
      <span className="text-white font-medium text-sm">{amount.toLocaleString()}</span>
    </div>
  );
}
