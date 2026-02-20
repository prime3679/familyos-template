import { test } from 'node:test';
import assert from 'node:assert';
import { isQuietHours, Preferences } from './preferences.ts';

function createMockPrefs(start: string, end: string): Preferences {
  return {
    notifications: {
      quiet_start: start,
      quiet_end: end
    }
  } as unknown as Preferences;
}

function createMockDate(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

test('isQuietHours - standard night (21:00 - 07:00)', () => {
  const prefs = createMockPrefs('21:00', '07:00');

  assert.strictEqual(isQuietHours(prefs, createMockDate(20)), false, '20:00 should not be quiet');
  assert.strictEqual(isQuietHours(prefs, createMockDate(21)), true, '21:00 should be quiet');
  assert.strictEqual(isQuietHours(prefs, createMockDate(23)), true, '23:00 should be quiet');
  assert.strictEqual(isQuietHours(prefs, createMockDate(0)), true, '00:00 should be quiet');
  assert.strictEqual(isQuietHours(prefs, createMockDate(6)), true, '06:00 should be quiet');
  assert.strictEqual(isQuietHours(prefs, createMockDate(7)), false, '07:00 should not be quiet');
});

test('isQuietHours - same day (13:00 - 15:00)', () => {
  const prefs = createMockPrefs('13:00', '15:00');
  assert.strictEqual(isQuietHours(prefs, createMockDate(12)), false, '12:00 should not be quiet');
  assert.strictEqual(isQuietHours(prefs, createMockDate(13)), true, '13:00 should be quiet');
  assert.strictEqual(isQuietHours(prefs, createMockDate(14)), true, '14:00 should be quiet');
  assert.strictEqual(isQuietHours(prefs, createMockDate(15)), false, '15:00 should not be quiet');
});

test('isQuietHours - AM/PM parsing', () => {
  const prefs = createMockPrefs('9:00pm', '7:00am'); // 21:00 - 07:00
  assert.strictEqual(isQuietHours(prefs, createMockDate(20)), false, '20:00 (8pm) should not be quiet');
  assert.strictEqual(isQuietHours(prefs, createMockDate(21)), true, '21:00 (9pm) should be quiet');
  assert.strictEqual(isQuietHours(prefs, createMockDate(7)), false, '07:00 (7am) should not be quiet');
});

test('isQuietHours - morning block (01:00 - 05:00)', () => {
  const prefs = createMockPrefs('01:00', '05:00');
  assert.strictEqual(isQuietHours(prefs, createMockDate(0)), false, '00:00 should not be quiet');
  assert.strictEqual(isQuietHours(prefs, createMockDate(1)), true, '01:00 should be quiet');
  assert.strictEqual(isQuietHours(prefs, createMockDate(4)), true, '04:00 should be quiet');
  assert.strictEqual(isQuietHours(prefs, createMockDate(5)), false, '05:00 should not be quiet');
});

test('isQuietHours - midnight wrap edge case', () => {
  // 23:00 - 01:00
  const prefs = createMockPrefs('23:00', '01:00');
  assert.strictEqual(isQuietHours(prefs, createMockDate(22)), false);
  assert.strictEqual(isQuietHours(prefs, createMockDate(23)), true);
  assert.strictEqual(isQuietHours(prefs, createMockDate(0)), true);
  assert.strictEqual(isQuietHours(prefs, createMockDate(1)), false);
});
