import assert from 'node:assert/strict';
import test from 'node:test';
import { dolphinStatusLabel } from './status.mjs';

test('when source API applies redemptions, status says automatic redemption works', () => {
  assert.equal(
    dolphinStatusLabel({ sourceApi: { status: 'active' } }),
    'Dolphin · автоматическое погашение работает',
  );
});

test('when synchronization reports an error, attention status wins', () => {
  assert.equal(
    dolphinStatusLabel({ lastError: 'offline', sourceApi: { status: 'active' } }),
    'Dolphin · требуется внимание',
  );
});

test('when synchronization is running, progress status wins', () => {
  assert.equal(
    dolphinStatusLabel({ running: true, lastError: 'previous error' }),
    'Dolphin · идёт проверка',
  );
});
