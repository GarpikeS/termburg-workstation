import { useRef, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, RotateCcw, Trophy, Sparkles } from 'lucide-react';
import { useBubbles } from '@/hooks/useBubbles';
import { useGameContext } from '@/store/GameContext';
import { getTermlinById, ELEMENT_COLORS } from '@/data/termliny';
import { BUBBLE_HEX_COLORS, BUBBLE_NAMES, type BubbleColor } from '@/engine/engine-bubbles/bubbleTypes';
import { BUBBLE_RADIUS } from '@/engine/engine-bubbles/hexGrid';
import { getAimLine } from '@/engine/engine-bubbles/bubblePhysics';
import { getTotalLevels } from '@/engine/engine-bubbles/bubbleLevels';
import { Button } from '@/components/ui/Button';
import { CharacterAbilityBar } from '@/components/game/CharacterAbilityBar';

const FIELD_WIDTH = 280;

// Компонент веника вместо шарика
function VenikBubble({ x, y, color, size = BUBBLE_RADIUS }: { x: number; y: number; color: BubbleColor; size?: number }) {
  const hex = BUBBLE_HEX_COLORS[color];
  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        width: size * 2,
        height: size * 2,
        left: x - size,
        top: y - size,
      }}
    >
      {/* Фоновый круг */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: hex,
          boxShadow: `0 0 8px ${hex}80, inset 0 -3px 6px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.25)`,
        }}
      />
      {/* Иконка веника */}
      <span className="relative text-base" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
        🌿
      </span>
    </div>
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

  const totalLevels = getTotalLevels();

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
  const currentVenikName = BUBBLE_NAMES[state.shooterColor] || 'Веник';

  return (
    <div className="h-full flex flex-col bg-dark-surface" style={{ backgroundImage: 'url(/images/ui/game-bubbles-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {/* Header */}
      <div className="pt-8 pb-2 px-4 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/games')} className="text-white/80 hover:text-primary transition-colors p-1">
            <ArrowLeft size={20} />
          </button>
          <div className="text-center">
            <h2 className="font-heading text-sm font-bold text-primary tracking-wider">
              Бирюльки — Ур. {state.level}/{totalLevels}
            </h2>
            <p className="text-white/40 text-[10px]">{state.levelName}</p>
          </div>
          <button onClick={restart} className="text-white/80 hover:text-primary transition-colors p-1">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 pb-1 bg-black/40">
        <div className="flex gap-2">
          <div className="flex-1 bg-black/40 border border-white/15 rounded-xl p-2 text-center backdrop-blur-sm">
            <p className="text-white/50 text-[9px]">Очки</p>
            <p className="text-primary font-bold text-base">{displayScore}</p>
          </div>
          <div className="flex-1 bg-black/40 border border-white/15 rounded-xl p-2 text-center backdrop-blur-sm">
            <p className="text-white/50 text-[9px]">Бросков</p>
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
          className="relative bg-black/40 backdrop-blur-sm rounded-xl overflow-hidden touch-none border border-white/10"
          style={{ width: FIELD_WIDTH, height: fieldHeight }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => { dragging.current = false; }}
        >
          {state.bubbles.map(b => (
            <VenikBubble key={b.id} x={b.x} y={b.y} color={b.color} />
          ))}

          {flying && (
            <VenikBubble x={flying.x} y={flying.y} color={flying.color} />
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
            style={{ left: shooterX - 22, top: shooterY - 22 }}
          >
            <div
              className="w-11 h-11 rounded-full border-3 border-white/60 flex items-center justify-center"
              style={{
                backgroundColor: BUBBLE_HEX_COLORS[state.shooterColor],
                boxShadow: `0 0 16px ${BUBBLE_HEX_COLORS[state.shooterColor]}90, 0 0 30px ${BUBBLE_HEX_COLORS[state.shooterColor]}40, inset 0 -3px 6px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.3)`,
              }}
            >
              <span className="text-lg">🌿</span>
            </div>
            {/* Cannon base */}
            <div className="w-14 h-3 -mt-1 rounded-b-lg bg-white/15 border border-white/20 border-t-0" />
          </div>

          {/* Next color */}
          <div
            className="absolute flex items-center gap-1.5"
            style={{ left: shooterX + 30, top: shooterY - 8 }}
          >
            <span className="text-white/50 text-[9px] font-medium">След:</span>
            <div
              className="w-5 h-5 rounded-full border-2 border-white/30 flex items-center justify-center"
              style={{
                backgroundColor: BUBBLE_HEX_COLORS[state.nextColor],
                boxShadow: `0 0 6px ${BUBBLE_HEX_COLORS[state.nextColor]}60`,
              }}
            >
              <span className="text-[10px]">🌿</span>
            </div>
          </div>

          {/* Current venik name */}
          <div
            className="absolute text-center"
            style={{ left: 8, top: shooterY - 10 }}
          >
            <span className="text-white/40 text-[8px]">{currentVenikName}</span>
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
                <p className="text-white/70 text-xs mb-1">{state.levelName}</p>
                <p className="text-white/50 text-sm mb-4">Очки: {displayScore}</p>
                <div className="space-y-2">
                  {state.level < totalLevels && (
                    <Button onClick={nextLevel} size="sm">Следующий уровень</Button>
                  )}
                  <button onClick={restart} className="block text-white/40 text-xs mx-auto hover:text-white/60">Заново</button>
                </div>
              </motion.div>
            )}
            {state.isLost && (
              <motion.div
                className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              >
                <p className="text-white font-bold text-lg mb-1">Бирюльки закончились!</p>
                <p className="text-white/50 text-sm mb-4">Очки: {displayScore}</p>
                <Button onClick={restart} size="sm">Попробовать снова</Button>
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
