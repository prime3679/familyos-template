import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process to prevent actual execution
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('getPartnerEvents', () => {
  beforeEach(() => {
    // Reset modules before each test to ensure fresh import with mocked env
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns empty array when PARTNER_GOOGLE_ACCOUNT is not set', async () => {
    vi.stubEnv('PARTNER_GOOGLE_ACCOUNT', '');
    // Ensure fallback doesn't happen from residual env
    vi.stubEnv('PARTNER_CALENDAR_ID', '');

    const { getPartnerEvents } = await import('./calendar');
    const result = getPartnerEvents('2023-01-01', '2023-01-02');

    expect(result).toEqual([]);
  });

  it('returns empty array when PARTNER_CALENDAR_ID is explicitly empty', async () => {
    vi.stubEnv('PARTNER_GOOGLE_ACCOUNT', 'partner@example.com');
    // empty string prevents fallback to account email
    vi.stubEnv('PARTNER_CALENDAR_ID', '');

    const { getPartnerEvents } = await import('./calendar');
    const result = getPartnerEvents('2023-01-01', '2023-01-02');

    expect(result).toEqual([]);
  });
});
