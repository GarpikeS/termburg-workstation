export type HapticEffect = 'selection' | 'move' | 'match' | 'cascade' | 'powerup' | 'success' | 'warning';

export const HAPTIC_PATTERNS: Record<HapticEffect, number | number[]> = {
  selection: 12,
  move: 16,
  match: 24,
  cascade: [18, 24, 30],
  powerup: [28, 20, 42],
  success: [30, 28, 64],
  warning: [38, 28, 38],
};

let lastSelectionAt = 0;

export function isHapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function triggerHaptic(effect: HapticEffect): boolean {
  if (!isHapticsSupported()) return false;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (effect === 'selection' && now - lastSelectionAt < 35) return false;
  if (effect === 'selection') lastSelectionAt = now;

  try {
    return navigator.vibrate(HAPTIC_PATTERNS[effect]);
  } catch {
    return false;
  }
}

export function stopHaptics(): boolean {
  if (!isHapticsSupported()) return false;
  try {
    return navigator.vibrate(0);
  } catch {
    return false;
  }
}
