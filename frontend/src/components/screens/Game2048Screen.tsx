import { useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useGame2048 } from '@/hooks/useGame2048';
import { Tile2048 } from '@/components/game/Tile2048';
import { Win2048Popup } from '@/popups/Win2048Popup';
import type { Direction } from '@/engine/engine-2048/moves2048';

const GRID_SIZE = 4;
const GAP = 8;

export function Game2048Screen() {
  const navigate = useNavigate();
  const { state, move, continueGame, restart } = useGame2048();
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  // Calculate cell size based on container width
  const containerSize = 320; // fixed for phone frame
  const cellSize = (containerSize - GAP * (GRID_SIZE + 1)) / GRID_SIZE;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    const minSwipe = 30;

    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

    let dir: Direction;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? 'right' : 'left';
    } else {
      dir = dy > 0 ? 'down' : 'up';
    }
    move(dir);
    touchRef.current = null;
  }, [move]);

  // Collect all tiles from grid
  const tiles = state.grid.flatMap(row => row.filter((t): t is NonNullable<typeof t> => t !== null));

  return (
    <div className="h-full flex flex-col bg-dark-surface">
      {/* Header */}
      <div className="pt-10 pb-3 px-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/games')} className="text-white/50 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-base font-bold text-primary tracking-wider">2048</h2>
          <button onClick={restart} className="text-white/50 hover:text-primary transition-colors">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Scores */}
      <div className="px-5 pb-3">
        <div className="flex gap-3">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-white/40 text-[10px] uppercase">Очки</p>
            <p className="text-primary font-bold text-xl">{state.score}</p>
          </div>
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-white/40 text-[10px] uppercase">Рекорд</p>
            <p className="text-primary font-bold text-xl">{state.bestScore}</p>
          </div>
        </div>
      </div>

      <div className="gold-separator" />

      {/* Game board */}
      <div
        className="flex-1 flex items-center justify-center px-5"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative bg-white/5 rounded-xl"
          style={{
            width: containerSize,
            height: containerSize,
            padding: GAP,
          }}
        >
          {/* Background cells */}
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const r = Math.floor(i / GRID_SIZE);
            const c = i % GRID_SIZE;
            return (
              <div
                key={i}
                className="absolute bg-white/5 rounded-lg"
                style={{
                  width: cellSize,
                  height: cellSize,
                  left: GAP + c * (cellSize + GAP),
                  top: GAP + r * (cellSize + GAP),
                }}
              />
            );
          })}

          {/* Tiles */}
          <div className="relative" style={{ left: GAP, top: GAP }}>
            {tiles.map(tile => (
              <Tile2048 key={tile.id} tile={tile} cellSize={cellSize} gap={GAP} />
            ))}
          </div>

          {/* Game over overlay */}
          {state.isLost && (
            <motion.div
              className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-white font-bold text-xl mb-2">Игра окончена</p>
              <p className="text-white/50 text-sm mb-4">Очки: {state.score}</p>
              <button
                onClick={restart}
                className="bg-primary/20 border border-primary/30 text-primary px-6 py-2 rounded-xl font-medium text-sm"
              >
                Заново
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Win popup */}
      <Win2048Popup
        open={state.isWon}
        score={state.score}
        onContinue={continueGame}
        onRestart={restart}
      />
    </div>
  );
}
