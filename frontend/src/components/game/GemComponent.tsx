import { memo, useCallback } from 'react';
import type { PointerEventHandler } from 'react';
import { motion } from 'motion/react';
import { SpecialType, TokenType, TOKEN_COLORS } from '@/types/game';
import type { Position } from '@/types/game';
import { TokenIcon, TOKEN_LABELS } from '@/components/ui/TokenIcon';

interface GemProps {
  type: TokenType;
  special?: SpecialType;
  row: number;
  col: number;
  selected?: boolean;
  matchState?: 'hold' | 'remove';
  hinted?: boolean;
  isCreatingSpecial?: boolean;
  onActivate?: (position: Position) => void;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel?: PointerEventHandler<HTMLButtonElement>;
}

export const GemComponent = memo(function GemComponent({
  type,
  special,
  row,
  col,
  selected,
  matchState,
  hinted,
  isCreatingSpecial,
  onActivate,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: GemProps) {
  const color = special === SpecialType.Helicopter
    ? '#71C3C5'
    : special === SpecialType.Barrel
      ? '#E0A45B'
      : TOKEN_COLORS[type];
  const label = special === SpecialType.Helicopter
    ? 'Вертолётик'
    : special === SpecialType.Barrel
      ? 'Пороховая бочка'
      : TOKEN_LABELS[type];

  const animation = matchState === 'hold'
    ? {
        scale: [1, 1.18, 1.07],
        opacity: 1,
        filter: ['brightness(1)', 'brightness(1.24)', 'brightness(1.1)'],
      }
    : matchState === 'remove'
      ? {
          scale: [1.07, 1.25, 0.12],
          opacity: [1, 1, 0],
          filter: ['brightness(1.1)', 'brightness(1.48)', 'brightness(1.2)'],
        }
      : {
          scale: selected ? 0.95 : 1,
          opacity: 1,
          filter: 'brightness(1)',
        };

  const transition = matchState === 'hold'
    ? { duration: 0.32, times: [0, 0.45, 1], ease: 'easeOut' as const }
    : matchState === 'remove'
      ? { duration: 0.22, times: [0, 0.38, 1], ease: 'easeIn' as const }
      : { type: 'spring' as const, stiffness: 420, damping: 28, mass: 0.75 };
  const handleClick = useCallback(
    () => onActivate?.({ row, col }),
    [col, onActivate, row]
  );

  return (
    <motion.button
      type="button"
      className="game-gem w-full aspect-square rounded-xl flex items-center justify-center relative overflow-visible focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      style={{
        background: `linear-gradient(155deg, ${color}E8, ${color}A8)`,
        border: `2px solid ${color}FF`,
        boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.2), 0 3px 7px rgba(0,0,0,.24)',
      }}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      data-match-state={matchState}
      aria-label={`${label}${selected ? ', выбрано' : ''}`}
      aria-pressed={selected}
      initial={false}
      animate={animation}
      whileTap={{ scale: 0.9 }}
      transition={transition}
    >
      {special ? (
        <motion.img
          src={`/images/tokens/${special}.svg`}
          alt=""
          aria-hidden="true"
          className="relative z-[1] h-[90%] w-[90%] object-contain"
          animate={special === SpecialType.Helicopter
            ? { y: [0, -2, 0], rotate: [0, 2, -2, 0] }
            : { scale: [1, 1.04, 1] }}
          transition={{ duration: special === SpecialType.Helicopter ? 1.25 : 1.5, repeat: Infinity }}
        />
      ) : (
        <TokenIcon type={type} className="relative z-[1] h-[92%] w-[92%]" />
      )}
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
      {hinted && !selected && (
        <motion.div
          className="absolute inset-0 rounded-xl ring-2 ring-yellow-300"
          animate={{ opacity: [0.35, 1, 0.35], scale: [0.96, 1.04, 0.96] }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
      )}
      {isCreatingSpecial && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-xl border-2"
          style={{ borderColor: color, boxShadow: `inset 0 0 14px ${color}, 0 0 12px ${color}` }}
          initial={{ opacity: 0.95, scale: 0.58 }}
          animate={{ opacity: [0.95, 0.7, 0], scale: [0.58, 1.08, 1.32] }}
          transition={{ duration: 0.86, times: [0, 0.55, 1], ease: 'easeOut' }}
          aria-hidden="true"
        />
      )}
      {matchState === 'hold' && (
        <motion.span
          className="absolute -inset-0.5 rounded-xl border-2"
          style={{ borderColor: '#fff1ad', boxShadow: `0 0 11px ${color}` }}
          initial={{ opacity: 0, scale: 0.84 }}
          animate={{ opacity: [0, 0.95, 0.4], scale: [0.84, 1.08, 1] }}
          transition={{ duration: 0.32, times: [0, 0.55, 1] }}
          aria-hidden="true"
        />
      )}
    </motion.button>
  );
});
