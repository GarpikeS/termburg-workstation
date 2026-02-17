import { motion } from 'motion/react';
import { Droplets, Leaf, Mountain, Wind, Flame, TreeDeciduous } from 'lucide-react';
import { TokenType, TOKEN_COLORS } from '@/types/game';
import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';

const GEM_ICONS: Record<TokenType, ComponentType<LucideProps>> = {
  water: Droplets,
  leaf: Leaf,
  stone: Mountain,
  steam: Wind,
  fire: Flame,
  wood: TreeDeciduous,
};

interface GemProps {
  type: TokenType;
  selected?: boolean;
  matched?: boolean;
  onClick?: () => void;
}

export function GemComponent({ type, selected, matched, onClick }: GemProps) {
  const Icon = GEM_ICONS[type];
  const color = TOKEN_COLORS[type];

  return (
    <motion.button
      className="w-full aspect-square rounded-xl flex items-center justify-center relative"
      style={{ backgroundColor: `${color}25`, border: `1.5px solid ${color}50` }}
      onClick={onClick}
      initial={false}
      animate={{
        scale: matched ? 0 : selected ? 0.95 : 1,
        opacity: matched ? 0 : 1,
      }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Icon size={20} strokeWidth={2.5} color={color} />
      {selected && (
        <>
          <motion.div
            className="absolute inset-0 rounded-xl ring-2 ring-primary"
            layoutId="gem-selection"
          />
          <motion.div
            className="absolute inset-0 rounded-xl"
            style={{ backgroundColor: color }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0, 0.15] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </>
      )}
    </motion.button>
  );
}
