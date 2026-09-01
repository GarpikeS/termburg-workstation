import type { Bubble } from './bubbleTypes.ts';
import { BUBBLE_RADIUS } from './hexGrid.ts';
import { checkCollision } from './bubbleMatching.ts';

// The path uses small collision-safe steps, while animation speed is measured
// in pixels per second so 60 Hz and 120 Hz screens show the same throw.
export const BUBBLE_TRAJECTORY_STEP = 4;
export const BUBBLE_FLIGHT_SPEED = 820;
export const SHOOTER_BOTTOM_GUTTER = 72;
export const COMPACT_SHOOTER_BOTTOM_GUTTER = 112;

export function getShooterBottomGutter(viewportHeight = 844): number {
  return viewportHeight <= 700 ? COMPACT_SHOOTER_BOTTOM_GUTTER : SHOOTER_BOTTOM_GUTTER;
}

export interface TrajectoryPoint {
  x: number;
  y: number;
}

export function calculateTrajectory(
  startX: number,
  startY: number,
  angle: number, // radians, 0 = up, positive = clockwise
  fieldWidth: number,
  fieldHeight: number,
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  let x = startX;
  let y = startY;
  let vx = Math.sin(angle) * BUBBLE_TRAJECTORY_STEP;
  const vy = -Math.cos(angle) * BUBBLE_TRAJECTORY_STEP;

  for (let i = 0; i < 1000; i++) {
    x += vx;
    y += vy;

    // Wall bounces
    if (x < BUBBLE_RADIUS) {
      x = BUBBLE_RADIUS;
      vx = -vx;
    } else if (x > fieldWidth - BUBBLE_RADIUS) {
      x = fieldWidth - BUBBLE_RADIUS;
      vx = -vx;
    }

    points.push({ x, y });

    // Stop at top or off screen
    if (y < BUBBLE_RADIUS || y > fieldHeight) break;
  }

  return points;
}

export function getCollisionAwareAimLine(
  startX: number,
  startY: number,
  angle: number,
  fieldWidth: number,
  fieldHeight: number,
  bubbles: readonly Bubble[],
): TrajectoryPoint[] {
  const path = calculateTrajectory(startX, startY, angle, fieldWidth, fieldHeight);
  const collisionIndex = path.findIndex(point => (
    point.y <= BUBBLE_RADIUS || checkCollision(bubbles, point.x, point.y, BUBBLE_RADIUS)
  ));
  const visiblePath = collisionIndex >= 0 ? path.slice(0, collisionIndex + 1) : path;
  return [{ x: startX, y: startY }, ...visiblePath];
}

export function getAimLine(
  startX: number,
  startY: number,
  angle: number,
  fieldWidth: number,
  length: number = 200,
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [{ x: startX, y: startY }];
  let x = startX;
  let y = startY;
  let vx = Math.sin(angle);
  const vy = -Math.cos(angle);
  let remaining = length;

  while (remaining > 0) {
    const step = Math.min(remaining, 5);
    x += vx * step;
    y += vy * step;
    remaining -= step;

    if (x < BUBBLE_RADIUS) { x = BUBBLE_RADIUS; vx = -vx; }
    if (x > fieldWidth - BUBBLE_RADIUS) { x = fieldWidth - BUBBLE_RADIUS; vx = -vx; }
    if (y < BUBBLE_RADIUS) break;

    points.push({ x, y });
  }

  return points;
}
