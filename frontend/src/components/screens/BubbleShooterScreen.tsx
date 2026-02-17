import { useRef, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, RotateCcw, Trophy, Sparkles } from 'lucide-react';
import { useBubbles } from '@/hooks/useBubbles';
import { useGameContext } from '@/store/GameContext';
import { getTermlinById, ELEMENT_COLORS } from '@/data/termliny';
import { BUBBLE_HEX_COLORS, type BubbleColor } from '@/engine/engine-bubbles/bubbleTypes';
import { BUBBLE_RADIUS } from '@/engine/engine-bubbles/hexGrid';
import { getAimLine } from '@/engine/engine-bubbles/bubblePhysics';
import { Button } from '@/components/ui/Button';
import { CharacterAbilityBar } from '@/components/game/CharacterAbilityBar';

const FIELD_WIDTH = 280;

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
  const { progress } = useGameContext();
  const { state, aimAngle, setAimAngle, shoot, flying, nextLevel, restart } = useBubbles(FIELD_WIDTH);
  const fieldRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [abilityUsed, setAbilityUsed] = useState(false);
  const [showTrajectory, setShowTrajectory] = useState(false);

  const character = getTermlinById(progress.selectedCharacter);
  const charColor = character ? (ELEMENT_COLORS[character.element] ?? '#BA9B4F') : '#BA9B4F';

  const bonusShots = progress.selectedCharacter === 'yaromir' ? 3
    : progress.selectedCharacter === 'valkiriya' ? 2 : 0;
  const scoreMult = progress.selectedCharacter === 'pereslav' ? 1.20 : 1.0;

  const shooterX = FIELD_WIDTH / 2;
  const fieldHeight = FIELD_WIDTH * 1.4;
  const shooterY = fieldHeight - 30;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const angle = Math.atan2(x - shooterX, shooterY - y);
    setAimAngle(Math.max(-1.2, Math.min(1.2, angle)));
  }, [shooterX, shooterY, setAimAngle]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const angle = Math.atan2(x - shooterX, shooterY - y);
    setAimAngle(Math.max(-1.2, Math.min(1.2, angle)));
  }, [shooterX, shooterY, setAimAngle]);

  const handlePointerUp = useCallback(() => {
    if (dragging.current) {
      dragging.current = false;
      shoot(aimAngle);
    }
  }, [aimAngle, shoot]);

  const handleAbility = useCallback(() => {
    if (abilityUsed) return;
    setAbilityUsed(true);
    setShowTrajectory(true);
    setTimeout(() => setShowTrajectory(false), 5000);
  }, [abilityUsed]);

  const hasActiveAbility = !abilityUsed && (
    progress.selectedCharacter === 'kazimir' ||
    progress.selectedCharacter === 'milovan'
  );

  const aimLine = useMemo(() => {
    if (state.isWon || state.isLost) return [];
    return getAimLine(shooterX, shooterY, aimAngle, FIELD_WIDTH, showTrajectory ? 300 : 150);
  }, [aimAngle, shooterX, shooterY, state.isWon, state.isLost, showTrajectory]);

  const displayScore = Math.round(state.score * scoreMult);

  return (
    <div className="h-full flex flex-col bg-dark-surface">
      {/* Header */}
      <div className="pt-8 pb-2 px-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/games')} className="text-white/50 hover:text-primary transition-colors p-1">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-sm font-bold text-primary tracking-wider">
            Шарики — Ур. {state.level}
          </h2>
          <button onClick={restart} className="text-white/50 hover:text-primary transition-colors p-1">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 pb-1">
        <div className="flex gap-2">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2 text-center">
            <p className="text-white/40 text-[9px]">Очки</p>
            <p className="text-primary font-bold text-base">{displayScore}</p>
          </div>
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2 text-center">
            <p className="text-white/40 text-[9px]">Выстрелов</p>
            <p className="text-primary font-bold text-base">{state.shotsLeft + bonusShots}</p>
          </div>
          {hasActiveAbility && (
            <button
              onClick={handleAbility}
              className="w-10 bg-white/5 border rounded-xl flex items-center justify-center animate-pulse"
              style={{ borderColor: `${charColor}40` }}
            >
              <Sparkles size={16} style={{ color: charColor }} />
            </button>
          )}
        </div>
      </div>

      {/* Game field */}
      <div className="flex-1 flex items-start justify-center pt-1 overflow-hidden">
        <div
          ref={fieldRef}
          className="relative bg-white/3 rounded-xl overflow-hidden touch-none"
          style={{ width: FIELD_WIDTH, height: fieldHeight }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => { dragging.current = false; }}
        >
          {state.bubbles.map(b => (
            <BubbleCircle key={b.id} x={b.x} y={b.y} color={b.color} />
          ))}

          {flying && (
            <BubbleCircle x={flying.x} y={flying.y} color={flying.color} />
          )}

          {!flying && aimLine.length > 1 && (
            <svg className="absolute inset-0 pointer-events-none" style={{ width: FIELD_WIDTH, height: fieldHeight }}>
              <polyline
                points={aimLine.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={showTrajectory ? `${charColor}60` : 'rgba(255,255,255,0.2)'}
                strokeWidth={showTrajectory ? 3 : 2}
                strokeDasharray="4,6"
              />
            </svg>
          )}

          {/* Shooter */}
          <div
            className="absolute flex flex-col items-center"
            style={{ left: shooterX - 18, top: shooterY - 18 }}
          >
            <div
              className="w-9 h-9 rounded-full border-2 border-white/30"
              style={{ backgroundColor: BUBBLE_HEX_COLORS[state.shooterColor] }}
            />
          </div>

          {/* Next color */}
          <div
            className="absolute flex items-center gap-1"
            style={{ left: shooterX + 26, top: shooterY - 6 }}
          >
            <span className="text-white/30 text-[9px]">След:</span>
            <div
              className="w-4 h-4 rounded-full border border-white/20"
              style={{ backgroundColor: BUBBLE_HEX_COLORS[state.nextColor] }}
            />
          </div>

          {/* Win/Lose */}
          <AnimatePresence>
            {state.isWon && (
              <motion.div
                className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              >
                <Trophy size={40} className="text-primary mb-3" />
                <p className="text-primary font-bold text-lg mb-1">Победа!</p>
                <p className="text-white/50 text-sm mb-4">Очки: {displayScore}</p>
                <div className="space-y-2">
                  <Button onClick={nextLevel} size="sm">Следующий уровень</Button>
                  <button onClick={restart} className="block text-white/40 text-xs mx-auto hover:text-white/60">Заново</button>
                </div>
              </motion.div>
            )}
            {state.isLost && (
              <motion.div
                className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              >
                <p className="text-white font-bold text-lg mb-1">Проиграли</p>
                <p className="text-white/50 text-sm mb-4">Очки: {displayScore}</p>
                <Button onClick={restart} size="sm">Заново</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Character ability bar */}
      <CharacterAbilityBar game="bubbles" />
    </div>
  );
}
