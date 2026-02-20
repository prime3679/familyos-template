import { describe, test } from 'node:test';
import assert from 'node:assert';
import { getMonday } from './calendar.ts';

describe('getMonday', () => {
  // Helper to assert date components match
  function assertDate(actual: Date, year: number, month: number, day: number) {
    assert.strictEqual(actual.getFullYear(), year, `Expected year ${year}, got ${actual.getFullYear()}`);
    assert.strictEqual(actual.getMonth(), month, `Expected month ${month}, got ${actual.getMonth()}`);
    assert.strictEqual(actual.getDate(), day, `Expected day ${day}, got ${actual.getDate()}`);
    assert.strictEqual(actual.getHours(), 0, 'Expected time 00:00:00');
    assert.strictEqual(actual.getMinutes(), 0);
    assert.strictEqual(actual.getSeconds(), 0);
    assert.strictEqual(actual.getMilliseconds(), 0);
  }

  test('returns same day if today is Monday', () => {
    // Oct 2, 2023 is Monday
    const monday = new Date(2023, 9, 2, 12, 30, 0);
    const result = getMonday(monday);
    assertDate(result, 2023, 9, 2);
  });

  test('returns previous Monday if today is Tuesday', () => {
    // Oct 3, 2023 is Tuesday
    const tuesday = new Date(2023, 9, 3, 10, 0, 0);
    const result = getMonday(tuesday);
    assertDate(result, 2023, 9, 2);
  });

  test('returns previous Monday if today is Wednesday', () => {
    // Oct 4, 2023 is Wednesday
    const wednesday = new Date(2023, 9, 4, 15, 0, 0);
    const result = getMonday(wednesday);
    assertDate(result, 2023, 9, 2);
  });

  test('returns previous Monday if today is Thursday', () => {
    // Oct 5, 2023 is Thursday
    const thursday = new Date(2023, 9, 5, 20, 0, 0);
    const result = getMonday(thursday);
    assertDate(result, 2023, 9, 2);
  });

  test('returns previous Monday if today is Friday', () => {
    // Oct 6, 2023 is Friday
    const friday = new Date(2023, 9, 6, 8, 0, 0);
    const result = getMonday(friday);
    assertDate(result, 2023, 9, 2);
  });

  test('returns previous Monday if today is Saturday', () => {
    // Oct 7, 2023 is Saturday
    const saturday = new Date(2023, 9, 7, 23, 59, 59);
    const result = getMonday(saturday);
    assertDate(result, 2023, 9, 2);
  });

  test('returns next Monday if today is Sunday', () => {
    // Oct 1, 2023 is Sunday. Next Monday is Oct 2.
    const sunday = new Date(2023, 9, 1, 12, 0, 0);
    const result = getMonday(sunday);
    assertDate(result, 2023, 9, 2);
  });

  test('returns next Monday for another Sunday', () => {
    // Oct 8, 2023 is Sunday. Next Monday is Oct 9.
    const sunday = new Date(2023, 9, 8, 12, 0, 0);
    const result = getMonday(sunday);
    assertDate(result, 2023, 9, 9);
  });

  test('handles month boundary correctly', () => {
    // Nov 1, 2023 is Wednesday. Previous Monday is Oct 30, 2023.
    const nov1 = new Date(2023, 10, 1, 12, 0, 0);
    const result = getMonday(nov1);
    assertDate(result, 2023, 9, 30);
  });

  test('handles year boundary correctly', () => {
    // Jan 1, 2024 is Monday. Returns same day.
    const jan1 = new Date(2024, 0, 1, 10, 0, 0);
    const result = getMonday(jan1);
    assertDate(result, 2024, 0, 1);

    // Jan 2, 2024 is Tuesday. Returns Jan 1.
    const jan2 = new Date(2024, 0, 2, 10, 0, 0);
    const result2 = getMonday(jan2);
    assertDate(result2, 2024, 0, 1);
  });

  test('handles default parameter', () => {
    const result = getMonday();
    assert.ok(result instanceof Date);
    // Should be a Monday (1)
    assert.strictEqual(result.getDay(), 1);
    // Should be time 00:00:00
    assert.strictEqual(result.getHours(), 0);
    assert.strictEqual(result.getMinutes(), 0);
    assert.strictEqual(result.getSeconds(), 0);
    assert.strictEqual(result.getMilliseconds(), 0);
  });
});
