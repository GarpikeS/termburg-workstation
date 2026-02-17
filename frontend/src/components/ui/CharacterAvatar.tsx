import { motion } from 'motion/react';
import { User } from 'lucide-react';
import { cn } from '@/utils/cn';

interface CharacterAvatarProps {
  gradient: string;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

const sizes = {
  sm: 'w-12 h-12',
  md: 'w-20 h-20',
  lg: 'w-32 h-32',
};

const iconSizes = { sm: 20, md: 32, lg: 48 };

export function CharacterAvatar({ gradient, size = 'md', animated = false, className }: CharacterAvatarProps) {
  return (
    <motion.div
      className={cn(
        'rounded-full flex items-center justify-center bg-gradient-to-br relative',
        gradient,
        sizes[size],
        className,
      )}
      animate={animated ? { y: [0, -10, 0] } : undefined}
      transition={animated ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      <User size={iconSizes[size]} className="text-white" />
      {animated && (
        <motion.div
          className="absolute inset-0 rounded-full bg-white"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0, 0.2] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full" />
    </motion.div>
  );
}
