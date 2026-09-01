import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Hand } from 'lucide-react';
import type { Grid, Position, AnimationPhase } from '@/types/game';
import { SpecialType, TOKEN_COLORS } from '@/types/game';
import { GemComponent } from './GemComponent';
import type { AnimationData } from '@/hooks/useGame';
import type { Match3TutorialStep } from './Match3Coach';

interface GameBoardProps {
  grid: Grid;
  rows: number;
  cols: number;
  phase: AnimationPhase;
  animData: AnimationData;
  selectedCell: Position | null;
  hintPositions?: Position[];
  tutorialStep?: Match3TutorialStep | null;
  onCellClick: (pos: Position) => void;
  onSwipe: (pos: Position, dx: number, dy: number) => void;
  onAnimationComplete: () => void;
}

const SWIPE_THRESHOLD = 20;
const SPECIAL_MATCH_HOLD_DELAY = 920;
const SPECIAL_CREATION_DELAY = 920;
const PHASE_DELAYS: Partial<Record<AnimationPhase, number>> = {
  swap: 220,
  swap_back: 190,
  match_hold: 300,
  match: 200,
  powerup: 920,
  score: 120,
  fall: 190,
  spawn: 120,
};

const BURST_DIRECTIONS = Array.from({ length: 8 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 8;
  return { x: Math.cos(angle) * 24, y: Math.sin(angle) * 24 };
});

