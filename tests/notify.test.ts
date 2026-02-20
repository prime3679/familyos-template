import { test, after } from 'node:test';
import assert from 'node:assert';
import { formatWeeklyProposal } from '../src/notify.ts';
import { type Proposal, type Task } from '../src/tasks.ts';

// Mock Date to ensure deterministic output
const RealDate = global.Date;
// Mock "today" as Monday, Jan 1, 2024.
// 2024-01-01 is a Monday.
const MOCK_NOW_STR = '2024-01-01T12:00:00Z';
const MOCK_NOW_TIME = new RealDate(MOCK_NOW_STR).getTime();

class MockDate extends RealDate {
  constructor(...args: any[]) {
    if (args.length) {
      super(...args as [any]);
    } else {
      super(MOCK_NOW_TIME);
    }
  }

  static now() {
    return MOCK_NOW_TIME;
  }
}

// Override global Date
global.Date = MockDate as any;

// Restore Date after tests
after(() => {
  global.Date = RealDate;
});

test('formatWeeklyProposal', async (t) => {
  await t.test('returns empty string for empty proposals', () => {
    const result = formatWeeklyProposal([]);
    assert.strictEqual(result, '');
  });

  await t.test('formats a single proposal correctly', () => {
    const task: Task = {
      id: '1',
      type: 'daycare_pickup',
      dueDate: '2024-01-01',
      dayName: 'Monday',
      status: 'proposed'
    };

    const proposal: Proposal = {
      task,
      suggestedAssignee: 'person1',
      reasoning: 'Test reasoning',
      confidence: 1
    };

    const result = formatWeeklyProposal([proposal]);

    // Check for week label (Mocked today is Jan 1, so week of Jan 1)
    // formatWeeklyProposal calls getWeekLabel() which uses new Date() (mocked to Jan 1)
    // getWeekLabel Logic:
    //   monday = new Date() -> Jan 1 (Monday)
    //   day = 1
    //   monday.setDate(1 - 1 + 1) -> Jan 1
    //   returns Jan 1
    assert.match(result, /Week of Jan 1/);

    // Check for day header
    // formatDisplayDate('2024-01-01') -> Jan 1
    assert.match(result, /\*Monday \(Jan 1\)\*/);

    // Check for task details
    // "  🧒 Child pickup → Person1"
    // Note: "Child pickup" comes from taskLabel, which defaults to "Child pickup" if prefs missing.
    // "Person1" comes from capitalize('person1').
    assert.match(result, /Child pickup/);
    assert.match(result, /Person1/);
  });

  await t.test('groups proposals by day', () => {
    const p1: Proposal = {
      task: {
        id: '1',
        type: 'daycare_pickup',
        dueDate: '2024-01-01',
        dayName: 'Monday',
        status: 'proposed'
      },
      suggestedAssignee: 'person1',
      reasoning: 'r1',
      confidence: 1
    };

    const p2: Proposal = {
      task: {
        id: '2',
        type: 'meal',
        dueDate: '2024-01-01',
        dayName: 'Monday',
        status: 'proposed'
      },
      suggestedAssignee: 'person2',
      reasoning: 'r2',
      confidence: 1
    };

    const p3: Proposal = {
      task: {
        id: '3',
        type: 'date_night',
        dueDate: '2024-01-02',
        dayName: 'Tuesday',
        status: 'proposed'
      },
      suggestedAssignee: 'person1',
      reasoning: 'r3',
      confidence: 1
    };

    const result = formatWeeklyProposal([p1, p2, p3]);

    // Monday header should appear once
    const mondayMatches = result.match(/\*Monday \(Jan 1\)\*/g);
    assert.strictEqual(mondayMatches?.length, 1);

    // Tuesday header should appear once
    const tuesdayMatches = result.match(/\*Tuesday \(Jan 2\)\*/g);
    assert.strictEqual(tuesdayMatches?.length, 1);

    // Check content order/presence
    // We expect Child pickup and Dinner under Monday
    // Date night under Tuesday

    assert.ok(result.includes('Child pickup'));
    assert.ok(result.includes('Dinner')); // meal -> Dinner
    assert.ok(result.includes('Date night'));
  });

  await t.test('includes partner context', () => {
    const proposal: Proposal = {
      task: {
        id: '1',
        type: 'errand',
        dueDate: '2024-01-01',
        dayName: 'Monday',
        status: 'proposed'
      },
      suggestedAssignee: 'person1',
      reasoning: 'r',
      confidence: 1
    };

    const context = "Make sure to buy milk.";
    const result = formatWeeklyProposal([proposal], context);

    assert.ok(result.includes(context));
  });
});
