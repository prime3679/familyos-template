import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('addCalendarEvent', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return true when event is created successfully', async () => {
    vi.stubEnv('PRIMARY_GOOGLE_ACCOUNT', 'test@example.com');

    // Dynamic import to pick up the env var
    const { addCalendarEvent } = await import('./calendar');

    const result = addCalendarEvent('Test Event', '2023-10-27', '10:00');

    expect(result).toBe(true);
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('gog calendar create primary --summary "Test Event" --start "2023-10-27T10:00" --duration 60 --account test@example.com'),
      expect.objectContaining({ encoding: 'utf8', timeout: 15000 })
    );
  });

  it('should return false when execSync throws an error', async () => {
    vi.stubEnv('PRIMARY_GOOGLE_ACCOUNT', 'test@example.com');

    // Mock execSync to throw an error
    vi.mocked(execSync).mockImplementationOnce(() => {
      throw new Error('Command failed');
    });

    const { addCalendarEvent } = await import('./calendar');

    const result = addCalendarEvent('Test Event', '2023-10-27', '10:00');

    expect(result).toBe(false);
    expect(execSync).toHaveBeenCalled();
  });

  it('should return false when PRIMARY_GOOGLE_ACCOUNT is not set', async () => {
    // Ensure PRIMARY_GOOGLE_ACCOUNT is undefined/empty
    delete process.env.PRIMARY_GOOGLE_ACCOUNT;
    vi.stubEnv('PRIMARY_GOOGLE_ACCOUNT', '');

    const { addCalendarEvent } = await import('./calendar');

    const result = addCalendarEvent('Test Event', '2023-10-27', '10:00');

    expect(result).toBe(false);
    expect(execSync).not.toHaveBeenCalled();
  });
});
