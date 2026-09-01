import { cn } from '@/utils/cn';

interface CurrencyDisplayProps {
  amount: number;
  className?: string;
}

export function CurrencyDisplay({ amount, className }: CurrencyDisplayProps) {
  return (
    <div
      className={cn('flex items-center gap-1.5 bg-primary/20 rounded-full px-2.5 py-1', className)}
      aria-label={`Баланс: ${amount.toLocaleString('ru-RU')} термокоинов`}
      title={`${amount.toLocaleString('ru-RU')} термокоинов`}
    >
      <span className="termcoin-mark" aria-hidden="true">
        <img src="/images/brand/termburg-fish-96-v2.webp" alt="" width="48" height="48" />
      </span>
      <span className="text-primary font-bold text-xs">{amount.toLocaleString('ru-RU')}</span>
    </div>
  );
}
