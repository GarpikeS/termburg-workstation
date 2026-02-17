import { useRef, useEffect, useCallback, useMemo } from 'react';
import type { Grid, Position, AnimationPhase, TokenType } from '@/types/game';
import { TOKEN_COLORS } from '@/types/game';
import { useSwipe } from '@/hooks/useSwipe';
import { easeOutCubic, easeInOutQuad, easeOutBack, lerp } from '@/utils/animation';
import type { AnimationData } from '@/hooks/useGame';

interface GameBoardProps {
  grid: Grid;
  rows: number;
  cols: number;
  phase: AnimationPhase;
  animData: AnimationData;
  selectedCell: Position | null;
  onCellClick: (pos: Position) => void;
  onSwipe: (pos: Position, dx: number, dy: number) => void;
  onAnimationComplete: () => void;
}

const CELL_SIZE = 52;
const CELL_GAP = 4;
const CELL_RADIUS = 10;
const PADDING = 8;

const PHASE_DURATIONS: Partial<Record<AnimationPhase, number>> = {
  swap: 200,
  swap_back: 200,
  match: 300,
  score: 200,
  fall: 300,
  spawn: 200,
};

export function GameBoard({
  grid, rows, cols, phase, animData, selectedCell,
  onCellClick, onSwipe, onAnimationComplete,
}: GameBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokenImages = useRef<Map<string, HTMLImageElement>>(new Map());
  const animStart = useRef(0);
  const animFrameId = useRef(0);

  const cellTotal = CELL_SIZE + CELL_GAP;
  const boardW = cols * cellTotal - CELL_GAP + PADDING * 2;
  const boardH = rows * cellTotal - CELL_GAP + PADDING * 2;

  // Load SVG token images
  useEffect(() => {
    const types: TokenType[] = ['water', 'leaf', 'stone', 'steam', 'fire', 'wood'] as TokenType[];
    for (const t of types) {
      if (!tokenImages.current.has(t)) {
        const img = new Image();
        img.src = `/images/tokens/${t}.svg`;
        tokenImages.current.set(t, img);
      }
    }
  }, []);

  const cellPos = useCallback((row: number, col: number) => ({
    x: PADDING + col * cellTotal,
    y: PADDING + row * cellTotal,
  }), [cellTotal]);

  const posFromPixel = useCallback((px: number, py: number): Position | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const col = Math.floor((px * dpr - PADDING) / cellTotal);
    const row = Math.floor((py * dpr - PADDING) / cellTotal);
    if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
    return { row, col };
  }, [cellTotal, rows, cols]);

  const swipeCallbacks = useMemo(() => ({
    onSwipe: (startX: number, startY: number, dx: number, dy: number) => {
      const pos = posFromPixel(startX, startY);
      if (pos) onSwipe(pos, dx, dy);
    },
    onTap: (x: number, y: number) => {
      const pos = posFromPixel(x, y);
      if (pos) onCellClick(pos);
    },
  }), [posFromPixel, onSwipe, onCellClick]);

  useSwipe(canvasRef, swipeCallbacks);

  const drawCell = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    type: TokenType,
    scale: number = 1,
    alpha: number = 1,
  ) => {
    ctx.save();
    ctx.globalAlpha = alpha;

    // Cell background
    const cx = x + CELL_SIZE / 2;
    const cy = y + CELL_SIZE / 2;
    const s = CELL_SIZE * scale;
    const sx = cx - s / 2;
    const sy = cy - s / 2;

    ctx.fillStyle = '#302A50';
    ctx.beginPath();
    ctx.roundRect(sx, sy, s, s, CELL_RADIUS * scale);
    ctx.fill();

    // Token image or colored circle fallback
    const img = tokenImages.current.get(type);
    const tokenSize = s * 0.75;
    const tx = cx - tokenSize / 2;
    const ty = cy - tokenSize / 2;

    if (img && img.complete) {
      ctx.drawImage(img, tx, ty, tokenSize, tokenSize);
    } else {
      ctx.fillStyle = TOKEN_COLORS[type];
      ctx.beginPath();
      ctx.arc(cx, cy, tokenSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, []);

  const render = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d')!;

    // Set canvas size for retina
    canvas.width = boardW * dpr;
    canvas.height = boardH * dpr;
    canvas.style.width = `${boardW}px`;
    canvas.style.height = `${boardH}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, boardW, boardH);

    // Background
    ctx.fillStyle = '#252040';
    ctx.beginPath();
    ctx.roundRect(0, 0, boardW, boardH, 16);
    ctx.fill();

    // Draw empty cell backgrounds
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const { x, y } = cellPos(r, c);
        ctx.fillStyle = '#1E1A2E';
        ctx.beginPath();
        ctx.roundRect(x, y, CELL_SIZE, CELL_SIZE, CELL_RADIUS);
        ctx.fill();
      }
    }

    const duration = PHASE_DURATIONS[phase] ?? 0;
    const elapsed = timestamp - animStart.current;
    const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 1;

    // Draw tokens based on phase
    if (phase === 'swap' || phase === 'swap_back') {
      const { swapFrom, swapTo } = animData;
      const t = easeInOutQuad(phase === 'swap_back' && progress > 0.5
        ? 1 - (progress - 0.5) * 2
        : phase === 'swap_back' ? progress * 2 : progress);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[r]?.[c];
          if (!cell) continue;

          let { x, y } = cellPos(r, c);

          if (swapFrom && swapTo) {
            if (r === swapFrom.row && c === swapFrom.col) {
              const toPos = cellPos(swapTo.row, swapTo.col);
              x = lerp(x, toPos.x, t);
              y = lerp(y, toPos.y, t);
            } else if (r === swapTo.row && c === swapTo.col) {
              const fromPos = cellPos(swapFrom.row, swapFrom.col);
              x = lerp(x, fromPos.x, t);
              y = lerp(y, fromPos.y, t);
            }
          }

          drawCell(ctx, x, y, cell.type);
        }
      }
    } else if (phase === 'match') {
      const { matchedPositions } = animData;
      const matchSet = new Set(matchedPositions?.map(p => `${p.row},${p.col}`) ?? []);
      const t = easeOutCubic(progress);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[r]?.[c];
          if (!cell) continue;
          const { x, y } = cellPos(r, c);

          if (matchSet.has(`${r},${c}`)) {
            const scale = 1 + 0.2 * Math.sin(t * Math.PI);
            const alpha = 1 - t * 0.5;
            drawCell(ctx, x, y, cell.type, scale, alpha);
          } else {
            drawCell(ctx, x, y, cell.type);
          }
        }
      }
    } else if (phase === 'fall') {
      const { fallMoves } = animData;
      const moveMap = new Map<string, { fromRow: number; distance: number }>();
      for (const m of fallMoves ?? []) {
        moveMap.set(`${m.to.row},${m.to.col}`, { fromRow: m.from.row, distance: m.distance });
      }
      const t = easeOutCubic(progress);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[r]?.[c];
          if (!cell) continue;
          const { x, y } = cellPos(r, c);

          const move = moveMap.get(`${r},${c}`);
          if (move) {
            const fromY = cellPos(move.fromRow, c).y;
            const animY = lerp(fromY, y, t);
            drawCell(ctx, x, animY, cell.type);
          } else {
            drawCell(ctx, x, y, cell.type);
          }
        }
      }
    } else if (phase === 'spawn') {
      const { spawnEntries } = animData;
      const spawnSet = new Set(spawnEntries?.map(s => `${s.row},${s.col}`) ?? []);
      const t = easeOutBack(progress);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[r]?.[c];
          if (!cell) continue;
          const { x, y } = cellPos(r, c);

          if (spawnSet.has(`${r},${c}`)) {
            drawCell(ctx, x, y, cell.type, t, progress);
          } else {
            drawCell(ctx, x, y, cell.type);
          }
        }
      }
    } else {
      // idle / score / cascade_check
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[r]?.[c];
          if (!cell) continue;
          const { x, y } = cellPos(r, c);
          drawCell(ctx, x, y, cell.type);
        }
      }
    }

    // Draw selected cell highlight
    if (selectedCell && phase === 'idle') {
      const { x, y } = cellPos(selectedCell.row, selectedCell.col);
      ctx.strokeStyle = '#BA9B4F';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x - 1, y - 1, CELL_SIZE + 2, CELL_SIZE + 2, CELL_RADIUS + 1);
      ctx.stroke();
    }

    // Advance animation if complete
    if (phase !== 'idle' && progress >= 1) {
      onAnimationComplete();
    }

    animFrameId.current = requestAnimationFrame(render);
  }, [grid, rows, cols, phase, animData, selectedCell, boardW, boardH, cellPos, drawCell, onAnimationComplete]);

  // Start animation loop
  useEffect(() => {
    animStart.current = performance.now();
    animFrameId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId.current);
  }, [render]);

  // Reset animation timer on phase change
  useEffect(() => {
    animStart.current = performance.now();
  }, [phase]);

  return (
    <canvas
      ref={canvasRef}
      className="block mx-auto"
      style={{ touchAction: 'none' }}
    />
  );
}
