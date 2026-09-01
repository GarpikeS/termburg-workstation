import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateBubbles,
  getActiveBubbleColors,
  getBubbleLevel,
  getBubbleShotBonus,
  getShooterColors,
  getTotalLevels,
} from '../frontend/src/engine/engine-bubbles/bubbleLevels.ts';
import { findColorGroup, findFloating, isLevelCleared } from '../frontend/src/engine/engine-bubbles/bubbleMatching.ts';
import { resolveBubblePlacement } from '../frontend/src/engine/engine-bubbles/bubbleResolution.ts';
import {
  BUBBLE_DIAMETER,
  findAttachmentCell,
  getNeighbors,
  hexToPixel,
} from '../frontend/src/engine/engine-bubbles/hexGrid.ts';
import {
  BUBBLE_FLIGHT_SPEED,
  BUBBLE_TRAJECTORY_STEP,
  calculateTrajectory,
  getCollisionAwareAimLine,
} from '../frontend/src/engine/engine-bubbles/bubblePhysics.ts';

const FIELD_WIDTH = 336;

test('полёт Бирюльки читаемый и одинаковый на экранах с разной частотой', () => {
  assert.equal(BUBBLE_FLIGHT_SPEED, 820);
  assert.equal(BUBBLE_TRAJECTORY_STEP, 4);
  assert.ok(BUBBLE_TRAJECTORY_STEP < BUBBLE_DIAMETER);
  const trajectory = calculateTrajectory(FIELD_WIDTH / 2, 398, 0, FIELD_WIDTH, 470);
  const flightDurationMs = trajectory.length * BUBBLE_TRAJECTORY_STEP / BUBBLE_FLIGHT_SPEED * 1000;
  assert.ok(flightDurationMs >= 400 && flightDurationMs <= 550, `вертикальный бросок длится ${flightDurationMs} мс`);
});

test('линия прицела доходит до первого столкновения, а не обрывается посреди поля', () => {
  const obstacle = { id: 1, color: 'leaf', row: 0, col: 4, ...hexToPixel(0, 4, FIELD_WIDTH) };
  const startX = FIELD_WIDTH / 2;
  const startY = 398;
  const line = getCollisionAwareAimLine(startX, startY, 0, FIELD_WIDTH, 470, [obstacle]);
  const endpoint = line.at(-1);

  assert.deepEqual(line[0], { x: startX, y: startY });
  assert.ok(line.length > 50, `линия слишком короткая: ${line.length} точек`);
  assert.ok(endpoint);
  assert.ok(endpoint.y > obstacle.y, 'линия должна остановиться перед шариком');
  assert.ok(endpoint.y - obstacle.y < BUBBLE_DIAMETER, 'конец линии должен показывать точку столкновения');
});

test('исчезновение тройки отдаёт координаты для эффекта взрыва', () => {
  const first = { id: 1, color: 'birch', row: 0, col: 0, ...hexToPixel(0, 0, FIELD_WIDTH) };
  const second = { id: 2, color: 'birch', row: 0, col: 1, ...hexToPixel(0, 1, FIELD_WIDTH) };
  const placed = { id: 3, color: 'birch', row: 1, col: 0, ...hexToPixel(1, 0, FIELD_WIDTH) };
  const result = resolveBubblePlacement([first, second], placed);

  assert.equal(result.bubbles.length, 0);
  assert.equal(result.scoreGained, 30);
  assert.deepEqual(result.removals.map(bubble => bubble.id).sort(), [1, 2, 3]);
  assert.ok(result.removals.every(bubble => bubble.kind === 'match'));
});

test('победа засчитывается только после очистки всех шариков', () => {
  const level = getBubbleLevel(1);
  assert.ok(level);
  const [lastBubble] = generateBubbles(level, FIELD_WIDTH);

  assert.equal(isLevelCleared([lastBubble]), false);
  assert.equal(isLevelCleared([]), true);
});

test('первый уровень начинается сразу с трёх цветов и ограниченного числа бросков', () => {
  const level = getBubbleLevel(1);
  assert.ok(level);
  assert.equal(level.rows, 4);
  assert.equal(level.colors.length, 3);
  assert.equal(level.shots, 26);
  assert.equal(getBubbleShotBonus('yaromir'), 3);
  assert.equal(getBubbleShotBonus('valkiriya'), 2);
  assert.equal(getBubbleShotBonus('pereslav'), 0);
});

test('первые четыре уровня последовательно сокращают запас на промахи', () => {
  const shots = [1, 2, 3, 4].map(id => getBubbleLevel(id)?.shots);
  assert.deepEqual(shots, [26, 23, 21, 18]);
});

test('раскладка одинакова после перезапуска и не содержит готовых групп больше двух', () => {
  for (let id = 1; id <= getTotalLevels(); id += 1) {
    const level = getBubbleLevel(id);
    assert.ok(level);
    const first = generateBubbles(level, FIELD_WIDTH);
    const second = generateBubbles(level, FIELD_WIDTH);
    assert.deepEqual(second, first, `уровень ${id} должен быть детерминированным`);

    const largestGroup = first.reduce(
      (largest, bubble) => Math.max(largest, findColorGroup(first, bubble.row, bubble.col).length),
      0,
    );
    assert.ok(largestGroup <= 2, `на уровне ${id} стартовая группа равна ${largestGroup}`);
  }
});

