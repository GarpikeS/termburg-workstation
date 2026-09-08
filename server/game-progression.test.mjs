import assert from 'node:assert/strict';
import test from 'node:test';
import { bathhouses, getBathhouseEntryLevel } from '../frontend/src/data/bathhouses.ts';
import { getLevelsForBathhouse, levels as match3Levels } from '../frontend/src/data/levels.ts';
import { getBubbleLevel, getTotalLevels } from '../frontend/src/engine/engine-bubbles/bubbleLevels.ts';
import { getPetLevel, getPetLevelProgress } from '../frontend/src/engine/engine-pet/petEngine.ts';
import {
  GAME_LEVEL_TOTAL,
  SLAVICH_LEVEL_TARGETS,
  SLAVICH_LEVEL_TOTAL,
  getNextPlayableLevel,
  getNextPlayableSlavichLevel,
  getSlavichLevelTarget,
  isSlavichLevelComplete,
  migrateLegacySlavichCompletedLevels,
} from '../frontend/src/data/gameProgression.ts';

test('Хоровод и Бирюльки содержат непрерывные 50 уровней', () => {
  assert.equal(GAME_LEVEL_TOTAL, 50);
  assert.equal(match3Levels.length, GAME_LEVEL_TOTAL);
  assert.deepEqual(match3Levels.map(level => level.id), Array.from({ length: GAME_LEVEL_TOTAL }, (_, index) => index + 1));
  assert.equal(bathhouses.length, 10);
  assert.deepEqual(
    bathhouses.map(bathhouse => bathhouse.levelsRange),
    Array.from({ length: 10 }, (_, index) => [index * 5 + 1, (index + 1) * 5]),
  );
  for (const bathhouse of bathhouses) {
    assert.deepEqual(
      getLevelsForBathhouse(bathhouse.id).map(level => level.id),
      Array.from({ length: 5 }, (_, index) => bathhouse.levelsRange[0] + index),
    );
  }
  const finalMatch3Level = match3Levels.at(-1);
  assert.equal(finalMatch3Level?.moves, 6);
  assert.deepEqual(finalMatch3Level?.objectives.map(objective => objective.target), [42, 35]);

  assert.equal(getTotalLevels(), GAME_LEVEL_TOTAL);
  for (let id = 1; id <= GAME_LEVEL_TOTAL; id += 1) {
    assert.equal(getBubbleLevel(id)?.id, id);
  }
  assert.equal(getBubbleLevel(GAME_LEVEL_TOTAL + 1), undefined);
});

test('домик Хоровода сразу ведёт в подходящий уровень без второй карты', () => {
  assert.equal(getBathhouseEntryLevel(bathhouses[0], 1), 1);
  assert.equal(getBathhouseEntryLevel(bathhouses[0], 4), 4);
  assert.equal(getBathhouseEntryLevel(bathhouses[0], 6), 5);
  assert.equal(getBathhouseEntryLevel(bathhouses[1], 5), null);
  assert.equal(getBathhouseEntryLevel(bathhouses[1], 6), 6);
  assert.equal(getBathhouseEntryLevel(bathhouses[1], 8), 8);
  assert.equal(getBathhouseEntryLevel(bathhouses[9], 51), 50);
});

test('Славич имеет четыре крупных этапа при прежней финальной цели по очкам', () => {
  assert.equal(getNextPlayableLevel(0), 1);
  assert.equal(getNextPlayableLevel(49), 50);
  assert.equal(getNextPlayableLevel(50), 50);
  assert.equal(getNextPlayableLevel(100), 50);
  assert.equal(SLAVICH_LEVEL_TOTAL, 4);
  assert.deepEqual(SLAVICH_LEVEL_TARGETS, [800, 1600, 2400, 3200]);
  assert.equal(getNextPlayableSlavichLevel(0), 1);
  assert.equal(getNextPlayableSlavichLevel(3), 4);
  assert.equal(getNextPlayableSlavichLevel(50), 4);
  assert.equal(getSlavichLevelTarget(1), 800);
  assert.equal(getSlavichLevelTarget(4), 3200);

  for (let level = 1; level <= SLAVICH_LEVEL_TOTAL; level += 1) {
    const target = getSlavichLevelTarget(level);
    assert.equal(isSlavichLevelComplete(target - 1, level), false);
    assert.equal(isSlavichLevelComplete(target, level), true);
    if (level > 1) assert.ok(target > getSlavichLevelTarget(level - 1));
  }
});

test('старые микролевелы Славича мигрируют один раз без потери первого зачёта', () => {
  assert.equal(migrateLegacySlavichCompletedLevels(0, 0), 0);
  assert.equal(migrateLegacySlavichCompletedLevels(1, 0), 1);
  assert.equal(migrateLegacySlavichCompletedLevels(12, 0), 1);
  assert.equal(migrateLegacySlavichCompletedLevels(13, 0), 1);
  assert.equal(migrateLegacySlavichCompletedLevels(24, 0), 1);
  assert.equal(migrateLegacySlavichCompletedLevels(25, 0), 2);
  assert.equal(migrateLegacySlavichCompletedLevels(37, 0), 2);
  assert.equal(migrateLegacySlavichCompletedLevels(38, 0), 3);
  assert.equal(migrateLegacySlavichCompletedLevels(49, 0), 3);
  assert.equal(migrateLegacySlavichCompletedLevels(50, 0), 4);
  assert.equal(migrateLegacySlavichCompletedLevels(0, 1600), 2);
});

test('Пестун растёт до 50 уровня без изменения накопленного опыта', () => {
  assert.equal(getPetLevel({ experience: 0 }), 1);
  assert.equal(getPetLevel({ experience: 4_899 }), 49);
  assert.equal(getPetLevel({ experience: 4_900 }), 50);
  assert.equal(getPetLevel({ experience: 99_999 }), 50);
  assert.deepEqual(getPetLevelProgress({ experience: 4_900 }), { current: 100, max: 100 });
});
