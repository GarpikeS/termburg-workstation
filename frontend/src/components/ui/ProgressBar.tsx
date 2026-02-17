import { cn } from '@/utils/cn';

interface ProgressBarProps {
  current: number;
  max: number;
  color?: string;
  className?: string;
}

export function ProgressBar({ current, max, color = '#BA9B4F', className }: ProgressBarProps) {
  const pct = Math.min((current / max) * 100, 100);

  return (
    <div className={cn('w-full h-3 bg-dark-surface rounded-full overflow-hidden', className)}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}
