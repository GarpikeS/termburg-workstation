import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { startFeedbackService } from './feedback-service.mjs';

const ALLOWED_ORIGIN = 'https://tbgame.ru';
const AUTH_SECRET = 'synthetic-test-secret-that-is-long-enough-for-account-authentication';
const TEST_PASSWORD = '4321';

function authHeaders(extra = {}) {
  return { Origin: ALLOWED_ORIGIN, 'Content-Type': 'application/json', ...extra };
}

function cookieFrom(response) {
  return String(response.headers.get('set-cookie') || '').split(';')[0];
}

function baseProgress(date = '2026-08-15') {
  return {
    currentLevel: 3,
    levels: {
      1: { stars: 3, bestScore: 2200, completed: true },
      2: { stars: 2, bestScore: 1800, completed: true },
    },
    currency: 181,
    dailyGameRewards: { date, earned: { match3: 0, game2048: 0, bubbles: 0, pet: 0 } },
    lives: 4,
    nextLifeAt: null,
    selectedCharacter: 'yaromir',
    tutorialCompleted: true,
    tutorialFlags: ['match3:swap'],
    best2048Score: 1024,
    game2048ProgressVersion: 2,
    game2048LevelsCompleted: 2,
    bubbleLevelsCompleted: 2,
    pet: null,
    petDeparture: null,
    unlockedCharacters: ['yaromir'],
    inventory: {},
    rewardClaims: [],
    cart: [],
    orders: [],
  };
}

async function startTestService(tempRoot, now, accountOptions = {}) {
  return startFeedbackService({
    dataFile: path.join(tempRoot, 'feedback.jsonl'),
    claimsDataFile: path.join(tempRoot, 'claims.jsonl'),
    host: '127.0.0.1',
    port: 0,
    allowedOrigin: ALLOWED_ORIGIN,
    logger: { info() {}, error() {} },
    now,
    accountOptions: {
      databaseFile: path.join(tempRoot, 'accounts.sqlite'),
      authSecret: AUTH_SECRET,
      secureCookies: true,
      ...accountOptions,
    },
  });
}

