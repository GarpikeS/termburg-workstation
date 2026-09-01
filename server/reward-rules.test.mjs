import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FREE_HOUR_PRICE,
  FREE_HOUR_VALID_DAYS,
  activeFreeHourClaim,
} from '../frontend/src/features/rewards/rewardRules.ts';
import { products } from '../frontend/src/data/shopData.ts';

test('shop exposes the agreed pilot rewards and only one merch item', () => {
  const freeHour = products.find(product => product.id === 'ticket-free');
  const vipDay = products.find(product => product.id === 'ticket-vip');
  const merch = products.filter(product => product.category === 'merch');

  assert.equal(FREE_HOUR_PRICE, 50);
  assert.equal(FREE_HOUR_VALID_DAYS, 7);
  assert.equal(freeHour?.price, FREE_HOUR_PRICE);
  assert.equal(freeHour?.currency, 'coins');
  assert.equal(freeHour?.action, 'weekly-reward');
  assert.equal(vipDay?.name, 'VIP — бесплатное посещение');
  assert.equal(vipDay?.description, 'Бесплатное посещение термального комплекса в любой день, включая выходные');
  assert.equal(vipDay?.price, 5000);
  assert.equal(vipDay?.currency, 'coins');
  assert.deepEqual(merch.map(product => product.id), ['merch-hat']);
  assert.equal(merch[0]?.price, 6000);
  assert.equal(merch[0]?.currency, 'coins');
  assert.equal(merch[0]?.action, undefined);
});

test('active free hour remains locked until nextPurchaseAt', () => {
  const now = Date.UTC(2026, 7, 12, 12, 0, 0);
  const claim = {
    id: 'claim-1',
    rewardId: 'ticket-free',
    code: 'TB-12345678',
    purchasedAt: now,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    nextPurchaseAt: now + 7 * 24 * 60 * 60 * 1000,
  };
  assert.equal(activeFreeHourClaim([claim], now)?.id, claim.id);
  assert.equal(activeFreeHourClaim([claim], claim.nextPurchaseAt), null);
});
