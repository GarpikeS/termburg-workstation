import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { startScheduleService } from './schedule-service.mjs';

test('desktop accounts save date replacements without changing the other complex; legacy edits fail safely', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tb-day-replacement-'));
  const weekly = locationId => ({ id: `weekly-${locationId}`, locationId, daysOfWeek: [1,2,3,4,5,6,7], time: '14:00', title: 'Обычное парение', venue: 'Парная', published: true, priceKind: 'paid', price: 390 });
  const seed = { schemaVersion: 1, revision: 1, updatedAt: new Date().toISOString(), locations: [{ id: '1', timezone: 'Europe/Moscow' }, { id: '2', timezone: 'Asia/Krasnoyarsk' }], weeklyEvents: [weekly('1'), weekly('2')], exceptions: [], monthlyPosters: [] };
  const seedFile = path.join(root, 'seed.json'), dataFile = path.join(root, 'schedule.json');
  await writeFile(seedFile, JSON.stringify(seed));
  let service;
  try {
    service = await startScheduleService({ staticRoot: root, seedFile, dataFile, authFile: path.join(root, 'auth.json'), host: '127.0.0.1', port: 0, logger: { info() {}, error() {} } });
    const origin = `http://127.0.0.1:${service.port}`;
    const post = (url, body, cookie = '') => fetch(origin + url, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) });
    const setup = await post('/api/auth/setup', { moscowPassword: 'Fixture-Moscow-126!', zelenogorskPassword: 'Fixture-Zelenogorsk-126!' });
    assert.equal(setup.status, 201);
    for (const [locationId, username, password] of [['1', 'moscow', 'Fixture-Moscow-126!'], ['2', 'zelenogorsk', 'Fixture-Zelenogorsk-126!']]) {
      const login = await post('/api/auth/login', { username, password });
      assert.equal(login.status, 200);
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const get = async () => (await fetch(origin + '/api/schedule', { headers: { Cookie: cookie } })).json();
      const put = data => fetch(origin + '/api/schedule', { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(data) });
      const before = await get();
      const override = { ...weekly(locationId), id: `replacement-${locationId}`, date: '2026-10-17', replacesEventId: `weekly-${locationId}`, title: 'Праздничное парение', priceKind: 'free' };
      delete override.daysOfWeek; delete override.price;
      const next = { ...before, revision: before.revision + 1, exceptions: [...before.exceptions, override] };
      assert.equal((await put(next)).status, 200);
      const confirmed = await get();
      const byId = items => [...items].sort((a, b) => a.id.localeCompare(b.id));
      assert.deepEqual(byId(confirmed.weeklyEvents), byId(before.weeklyEvents));
      assert.deepEqual(confirmed.exceptions.filter(item => item.locationId !== locationId), before.exceptions.filter(item => item.locationId !== locationId));
      assert.equal(confirmed.exceptions.find(item => item.id === override.id).replacesEventId, override.replacesEventId);
      const stored = await readFile(dataFile, 'utf8');
      const legacy = structuredClone(confirmed);
      delete legacy.exceptions.find(item => item.id === override.id).replacesEventId;
      assert.equal((await put(legacy)).status, 409);
      assert.equal(await readFile(dataFile, 'utf8'), stored);
      const invalid = structuredClone(confirmed);
      invalid.revision++;
      invalid.exceptions.find(item => item.id === override.id).title = '';
      assert.equal((await put(invalid)).status, 400);
      assert.equal(await readFile(dataFile, 'utf8'), stored);
      const restored = { ...confirmed, revision: confirmed.revision + 1, exceptions: confirmed.exceptions.filter(item => item.id !== override.id) };
      assert.equal((await put(restored)).status, 200);
      assert.deepEqual((await get()).exceptions, before.exceptions);
    }
  } finally {
    await service?.close();
    await rm(root, { recursive: true, force: true });
  }
});
