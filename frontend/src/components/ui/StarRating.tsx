import { cn } from '@/utils/cn';

interface StarRatingProps {
  stars: number;
  maxStars?: number;
  size?: number;
  animated?: boolean;
  className?: string;
}

export function StarRating({ stars, maxStars = 3, size = 24, animated = false, className }: StarRatingProps) {
  const fontSize = size * 0.9;

  return (
    <div className={cn('flex gap-1', className)}>
      {Array.from({ length: maxStars }, (_, i) => (
        <span
          key={i}
          className={cn(
            'transition-all duration-300',
            i < stars ? 'opacity-100' : 'opacity-30 grayscale',
            animated && i < stars && 'animate-star-pop',
          )}
          style={{
            fontSize,
            animationDelay: animated && i < stars ? `${i * 0.15}s` : undefined
          }}
        >
          🌿
        </span>
      ))}
    </div>
  );
}