function MatchBurst({ color }: { color: string }) {
  return (
    <span className="match3-burst" aria-hidden="true">
      <motion.span
        className="match3-burst__ring"
        style={{ borderColor: color }}
        initial={{ opacity: 0.95, scale: 0.3 }}
        animate={{ opacity: 0, scale: 1.75 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
      <motion.span
        className="match3-burst__flash"
        style={{ backgroundColor: color, boxShadow: `0 0 16px ${color}` }}
        initial={{ opacity: 0.9, scale: 0.3 }}
        animate={{ opacity: 0, scale: 1.3 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      />
      {BURST_DIRECTIONS.map((direction, index) => (
        <motion.i
          key={index}
          className="match3-burst__particle"
          style={{ backgroundColor: index % 2 === 0 ? '#fff1ad' : color }}
          initial={{ x: 0, y: 0, opacity: 0.95, scale: 0.65 }}
          animate={{ x: direction.x, y: direction.y, opacity: 0, scale: 0.15 }}
          transition={{ duration: 0.3, delay: index * 0.008, ease: 'easeOut' }}
        />
      ))}
    </span>
  );
}

interface PowerUpEffectProps {
  special: SpecialType;
  origin: Position;
  target?: Position;
  rows: number;
  cols: number;
}

function PowerUpEffect({ special, origin, target, rows, cols }: PowerUpEffectProps) {
  const start = {
    left: `${((origin.col + 0.5) / cols) * 100}%`,
    top: `${((origin.row + 0.5) / rows) * 100}%`,
  };

  if (special === SpecialType.Helicopter) {
    const finish = target
      ? {
          left: `${((target.col + 0.5) / cols) * 100}%`,
          top: `${((target.row + 0.5) / rows) * 100}%`,
        }
      : start;

    return (
      <motion.div
        className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
        style={{ ...start, width: `calc(${100 / cols}% - 2px)` }}
        animate={{ ...finish, scale: [1, 1.22, 1], rotate: [0, -8, 7, 0] }}
        transition={{ duration: 0.78, times: [0, 0.25, 0.72, 1], ease: 'easeInOut' }}
        aria-hidden="true"
      >
        <img
          src="/images/tokens/helicopter.svg"
          alt=""
          className="h-auto w-full drop-shadow-[0_5px_8px_rgba(113,195,197,.65)]"
        />
      </motion.div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
      style={{ ...start, width: `calc(${100 / cols}% - 2px)` }}
      aria-hidden="true"
    >
      <motion.img
        src="/images/tokens/barrel.svg"
        alt=""
        className="relative z-[2] h-auto w-full drop-shadow-[0_5px_10px_rgba(224,94,57,.7)]"
        animate={{ scale: [1, 1.2, 0.88], rotate: [0, -7, 7, 0], opacity: [1, 1, 0.15] }}
        transition={{ duration: 0.8, times: [0, 0.42, 0.78, 1] }}
      />
      {[0, 0.14].map(delay => (
        <motion.span
          key={delay}
          className="absolute left-1/2 top-1/2 aspect-square rounded-full border-2 border-yellow-200"
          style={{ width: `calc(${500}% + 10px)` }}
          initial={{ x: '-50%', y: '-50%', scale: 0.12, opacity: 0.95 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ duration: 0.68, delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

function TutorialGesture({ step, rows, cols }: {
  step: Match3TutorialStep;
  rows: number;
  cols: number;
}) {
  if (step.kind === 'ability') return null;

  const start = step.kind === 'swap' ? step.from : step.target;
  const finish = step.kind === 'swap' ? step.to : step.target;
  const startPoint = {
    left: `${((start.col + 0.5) / cols) * 100}%`,
    top: `${((start.row + 0.5) / rows) * 100}%`,
  };
  const finishPoint = {
    left: `${((finish.col + 0.5) / cols) * 100}%`,
    top: `${((finish.row + 0.5) / rows) * 100}%`,
  };

  return (
    <motion.div
      className="match3-tutorial-pointer"
      style={startPoint}
      animate={step.kind === 'swap'
        ? {
            left: [startPoint.left, finishPoint.left, finishPoint.left, startPoint.left],
            top: [startPoint.top, finishPoint.top, finishPoint.top, startPoint.top],
            scale: [1, 0.9, 0.9, 1],
          }
        : { scale: [1, 0.78, 1], y: [5, 0, 5] }}
      transition={step.kind === 'swap'
        ? { duration: 1.65, times: [0, 0.42, 0.66, 1], repeat: Infinity, repeatDelay: 0.35, ease: 'easeInOut' }
        : { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    >
      <span className="match3-tutorial-pointer__halo" />
      <Hand size={28} strokeWidth={2.2} />
    </motion.div>
  );
}

export function GameBoard({
  grid, rows, cols, phase, animData, selectedCell,
  hintPositions = [],
  tutorialStep,
  onCellClick, onSwipe, onAnimationComplete,
}: GameBoardProps) {
  const touchStart = useRef<{ x: number; y: number; row: number; col: number } | null>(null);
  const ignoreNextClick = useRef(false);

  const matchState = phase === 'match_hold' || phase === 'powerup'
    ? 'hold'
    : phase === 'match'
      ? 'remove'
      : undefined;
  const activePositions = phase === 'powerup'
    ? animData.affectedPositions
    : animData.matchedPositions;
  const matchedSet = useMemo(() => new Set(
    (matchState ? activePositions : [])?.map(p => `${p.row},${p.col}`) ?? []
  ), [activePositions, matchState]);
  const hintedSet = useMemo(
    () => new Set(hintPositions.map(pos => `${pos.row},${pos.col}`)),
    [hintPositions]
  );
  const animateTilePosition = phase === 'swap' || phase === 'swap_back' || phase === 'fall';

  const handlePointerDown = useCallback((e: React.PointerEvent, row: number, col: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    touchStart.current = { x: e.clientX, y: e.clientY, row, col };
    ignoreNextClick.current = false;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!touchStart.current) return;
    const { x, y, row, col } = touchStart.current;
    touchStart.current = null;

    const dx = e.clientX - x;
    const dy = e.clientY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= SWIPE_THRESHOLD) {
      const dirX = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : 0;
      const dirY = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 1 : -1) : 0;
      ignoreNextClick.current = true;
      onSwipe({ row, col }, dirX, dirY);
    }
  }, [onSwipe]);

  const handleCellActivate = useCallback((pos: Position) => {
    if (ignoreNextClick.current) {
      ignoreNextClick.current = false;
      return;
    }
    onCellClick(pos);
  }, [onCellClick]);

  useEffect(() => {
    const delay = phase === 'match_hold' && animData.createdSpecial
      ? SPECIAL_MATCH_HOLD_DELAY
      : phase === 'score' && animData.createdSpecial
        ? SPECIAL_CREATION_DELAY
        : PHASE_DELAYS[phase];
    if (delay === undefined) return;

    const timer = window.setTimeout(onAnimationComplete, delay);
    return () => window.clearTimeout(timer);
  }, [animData.createdSpecial, onAnimationComplete, phase]);

  return (
    <div
      className="match3-board w-full max-w-md mx-auto p-1"
      data-phase={phase}
      data-match-size={animData.matchSize ?? undefined}
    >
      <div className="match3-board-shell game-panel rounded-2xl p-1">
        <div
          className="relative grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            touchAction: 'none',
          }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {Array.from({ length: rows }, (_, r) =>
              Array.from({ length: cols }, (_, c) => {
                const cell = grid[r]?.[c];
                if (!cell) return <div key={`${r}-${c}`} className="aspect-square" />;

                const isSelected = selectedCell?.row === r && selectedCell?.col === c;
                const isMatched = matchedSet.has(`${r},${c}`);
                const isHinted = hintedSet.has(`${r},${c}`);
                const tutorialRole = tutorialStep?.kind === 'swap'
                  ? tutorialStep.from.row === r && tutorialStep.from.col === c
                    ? 'from'
                    : tutorialStep.to.row === r && tutorialStep.to.col === c
                      ? 'to'
                      : undefined
                  : tutorialStep?.kind === 'special'
                    && tutorialStep.target.row === r
                    && tutorialStep.target.col === c
                    ? 'target'
                    : undefined;
                const isCreatingSpecial = phase === 'score'
                  && Boolean(cell.special)
                  && animData.specialCreation?.position.row === r
                  && animData.specialCreation.position.col === c;

                return (
                  <motion.div
                    key={cell.id}
                    className={`relative ${tutorialStep
                      ? tutorialRole
                        ? 'match3-tile--tutorial-focus'
                        : 'match3-tile--tutorial-dim'
                      : ''}`}
                    layout={animateTilePosition ? 'position' : false}
                    initial={isCreatingSpecial
                      ? { scale: 0.2, opacity: 0, rotate: -12 }
                      : { scale: 0, opacity: 0 }}
                    animate={isCreatingSpecial
                      ? {
                          scale: [0.2, 1.18, 0.96, 1],
                          opacity: [0, 1, 1, 1],
                          rotate: [-12, 5, -2, 0],
                        }
                      : { scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={isCreatingSpecial
                      ? {
                          duration: 0.86,
                          times: [0, 0.46, 0.76, 1],
                          ease: [0.22, 1, 0.36, 1],
                        }
                      : {
                          layout: phase === 'swap' || phase === 'swap_back'
                            ? { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
                            : { type: 'spring', stiffness: 420, damping: 30, mass: 0.75 },
                          scale: { duration: 0.18 },
                          opacity: { duration: 0.15 },
                        }}
                    data-row={r}
                    data-col={c}
                    data-token-id={cell.id}
                    data-special={cell.special}
                    data-special-creating={isCreatingSpecial || undefined}
                    data-tutorial-role={tutorialRole}
                  >
                    <GemComponent
                      type={cell.type}
                      special={cell.special}
                      row={r}
                      col={c}
                      selected={isSelected}
                      matchState={isMatched ? matchState : undefined}
                      hinted={isHinted}
                      isCreatingSpecial={isCreatingSpecial}
                      onActivate={handleCellActivate}
                      onPointerDown={(e) => handlePointerDown(e, r, c)}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={() => {
                        touchStart.current = null;
                        ignoreNextClick.current = false;
                      }}
                    />
                    {isMatched && matchState === 'remove' && (
                      <MatchBurst color={TOKEN_COLORS[cell.type]} />
                    )}
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
          {tutorialStep && (
            <TutorialGesture step={tutorialStep} rows={rows} cols={cols} />
          )}
          {phase === 'powerup' && animData.activatedSpecial && animData.activationOrigin && (
            <PowerUpEffect
              special={animData.activatedSpecial}
              origin={animData.activationOrigin}
              target={animData.activationTarget}
              rows={rows}
              cols={cols}
            />
          )}
        </div>
      </div>
    </div>
  );
}
