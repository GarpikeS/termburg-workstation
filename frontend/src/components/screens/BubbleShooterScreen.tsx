import { useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, RotateCcw, Trophy } from 'lucide-react';
import { useBubbles } from '@/hooks/useBubbles';
import { BUBBLE_HEX_COLORS, type BubbleColor } from '@/engine/engine-bubbles/bubbleTypes';
import { BUBBLE_RADIUS } from '@/engine/engine-bubbles/hexGrid';
import { getAimLine } from '@/engine/engine-bubbles/bubblePhysics';
import { Button } from '@/components/ui/Button';

const FIELD_WIDTH = 300;

function BubbleCircle({ x, y, color, size = BUBBLE_RADIUS }: { x: number; y: number; color: BubbleColor; size?: number }) {
  return (
    <div
      className="absolute rounded-full border border-white/20"
      style={{
        width: size * 2,
        height: size * 2,
        left: x - size,
        top: y - size,
        backgroundColor: BUBBLE_HEX_COLORS[color],
      }}
    />
  );
}

export function BubbleShooterScreen() {
  const navigate = useNavigate();
  const { state, aimAngle, setAimAngle, shoot, flying, nextLevel, restart } = useBubbles(FIELD_WIDTH);
  const fieldRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const shooterX = FIELD_WIDTH / 2;
  const shooterY = FIELD_WIDTH * 1.3;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const angle = Math.atan2(x - shooterX, shooterY - y);
    const clamped = Math.max(-1.2, Math.min(1.2, angle));
    setAimAngle(clamped);
  }, [shooterX, shooterY, setAimAngle]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const angle = Math.atan2(x - shooterX, shooterY - y);
    const clamped = Math.max(-1.2, Math.min(1.2, angle));
    setAimAngle(clamped);
  }, [shooterX, shooterY, setAimAngle]);

  const handlePointerUp = useCallback(() => {
    if (dragging.current) {
      dragging.current = false;
      shoot(aimAngle);
    }
  }, [aimAngle, shoot]);

  // Aim line
  const aimLine = useMemo(() => {
    if (state.isWon || state.isLost) return [];
    return getAimLine(shooterX, shooterY, aimAngle, FIELD_WIDTH, 150);
  }, [aimAngle, shooterX, shooterY, state.isWon, state.isLost]);

  return (
    <div className="h-full flex flex-col bg-dark-surface">
      {/* Header */}
      <div className="pt-10 pb-3 px-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/games')} className="text-white/50 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-base font-bold text-primary tracking-wider">
            Шарики — Ур. {state.level}
          </h2>
          <button onClick={restart} className="text-white/50 hover:text-primary transition-colors">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 pb-2">
        <div className="flex gap-3">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2 text-center">
            <p className="text-white/40 text-[10px]">Очки</p>
            <p className="text-primary font-bold text-lg">{state.score}</p>
          </div>
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2 text-center">
            <p className="text-white/40 text-[10px]">Выстрелов</p>
            <p className="text-primary font-bold text-lg">{state.shotsLeft}</p>
          </div>
        </div>
      </div>

      {/* Game field */}
      <div className="flex-1 flex items-start justify-center pt-2">
        <div
          ref={fieldRef}
          className="relative bg-white/3 rounded-xl overflow-hidden touch-none"
          style={{ width: FIELD_WIDTH, height: FIELD_WIDTH * 1.5 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => { dragging.current = false; }}
        >
          {/* Grid bubbles */}
          {state.bubbles.map(b => (
            <BubbleCircle key={b.id} x={b.x} y={b.y} color={b.color} />
          ))}

          {/* Flying bubble */}
          {flying && (
            <BubbleCircle x={flying.x} y={flying.y} color={flying.color} />
          )}

          {/* Aim line (dotted) */}
          {!flying && aimLine.length > 1 && (
            <svg className="absolute inset-0 pointer-events-none" style={{ width: FIELD_WIDTH, height: FIELD_WIDTH * 1.5 }}>
              <polyline
                points={aimLine.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
                strokeDasharray="4,6"
              />
            </svg>
          )}

          {/* Shooter */}
          <div
            className="absolute flex flex-col items-center"
            style={{ left: shooterX - 20, top: shooterY - 20 }}
          >
            <div
              className="w-10 h-10 rounded-full border-2 border-white/30"
              style={{ backgroundColor: BUBBLE_HEX_COLORS[state.shooterColor] }}
            />
          </div>

          {/* Next color indicator */}
          <div
            className="absolute flex items-center gap-1"
            style={{ left: shooterX + 30, top: shooterY - 8 }}
          >
            <span className="text-white/30 text-[10px]">След:</span>
            <div
              className="w-5 h-5 rounded-full border border-white/20"
              style={{ backgroundColor: BUBBLE_HEX_COLORS[state.nextColor] }}
            />
          </div>

          {/* Win/Lose overlays */}
          <AnimatePresence>
            {state.isWon && (
              <motion.div
                className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Trophy size={48} className="text-primary mb-3" />
                <p className="text-primary font-bold text-xl mb-1">Победа!</p>
                <p className="text-white/50 text-sm mb-4">Очки: {state.score}</p>
                <div className="space-y-2">
                  <Button onClick={nextLevel} size="sm">Следующий уровень</Button>
                  <button onClick={restart} className="block text-white/40 text-xs mx-auto hover:text-white/60">
                    Заново
                  </button>
                </div>
              </motion.div>
            )}
            {state.isLost && (
              <motion.div
                className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <p className="text-white font-bold text-xl mb-1">Проиграли</p>
                <p className="text-white/50 text-sm mb-4">Очки: {state.score}</p>
                <Button onClick={restart} size="sm">Заново</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
