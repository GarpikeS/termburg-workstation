import assert from 'node:assert/strict';
import test from 'node:test';
import { certificateTvPhase } from '../src/features/schedule/certificateTvPhase.ts';

const phase = (date, location = '2') => certificateTvPhase(location, Date.parse(date));

test('the Zelenogorsk TV alternates 49 seconds of schedule and 11 seconds of poster', () => {
  assert.equal(phase('2026-11-19T23:59:59.999+07:00'), 'inactive');
  assert.equal(phase('2026-11-20T00:00:00+07:00'), 'schedule');
  assert.equal(phase('2026-11-20T00:00:48.999+07:00'), 'schedule');
  assert.equal(phase('2026-11-20T00:00:49+07:00'), 'poster');
  assert.equal(phase('2026-11-20T00:00:59.999+07:00'), 'poster');
  assert.equal(phase('2026-11-20T00:01:00+07:00'), 'schedule');
  assert.equal(phase('2026-11-30T23:59:59.999+07:00'), 'poster');
  assert.equal(phase('2026-12-01T00:00:00+07:00'), 'inactive');
});

test('other locations always show their original schedule', () => {
  assert.equal(phase('2026-11-25T12:00:53+07:00', '1'), 'inactive');
  assert.equal(phase('2026-11-25T12:00:53+07:00', ''), 'inactive');
});
