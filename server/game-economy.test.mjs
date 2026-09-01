import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DAILY_GAME_REWARD_LIMIT,
  DAILY_TOTAL_REWARD_LIMIT,
  PET_DAILY_REWARD,
  SLAVICH_MILESTONE_REWARDS,
  STANDARD_WIN_REWARD,
  awardDailyGameReward,
  createDailyGameRewards,
  getDailyRewardTotal,
  getSlavichMilestoneRewards,
} from '../frontend/src/data/economy.ts';
import { levels } from '../frontend/src/data/levels.ts';
import { getReward } from '../frontend/src/engine/scorer.ts';
import { getBubbleLevel, getTotalLevels } from '../frontend/src/engine/engine-bubbles/bubbleLevels.ts';
import { createPet, claimDailyGift } from '../frontend/src/engine/engine-pet/petEngine.ts';
import { DEFAULT_SOUND_ENABLED, SOUND_STORAGE_KEY } from '../frontend/src/hooks/useSound.ts';

test('победа в основных играх даёт единую награду в термокоинах', () => {
  assert.equal(STANDARD_WIN_REWARD, 10);
  assert.equal(getReward(1, STANDARD_WIN_REWARD), STANDARD_WIN_REWARD);
  assert.equal(getReward(2, STANDARD_WIN_REWARD), STANDARD_WIN_REWARD);
  assert.equal(getReward(3, STANDARD_WIN_REWARD), STANDARD_WIN_REWARD);
  assert.ok(levels.every(level => level.reward === STANDARD_WIN_REWARD));
  for (let id = 1; id <= getTotalLevels(); id += 1) {
    assert.equal(getBubbleLevel(id)?.reward, STANDARD_WIN_REWARD);
  }
});

test('Славич даёт три равных награды за рубежи 512, 1024 и 2048', () => {
  assert.equal(SLAVICH_MILESTONE_REWARDS.reduce((total, item) => total + item.reward, 0), DAILY_GAME_REWARD_LIMIT);
  assert.deepEqual(SLAVICH_MILESTONE_REWARDS, [
    { tile: 512, reward: 5 },
    { tile: 1024, reward: 10 },
    { tile: 2048, reward: 15 },
  ]);
  assert.deepEqual(getSlavichMilestoneRewards(1024, new Set([512])), [{ tile: 1024, reward: 10 }]);
});

test('ежедневная завершённая цель Пестуна даёт ту же базовую награду', () => {
  const now = Date.UTC(2026, 7, 12, 12, 0, 0);
  const result = claimDailyGift(createPet('yaromir', now), now);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.coins, PET_DAILY_REWARD);
  assert.equal(PET_DAILY_REWARD, STANDARD_WIN_REWARD);
});

test('каждая игра даёт максимум 30, а все игры вместе — максимум 120 в день', () => {
  const now = new Date(2026, 7, 12, 12, 0, 0).getTime();
  let daily = createDailyGameRewards(now);

  for (const source of ['match3', 'game2048', 'bubbles', 'pet']) {
    assert.equal(awardDailyGameReward(daily, source, 10, now).awarded, 10);
    daily = awardDailyGameReward(daily, source, 50, now).rewards;
    assert.equal(daily.earned[source], DAILY_GAME_REWARD_LIMIT);
    assert.equal(awardDailyGameReward(daily, source, 10, now).awarded, 0);
  }

  assert.equal(getDailyRewardTotal(daily, now), DAILY_TOTAL_REWARD_LIMIT);
});

test('дневной счётчик сбрасывается на следующую локальную дату', () => {
  const firstDay = new Date(2026, 7, 12, 12, 0, 0).getTime();
  const nextDay = new Date(2026, 7, 13, 12, 0, 0).getTime();
  const earned = awardDailyGameReward(createDailyGameRewards(firstDay), 'match3', 30, firstDay).rewards;
  const reset = awardDailyGameReward(earned, 'match3', 10, nextDay);

  assert.equal(reset.awarded, 10);
  assert.equal(reset.rewards.earned.match3, 10);
  assert.equal(getDailyRewardTotal(reset.rewards, nextDay), 10);
});

test('звук при первом запуске выключен и имеет постоянный ключ настройки', () => {
  assert.equal(DEFAULT_SOUND_ENABLED, false);
  assert.equal(SOUND_STORAGE_KEY, 'termliny-sound-enabled');
});
