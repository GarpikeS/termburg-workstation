import { cn } from '@/utils/cn';

interface ProgressBarProps {
  current: number;
  max: number;
  color?: string;
  className?: string;
}

export function ProgressBar({ current, max, color = '#4A7C59', className }: ProgressBarProps) {
  const pct = Math.min((current / max) * 100, 100);

  return (
    <div className={cn('w-full h-2 bg-muted rounded-full overflow-hidden', className)}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}
