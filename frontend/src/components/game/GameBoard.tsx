import { useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Grid, Position, AnimationPhase } from '@/types/game';
import { GemComponent } from './GemComponent';
import type { AnimationData } from '@/hooks/useGame';

interface GameBoardProps {
  grid: Grid;
  rows: number;
  cols: number;
  phase: AnimationPhase;
  animData: AnimationData;
  selectedCell: Position | null;
  onCellClick: (pos: Position) => void;
  onSwipe: (pos: Position, dx: number, dy: number) => void;
  onAnimationComplete: () => void;
}

const SWIPE_THRESHOLD = 20;

export function GameBoard({
  grid, rows, cols, phase, animData, selectedCell,
  onCellClick, onSwipe, onAnimationComplete,
}: GameBoardProps) {
  const touchStart = useRef<{ x: number; y: number; row: number; col: number } | null>(null);

  const matchedSet = new Set(
    (phase === 'match' ? animData.matchedPositions : [])?.map(p => `${p.row},${p.col}`) ?? []
  );

  const handlePointerDown = useCallback((e: React.PointerEvent, row: number, col: number) => {
    touchStart.current = { x: e.clientX, y: e.clientY, row, col };
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!touchStart.current) return;
    const { x, y, row, col } = touchStart.current;
    touchStart.current = null;

    const dx = e.clientX - x;
    const dy = e.clientY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < SWIPE_THRESHOLD) {
      onCellClick({ row, col });
    } else {
      const dirX = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : 0;
      const dirY = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 1 : -1) : 0;
      onSwipe({ row, col }, dirX, dirY);
    }
  }, [onCellClick, onSwipe]);

  // Auto-advance animation phases after short delays
  const scheduleAdvance = useCallback((delay: number) => {
    setTimeout(onAnimationComplete, delay);
  }, [onAnimationComplete]);

  // Trigger animation advance based on phase
  if (phase === 'swap' || phase === 'swap_back') scheduleAdvance(250);
  else if (phase === 'match') scheduleAdvance(350);
  else if (phase === 'score') scheduleAdvance(200);
  else if (phase === 'fall') scheduleAdvance(350);
  else if (phase === 'spawn') scheduleAdvance(250);

  return (
    <div className="w-full max-w-md mx-auto p-4">
      <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 shadow-xl">
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            touchAction: 'none',
          }}
        >
          <AnimatePresence mode="popLayout">
            {Array.from({ length: rows }, (_, r) =>
              Array.from({ length: cols }, (_, c) => {
                const cell = grid[r]?.[c];
                if (!cell) return <div key={`${r}-${c}`} className="aspect-square" />;

                const isSelected = selectedCell?.row === r && selectedCell?.col === c;
                const isMatched = matchedSet.has(`${r},${c}`);

                return (
                  <motion.div
                    key={cell.id}
                    layout
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    onPointerDown={(e) => handlePointerDown(e, r, c)}
                    onPointerUp={handlePointerUp}
                  >
                    <GemComponent
                      type={cell.type}
                      selected={isSelected}
                      matched={isMatched}
                      onClick={() => onCellClick({ row: r, col: c })}
                    />
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
