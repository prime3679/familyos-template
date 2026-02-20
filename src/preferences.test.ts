import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import * as preferences from './preferences';

// Mock data
let mockYaml = '';

// Mock fs methods
mock.method(fs, 'existsSync', () => true);
mock.method(fs, 'readFileSync', () => mockYaml);

beforeEach(() => {
  preferences.resetPreferencesCache();
  mockYaml = '';
});

// Helper to create basic valid yaml
function createYaml(overrides: string = '') {
  // If overrides contains a top-level key that is already in default, yaml parser might take last one or merge?
  // js-yaml usually takes last one.
  // But strictly speaking, duplicate keys are invalid YAML.
  // However, I will construct the default yaml such that I can replace sections or append.
  // Ideally I should merge objects, but string manipulation is easier for simple tests.

  // Let's use a base object and merge.
  const base = {
    family: {
      person1: { name: 'Alice', role: 'primary' },
      person2: { name: 'Bob', role: 'partner' }
    },
    childcare: {
      child_name: 'Charlie',
      dropoff_days: [],
      dropoff_time: "08:00",
      pickup_time: "17:00",
      earliest_morning: "07:00"
    },
    fitness: {
      workouts: [],
      min_per_week: 3
    },
    work: {
      heavy_days: [],
      blocked_times: []
    },
    notifications: {
      quiet_start: "21:00",
      quiet_end: "07:00"
    }
  };

  // But wait, createYaml needs to return string.
  // I'll stick to string concatenation but be careful about valid YAML.

  return `
family:
  person1:
    name: Alice
    role: primary
  person2:
    name: Bob
    role: partner
childcare:
  child_name: Charlie
  dropoff_days: []
  dropoff_time: "08:00"
  pickup_time: "17:00"
  earliest_morning: "07:00"
fitness:
  workouts: []
  min_per_week: 3
notifications:
  quiet_start: "21:00"
  quiet_end: "07:00"
${overrides}
`;
}

test('isHardBlock returns true for errand on heavy work days', () => {
  mockYaml = createYaml(`
work:
  heavy_days: ['Monday']
  blocked_times: []
`);
  assert.strictEqual(preferences.isHardBlock('Monday', 'errand'), true);
});

test('isHardBlock returns true for meal on heavy work days', () => {
  mockYaml = createYaml(`
work:
  heavy_days: ['Monday']
  blocked_times: []
`);
  assert.strictEqual(preferences.isHardBlock('Monday', 'meal'), true);
});

test('isHardBlock returns false for pickup on heavy work days', () => {
  mockYaml = createYaml(`
work:
  heavy_days: ['Monday']
  blocked_times: []
`);
  assert.strictEqual(preferences.isHardBlock('Monday', 'pickup'), false);
});

test('isHardBlock returns false for errand on non-heavy work days', () => {
  mockYaml = createYaml(`
work:
  heavy_days: ['Monday']
  blocked_times: []
`);
  assert.strictEqual(preferences.isHardBlock('Tuesday', 'errand'), false);
});

test('isHardBlock returns true for legacy hard constraints (never)', () => {
  mockYaml = createYaml(`
work:
  heavy_days: []
  blocked_times: []
daycare:
  hard_constraints: ['Friday pickup never']
`);
  // The logic checks if constraint includes dayName and 'never'
  assert.strictEqual(preferences.isHardBlock('Friday', 'pickup'), true);
});

test('isHardBlock returns false for legacy hard constraints (without never)', () => {
  mockYaml = createYaml(`
work:
  heavy_days: []
  blocked_times: []
daycare:
  hard_constraints: ['Friday pickup preferred']
`);
  assert.strictEqual(preferences.isHardBlock('Friday', 'pickup'), false);
});

test('isHardBlock handles case insensitivity in constraints', () => {
  mockYaml = createYaml(`
work:
  heavy_days: []
  blocked_times: []
daycare:
  hard_constraints: ['friday pickup NEVER']
`);
  assert.strictEqual(preferences.isHardBlock('Friday', 'pickup'), true);
});

test('isHardBlock handles case insensitivity in day name argument', () => {
  mockYaml = createYaml(`
work:
  heavy_days: ['Monday']
  blocked_times: []
`);
  assert.strictEqual(preferences.isHardBlock('monday', 'errand'), true);
});

test('isHardBlock handles missing work preference gracefully', () => {
    mockYaml = `
family:
  person1: { name: A, role: primary }
  person2: { name: B, role: partner }
childcare: { child_name: C, dropoff_days: [], dropoff_time: "", pickup_time: "", earliest_morning: "" }
fitness: { workouts: [], min_per_week: 0 }
notifications: { quiet_start: "", quiet_end: "" }
`; // Missing work and daycare keys

    assert.strictEqual(preferences.isHardBlock('Monday', 'errand'), false);
});
