import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PET_COMPANION_BOND,
  PET_COMPANION_EXPERIENCE,
  PET_COMPANION_HAPPINESS,
  PET_COMPANION_SESSION_MAX_AGE_MS,
  applyPetCompanionWin,
  createPetCompanionRouteState,
  createPetCompanionSession,
  getPetCompanionGameRoute,
  readPetCompanionSession,
} from '../frontend/src/engine/engine-pet/petCompanion.ts';
import { createPet } from '../frontend/src/engine/engine-pet/petEngine.ts';

const START = new Date(2026, 8, 6, 12, 0, 0).getTime();

test('маршрутная сессия читается только для выбранной игры', () => {
  const cases = [
    ['match3', '/games/match3/play/7'],
    ['game2048', '/games/2048'],
    ['bubbles', '/games/bubbles'],
  ];

  for (const [game, expectedRoute] of cases) {
    const session = createPetCompanionSession('pet-yaromir-1', game, START);
    const routeState = createPetCompanionRouteState(session);
    assert.deepEqual(readPetCompanionSession(routeState, game, START + 1_000), session);
    assert.equal(getPetCompanionGameRoute(game, 7), expectedRoute);
  }

  const match3 = createPetCompanionSession('pet-yaromir-1', 'match3', START);
  assert.equal(readPetCompanionSession(createPetCompanionRouteState(match3), 'bubbles', START + 1_000), null);
});

test('невалидные, просроченные и будущие сессии отклоняются', () => {
  const valid = createPetCompanionSession('pet-yaromir-1', 'match3', START);
  assert.equal(readPetCompanionSession({ petCompanionSession: { ...valid, id: '' } }, 'match3', START), null);
  assert.equal(readPetCompanionSession({ petCompanionSession: { ...valid, adoptionId: 'x'.repeat(101) } }, 'match3', START), null);
  assert.equal(readPetCompanionSession(
    createPetCompanionRouteState(valid),
    'match3',
    START + PET_COMPANION_SESSION_MAX_AGE_MS + 1,
  ), null);
  assert.equal(readPetCompanionSession(
    createPetCompanionRouteState({ ...valid, startedAt: START + 1 }),
    'match3',
    START,
  ), null);
});

test('победа даёт питомцу опыт, привязанность и радость, обновляя этап', () => {
  const base = {
    ...createPet('yaromir', START, 195, 'pet-yaromir-1'),
    bond: 99,
    happiness: 96,
  };
  const session = createPetCompanionSession(base.adoptionId, 'match3', START + 100);
  const result = applyPetCompanionWin(base, session, START + 1_000);

  assert.equal(result.awarded, true);
  assert.equal(result.experience, PET_COMPANION_EXPERIENCE);
  assert.equal(result.bond, 1);
  assert.equal(result.gameLabel, 'Хоровод');
  assert.equal(result.pet.experience, 195 + PET_COMPANION_EXPERIENCE);
  assert.equal(result.pet.companionExperience, PET_COMPANION_EXPERIENCE);
  assert.equal(result.pet.bond, 100);
  assert.equal(result.pet.happiness, 100);
  assert.equal(result.pet.stage, 'teen');
  assert.equal(result.pet.lastUpdated, START + 1_000);
  assert.equal(result.pet.diary[0].kind, 'reward');
  assert.match(result.pet.diary[0].detail, /\+12 опыта.*\+1 к привязанности/);
  assert.equal(PET_COMPANION_HAPPINESS, 8);
});

test('чужой, отсутствующий и просроченный питомец не получают награду', () => {
  const pet = createPet('yaromir', START, 0, 'pet-yaromir-1');
  const foreign = createPetCompanionSession('pet-other-2', 'bubbles', START);
  const mismatch = applyPetCompanionWin(pet, foreign, START + 1_000);
  assert.equal(mismatch.awarded, false);
  assert.strictEqual(mismatch.pet, pet);

  const missing = applyPetCompanionWin(null, foreign, START + 1_000);
  assert.equal(missing.awarded, false);
  assert.equal(missing.pet, null);

  const own = createPetCompanionSession(pet.adoptionId, 'bubbles', START);
  const expired = applyPetCompanionWin(pet, own, START + PET_COMPANION_SESSION_MAX_AGE_MS + 1);
  assert.equal(expired.awarded, false);
  assert.strictEqual(expired.pet, pet);
});

test('одна сессия награждает ровно один раз и не вводит термокоины', () => {
  const pet = createPet('milovan', START, 0, 'pet-milovan-1');
  const session = createPetCompanionSession(pet.adoptionId, 'game2048', START);
  const first = applyPetCompanionWin(pet, session, START + 1_000);
  assert.equal(first.awarded, true);
  assert.deepEqual(first.pet.companionRewardSessionIds, [session.id]);

  const withCrowdedDiary = {
    ...first.pet,
    diary: Array.from({ length: 20 }, (_, index) => ({
      id: `later-entry-${index}`,
      createdAt: START + 1_100 + index,
      title: 'Поздняя запись',
      detail: 'Запись вытеснила маркер награды из дневника.',
      kind: 'care',
    })),
  };
  const snapshot = structuredClone(withCrowdedDiary);
  const duplicate = applyPetCompanionWin(withCrowdedDiary, session, START + 2_000);
  assert.equal(duplicate.awarded, false);
  assert.strictEqual(duplicate.pet, withCrowdedDiary);
  assert.deepEqual(duplicate.pet, snapshot);
  assert.equal(Object.hasOwn(first, 'coins'), false);
  assert.doesNotMatch(JSON.stringify(first), /coin|термоко/i);
});

test('совместная игра учитывает прошедшее время и не воскрешает истощённого питомца', () => {
  const pet = createPet('valkiriya', START, 0, 'pet-valkiriya-1');
  const session = createPetCompanionSession(pet.adoptionId, 'bubbles', START);
  const afterHour = applyPetCompanionWin(pet, session, START + 60 * 60_000);

  assert.equal(afterHour.awarded, true);
  assert.ok(afterHour.pet.hunger < pet.hunger);
  assert.ok(afterHour.pet.energy < pet.energy);

  const exhausted = { ...pet, hunger: 0.1 };
  const exhaustedSession = createPetCompanionSession(exhausted.adoptionId, 'match3', START);
  const rejected = applyPetCompanionWin(exhausted, exhaustedSession, START + 60 * 60_000);
  assert.equal(rejected.awarded, false);
  assert.strictEqual(rejected.pet, exhausted);
});
