import { useRef, useCallback, useEffect } from 'react';

interface SwipeCallbacks {
  onSwipe: (startX: number, startY: number, dx: number, dy: number) => void;
  onTap: (x: number, y: number) => void;
}

const SWIPE_THRESHOLD = 20;

export function useSwipe(canvasRef: React.RefObject<HTMLCanvasElement | null>, callbacks: SwipeCallbacks) {
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  const getPos = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0 : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleStart = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const pos = getPos(e);
      if (pos) {
        startPos.current = pos;
        isDragging.current = true;
      }
    };

    const handleEnd = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current || !startPos.current) return;
      isDragging.current = false;

      const pos = getPos(e);
      if (!pos) return;

      const dx = pos.x - startPos.current.x;
      const dy = pos.y - startPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < SWIPE_THRESHOLD) {
        callbacks.onTap(startPos.current.x, startPos.current.y);
      } else {
        // Determine primary direction
        let dirX = 0;
        let dirY = 0;
        if (Math.abs(dx) > Math.abs(dy)) {
          dirX = dx > 0 ? 1 : -1;
        } else {
          dirY = dy > 0 ? 1 : -1;
        }
        callbacks.onSwipe(startPos.current.x, startPos.current.y, dirX, dirY);
      }

      startPos.current = null;
    };

    const handleCancel = () => {
      isDragging.current = false;
      startPos.current = null;
    };

    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleCancel);

    return () => {
      canvas.removeEventListener('mousedown', handleStart);
      canvas.removeEventListener('touchstart', handleStart);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleCancel);
    };
  }, [canvasRef, callbacks, getPos]);
}
