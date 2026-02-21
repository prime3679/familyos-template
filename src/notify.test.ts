
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { formatDailyReminder } from './notify.ts';
import { _setPreferencesCache, type Preferences } from './preferences.ts';
import { type Proposal, type Task } from './tasks.ts';

function createProposal(
  type: Task['type'],
  assignee: 'person1' | 'person2' = 'person1'
): Proposal {
  return {
    task: {
      id: `task-${Math.random()}`,
      type,
      dueDate: '2023-10-27',
      dayName: 'Friday',
      status: 'proposed',
    },
    suggestedAssignee: assignee,
    reasoning: 'test',
    confidence: 0.8,
  };
}

describe('formatDailyReminder', () => {
  afterEach(() => {
    _setPreferencesCache(null);
  });

  it('should return empty string for no proposals', () => {
    const result = formatDailyReminder([]);
    assert.strictEqual(result, '');
  });

  it('should format a single task correctly with default preferences', () => {
    const proposals: Proposal[] = [createProposal('meal', 'person1')];
    const result = formatDailyReminder(proposals);

    // Check for header
    assert.ok(result.includes('⏰ *FamilyOS — Today\'s Reminders*'), 'Header should be present');
    // Check for task content (default label for meal is 'Dinner')
    assert.ok(result.includes('🍽️ Dinner — Person1'), 'Task content should be formatted correctly');
  });

  it('should format multiple tasks correctly', () => {
    const proposals: Proposal[] = [
      createProposal('daycare_dropoff', 'person1'),
      createProposal('daycare_pickup', 'person2'),
    ];
    const result = formatDailyReminder(proposals);

    assert.ok(result.includes('🏫 Child dropoff — Person1'), 'First task incorrect');
    assert.ok(result.includes('🧒 Child pickup — Person2'), 'Second task incorrect');
  });

  it('should handle all task types correctly', () => {
    const types: Task['type'][] = [
        'daycare_pickup', 'daycare_dropoff', 'meal', 'errand', 'date_night'
    ];

    const proposals = types.map(t => createProposal(t));
    const result = formatDailyReminder(proposals);

    // Verify each expected line part is present
    assert.ok(result.includes('🧒 Child pickup'));
    assert.ok(result.includes('🏫 Child dropoff'));
    assert.ok(result.includes('🍽️ Dinner'));
    assert.ok(result.includes('🛒 Errands'));
    assert.ok(result.includes('🌙 Date night'));
  });

  it('should use child name from preferences if available', () => {
    // Create a partial mock that satisfies the specific need
    const mockPrefs = {
      family: {
        person1: { name: 'Alice', role: 'primary' },
        person2: { name: 'Bob', role: 'partner' }
      },
      childcare: {
        child_name: 'Coco',
        dropoff_days: [],
        dropoff_time: '08:00',
        pickup_time: '17:00',
        earliest_morning: '06:00'
      },
      fitness: { workouts: [], min_per_week: 0 },
      work: { heavy_days: [], blocked_times: [] },
      notifications: { quiet_start: '21:00', quiet_end: '07:00' }
    } as unknown as Preferences;

    _setPreferencesCache(mockPrefs);

    const proposals = [createProposal('daycare_pickup')];
    const result = formatDailyReminder(proposals);

    assert.ok(result.includes('🧒 Coco pickup'), 'Should use child name from preferences');
  });
});
