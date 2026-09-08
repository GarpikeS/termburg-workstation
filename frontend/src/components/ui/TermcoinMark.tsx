import { cn } from '@/utils/cn';

interface TermcoinMarkProps {
  className?: string;
}

export function TermcoinMark({ className }: TermcoinMarkProps) {
  return (
    <span className={cn('termcoin-mark', className)} aria-hidden="true">
      <img src="/images/brand/termburg-fish-96-v2.webp" alt="" width="48" height="48" />
    </span>
  );
}
