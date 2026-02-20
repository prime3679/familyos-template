import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatWeeklyProposalEmail } from './notify.ts';
import { Proposal } from './tasks.ts';

// Mock preferences
vi.mock('./preferences.ts', () => ({
  getPreferences: vi.fn(() => ({
    family: {
      person1: { name: 'Alice' },
      person2: { name: 'Bob' }
    },
    childcare: {
      child_name: 'Charlie'
    }
  }))
}));

describe('formatWeeklyProposalEmail', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-10-23T10:00:00Z')); // A Monday
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles empty proposals', () => {
    const result = formatWeeklyProposalEmail([]);
    expect(result.subject).toContain('Week of Oct 23');
    expect(result.text).toContain('Nothing to coordinate');
  });

  it('formats a single proposal', () => {
    const proposals: Proposal[] = [{
      task: {
        id: '1',
        type: 'daycare_pickup',
        dueDate: '2023-10-24', // Tuesday
        dayName: 'Tuesday',
        status: 'proposed'
      },
      suggestedAssignee: 'person1',
      reasoning: 'test',
      confidence: 1
    }];

    const result = formatWeeklyProposalEmail(proposals);
    expect(result.text).toContain('Hi Bob');
    expect(result.text).toContain('Tuesday (Oct 24)');
    expect(result.text).toContain('Charlie pickup → Person1');
    expect(result.text).toContain('Alice sees this too');
  });

  it('formats multiple proposals on same day', () => {
    const proposals: Proposal[] = [
      {
        task: {
          id: '1',
          type: 'daycare_dropoff',
          dueDate: '2023-10-25', // Wednesday
          dayName: 'Wednesday',
          status: 'proposed'
        },
        suggestedAssignee: 'person1',
        reasoning: 'test',
        confidence: 1
      },
      {
        task: {
          id: '2',
          type: 'meal',
          dueDate: '2023-10-25', // Wednesday
          dayName: 'Wednesday',
          status: 'proposed'
        },
        suggestedAssignee: 'person2',
        reasoning: 'test',
        confidence: 1
      }
    ];

    const result = formatWeeklyProposalEmail(proposals);
    expect(result.text).toContain('Wednesday (Oct 25)');
    expect(result.text).toContain('Charlie dropoff → Person1');
    expect(result.text).toContain('Dinner → Person2');
  });

  it('sorts days correctly', () => {
    const proposals: Proposal[] = [
      {
        task: {
          id: '2',
          type: 'meal',
          dueDate: '2023-10-27', // Friday
          dayName: 'Friday',
          status: 'proposed'
        },
        suggestedAssignee: 'person2',
        reasoning: 'test',
        confidence: 1
      },
      {
        task: {
          id: '1',
          type: 'daycare_dropoff',
          dueDate: '2023-10-23', // Monday
          dayName: 'Monday',
          status: 'proposed'
        },
        suggestedAssignee: 'person1',
        reasoning: 'test',
        confidence: 1
      }
    ];

    const result = formatWeeklyProposalEmail(proposals);
    const text = result.text;
    const mondayIndex = text.indexOf('Monday (Oct 23)');
    const fridayIndex = text.indexOf('Friday (Oct 27)');
    expect(mondayIndex).toBeLessThan(fridayIndex);
  });

  it('includes partner context and strips markdown', () => {
    const proposals: Proposal[] = [{
      task: {
        id: '1',
        type: 'daycare_pickup',
        dueDate: '2023-10-24',
        dayName: 'Tuesday',
        status: 'proposed'
      },
      suggestedAssignee: 'person1',
      reasoning: 'test',
      confidence: 1
    }];

    const context = 'Some *important* context';
    const result = formatWeeklyProposalEmail(proposals, context);
    expect(result.text).toContain('Some important context');
    expect(result.text).not.toContain('*important*');
  });
});
