import { motion } from 'motion/react';
import type { Tile } from '@/engine/engine-2048/grid2048';
import { getTileColor, getTileFontSize } from '@/engine/engine-2048/score2048';

interface Tile2048Props {
  tile: Tile;
  cellSize: number;
  gap: number;
}

export function Tile2048({ tile, cellSize, gap }: Tile2048Props) {
  const { bg, text } = getTileColor(tile.value);
  const fontSize = getTileFontSize(tile.value);
  // Same formula as background cells
  const left = gap + tile.col * (cellSize + gap);
  const top = gap + tile.row * (cellSize + gap);

  return (
    <motion.div
      className={`absolute rounded-lg flex items-center justify-center font-bold ${fontSize} z-10`}
      style={{
        width: cellSize,
        height: cellSize,
        left,
        top,
        backgroundColor: bg,
        color: text,
      }}
      initial={tile.isNew ? { scale: 0 } : tile.mergedFrom ? { scale: 0.8 } : false}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, duration: 0.15 }}
    >
      {tile.value}
    </motion.div>
  );
}
