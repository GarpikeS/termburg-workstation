import { BUBBLE_RADIUS } from './hexGrid';

const SPEED = 12; // pixels per frame

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
  let vx = Math.sin(angle) * SPEED;
  let vy = -Math.cos(angle) * SPEED;

  for (let i = 0; i < 200; i++) {
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
  let vy = -Math.cos(angle);
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
