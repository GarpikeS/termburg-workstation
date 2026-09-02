import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { defaultSettings } from '../dolphin-agent/core/settings.mjs';
import { normalizeDeviceProfile, readEmbeddedDeviceProfile } from './device-profile.mjs';

test('Greenogorsk profile produces an explicit Dolphin device prefix', () => {
  assert.deepEqual(normalizeDeviceProfile({
    version: 1,
    locationCode: 'zelenogorsk',
    locationName: 'Зеленогорск',
  }), {
    version: 1,
    locationCode: 'zelenogorsk',
    locationName: 'Зеленогорск',
    deviceIdPrefix: 'dolphin-zelenogorsk',
  });
});

test('profile prefix becomes part of a newly generated device id', () => {
  const settings = defaultSettings('C:\\Downloads', { deviceIdPrefix: 'dolphin-zelenogorsk' });
  assert.match(settings.deviceId, /^dolphin-zelenogorsk-[0-9a-f-]{36}$/);
});

test('missing or invalid embedded profile is ignored safely', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'term-device-profile-'));
  try {
    assert.equal(await readEmbeddedDeviceProfile(path.join(root, 'missing.json')), null);
    const invalidFile = path.join(root, 'invalid.json');
    await fs.writeFile(invalidFile, JSON.stringify({ locationCode: '../moscow' }), 'utf8');
    assert.equal(await readEmbeddedDeviceProfile(invalidFile), null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
