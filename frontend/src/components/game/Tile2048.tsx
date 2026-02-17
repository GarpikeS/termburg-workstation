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
  const x = tile.col * (cellSize + gap);
  const y = tile.row * (cellSize + gap);

  return (
    <motion.div
      layout
      layoutId={`tile-${tile.id}`}
      className={`absolute rounded-lg flex items-center justify-center font-bold ${fontSize}`}
      style={{
        width: cellSize,
        height: cellSize,
        backgroundColor: bg,
        color: text,
      }}
      initial={tile.isNew ? { scale: 0, x, y } : tile.mergedFrom ? { scale: 0.8, x, y } : { x, y }}
      animate={{ scale: 1, x, y }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, duration: 0.15 }}
    >
      {tile.value}
    </motion.div>
  );
}
