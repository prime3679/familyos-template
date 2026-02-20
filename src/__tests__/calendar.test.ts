import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock child_process before importing other modules
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('calendar', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('getEvents', () => {
    it('should return empty array when execSync throws an error', async () => {
      process.env.PRIMARY_GOOGLE_ACCOUNT = 'test-account';

      const { execSync } = await import('child_process');
      const mockExecSync = execSync as unknown as jest.Mock;

      mockExecSync.mockImplementation(() => {
        throw new Error('Network error');
      });

      const { getEvents } = await import('../calendar.js');

      const events = getEvents('2023-01-01', '2023-01-02');

      expect(events).toEqual([]);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('gog calendar events primary'),
        expect.anything()
      );
    });

    it('should return parsed events on success', async () => {
      process.env.PRIMARY_GOOGLE_ACCOUNT = 'test-account';

      const { execSync } = await import('child_process');
      const mockExecSync = execSync as unknown as jest.Mock;

      const mockOutput = JSON.stringify({
        events: [
          {
            id: '1',
            summary: 'Test Event',
            start: { dateTime: '2023-01-01T10:00:00Z' },
            end: { dateTime: '2023-01-01T11:00:00Z' },
          },
        ],
      });

      mockExecSync.mockReturnValue(mockOutput);

      const { getEvents } = await import('../calendar.js');

      const events = getEvents('2023-01-01', '2023-01-02');

      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Test Event');
      expect(events[0].start).toBe('2023-01-01T10:00:00Z');
      expect(events[0].end).toBe('2023-01-01T11:00:00Z');
    });

    it('should handle missing PRIMARY_GOOGLE_ACCOUNT gracefully', async () => {
      delete process.env.PRIMARY_GOOGLE_ACCOUNT;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { execSync } = await import('child_process');
      const mockExecSync = execSync as unknown as jest.Mock;

      const { getEvents } = await import('../calendar.js');

      const events = getEvents('2023-01-01', '2023-01-02');

      expect(events).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PRIMARY_GOOGLE_ACCOUNT not set'));
      expect(mockExecSync).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle partner calendar if configured', async () => {
      process.env.PRIMARY_GOOGLE_ACCOUNT = 'test-account';
      process.env.PARTNER_GOOGLE_ACCOUNT = 'partner-account';
      process.env.PARTNER_CALENDAR_ID = 'partner-cal-id';

      const { execSync } = await import('child_process');
      const mockExecSync = execSync as unknown as jest.Mock;

      const primaryOutput = JSON.stringify({
        events: [{ id: '1', summary: 'Primary Event' }]
      });
      const partnerOutput = JSON.stringify({
        events: [{ id: '2', summary: 'Partner Event' }]
      });

      mockExecSync
        .mockReturnValueOnce(primaryOutput)
        .mockReturnValueOnce(partnerOutput);

      const { getEvents } = await import('../calendar.js');

      const events = getEvents('2023-01-01', '2023-01-02');

      expect(events).toHaveLength(2);
      expect(events[0].title).toBe('Primary Event');
      expect(events[0].calendar).toBe('person1');
      expect(events[1].title).toBe('Partner Event');
      expect(events[1].calendar).toBe('person2');
    });

    it('should return partial results if partner calendar fails', async () => {
      process.env.PRIMARY_GOOGLE_ACCOUNT = 'test-account';
      process.env.PARTNER_GOOGLE_ACCOUNT = 'partner-account';
      process.env.PARTNER_CALENDAR_ID = 'partner-cal-id';

      const { execSync } = await import('child_process');
      const mockExecSync = execSync as unknown as jest.Mock;

      const primaryOutput = JSON.stringify({
        events: [{ id: '1', summary: 'Primary Event' }]
      });

      mockExecSync
        .mockReturnValueOnce(primaryOutput)
        .mockImplementationOnce(() => {
          throw new Error('Partner calendar failed');
        });

      const { getEvents } = await import('../calendar.js');

      const events = getEvents('2023-01-01', '2023-01-02');

      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Primary Event');
      expect(events[0].calendar).toBe('person1');
    });
  });
});
