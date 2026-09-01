import test from 'node:test';
import assert from 'node:assert/strict';

import { applyMove } from '../frontend/src/engine/engine-2048/moves2048.ts';

function tile(id, value, row, col) {
  return { id, value, row, col };
}

test('ход 2048 объединяет только соседние одинаковые плитки и сохраняет исходное поле', () => {
  const grid = [
    [tile(1, 2, 0, 0), tile(2, 2, 0, 1), tile(3, 4, 0, 2), tile(4, 4, 0, 3)],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ];
  const snapshot = JSON.stringify(grid);
  const result = applyMove(grid, 'left');

  assert.equal(JSON.stringify(grid), snapshot);
  assert.deepEqual(result.grid[0].filter(Boolean).map(item => item.value), [4, 8]);
  assert.equal(result.scoreGained, 12);
  assert.equal(result.moved, true);
});
