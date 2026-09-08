import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FOUR_GAME_CHALLENGE_ID,
  FOUR_GAME_CHALLENGE_SOURCES,
  addFourGameCompletion,
  backfillFourGameChallengeProgress,
  createFourGameChallengeProgress,
  getFourGameChallengeCount,
  getPetChallengeStageCount,
  isFourGameChallengeComplete,
  mergeFourGameChallengeProgress,
  normalizeFourGameChallengeProgress,
  setFourGameStageCount,
} from '../frontend/src/features/rewards/fourGameChallenge.ts';

const emptyStageCounts = {
  game2048: 0,
  bubbles: 0,
  pet: 0,
  match3: 0,
};

test('отсутствующий или повреждённый прогресс мигрирует в пустую кампанию v1', () => {
  const empty = { version: 1, completedGames: [], stageCounts: emptyStageCounts };

  assert.equal(FOUR_GAME_CHALLENGE_ID, 'four-games-v1');
  assert.deepEqual(createFourGameChallengeProgress(), empty);
  assert.deepEqual(normalizeFourGameChallengeProgress(undefined), empty);
  assert.deepEqual(normalizeFourGameChallengeProgress(null), empty);
  assert.deepEqual(normalizeFourGameChallengeProgress('broken'), empty);
  assert.deepEqual(normalizeFourGameChallengeProgress({ version: 9, completedGames: 'match3' }), empty);
});

test('нормализация удаляет неизвестные и повторные игры и возвращает канонический порядок', () => {
  const normalized = normalizeFourGameChallengeProgress({
    version: 0,
    completedGames: ['pet', 'unknown', 'game2048', 'pet', null, 'bubbles'],
  });

  assert.deepEqual(FOUR_GAME_CHALLENGE_SOURCES, ['game2048', 'bubbles', 'pet', 'match3']);
  assert.deepEqual(normalized, {
    version: 1,
    completedGames: ['game2048', 'bubbles', 'pet'],
    stageCounts: { game2048: 1, bubbles: 1, pet: 1, match3: 0 },
  });
});

test('старый список игр даёт по одному зачёту, а новые счётчики очищаются и ограничиваются', () => {
  const normalized = normalizeFourGameChallengeProgress({
    completedGames: ['pet'],
    stageCounts: { game2048: 99, bubbles: 2.9, pet: -5, match3: '3' },
  });

  assert.deepEqual(normalized, {
    version: 1,
    completedGames: FOUR_GAME_CHALLENGE_SOURCES,
    stageCounts: { game2048: 4, bubbles: 2, pet: 1, match3: 3 },
  });
});

test('повтор одного зачёта идемпотентен, а абсолютный номер этапа растёт монотонно', () => {
  let progress = createFourGameChallengeProgress();
  progress = addFourGameCompletion(progress, 'game2048');
  progress = addFourGameCompletion(progress, 'game2048');
  progress = addFourGameCompletion(progress, 'unknown-game');

  assert.equal(getFourGameChallengeCount(progress), 1);
  assert.equal(isFourGameChallengeComplete(progress), false);

  progress = setFourGameStageCount(progress, 'game2048', 3);
  progress = setFourGameStageCount(progress, 'game2048', 2);
  assert.equal(getFourGameChallengeCount(progress), 3);
  assert.equal(isFourGameChallengeComplete(progress), false);

  progress = setFourGameStageCount(progress, 'game2048', 4);

  assert.equal(getFourGameChallengeCount(progress), 4);
  assert.equal(isFourGameChallengeComplete(progress), true);
  assert.deepEqual(progress.completedGames, ['game2048']);
  assert.equal(progress.stageCounts.game2048, 4);
});

test('любые четыре новых уровня завершают кампанию, а три — нет', () => {
  const layouts = [
    { game2048: 4, bubbles: 0, pet: 0, match3: 0 },
    { game2048: 1, bubbles: 1, pet: 1, match3: 1 },
    { game2048: 2, bubbles: 2, pet: 0, match3: 0 },
    { game2048: 3, bubbles: 1, pet: 0, match3: 0 },
  ];
  for (const stageCounts of layouts) {
    assert.equal(isFourGameChallengeComplete({ stageCounts }), true);
    assert.equal(getFourGameChallengeCount({ stageCounts }), 4);
  }
  assert.equal(isFourGameChallengeComplete({ stageCounts: { game2048: 2, bubbles: 1 } }), false);
});

test('слияние прогресса монотонно и не меняет входные значения', () => {
  const guest = { version: 1, completedGames: ['game2048'], stageCounts: { game2048: 3, bubbles: 0, pet: 0, match3: 0 } };
  const account = { version: 1, completedGames: ['bubbles'], stageCounts: { game2048: 2, bubbles: 1, pet: 0, match3: 0 } };
  const guestSnapshot = structuredClone(guest);
  const accountSnapshot = structuredClone(account);

  const merged = mergeFourGameChallengeProgress(account, guest);
  const mergedAgain = mergeFourGameChallengeProgress(merged, account);

  assert.deepEqual(merged, {
    version: 1,
    completedGames: ['game2048', 'bubbles'],
    stageCounts: { game2048: 3, bubbles: 1, pet: 0, match3: 0 },
  });
  assert.deepEqual(mergedAgain, merged);
  assert.deepEqual(guest, guestSnapshot);
  assert.deepEqual(account, accountSnapshot);
});

test('старые игровые результаты восстанавливают отметки кампании без повторного прохождения', () => {
  const migrated = backfillFourGameChallengeProgress(undefined, {
    currentLevel: 117,
    levels: { 50: { completed: true } },
    game2048LevelsCompleted: 99,
    bubbleLevelsCompleted: 99,
    petDeparture: { experience: 9_899 },
  });

  assert.deepEqual(migrated.completedGames, FOUR_GAME_CHALLENGE_SOURCES);
  assert.deepEqual(migrated.stageCounts, { game2048: 4, bubbles: 4, pet: 4, match3: 4 });
  assert.deepEqual(backfillFourGameChallengeProgress(migrated, {}), migrated);
});

test('опыт совместных игр растит питомца, но сам по себе не закрывает Пестуна', () => {
  const onlyCompanion = backfillFourGameChallengeProgress(undefined, {
    pet: { experience: 108, companionExperience: 108 },
  });
  assert.equal(onlyCompanion.completedGames.includes('pet'), false);

  const careAndCompanion = backfillFourGameChallengeProgress(undefined, {
    pet: { experience: 112, companionExperience: 12 },
  });
  assert.equal(careAndCompanion.completedGames.includes('pet'), true);
  assert.equal(careAndCompanion.stageCounts.pet, 1);
  assert.equal(getPetChallengeStageCount({ experience: 399, companionExperience: 0 }), 3);
  assert.equal(getPetChallengeStageCount({ experience: 400, companionExperience: 0 }), 4);
  assert.equal(getPetChallengeStageCount({ experience: 520, companionExperience: 120 }), 4);
});

test('backfill берёт максимум активного и ушедшего питомца и distinct уровней Хоровода', () => {
  const progress = backfillFourGameChallengeProgress(undefined, {
    currentLevel: 2,
    levels: {
      1: { completed: true },
      3: { completed: true },
      7: { completed: false },
    },
    pet: { experience: 250, companionExperience: 50 },
    petDeparture: { experience: 399, companionExperience: 0 },
  });

  assert.equal(progress.stageCounts.match3, 2);
  assert.equal(progress.stageCounts.pet, 3);
  assert.equal(getFourGameChallengeCount(progress), 4);
});
