import type { TokenType } from '@/types/game';
import { cn } from '@/utils/cn';

export const TOKEN_LABELS: Record<TokenType, string> = {
  water: 'Банная шайка',
  leaf: 'Берёзовый веник',
  stone: 'Банные тапочки',
  steam: 'Банная шапка',
  fire: 'Медный ковш',
  wood: 'Полотенце',
};

const TOKEN_ART: Record<TokenType, string> = {
  water: '/images/tokens/fairytale/bath-tub.webp',
  leaf: '/images/tokens/fairytale/bath-broom.webp',
  stone: '/images/tokens/fairytale/bath-slippers.webp',
  steam: '/images/tokens/fairytale/bath-hat.webp',
  fire: '/images/tokens/fairytale/bath-ladle.webp',
  wood: '/images/tokens/fairytale/bath-towel.webp',
};

interface TokenIconProps {
  type: TokenType;
  className?: string;
  decorative?: boolean;
}

export function TokenIcon({ type, className, decorative = true }: TokenIconProps) {
  return (
    <img
      src={TOKEN_ART[type]}
      alt={decorative ? '' : TOKEN_LABELS[type]}
      aria-hidden={decorative || undefined}
      className={cn('pointer-events-none select-none object-contain', className)}
      draggable={false}
      decoding="async"
    />
  );
}
