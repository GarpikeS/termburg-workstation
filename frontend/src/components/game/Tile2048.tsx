import { motion } from 'motion/react';
import type { Tile } from '@/engine/engine-2048/grid2048';
import { getTileColor, getTileFontSize } from '@/engine/engine-2048/score2048';

interface Tile2048Props {
  tile: Tile;
  cellSize: number;
  gap: number;
  tutorialFocus?: boolean;
}

export function Tile2048({ tile, cellSize, gap, tutorialFocus = false }: Tile2048Props) {
  const { bg, text } = getTileColor(tile.value);
  const fontSize = getTileFontSize(tile.value);
  // Same formula as background cells
  const left = gap + tile.col * (cellSize + gap);
  const top = gap + tile.row * (cellSize + gap);

  return (
    <motion.div
      className={`game-2048-tile absolute rounded-lg flex items-center justify-center font-bold ${fontSize} z-10 overflow-hidden${tile.mergedFrom ? ' game-2048-tile--merged' : ''}${tutorialFocus ? ' game-2048-tile--tutorial' : ''}`}
      style={{
        width: cellSize,
        height: cellSize,
        left,
        top,
        background: `linear-gradient(155deg, ${bg}, ${bg}c4)`,
        color: text,
        border: '1px solid rgba(255,255,255,.2)',
        boxShadow: 'inset 0 -6px 11px rgba(0,0,0,.16), 0 4px 10px rgba(0,0,0,.24)',
      }}
      initial={tile.isNew ? { scale: 0 } : tile.mergedFrom ? { scale: 0.8 } : false}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, duration: 0.15 }}
    >
      <span className="relative z-[1] drop-shadow-sm">{tile.value}</span>
      {tile.mergedFrom && (
        <motion.span
          className="game-2048-merge-proof"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: [0, 1, 1, 0], y: [4, -2, -2, -8] }}
          transition={{ duration: 1.15, times: [0, 0.18, 0.7, 1] }}
        >
          {tile.value / 2}+{tile.value / 2}
        </motion.span>
      )}
    </motion.div>
  );
}
