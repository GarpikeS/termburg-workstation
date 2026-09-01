import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getTermlinById,
  isTermlinUnlocked,
  syncTermlinUnlocks,
} from '../frontend/src/data/termliny.ts';

function progress(overrides = {}) {
  return {
    currentLevel: 1,
    levels: {},
    currency: 0,
    dailyGameRewards: null,
    lives: 5,
    nextLifeAt: null,
    selectedCharacter: 'yaromir',
    tutorialCompleted: false,
    tutorialFlags: [],
    best2048Score: 0,
    bubbleLevelsCompleted: 0,
    pet: null,
    petDeparture: null,
    unlockedCharacters: ['yaromir'],
    inventory: {},
    rewardClaims: [],
    cart: [],
    orders: [],
    ...overrides,
  };
}

test('термлины открываются конкретными достижениями, а не абстрактным уровнем', () => {
  const valkiriya = getTermlinById('valkiriya');
  const pereslav = getTermlinById('pereslav');
  const kazimir = getTermlinById('kazimir');
  assert.ok(valkiriya && pereslav && kazimir);

  assert.equal(isTermlinUnlocked(valkiriya, progress()), false);
  assert.equal(isTermlinUnlocked(valkiriya, progress({
    levels: {
      1: { completed: true, stars: 1, bestScore: 100 },
      2: { completed: true, stars: 1, bestScore: 100 },
      3: { completed: true, stars: 1, bestScore: 100 },
    },
  })), true);
  assert.equal(isTermlinUnlocked(pereslav, progress({ best2048Score: 1000 })), true);
  assert.equal(isTermlinUnlocked(kazimir, progress({ bubbleLevelsCompleted: 3 })), true);
});

test('сложный термлин требует выполнения всех перечисленных условий', () => {
  const milovan = getTermlinById('milovan');
  assert.ok(milovan);
  const tenMatch3Levels = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [
    index + 1,
    { completed: true, stars: 1, bestScore: 100 },
  ]));

  assert.equal(isTermlinUnlocked(milovan, progress({ levels: tenMatch3Levels })), false);
  assert.equal(isTermlinUnlocked(milovan, progress({
    levels: tenMatch3Levels,
    bubbleLevelsCompleted: 5,
  })), true);
});

test('выполненное достижение автоматически попадает в список открытых термлинов', () => {
  const next = syncTermlinUnlocks(progress({ best2048Score: 1000 }));
  assert.ok(next.unlockedCharacters.includes('pereslav'));
});
