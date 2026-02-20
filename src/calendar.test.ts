import { describe, it, expect } from 'vitest';
import { dayOfWeek } from './calendar';

describe('dayOfWeek', () => {
  it('should return the correct day of the week for a valid date string', () => {
    // 2023-10-27 is a Friday
    expect(dayOfWeek('2023-10-27')).toBe('Friday');

    // 2023-10-30 is a Monday
    expect(dayOfWeek('2023-10-30')).toBe('Monday');

    // 2024-02-29 (Leap Day) is a Thursday
    expect(dayOfWeek('2024-02-29')).toBe('Thursday');
  });

  it('should handle different date formats', () => {
    // ISO format
    expect(dayOfWeek('2023-10-27T10:00:00Z')).toBe('Friday');

    // Slash format
    expect(dayOfWeek('2023/10/27')).toBe('Friday');
  });

  it('should return undefined for invalid date strings', () => {
    expect(dayOfWeek('invalid-date')).toBeUndefined();
    expect(dayOfWeek('')).toBeUndefined();
  });

  it('should work correctly for edge cases like year change', () => {
      // 2023-12-31 is Sunday
      expect(dayOfWeek('2023-12-31')).toBe('Sunday');
      // 2024-01-01 is Monday
      expect(dayOfWeek('2024-01-01')).toBe('Monday');
  });
});
