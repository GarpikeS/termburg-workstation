import { useState, useCallback, useRef, useEffect } from 'react';
import type { Bubble, BubbleColor } from '@/engine/engine-bubbles/bubbleTypes';
import { ALL_BUBBLE_COLORS } from '@/engine/engine-bubbles/bubbleTypes';
import { BUBBLE_RADIUS, snapToHex, GRID_ROWS } from '@/engine/engine-bubbles/hexGrid';
import { calculateTrajectory } from '@/engine/engine-bubbles/bubblePhysics';
import { findColorGroup, findFloating, checkCollision, isLevelCleared } from '@/engine/engine-bubbles/bubbleMatching';
import { getBubbleLevel, generateBubbles, nextBubbleId } from '@/engine/engine-bubbles/bubbleLevels';
import { useGameContext } from '@/store/GameContext';

interface BubbleGameState {
  bubbles: Bubble[];
  shooterColor: BubbleColor;
  nextColor: BubbleColor;
  score: number;
  level: number;
  levelName: string;
  isWon: boolean;
  isLost: boolean;
  shotsLeft: number;
}

function randomColor(colors: BubbleColor[]): BubbleColor {
  return colors[Math.floor(Math.random() * colors.length)];
}

export function useBubbles(fieldWidth: number) {
  const { completeBubbleLevel, addCurrency } = useGameContext();

  const [state, setState] = useState<BubbleGameState>(() => {
    const level = getBubbleLevel(1)!;
    const colors = level.colors;
    return {
      bubbles: generateBubbles(level, fieldWidth),
      shooterColor: randomColor(colors),
      nextColor: randomColor(colors),
      score: 0,
      level: 1,
      levelName: level.name,
      isWon: false,
      isLost: false,
      shotsLeft: level.shots,
    };
  });

  const [aimAngle, setAimAngle] = useState(0);
  const [flying, setFlying] = useState<{ x: number; y: number; color: BubbleColor } | null>(null);
  const animRef = useRef<number>(0);
  const trajectoryRef = useRef<{ x: number; y: number }[]>([]);
  const trajectoryIdx = useRef(0);

  const currentLevel = getBubbleLevel(state.level);

  const shoot = useCallback((angle: number) => {
    if (flying || state.isWon || state.isLost) return;

    const startX = fieldWidth / 2;
    const startY = fieldWidth * 1.3; // shooter position
    const fieldHeight = fieldWidth * 1.4;

    const traj = calculateTrajectory(startX, startY, angle, fieldWidth, fieldHeight);
    trajectoryRef.current = traj;
    trajectoryIdx.current = 0;

    setFlying({ x: startX, y: startY, color: state.shooterColor });

    setState(prev => ({
      ...prev,
      shooterColor: prev.nextColor,
      nextColor: randomColor(currentLevel?.colors ?? ALL_BUBBLE_COLORS),
      shotsLeft: prev.shotsLeft - 1,
    }));
  }, [flying, state.isWon, state.isLost, state.shooterColor, fieldWidth, currentLevel]);

  // Animate flying bubble
  useEffect(() => {
    if (!flying) return;

    const animate = () => {
      const traj = trajectoryRef.current;
      const idx = trajectoryIdx.current;

      if (idx >= traj.length) {
        // Reached end — snap and place
        const snap = snapToHex(flying.x, flying.y, fieldWidth);
        placeBubble(snap.row, snap.col, snap.x, snap.y, flying.color);
        setFlying(null);
        return;
      }

      const point = traj[idx];
      trajectoryIdx.current = idx + 1;

      // Check collision with existing bubbles
      const hit = checkCollision(state.bubbles, point.x, point.y, BUBBLE_RADIUS);
      if (hit || point.y <= BUBBLE_RADIUS) {
        const snap = snapToHex(point.x, point.y, fieldWidth);
        placeBubble(snap.row, snap.col, snap.x, snap.y, flying.color);
        setFlying(null);
        return;
      }

      setFlying(prev => prev ? { ...prev, x: point.x, y: point.y } : null);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [flying, state.bubbles, fieldWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeBubble = useCallback((row: number, col: number, x: number, y: number, color: BubbleColor) => {
    setState(prev => {
      // Check if position already occupied
      const occupied = prev.bubbles.find(b => b.row === row && b.col === col);
      if (occupied) {
        // Find nearest empty neighbor
        return prev; // skip placement if occupied
      }

      const newBubble: Bubble = { id: nextBubbleId(), color, row, col, x, y };
      let newBubbles = [...prev.bubbles, newBubble];

      // Find matches (3+)
      const group = findColorGroup(newBubbles, row, col);
      let scoreGained = 0;

      if (group.length >= 3) {
        const groupIds = new Set(group.map(b => b.id));
        newBubbles = newBubbles.filter(b => !groupIds.has(b.id));
        scoreGained += group.length * 10;

        // Remove floating bubbles
        const floating = findFloating(newBubbles);
        if (floating.length > 0) {
          const floatingIds = new Set(floating.map(b => b.id));
          newBubbles = newBubbles.filter(b => !floatingIds.has(b.id));
          scoreGained += floating.length * 15;
        }
      }

      const won = isLevelCleared(newBubbles);
      const lost = !won && prev.shotsLeft <= 0;

      // Check if any bubble reached bottom rows
      const bottomReached = newBubbles.some(b => b.row >= GRID_ROWS - 1);

      return {
        ...prev,
        bubbles: newBubbles,
        score: prev.score + scoreGained,
        isWon: won,
        isLost: lost || bottomReached,
      };
    });
  }, []);

  // Handle win
  useEffect(() => {
    if (state.isWon && currentLevel) {
      completeBubbleLevel();
      addCurrency(currentLevel.reward);
    }
  }, [state.isWon]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextLevel = useCallback(() => {
    const next = getBubbleLevel(state.level + 1);
    if (!next) return;
    setState({
      bubbles: generateBubbles(next, fieldWidth),
      shooterColor: randomColor(next.colors),
      nextColor: randomColor(next.colors),
      score: 0,
      level: state.level + 1,
      levelName: next.name,
      isWon: false,
      isLost: false,
      shotsLeft: next.shots,
    });
  }, [state.level, fieldWidth]);

  const restart = useCallback(() => {
    const level = getBubbleLevel(state.level) ?? getBubbleLevel(1)!;
    setState({
      bubbles: generateBubbles(level, fieldWidth),
      shooterColor: randomColor(level.colors),
      nextColor: randomColor(level.colors),
      score: 0,
      level: state.level,
      levelName: level.name,
      isWon: false,
      isLost: false,
      shotsLeft: level.shots,
    });
  }, [state.level, fieldWidth]);

  return { state, aimAngle, setAimAngle, shoot, flying, nextLevel, restart };
}
