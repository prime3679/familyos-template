import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as calendar from './calendar';

// Mock child_process to prevent actual execution
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('calendar', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Default mock behavior for execSync
    (execSync as any).mockReturnValue(JSON.stringify({ events: [] }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getPartnerEvents', () => {
    it('returns empty array when PARTNER_GOOGLE_ACCOUNT is not set', async () => {
      vi.stubEnv('PARTNER_GOOGLE_ACCOUNT', '');
      vi.stubEnv('PARTNER_CALENDAR_ID', '');
      const { getPartnerEvents } = await import('./calendar');
      expect(getPartnerEvents('2023-01-01', '2023-01-02')).toEqual([]);
    });

    it('returns parsed events when configured correctly', async () => {
      vi.stubEnv('PARTNER_GOOGLE_ACCOUNT', 'partner@example.com');
      vi.stubEnv('PARTNER_CALENDAR_ID', 'partner-cal-id');

      const mockEvents = JSON.stringify({
        events: [
          {
            id: 'evt1',
            summary: 'Partner Event',
            start: { dateTime: '2023-01-01T10:00:00Z' },
            end: { dateTime: '2023-01-01T11:00:00Z' }
          }
        ]
      });
      (execSync as any).mockReturnValue(mockEvents);

      const { getPartnerEvents } = await import('./calendar');
      const events = getPartnerEvents('2023-01-01', '2023-01-02');

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        id: 'evt1',
        title: 'Partner Event',
        calendar: 'person2'
      });
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('gog calendar events "partner-cal-id"'),
        expect.any(Object)
      );
    });

    it('handles execSync failure gracefully', async () => {
      vi.stubEnv('PARTNER_GOOGLE_ACCOUNT', 'partner@example.com');
      vi.stubEnv('PARTNER_CALENDAR_ID', 'partner-cal-id');
      (execSync as any).mockImplementation(() => { throw new Error('gog failed'); });

      const { getPartnerEvents } = await import('./calendar');
      expect(getPartnerEvents('2023-01-01', '2023-01-02')).toEqual([]);
    });
  });

  describe('getEvents', () => {
    it('returns empty array if PRIMARY_GOOGLE_ACCOUNT is missing', async () => {
      vi.stubEnv('PRIMARY_GOOGLE_ACCOUNT', '');
      const { getEvents } = await import('./calendar');
      expect(getEvents('2023-01-01', '2023-01-02')).toEqual([]);
    });

    it('fetches primary events successfully', async () => {
      vi.stubEnv('PRIMARY_GOOGLE_ACCOUNT', 'primary@example.com');
      vi.stubEnv('PARTNER_GOOGLE_ACCOUNT', ''); // disable partner

      const mockEvents = JSON.stringify({
        events: [
          {
            id: 'p1',
            summary: 'Primary Event',
            start: { dateTime: '2023-01-01T10:00:00Z' },
            end: { dateTime: '2023-01-01T11:00:00Z' }
          }
        ]
      });
      (execSync as any).mockReturnValue(mockEvents);

      const { getEvents } = await import('./calendar');
      const events = getEvents('2023-01-01', '2023-01-02');

      expect(events).toHaveLength(1);
      expect(events[0].calendar).toBe('person1');
      expect(execSync).toHaveBeenCalledTimes(1);
    });

    it('fetches both primary and partner events', async () => {
      vi.stubEnv('PRIMARY_GOOGLE_ACCOUNT', 'primary@example.com');
      vi.stubEnv('PARTNER_GOOGLE_ACCOUNT', 'partner@example.com');
      vi.stubEnv('PARTNER_CALENDAR_ID', 'partner-cal-id');

      // Use consistent mock format (object with events array)
      (execSync as any)
        .mockReturnValueOnce(JSON.stringify({ events: [{ id: 'p1', summary: 'Primary', start: { date: '2023-01-01' } }] })) // primary
        .mockReturnValueOnce(JSON.stringify({ events: [{ id: 'p2', summary: 'Partner', start: { date: '2023-01-01' } }] })); // partner

      const { getEvents } = await import('./calendar');
      const events = getEvents('2023-01-01', '2023-01-02');

      expect(events).toHaveLength(2);
      expect(events.find(e => e.calendar === 'person1')).toBeDefined();
      expect(events.find(e => e.calendar === 'person2')).toBeDefined();
    });
  });

  describe('addCalendarEvent', () => {
    it('returns false if PRIMARY_GOOGLE_ACCOUNT is missing', async () => {
      vi.stubEnv('PRIMARY_GOOGLE_ACCOUNT', '');
      const { addCalendarEvent } = await import('./calendar');
      expect(addCalendarEvent('Test', '2023-01-01', '10:00')).toBe(false);
    });

    it('returns true on successful execution', async () => {
      vi.stubEnv('PRIMARY_GOOGLE_ACCOUNT', 'primary@example.com');
      const { addCalendarEvent } = await import('./calendar');
      expect(addCalendarEvent('Test', '2023-01-01', '10:00')).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('gog calendar create primary'),
        expect.any(Object)
      );
    });

    it('returns false on execution failure', async () => {
      vi.stubEnv('PRIMARY_GOOGLE_ACCOUNT', 'primary@example.com');
      (execSync as any).mockImplementation(() => { throw new Error('fail'); });
      const { addCalendarEvent } = await import('./calendar');
      expect(addCalendarEvent('Test', '2023-01-01', '10:00')).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    it('formatDate formats date as YYYY-MM-DD', () => {
      const d = new Date('2023-12-25T12:00:00Z');
      expect(calendar.formatDate(d)).toBe('2023-12-25');
    });

    it('addDays adds days correctly', () => {
      const d = new Date('2023-01-01');
      const result = calendar.addDays(d, 5);
      expect(calendar.formatDate(result)).toBe('2023-01-06');
    });

    it('getMonday returns the Monday of the current week', () => {
      expect(calendar.formatDate(calendar.getMonday(new Date('2023-01-02')))).toBe('2023-01-02'); // Jan 2 is Mon
      expect(calendar.formatDate(calendar.getMonday(new Date('2023-01-03')))).toBe('2023-01-02');
      expect(calendar.formatDate(calendar.getMonday(new Date('2023-01-01')))).toBe('2023-01-02');
    });

    it('dayOfWeek returns correct day name', () => {
      expect(calendar.dayOfWeek('2023-01-01')).toBe('Sunday');
      expect(calendar.dayOfWeek('2023-01-02')).toBe('Monday');
    });

    it('isWeekend identifies weekends correctly', () => {
      expect(calendar.isWeekend('2023-01-01')).toBe(true); // Sun
      expect(calendar.isWeekend('2023-01-02')).toBe(false); // Mon
      expect(calendar.isWeekend('2023-01-07')).toBe(true); // Sat
    });
  });
});
