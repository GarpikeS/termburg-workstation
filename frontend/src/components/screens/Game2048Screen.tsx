import { useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, RotateCcw, Sparkles } from 'lucide-react';
import { useGame2048 } from '@/hooks/useGame2048';
import { useGameContext } from '@/store/GameContext';
import { getTermlinById, ELEMENT_COLORS } from '@/data/termliny';
import { Tile2048 } from '@/components/game/Tile2048';
import { Win2048Popup } from '@/popups/Win2048Popup';
import { CharacterAbilityBar } from '@/components/game/CharacterAbilityBar';
import type { Direction } from '@/engine/engine-2048/moves2048';

const GRID_SIZE = 4;
const GAP = 6;

export function Game2048Screen() {
  const navigate = useNavigate();
  const { progress } = useGameContext();
  const { state, move, continueGame, restart } = useGame2048();
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const [abilityUsed, setAbilityUsed] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const character = getTermlinById(progress.selectedCharacter);
  const charColor = character ? (ELEMENT_COLORS[character.element] ?? '#BA9B4F') : '#BA9B4F';

  // Responsive grid: fit within phone width minus padding
  const containerSize = Math.min(300, window.innerWidth - 40);
  const cellSize = (containerSize - GAP * (GRID_SIZE + 1)) / GRID_SIZE;

  // Score multiplier
  const scoreMultiplier = progress.selectedCharacter === 'pereslav' ? 1.15
    : progress.selectedCharacter === 'yaromir' ? 1.10 : 1.0;
  const displayScore = Math.round(state.score * scoreMultiplier);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;

    let dir: Direction;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? 'right' : 'left';
    } else {
      dir = dy > 0 ? 'down' : 'up';
    }
    move(dir);
    touchRef.current = null;
  }, [move]);

  const handleAbility = useCallback(() => {
    if (abilityUsed) return;
    const charId = progress.selectedCharacter;
    if (charId === 'kazimir' || charId === 'vedagor') {
      setShowHint(true);
      setAbilityUsed(true);
      setTimeout(() => setShowHint(false), 3000);
    }
    if (charId === 'milovan') {
      setAbilityUsed(true);
    }
  }, [abilityUsed, progress.selectedCharacter]);

  const hasActiveAbility = !abilityUsed && (
    progress.selectedCharacter === 'kazimir' ||
    progress.selectedCharacter === 'vedagor' ||
    progress.selectedCharacter === 'milovan'
  );

  const tiles = state.grid.flatMap(row => row.filter((t): t is NonNullable<typeof t> => t !== null));

  return (
    <div className="h-full flex flex-col bg-dark-surface">
      {/* Header */}
      <div className="pt-8 pb-2 px-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/games')} className="text-white/50 hover:text-primary transition-colors p-1">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-base font-bold text-primary tracking-wider">2048</h2>
          <button onClick={restart} className="text-white/50 hover:text-primary transition-colors p-1">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Scores */}
      <div className="px-4 pb-2">
        <div className="flex gap-2">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
            <p className="text-white/40 text-[10px] uppercase">Очки</p>
            <p className="text-primary font-bold text-lg">{displayScore}</p>
          </div>
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
            <p className="text-white/40 text-[10px] uppercase">Рекорд</p>
            <p className="text-primary font-bold text-lg">{state.bestScore}</p>
          </div>
          {hasActiveAbility && (
            <button
              onClick={handleAbility}
              className="w-12 bg-white/5 border rounded-xl flex items-center justify-center animate-pulse"
              style={{ borderColor: `${charColor}40` }}
            >
              <Sparkles size={18} style={{ color: charColor }} />
            </button>
          )}
        </div>
      </div>

      <div className="gold-separator" />

      {/* Hint overlay */}
      {showHint && (
        <div className="px-4 py-1">
          <div className="bg-primary/10 border border-primary/20 rounded-lg py-1.5 px-3 text-center">
            <span className="text-primary text-xs">Попробуйте сдвинуть вниз или вправо</span>
          </div>
        </div>
      )}

      {/* Game board */}
      <div
        className="flex-1 flex items-center justify-center px-4"
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

          {/* Tiles — same coordinate space as background cells */}
          {tiles.map(tile => (
            <Tile2048 key={tile.id} tile={tile} cellSize={cellSize} gap={GAP} />
          ))}

          {state.isLost && (
            <motion.div
              className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-white font-bold text-xl mb-2">Игра окончена</p>
              <p className="text-white/50 text-sm mb-4">Очки: {displayScore}</p>
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

      {/* Character ability bar */}
      <CharacterAbilityBar game="game2048" />

      <Win2048Popup
        open={state.isWon}
        score={displayScore}
        onContinue={continueGame}
        onRestart={restart}
      />
    </div>
  );
}
