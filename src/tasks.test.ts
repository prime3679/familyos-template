import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { identifyWeeklyTasks, Task } from './tasks';
import { DB } from './db';
import * as calendar from './calendar';
import * as preferences from './preferences';

// Mock dependencies
vi.mock('./calendar', async (importOriginal) => {
  const actual = await importOriginal<typeof calendar>();
  return {
    ...actual,
    getWeekEvents: vi.fn(),
  };
});

vi.mock('./preferences', async (importOriginal) => {
  const actual = await importOriginal<typeof preferences>();
  return {
    ...actual,
    getPreferences: vi.fn(),
    getDropoffDays: vi.fn(),
  };
});

describe('identifyWeeklyTasks', () => {
  let mockDb: DB;

  beforeEach(() => {
    // Set system time to Monday, Oct 2, 2023 10:00 AM
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-10-02T10:00:00Z'));

    // Reset mocks
    vi.clearAllMocks();

    // Default mock implementations
    (calendar.getWeekEvents as any).mockReturnValue([]);
    (preferences.getPreferences as any).mockReturnValue({
      childcare: { child_name: 'Kiddo' },
      date_nights: { min_frequency: 'biweekly', preferred_days: ['Friday', 'Saturday'] }
    });
    (preferences.getDropoffDays as any).mockReturnValue([]); // Default to all days if empty

    // Mock DB
    mockDb = {
      prepare: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(undefined), // No last date night by default
        run: vi.fn(),
      }),
    } as unknown as DB;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should generate pickup and dropoff tasks for all weekdays when no specific dropoff days are configured', () => {
    (preferences.getDropoffDays as any).mockReturnValue([]);

    const tasks = identifyWeeklyTasks(mockDb);

    // 5 days * 2 tasks (pickup + dropoff) = 10 tasks
    // Plus potentially date night if applicable (default mock returns undefined for last date night -> 999 days ago -> date night due)

    const pickupTasks = tasks.filter(t => t.type === 'daycare_pickup');
    const dropoffTasks = tasks.filter(t => t.type === 'daycare_dropoff');

    expect(pickupTasks).toHaveLength(5);
    expect(dropoffTasks).toHaveLength(5);

    expect(tasks.find(t => t.id === 'dropoff-2023-10-02')).toBeDefined();
    expect(tasks.find(t => t.id === 'pickup-2023-10-06')).toBeDefined();
  });

  it('should generate tasks only for configured dropoff days', () => {
    (preferences.getDropoffDays as any).mockReturnValue(['Tuesday', 'Thursday']);

    const tasks = identifyWeeklyTasks(mockDb);

    // Tuesday (Oct 3) and Thursday (Oct 5) -> 2 days * 2 tasks = 4 tasks
    const pickupTasks = tasks.filter(t => t.type === 'daycare_pickup');

    expect(pickupTasks).toHaveLength(2);
    expect(tasks.find(t => t.id === 'dropoff-2023-10-03')).toBeDefined(); // Tuesday
    expect(tasks.find(t => t.id === 'dropoff-2023-10-05')).toBeDefined(); // Thursday
    expect(tasks.find(t => t.id === 'dropoff-2023-10-02')).toBeUndefined(); // Monday
  });

  it('should mark tasks with hasChildcareEvent if a relevant calendar event exists', () => {
    (preferences.getDropoffDays as any).mockReturnValue(['Wednesday']);
    (calendar.getWeekEvents as any).mockReturnValue([
      { title: 'Daycare Closed', start: '2023-10-04T09:00:00', end: '2023-10-04T17:00:00' } // Wednesday
    ]);

    const tasks = identifyWeeklyTasks(mockDb);

    const wedTask = tasks.find(t => t.id === 'dropoff-2023-10-04');
    expect(wedTask).toBeDefined();
    expect(wedTask?.metadata?.hasChildcareEvent).toBe(true);
  });

  it('should generate a date night task if one is due', () => {
    // Mock last date night to be > 14 days ago (biweekly default)
    // Date.now() is 2023-10-02. 20 days ago is 2023-09-12.
    mockDb.prepare = vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue({ due_date: '2023-09-12' }),
      run: vi.fn(),
    });

    const tasks = identifyWeeklyTasks(mockDb);

    const dateNight = tasks.find(t => t.type === 'date_night');
    expect(dateNight).toBeDefined();
    // Should be Friday (Oct 6) or Saturday (Oct 7)
    expect(['2023-10-06', '2023-10-07']).toContain(dateNight?.dueDate);
  });

  it('should NOT generate a date night task if one is recently done', () => {
    // Mock last date night to be 5 days ago
    mockDb.prepare = vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue({ due_date: '2023-09-27' }), // 5 days before Oct 2
      run: vi.fn(),
    });

    const tasks = identifyWeeklyTasks(mockDb);

    const dateNight = tasks.find(t => t.type === 'date_night');
    expect(dateNight).toBeUndefined();
  });

  it('should skip days that have already passed', () => {
    // Set system time to Wednesday, Oct 4, 2023
    vi.setSystemTime(new Date('2023-10-04T10:00:00Z'));

    // Monday (2nd), Tuesday (3rd) should be skipped.
    // Wednesday (4th), Thursday (5th), Friday (6th) should be included.

    (preferences.getDropoffDays as any).mockReturnValue([]); // All days

    const tasks = identifyWeeklyTasks(mockDb);

    const dropoffs = tasks.filter(t => t.type === 'daycare_dropoff');
    // Wed, Thu, Fri = 3 days
    expect(dropoffs).toHaveLength(3);

    expect(tasks.find(t => t.id === 'dropoff-2023-10-02')).toBeUndefined();
    expect(tasks.find(t => t.id === 'dropoff-2023-10-03')).toBeUndefined();
    expect(tasks.find(t => t.id === 'dropoff-2023-10-04')).toBeDefined();
  });
});
