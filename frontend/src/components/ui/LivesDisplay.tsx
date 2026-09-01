import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { MAX_LIVES } from '@/store/lives';
import { cn } from '@/utils/cn';

interface LivesDisplayProps {
  lives: number;
  nextLifeAt: number | null;
  showTimer?: boolean;
  className?: string;
}

function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function LivesDisplay({
  lives,
  nextLifeAt,
  showTimer = false,
  className,
}: LivesDisplayProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!showTimer || lives >= MAX_LIVES || !nextLifeAt) return;

    const initialTick = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(timer);
    };
  }, [lives, nextLifeAt, showTimer]);

  const countdown = lives < MAX_LIVES && nextLifeAt && now !== null
    ? formatCountdown(nextLifeAt - now)
    : null;

  return (
    <div
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-full border border-rose-300/30 bg-black/55 px-3 text-rose-100 backdrop-blur-sm',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={`Жизни: ${lives} из ${MAX_LIVES}${countdown ? `. Следующая через ${countdown}` : ''}`}
      data-lives-count={lives}
    >
      <Heart size={18} className="shrink-0 text-rose-400" fill="currentColor" />
      <strong className="text-sm tabular-nums">{lives}/{MAX_LIVES}</strong>
      {showTimer && countdown && (
        <span className="border-l border-white/15 pl-2 text-xs font-semibold tabular-nums text-white/75">
          +1 через {countdown}
        </span>
      )}
    </div>
  );
}
