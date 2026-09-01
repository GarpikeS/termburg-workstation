import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HAPTIC_PATTERNS,
  isHapticsSupported,
  stopHaptics,
  triggerHaptic,
} from '../frontend/src/utils/haptics.ts';

test('паттерны короткие и не превращают игру в непрерывную вибрацию', () => {
  for (const [name, pattern] of Object.entries(HAPTIC_PATTERNS)) {
    const pulses = Array.isArray(pattern) ? pattern : [pattern];
    assert.ok(pulses.every(value => Number.isInteger(value) && value >= 0), `${name}: значения должны быть целыми`);
    assert.ok(pulses.reduce((sum, value) => sum + value, 0) <= 140, `${name}: паттерн слишком длинный`);
  }
});

test('без Vibration API модуль безопасно ничего не делает', () => {
  assert.equal(isHapticsSupported(), false);
  assert.equal(triggerHaptic('match'), false);
  assert.equal(stopHaptics(), false);
});
