import { Star } from 'lucide-react';
import { cn } from '@/utils/cn';

interface StarRatingProps {
  stars: number;
  maxStars?: number;
  size?: number;
  animated?: boolean;
  className?: string;
}

export function StarRating({ stars, maxStars = 3, size = 24, animated = false, className }: StarRatingProps) {
  return (
    <div className={cn('flex gap-1', className)}>
      {Array.from({ length: maxStars }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={cn(
            'transition-all duration-300',
            i < stars ? 'fill-primary text-primary' : 'text-border fill-none',
            animated && i < stars && 'animate-star-pop',
          )}
          style={animated && i < stars ? { animationDelay: `${i * 0.15}s` } : undefined}
        />
      ))}
    </div>
  );
}