test('existing accounts keep their city timezone when the timezone column is added', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'termburg-account-migration-'));
  const databaseFile = path.join(tempRoot, 'accounts.sqlite');
  const currentTime = Date.UTC(2026, 8, 4, 7, 0, 0);
  const legacyDatabase = new DatabaseSync(databaseFile);
  legacyDatabase.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      phone_hash TEXT NOT NULL UNIQUE,
      phone_last4 TEXT NOT NULL,
      login_name TEXT,
      is_test INTEGER NOT NULL DEFAULT 0 CHECK(is_test IN (0, 1)),
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      consent_version TEXT NOT NULL,
      consent_at INTEGER NOT NULL,
      registration_device_hash TEXT NOT NULL,
      progress_json TEXT NOT NULL,
      progress_revision INTEGER NOT NULL DEFAULT 1,
      password_salt TEXT,
      password_hash TEXT,
      password_changed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login_at INTEGER NOT NULL
    ) STRICT;
  `);
  legacyDatabase.prepare(`
    INSERT INTO users (
      id, phone_hash, phone_last4, is_test, name, city, consent_version, consent_at,
      registration_device_hash, progress_json, progress_revision, created_at, updated_at, last_login_at
    ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(
    'legacy-user', 'legacy-phone-hash', '0000', 'Старый профиль', 'Зеленогорск',
    'legacy-consent', currentTime, 'legacy-device-hash', JSON.stringify(baseProgress()),
    currentTime, currentTime, currentTime,
  );
  legacyDatabase.close();

  const service = await startTestService(tempRoot, () => currentTime);
  try {
    const migratedDatabase = new DatabaseSync(databaseFile, { readOnly: true });
    const migrated = migratedDatabase.prepare('SELECT city, time_zone, allow_legacy_reward_claims FROM users WHERE id = ?').get('legacy-user');
    migratedDatabase.close();
    assert.equal(migrated.city, 'Зеленогорск');
    assert.equal(migrated.time_zone, 'Asia/Krasnoyarsk');
    assert.equal(migrated.allow_legacy_reward_claims, 1);
  } finally {
    await service.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('hidden game profile logs in by name and remains separate from schedule access', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'termburg-test-profile-'));
  const databaseFile = path.join(tempRoot, 'accounts.sqlite');
  const service = await startTestService(tempRoot, () => Date.UTC(2026, 8, 4, 7, 0, 0), {
    testProfile: {
      username: 'qaHidden',
      password: '4321',
      name: 'Тестовый профиль',
      city: 'Москва',
    },
  });
  const origin = `http://127.0.0.1:${service.port}`;

  try {
    const login = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        identifier: 'QAHIDDEN',
        password: '4321',
        deviceId: 'device-hidden-profile-0001',
      }),
    });
    assert.equal(login.status, 200);
    const body = await login.json();
    assert.equal(body.account.login, 'qaHidden');
    assert.equal(body.account.phoneMasked, '');
    assert.equal(body.account.isTest, true);
    assert.equal(body.account.name, 'Тестовый профиль');

    const database = new DatabaseSync(databaseFile, { readOnly: true });
    const stored = database.prepare('SELECT login_name, is_test, password_hash FROM users WHERE login_name = ?').get('qaHidden');
    database.close();
    assert.equal(stored.login_name, 'qaHidden');
    assert.equal(stored.is_test, 1);
    assert.notEqual(stored.password_hash, '4321');
  } finally {
    await service.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('phone/password registration, session, progress sync, logout and cross-device login work', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'termburg-account-'));
  let currentTime = Date.UTC(2026, 7, 15, 15, 0, 0);
  const service = await startTestService(tempRoot, () => currentTime);
  const origin = `http://127.0.0.1:${service.port}`;
  const firstDevice = 'device-account-test-0001';

  try {
    const config = await fetch(`${origin}/api/auth/config`);
    assert.equal(config.status, 200);
    assert.deepEqual(await config.json(), { available: true, method: 'password', passwordMinLength: 4 });

    const register = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        phone: '8 999 123-45-67',
        password: TEST_PASSWORD,
        name: 'Анна',
        city: '  Владивосток  ',
        timeZone: 'Asia/Vladivostok',
        consent: true,
        consentVersion: 'account-2026-08-15',
        deviceId: firstDevice,
        progress: baseProgress('2026-08-16'),
      }),
    });
    assert.equal(register.status, 201);
    const firstSessionCookie = cookieFrom(register);
    assert.match(firstSessionCookie, /^tb_session=.+/);
    assert.match(String(register.headers.get('set-cookie')), /HttpOnly/);
    assert.match(String(register.headers.get('set-cookie')), /Secure/);
    const registered = await register.json();
    assert.equal(registered.account.name, 'Анна');
    assert.equal(registered.account.city, 'Владивосток');
    assert.equal(registered.account.phoneMasked, '+7 ••• •••-45-67');
    assert.equal(registered.progress.currency, 181);
    assert.equal(registered.progress.game2048ProgressVersion, 2);
    assert.equal(registered.progress.game2048LevelsCompleted, 2);
    assert.equal(registered.progress.dailyGameRewards.date, '2026-08-16');
    assert.deepEqual(registered.progress.fourGameChallenge, {
      version: 1,
      completedGames: ['game2048', 'bubbles', 'match3'],
      stageCounts: { game2048: 2, bubbles: 2, pet: 0, match3: 2 },
    });
    assert.equal(JSON.stringify(registered).includes(TEST_PASSWORD), false);

    const database = new DatabaseSync(path.join(tempRoot, 'accounts.sqlite'), { readOnly: true });
    const storedAccount = database.prepare('SELECT city, time_zone, allow_legacy_reward_claims FROM users WHERE id = ?').get(registered.account.id);
    database.close();
    assert.equal(storedAccount.city, 'Владивосток');
    assert.equal(storedAccount.time_zone, 'Asia/Vladivostok');
    assert.equal(storedAccount.allow_legacy_reward_claims, 0);

    const duplicate = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        phone: '+79991234567', password: TEST_PASSWORD, name: 'Анна', city: 'Владивосток', timeZone: 'Asia/Vladivostok',
        consent: true, consentVersion: 'account-2026-08-15', deviceId: firstDevice, progress: baseProgress('2026-08-16'),
      }),
    });
    assert.equal(duplicate.status, 409);

    const me = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: firstSessionCookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).account.city, 'Владивосток');

    const tampered = baseProgress('2026-08-16');
    tampered.currency = 999_999;
    tampered.currentLevel = 117;
    tampered.levels = {
      ...tampered.levels,
      50: { stars: 3, bestScore: 12_000, completed: true },
      51: { stars: 3, bestScore: 12_500, completed: true },
      100: { stars: 3, bestScore: 15_000, completed: true },
    };
    tampered.game2048LevelsCompleted = 999;
    tampered.bubbleLevelsCompleted = 999;
    tampered.dailyGameRewards.earned = { match3: 30, game2048: 30, bubbles: 30, pet: 30 };
    const firstSync = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: firstSessionCookie }),
      body: JSON.stringify({ progress: tampered, expectedAccountId: registered.account.id }),
    });
    assert.equal(firstSync.status, 200);
    const firstSyncProgress = (await firstSync.json()).progress;
    assert.equal(firstSyncProgress.currency, 301);
    assert.equal(firstSyncProgress.currentLevel, 51);
    assert.equal(firstSyncProgress.levels[50]?.completed, true);
    assert.equal(firstSyncProgress.levels[51], undefined);
    assert.equal(firstSyncProgress.levels[100], undefined);
    assert.equal(firstSyncProgress.game2048LevelsCompleted, 4);
    assert.equal(firstSyncProgress.bubbleLevelsCompleted, 50);
    assert.deepEqual(firstSyncProgress.fourGameChallenge.completedGames, ['game2048', 'bubbles', 'match3']);

    const repeatedSync = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: firstSessionCookie }),
      body: JSON.stringify({ progress: tampered, expectedAccountId: registered.account.id }),
    });
    assert.equal((await repeatedSync.json()).progress.currency, 301);

    const activePetProgress = {
      ...firstSyncProgress,
      pet: {
        characterId: 'yaromir',
        experience: 9_899,
        lastUpdated: currentTime + 100,
      },
      petDeparture: null,
    };
    const activePetSync = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: firstSessionCookie }),
      body: JSON.stringify({ progress: activePetProgress, expectedAccountId: registered.account.id }),
    });
    const activePetSaved = (await activePetSync.json()).progress;
    assert.equal(activePetSaved.pet.experience, 9_899);
    assert.equal(activePetSaved.pet.adoptionId, 'legacy-yaromir');
    assert.equal(activePetSaved.petDeparture, null);

    const departureProgress = {
      ...activePetSaved,
      pet: null,
      petDeparture: {
        characterId: 'yaromir',
        name: 'Яромир',
        depletedStat: 'hunger',
        departedAt: currentTime + 200,
        experience: 9_899,
      },
    };
    const departureSync = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: firstSessionCookie }),
      body: JSON.stringify({ progress: departureProgress, expectedAccountId: registered.account.id }),
    });
    const departureSaved = (await departureSync.json()).progress;
    assert.equal(departureSaved.pet, null);
    assert.equal(departureSaved.petDeparture.adoptionId, 'legacy-yaromir');
    assert.equal(departureSaved.petDeparture.experience, 9_899);

    const stalePetSync = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: firstSessionCookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          ...departureSaved,
          pet: {
            adoptionId: 'pet-unrelated-stale',
            characterId: 'pereslav',
            experience: 100,
            lastUpdated: currentTime + 250,
          },
          petDeparture: null,
        },
      }),
    });
    assert.equal(stalePetSync.status, 200);
    const stalePetIgnored = (await stalePetSync.json()).progress;
    assert.equal(stalePetIgnored.pet, null);
    assert.equal(stalePetIgnored.petDeparture.experience, 9_899);

    const adoptedPetSync = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: firstSessionCookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          ...departureSaved,
          pet: {
            adoptionId: 'pet-valkiriya-second',
            characterId: 'valkiriya',
            experience: 9_899,
            lastUpdated: currentTime + 300,
          },
          petDeparture: departureSaved.petDeparture,
        },
      }),
    });
    const adoptedPetSaved = (await adoptedPetSync.json()).progress;
    assert.equal(adoptedPetSaved.pet.characterId, 'valkiriya');
    assert.equal(adoptedPetSaved.petDeparture, null);

    const staleExperienceSync = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: firstSessionCookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          ...adoptedPetSaved,
          pet: {
            ...adoptedPetSaved.pet,
            experience: 100,
            lastUpdated: currentTime + 400,
          },
        },
      }),
    });
    assert.equal(staleExperienceSync.status, 200);
    const staleExperienceIgnored = (await staleExperienceSync.json()).progress;
    assert.equal(staleExperienceIgnored.pet.experience, 9_899);

    const staleDepartureSync = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: firstSessionCookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          ...staleExperienceIgnored,
          pet: null,
          petDeparture: {
            adoptionId: 'legacy-yaromir',
            characterId: 'yaromir',
            name: 'Яромир',
            depletedStat: 'hunger',
            departedAt: currentTime + 500,
            experience: 100,
          },
        },
      }),
    });
    assert.equal(staleDepartureSync.status, 200);
    const staleDepartureIgnored = (await staleDepartureSync.json()).progress;
    assert.equal(staleDepartureIgnored.pet.characterId, 'valkiriya');
    assert.equal(staleDepartureIgnored.pet.experience, 9_899);
    assert.equal(staleDepartureIgnored.petDeparture, null);

    const atomicReplacementSync = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: firstSessionCookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          ...staleDepartureIgnored,
          pet: {
            adoptionId: 'pet-pereslav-third',
            characterId: 'pereslav',
            experience: 9_899,
            lastUpdated: currentTime + 700,
          },
          petDeparture: {
            adoptionId: 'pet-valkiriya-second',
            characterId: 'valkiriya',
            name: 'Валькирия',
            depletedStat: 'cleanliness',
            departedAt: currentTime + 600,
            experience: 9_899,
          },
        },
      }),
    });
    assert.equal(atomicReplacementSync.status, 200);
    const atomicReplacementSaved = (await atomicReplacementSync.json()).progress;
    assert.equal(atomicReplacementSaved.pet.characterId, 'pereslav');
    assert.equal(atomicReplacementSaved.pet.experience, 9_899);
    assert.equal(atomicReplacementSaved.petDeparture, null);

    const wrongAccountSync = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: firstSessionCookie }),
      body: JSON.stringify({ progress: tampered, expectedAccountId: 'another-account' }),
    });
    assert.equal(wrongAccountSync.status, 409);
    assert.equal((await wrongAccountSync.json()).code, 'ACCOUNT_SESSION_CHANGED');

    const logout = await fetch(`${origin}/api/auth/logout`, {
      method: 'POST', headers: { Origin: ALLOWED_ORIGIN, Cookie: firstSessionCookie },
    });
    assert.equal(logout.status, 200);
    assert.match(String(logout.headers.get('set-cookie')), /Max-Age=0/);
    assert.equal((await fetch(`${origin}/api/auth/me`, { headers: { Cookie: firstSessionCookie } })).status, 401);

    currentTime += 1000;
    const login = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ phone: '+7 999 123-45-67', password: TEST_PASSWORD, deviceId: 'device-account-test-0002' }),
    });
    assert.equal(login.status, 200);
    const loggedIn = await login.json();
    assert.equal(loggedIn.account.name, 'Анна');
    assert.equal(loggedIn.progress.currency, 301);
  } finally {
    await service.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('registration preserves a departed pet level from guest progress', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'termburg-account-pet-departure-'));
  const currentTime = Date.UTC(2026, 7, 19, 12, 0, 0);
  const service = await startTestService(tempRoot, () => currentTime);
  const origin = `http://127.0.0.1:${service.port}`;
  const progress = baseProgress('2026-08-19');
  progress.petDeparture = {
    characterId: 'yaromir',
    name: 'Яромир',
    depletedStat: 'energy',
    departedAt: currentTime - 1_000,
    experience: 9_899,
  };

  try {
    const register = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        phone: '+7 999 555-44-33',
        password: TEST_PASSWORD,
        name: 'Гость',
        city: 'Казань',
        timeZone: 'Europe/Moscow',
        consent: true,
        consentVersion: 'account-2026-08-15',
        deviceId: 'device-pet-departure-0001',
        progress,
      }),
    });
    assert.equal(register.status, 201);
    const sessionCookie = cookieFrom(register);
    const registered = await register.json();
    assert.equal(registered.progress.pet, null);
    assert.equal(registered.progress.petDeparture.characterId, 'yaromir');
    assert.equal(registered.progress.petDeparture.experience, 9_899);
    assert.equal(registered.progress.petDeparture.companionExperience, 0);

    const staleLegacyPet = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: sessionCookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          ...registered.progress,
          pet: {
            adoptionId: 'legacy-yaromir',
            characterId: 'yaromir',
            experience: 100,
            lastUpdated: currentTime + 100,
          },
          petDeparture: null,
        },
      }),
    });
    assert.equal(staleLegacyPet.status, 200);
    const staleLegacyPetIgnored = (await staleLegacyPet.json()).progress;
    assert.equal(staleLegacyPetIgnored.pet, null);
    assert.equal(staleLegacyPetIgnored.petDeparture.experience, 9_899);

    const currentAdoption = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: sessionCookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          ...staleLegacyPetIgnored,
          pet: {
            adoptionId: 'pet-valkiriya-after-legacy-departure',
            characterId: 'valkiriya',
            experience: 9_899,
            lastUpdated: currentTime + 200,
          },
          petDeparture: staleLegacyPetIgnored.petDeparture,
        },
      }),
    });
    assert.equal(currentAdoption.status, 200);
    const currentAdoptionSaved = (await currentAdoption.json()).progress;
    assert.equal(currentAdoptionSaved.pet.characterId, 'valkiriya');
    assert.equal(currentAdoptionSaved.pet.experience, 9_899);
    assert.equal(currentAdoptionSaved.petDeparture, null);
  } finally {
    await service.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('legacy Slavich micro-levels migrate once and never erase current four-stage progress', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'termburg-account-slavich-v2-'));
  const currentTime = Date.UTC(2026, 8, 7, 11, 0, 0);
  const service = await startTestService(tempRoot, () => currentTime);
  const origin = `http://127.0.0.1:${service.port}`;

  try {
    const register = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        phone: '+7 999 444-30-01',
        password: TEST_PASSWORD,
        name: 'Славич',
        city: 'Казань',
        timeZone: 'Europe/Moscow',
        consent: true,
        consentVersion: 'account-2026-08-15',
        deviceId: 'device-slavich-migration-0001',
        progress: {
          best2048Score: 64,
          game2048LevelsCompleted: 1,
          fourGameChallenge: { version: 1, completedGames: [] },
        },
      }),
    });
    assert.equal(register.status, 201);
    const cookie = cookieFrom(register);
    const registered = await register.json();
    assert.equal(registered.progress.game2048ProgressVersion, 2);
    assert.equal(registered.progress.game2048LevelsCompleted, 1);
    assert.equal(registered.progress.fourGameChallenge.stageCounts.game2048, 1);

    const migratedSync = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: cookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          best2048Score: 1600,
          game2048LevelsCompleted: 25,
        },
      }),
    });
    assert.equal(migratedSync.status, 200);
    const migrated = (await migratedSync.json()).progress;
    assert.equal(migrated.game2048LevelsCompleted, 2);
    assert.equal(migrated.fourGameChallenge.stageCounts.game2048, 2);

    const currentSync = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: cookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          game2048ProgressVersion: 2,
          game2048LevelsCompleted: 3,
          best2048Score: 0,
        },
      }),
    });
    assert.equal(currentSync.status, 200);
    const current = (await currentSync.json()).progress;
    assert.equal(current.game2048LevelsCompleted, 3);
    assert.equal(current.fourGameChallenge.stageCounts.game2048, 3);

    const staleLegacySync = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: cookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: { best2048Score: 64, game2048LevelsCompleted: 1 },
      }),
    });
    const afterStale = (await staleLegacySync.json()).progress;
    assert.equal(afterStale.game2048LevelsCompleted, 3);
    assert.equal(afterStale.fourGameChallenge.stageCounts.game2048, 3);
  } finally {
    await service.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('companion pet progress is sanitized, merged, transferred and excluded from pet challenge XP', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'termburg-account-pet-companion-'));
  const currentTime = Date.UTC(2026, 8, 7, 12, 0, 0);
  const service = await startTestService(tempRoot, () => currentTime);
  const origin = `http://127.0.0.1:${service.port}`;
  const progress = baseProgress('2026-09-07');
  progress.currentLevel = 1;
  progress.levels = {};
  progress.game2048LevelsCompleted = 0;
  progress.bubbleLevelsCompleted = 0;
  progress.fourGameChallenge = { version: 1, completedGames: [] };
  progress.pet = {
    adoptionId: 'pet-yaromir-companion',
    characterId: 'yaromir',
    name: 'Яромир',
    experience: 108,
    companionExperience: 12,
    companionRewardSessionIds: [
      'session-a',
      ' session-b ',
      'session-a',
      'x'.repeat(80),
      '',
      42,
    ],
    lastUpdated: currentTime - 100,
  };

  try {
    const register = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        phone: '+7 999 444-33-22',
        password: TEST_PASSWORD,
        name: 'Спутник',
        city: 'Казань',
        timeZone: 'Europe/Moscow',
        consent: true,
        consentVersion: 'account-2026-08-15',
        deviceId: 'device-pet-companion-0001',
        progress,
      }),
    });
    assert.equal(register.status, 201);
    const cookie = cookieFrom(register);
    const registered = await register.json();
    assert.equal(registered.progress.pet.experience, 108);
    assert.equal(registered.progress.pet.companionExperience, 12);
    assert.deepEqual(registered.progress.pet.companionRewardSessionIds, [
      'session-a',
      'session-b',
      'x'.repeat(72),
    ]);
    assert.deepEqual(registered.progress.fourGameChallenge.completedGames, []);

    const mergeResponse = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: cookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          ...registered.progress,
          pet: {
            ...registered.progress.pet,
            experience: 110,
            companionExperience: 1,
            companionRewardSessionIds: ['session-b', 'session-c'],
            lastUpdated: currentTime + 100,
          },
        },
      }),
    });
    assert.equal(mergeResponse.status, 200);
    const merged = (await mergeResponse.json()).progress;
    assert.equal(merged.pet.companionExperience, 12);
    assert.deepEqual(merged.pet.companionRewardSessionIds, [
      'session-a',
      'session-b',
      'x'.repeat(72),
      'session-c',
    ]);
    assert.deepEqual(merged.fourGameChallenge.completedGames, []);

    const cappedIds = Array.from({ length: 300 }, (_, index) => `session-${String(index).padStart(3, '0')}`);
    const capResponse = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: cookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          ...merged,
          pet: {
            ...merged.pet,
            companionRewardSessionIds: cappedIds,
            lastUpdated: currentTime + 200,
          },
        },
      }),
    });
    assert.equal(capResponse.status, 200);
    const capped = (await capResponse.json()).progress;
    assert.equal(capped.pet.companionRewardSessionIds.length, 256);
    assert.equal(capped.pet.companionRewardSessionIds[0], 'session-044');
    assert.equal(capped.pet.companionRewardSessionIds.at(-1), 'session-299');

    const departureResponse = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: cookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          ...capped,
          pet: null,
          petDeparture: {
            adoptionId: capped.pet.adoptionId,
            characterId: capped.pet.characterId,
            name: capped.pet.name,
            depletedStat: 'hunger',
            departedAt: currentTime + 300,
            experience: 110,
            companionExperience: 0,
          },
        },
      }),
    });
    assert.equal(departureResponse.status, 200);
    const departed = (await departureResponse.json()).progress;
    assert.equal(departed.pet, null);
    assert.equal(departed.petDeparture.experience, 110);
    assert.equal(departed.petDeparture.companionExperience, 12);
    assert.deepEqual(departed.fourGameChallenge.completedGames, []);

    const adoptionResponse = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: cookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          ...departed,
          pet: {
            adoptionId: 'pet-valkiriya-after-companion',
            characterId: 'valkiriya',
            name: 'Валькирия',
            experience: 110,
            companionExperience: 0,
            companionRewardSessionIds: ['new-session'],
            lastUpdated: currentTime + 400,
          },
          petDeparture: departed.petDeparture,
        },
      }),
    });
    assert.equal(adoptionResponse.status, 200);
    const adopted = (await adoptionResponse.json()).progress;
    assert.equal(adopted.pet.companionExperience, 12);
    assert.deepEqual(adopted.pet.companionRewardSessionIds, ['new-session']);
    assert.deepEqual(adopted.fourGameChallenge.completedGames, []);

    const challengeResponse = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: cookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          ...adopted,
          pet: {
            ...adopted.pet,
            experience: 112,
            companionExperience: 12,
            lastUpdated: currentTime + 500,
          },
        },
      }),
    });
    assert.equal(challengeResponse.status, 200);
    const challengeSaved = (await challengeResponse.json()).progress;
    assert.deepEqual(challengeSaved.fourGameChallenge.completedGames, ['pet']);

    const clampResponse = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: cookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          ...challengeSaved,
          pet: {
            ...challengeSaved.pet,
            companionExperience: 999_999,
            lastUpdated: currentTime + 600,
          },
        },
      }),
    });
    assert.equal(clampResponse.status, 200);
    const clamped = (await clampResponse.json()).progress;
    assert.equal(clamped.pet.companionExperience, clamped.pet.experience);
  } finally {
    await service.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('parallel companion wins from phone and tablet keep both rewards', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'termburg-account-pet-parallel-'));
  const currentTime = Date.UTC(2026, 8, 7, 14, 0, 0);
  const service = await startTestService(tempRoot, () => currentTime);
  const origin = `http://127.0.0.1:${service.port}`;
  const progress = baseProgress('2026-09-07');
  progress.currentLevel = 1;
  progress.levels = {};
  progress.game2048LevelsCompleted = 0;
  progress.bubbleLevelsCompleted = 0;
  progress.fourGameChallenge = { version: 1, completedGames: [] };
  progress.pet = {
    adoptionId: 'pet-yaromir-parallel',
    characterId: 'yaromir',
    name: 'Яромир',
    experience: 0,
    companionExperience: 0,
    companionRewardSessionIds: [],
    lastUpdated: currentTime,
  };

  try {
    const register = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        phone: '+7 999 555-44-33',
        password: TEST_PASSWORD,
        name: 'Два устройства',
        city: 'Казань',
        timeZone: 'Europe/Moscow',
        consent: true,
        consentVersion: 'account-2026-08-15',
        deviceId: 'device-pet-parallel-0001',
        progress,
      }),
    });
    assert.equal(register.status, 201);
    const cookie = cookieFrom(register);
    const registered = await register.json();
    const commonSnapshot = registered.progress;

    const saveBranch = (sessionId, lastUpdated) => fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: cookie }),
      body: JSON.stringify({
        expectedAccountId: registered.account.id,
        progress: {
          ...commonSnapshot,
          pet: {
            ...commonSnapshot.pet,
            experience: 12,
            companionExperience: 12,
            companionRewardSessionIds: [sessionId],
            lastUpdated,
          },
        },
      }),
    });

    // The newer tablet snapshot reaches the server first; the older phone
    // snapshot arrives later and must still contribute its distinct win.
    const tabletResponse = await saveBranch('parallel-tablet-win', currentTime + 200);
    assert.equal(tabletResponse.status, 200);
    const phoneResponse = await saveBranch('parallel-phone-win', currentTime + 100);
    assert.equal(phoneResponse.status, 200);
    const merged = (await phoneResponse.json()).progress;

    assert.equal(merged.pet.experience, 24);
    assert.equal(merged.pet.companionExperience, 24);
    assert.deepEqual(merged.pet.companionRewardSessionIds, [
      'parallel-tablet-win',
      'parallel-phone-win',
    ]);
  } finally {
    await service.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('four-game challenge progress is allowlisted and cannot regress across stale or parallel sync', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'termburg-account-four-games-'));
  const currentTime = Date.UTC(2026, 7, 20, 12, 0, 0);
  const service = await startTestService(tempRoot, () => currentTime);
  const origin = `http://127.0.0.1:${service.port}`;
  const progress = baseProgress('2026-08-20');
  progress.currentLevel = 1;
  progress.levels = {};
  progress.game2048LevelsCompleted = 0;
  progress.bubbleLevelsCompleted = 0;
  progress.fourGameChallenge = {
    version: 999,
    completedGames: ['pet', 'unknown-game', 'pet'],
  };

  try {
    const register = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        phone: '8 999 555-12-34',
        password: TEST_PASSWORD,
        name: 'Мария',
        city: 'Казань',
        timeZone: 'Europe/Moscow',
        consent: true,
        consentVersion: 'account-2026-08-15',
        deviceId: 'device-four-game-test-0001',
        progress,
      }),
    });
    assert.equal(register.status, 201);
    const cookie = cookieFrom(register);
    const registered = await register.json();
    assert.deepEqual(registered.progress.fourGameChallenge, {
      version: 1,
      completedGames: ['pet'],
      stageCounts: { game2048: 0, bubbles: 0, pet: 1, match3: 0 },
    });

    const disjointSyncs = await Promise.all([
      fetch(`${origin}/api/account/progress`, {
        method: 'PUT',
        headers: authHeaders({ Cookie: cookie }),
        body: JSON.stringify({
          expectedAccountId: registered.account.id,
          progress: {
            ...registered.progress,
            fourGameChallenge: { version: 1, completedGames: ['game2048', 'not-a-game'] },
          },
        }),
      }),
      fetch(`${origin}/api/account/progress`, {
        method: 'PUT',
        headers: authHeaders({ Cookie: cookie }),
        body: JSON.stringify({
          expectedAccountId: registered.account.id,
          progress: {
            ...registered.progress,
            fourGameChallenge: { version: 1, completedGames: ['match3'] },
          },
        }),
      }),
    ]);
    assert.deepEqual(disjointSyncs.map(response => response.status), [200, 200]);
    await Promise.all(disjointSyncs.map(response => response.json()));

    const afterParallelSync = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(afterParallelSync.status, 200);
    const afterParallelSaved = await afterParallelSync.json();
    assert.deepEqual(afterParallelSaved.progress.fourGameChallenge, {
      version: 1,
      completedGames: ['game2048', 'pet', 'match3'],
      stageCounts: { game2048: 1, bubbles: 0, pet: 1, match3: 1 },
    });

    const staleSync = await fetch(`${origin}/api/account/progress`, {
      method: 'PUT',
      headers: authHeaders({ Cookie: cookie }),
      body: JSON.stringify({ progress: registered.progress, expectedAccountId: registered.account.id }),
    });
    assert.equal(staleSync.status, 200);
    const staleSaved = await staleSync.json();
    assert.deepEqual(staleSaved.progress.fourGameChallenge, {
      version: 1,
      completedGames: ['game2048', 'pet', 'match3'],
      stageCounts: { game2048: 1, bubbles: 0, pet: 1, match3: 1 },
    });

    const login = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        identifier: '8 999 555-12-34',
        password: TEST_PASSWORD,
        deviceId: 'device-four-game-test-0002',
        fourGameChallenge: {
          version: 42,
          completedGames: ['bubbles', 'unknown-game'],
        },
        progress: {
          currency: 999_999,
          fourGameChallenge: { version: 1, completedGames: [] },
        },
      }),
    });
    assert.equal(login.status, 200);
    const loggedIn = await login.json();
    assert.deepEqual(loggedIn.progress.fourGameChallenge, {
      version: 1,
      completedGames: ['game2048', 'bubbles', 'pet', 'match3'],
      stageCounts: { game2048: 1, bubbles: 1, pet: 1, match3: 1 },
    });
    assert.equal(loggedIn.progress.currency, registered.progress.currency);
    assert.equal(loggedIn.revision, staleSaved.revision + 1);

    const repeatedLogin = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        identifier: '8 999 555-12-34',
        password: TEST_PASSWORD,
        deviceId: 'device-four-game-test-0003',
        fourGameChallenge: { version: 1, completedGames: [] },
      }),
    });
    assert.equal(repeatedLogin.status, 200);
    const repeatedLoginBody = await repeatedLogin.json();
    assert.deepEqual(repeatedLoginBody.progress.fourGameChallenge, loggedIn.progress.fourGameChallenge);
    assert.equal(repeatedLoginBody.revision, loggedIn.revision);
  } finally {
    await service.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('password auth validates origin and rate-limits repeated failures without revealing account existence', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'termburg-account-security-'));
  let currentTime = Date.UTC(2026, 7, 15, 12, 0, 0);
  const service = await startTestService(tempRoot, () => currentTime);
  const origin = `http://127.0.0.1:${service.port}`;
  const deviceId = 'device-account-lock-0001';

  try {
    const foreign = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders({ Origin: 'https://example.com' }),
      body: JSON.stringify({ phone: '89990000001', password: TEST_PASSWORD, name: 'Иван', city: 'Москва', consent: true, consentVersion: 'account-2026-08-15', deviceId, progress: baseProgress() }),
    });
    assert.equal(foreign.status, 403);

    const emptyCity = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ phone: '89990000001', password: TEST_PASSWORD, name: 'Иван', city: '   ', consent: true, consentVersion: 'account-2026-08-15', deviceId, progress: baseProgress() }),
    });
    assert.equal(emptyCity.status, 400);
    assert.deepEqual(await emptyCity.json(), { error: 'Укажите город.', field: 'city' });

    const shortPassword = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ phone: '89990000001', password: '123', name: 'Иван', city: 'Казань', consent: true, consentVersion: 'account-2026-08-15', deviceId, progress: baseProgress() }),
    });
    assert.equal(shortPassword.status, 400);
    assert.deepEqual(await shortPassword.json(), {
      error: 'Пароль должен содержать не менее 4 символов.',
      field: 'password',
    });

    const register = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ phone: '89990000001', password: TEST_PASSWORD, name: 'Иван', city: 'Казань', consent: true, consentVersion: 'account-2026-08-15', deviceId, progress: baseProgress() }),
    });
    assert.equal(register.status, 201);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const invalid = await fetch(`${origin}/api/auth/login`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ phone: '89990000001', password: 'definitely-wrong', deviceId }),
      });
      assert.equal(invalid.status, 401);
      assert.equal((await invalid.json()).error, 'Неверный телефон, логин или пароль.');
    }

    const locked = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ phone: '89990000001', password: TEST_PASSWORD, deviceId }),
    });
    assert.equal(locked.status, 429);
    assert.equal((await locked.json()).code, 'LOGIN_RATE_LIMIT');

    currentTime += 15 * 60 * 1000 + 1;
    const recovered = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ phone: '89990000001', password: TEST_PASSWORD, deviceId }),
    });
    assert.equal(recovered.status, 200);

    const unknown = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: authHeaders({ 'X-Real-IP': '203.0.113.55' }),
      body: JSON.stringify({ phone: '89990000002', password: 'definitely-wrong', deviceId }),
    });
    assert.equal(unknown.status, 401);
    assert.equal((await unknown.json()).error, 'Неверный телефон, логин или пароль.');
  } finally {
    await service.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});
