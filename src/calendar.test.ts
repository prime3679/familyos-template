import { describe, it } from 'node:test';
import assert from 'node:assert';
import { addDays } from './calendar.js';

describe('addDays', () => {
  it('should add days within the same month', () => {
    const date = new Date('2023-01-01T00:00:00Z');
    const result = addDays(date, 5);
    assert.strictEqual(result.toISOString(), '2023-01-06T00:00:00.000Z');
  });

  it('should add days across month boundaries', () => {
    const date = new Date('2023-01-30T00:00:00Z');
    const result = addDays(date, 5);
    assert.strictEqual(result.toISOString(), '2023-02-04T00:00:00.000Z');
  });

  it('should add days across year boundaries', () => {
    const date = new Date('2023-12-30T00:00:00Z');
    const result = addDays(date, 5);
    assert.strictEqual(result.toISOString(), '2024-01-04T00:00:00.000Z');
  });

  it('should handle leap years correctly', () => {
    const date = new Date('2024-02-28T00:00:00Z'); // 2024 is a leap year
    const result = addDays(date, 1);
    assert.strictEqual(result.toISOString(), '2024-02-29T00:00:00.000Z');

    const result2 = addDays(date, 2);
    assert.strictEqual(result2.toISOString(), '2024-03-01T00:00:00.000Z');
  });

  it('should subtract days when adding negative number', () => {
    const date = new Date('2023-01-10T00:00:00Z');
    const result = addDays(date, -5);
    assert.strictEqual(result.toISOString(), '2023-01-05T00:00:00.000Z');
  });

  it('should subtract days across month boundaries', () => {
    const date = new Date('2023-03-02T00:00:00Z');
    const result = addDays(date, -5);
    assert.strictEqual(result.toISOString(), '2023-02-25T00:00:00.000Z');
  });

  it('should return the same date when adding 0 days', () => {
    const date = new Date('2023-05-10T00:00:00Z');
    const result = addDays(date, 0);
    assert.strictEqual(result.toISOString(), '2023-05-10T00:00:00.000Z');
    assert.notStrictEqual(result, date); // Ensure it's a new Date object
  });

  it('should not mutate the original date', () => {
    const date = new Date('2023-01-01T00:00:00Z');
    addDays(date, 5);
    assert.strictEqual(date.toISOString(), '2023-01-01T00:00:00.000Z');
  });

  it('should handle large number of days', () => {
    const date = new Date('2023-01-01T00:00:00Z');
    const result = addDays(date, 365);
    assert.strictEqual(result.toISOString(), '2024-01-01T00:00:00.000Z'); // 2023 is not a leap year
  });
});