test('на первых трёх уровнях снизу есть открытая пара для понятного первого броска', () => {
  for (let id = 1; id <= 3; id += 1) {
    const level = getBubbleLevel(id);
    assert.ok(level);
    const bubbles = generateBubbles(level, FIELD_WIDTH);
    const shot = findBestShot(bubbles, getShooterColors(bubbles, level.colors));
    assert.ok(shot, `уровень ${id}: стартовый результативный бросок не найден`);
  }
});

function findBestShot(bubbles, colors) {
  const occupied = new Set(bubbles.map(bubble => `${bubble.row},${bubble.col}`));
  let best = null;

  for (const color of colors) {
    for (let row = 0; row < 12; row += 1) {
      const maxCols = row % 2 === 1 ? 8 : 9;
      for (let col = 0; col < maxCols; col += 1) {
        if (occupied.has(`${row},${col}`)) continue;
        if (row !== 0 && !getNeighbors(row, col).some(([r, c]) => occupied.has(`${r},${c}`))) continue;

        const position = hexToPixel(row, col, FIELD_WIDTH);
        const probe = { id: Number.MAX_SAFE_INTEGER, color, row, col, ...position };
        const withProbe = [...bubbles, probe];
        const group = findColorGroup(withProbe, row, col);
        if (group.length < 2) continue;

        const groupIds = new Set(group.map(bubble => bubble.id));
        const afterGroup = group.length >= 3
          ? withProbe.filter(bubble => !groupIds.has(bubble.id))
          : withProbe;
        const removed = group.length >= 3
          ? group.length + findFloating(afterGroup).length
          : 0;
        if (!best || removed > best.removed || (removed === best.removed && group.length > best.group.length)) {
          best = { probe, group, removed };
        }
      }
    }
  }

  return best;
}

test('первые пять уровней можно выиграть последовательностью результативных бросков', () => {
  for (let id = 1; id <= 5; id += 1) {
    const level = getBubbleLevel(id);
    assert.ok(level);
    let bubbles = generateBubbles(level, FIELD_WIDTH);
    let shotsUsed = 0;

    while (!isLevelCleared(bubbles) && shotsUsed < level.shots) {
      const colors = getShooterColors(bubbles, level.colors);
      const best = findBestShot(bubbles, colors);
      assert.ok(best, `уровень ${id}: отсутствует результативный следующий бросок`);

      const bubble = { ...best.probe, id: Math.max(...bubbles.map(item => item.id)) + 1 };
      const withShot = [...bubbles, bubble];
      const group = findColorGroup(withShot, bubble.row, bubble.col);
      if (group.length >= 3) {
        const groupIds = new Set(group.map(item => item.id));
        const afterGroup = withShot.filter(item => !groupIds.has(item.id));
        const floatingIds = new Set(findFloating(afterGroup).map(item => item.id));
        bubbles = afterGroup.filter(item => !floatingIds.has(item.id));
      } else {
        bubbles = withShot;
      }
      shotsUsed += 1;
    }

    assert.ok(isLevelCleared(bubbles), `уровень ${id} не пройден за ${level.shots} бросков`);
    assert.ok(shotsUsed <= level.shots, `уровень ${id}: понадобилось ${shotsUsed} бросков`);
  }
});

test('плотность поля и палитра растут, но лимит бросков остаётся проходимым', () => {
  let previousRows = 0;
  let previousColors = 0;
  for (let id = 1; id <= getTotalLevels(); id += 1) {
    const level = getBubbleLevel(id);
    assert.ok(level);
    const bubbles = generateBubbles(level, FIELD_WIDTH);
    assert.ok(level.rows >= previousRows);
    assert.ok(level.colors.length >= previousColors);
    assert.ok(level.shots >= Math.ceil(bubbles.length / 3), `на уровне ${id} не хватает даже на идеальную игру`);
    previousRows = level.rows;
    previousColors = level.colors.length;
  }
});

test('стрелок получает только цвета, которые ещё остались на поле', () => {
  const level = getBubbleLevel(8);
  assert.ok(level);
  const bubbles = generateBubbles(level, FIELD_WIDTH).filter(bubble => bubble.color !== level.colors[0]);
  const active = getActiveBubbleColors(bubbles, level.colors);
  assert.equal(active.includes(level.colors[0]), false);
  assert.ok(active.length > 0);
});

test('соседние чётный и нечётный ряды соприкасаются без визуального зазора', () => {
  const even = hexToPixel(0, 0, FIELD_WIDTH);
  const odd = hexToPixel(1, 0, FIELD_WIDTH);
  const distance = Math.hypot(odd.x - even.x, odd.y - even.y);

  assert.ok(Math.abs(distance - BUBBLE_DIAMETER) < 0.01);
});

test('брошенный шар занимает свободного соседа и не исчезает в занятой ячейке', () => {
  const hit = { row: 0, col: 0 };
  const target = hexToPixel(1, 0, FIELD_WIDTH);
  const first = findAttachmentCell(target.x, target.y, FIELD_WIDTH, [hit], hit);
  assert.deepEqual(first && { row: first.row, col: first.col }, { row: 1, col: 0 });

  const occupied = [hit, { row: 1, col: 0 }];
  const second = findAttachmentCell(target.x, target.y, FIELD_WIDTH, occupied, occupied[1]);
  assert.ok(second);
  assert.equal(occupied.some(cell => cell.row === second.row && cell.col === second.col), false);
  assert.equal(getNeighbors(occupied[1].row, occupied[1].col).some(([row, col]) => row === second.row && col === second.col), true);
});
