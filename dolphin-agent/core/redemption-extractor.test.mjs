import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDelimited } from './delimited.mjs';
import { extractRedemptions, parseDolphinEntryTime } from './redemption-extractor.mjs';

test('extracts only exact ticket codes with a real Dolphin entry time', () => {
  const result = extractRedemptions([
    { 'Номер': '0000160961', 'Основание для льготы': 'TB-B5FDD15D', 'Время входа': '18.08.2026 14:10' },
    { 'Номер': '0000160962', 'Основание для льготы': 'TB-26806DE', 'Время входа': '18.08.2026 14:11' },
    { 'Номер': '0000160963', 'Основание для льготы': 'TB-EE185628', 'Время входа': '' },
  ]);

  assert.deepEqual(result.rows, [{
    code: 'TB-B5FDD15D',
    redeemedAt: '2026-08-18T14:10:00+03:00',
    sourceRecordId: '0000160961',
  }]);
  assert.equal(result.stats.invalidCodes, 1);
  assert.equal(result.stats.skippedWithoutEntryTime, 1);
});

test('parses Russian dates and rejects impossible dates', () => {
  assert.equal(parseDolphinEntryTime('21.08.26 16:40'), '2026-08-21T16:40:00+03:00');
  assert.equal(parseDolphinEntryTime('31.02.2026 16:40'), '');
});

test('parses Unix timestamps returned by an API', () => {
  assert.equal(parseDolphinEntryTime(1_777_631_400), '2026-05-01T10:30:00.000Z');
  assert.equal(parseDolphinEntryTime(1_777_631_400_000), '2026-05-01T10:30:00.000Z');
});

test('parses quoted semicolon CSV into Dolphin rows', () => {
  const rows = parseDelimited('Номер;Основание для льготы;Время входа\r\n"0001";"TB-3CB3F001";"22.08.2026 14:00"\r\n');
  assert.equal(rows[0]['Основание для льготы'], 'TB-3CB3F001');
  assert.equal(extractRedemptions(rows).rows.length, 1);
});
