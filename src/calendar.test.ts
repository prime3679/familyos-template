import { describe, it, expect } from 'vitest';
import { formatDate } from './calendar';

describe('formatDate', () => {
  it('formats a date correctly in YYYY-MM-DD format', () => {
    // 2023-01-01T12:00:00Z -> 2023-01-01
    const date = new Date('2023-01-01T12:00:00Z');
    expect(formatDate(date)).toBe('2023-01-01');
  });

  it('handles single digit months and days with padding', () => {
    // 2023-05-04T12:00:00Z -> 2023-05-04
    const date = new Date('2023-05-04T12:00:00Z');
    expect(formatDate(date)).toBe('2023-05-04');
  });

  it('uses UTC date (as per toISOString)', () => {
    // 2023-12-31T23:59:59Z -> 2023-12-31
    const date1 = new Date('2023-12-31T23:59:59Z');
    expect(formatDate(date1)).toBe('2023-12-31');

    // 2024-01-01T00:00:00Z -> 2024-01-01
    const date2 = new Date('2024-01-01T00:00:00Z');
    expect(formatDate(date2)).toBe('2024-01-01');
  });

  it('handles leap years correctly', () => {
    // 2024 is a leap year. Feb 29 exists.
    const date = new Date('2024-02-29T12:00:00Z');
    expect(formatDate(date)).toBe('2024-02-29');
  });
});
