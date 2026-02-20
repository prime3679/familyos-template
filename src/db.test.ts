import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { getWeeklyLoad, initSchema, DB } from './db.js';

describe('getWeeklyLoad', () => {
  let db: DB;
  const weekStart = '2023-10-23'; // A Monday

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    initSchema(db);
  });

  it('should return 0 for both if no tasks', () => {
    const result = getWeeklyLoad(db, weekStart);
    assert.deepStrictEqual(result, { person1: 0, person2: 0 });
  });

  it('should count tasks assigned to person1 and person2 within the week', () => {
    db.exec(`
      INSERT INTO tasks (id, type, status, assigned_to, due_date) VALUES
      ('1', 'chore', 'assigned', 'person1', '2023-10-23'), -- Monday (start of week)
      ('2', 'chore', 'completed', 'person1', '2023-10-25'), -- Wednesday
      ('3', 'chore', 'approved', 'person2', '2023-10-29')   -- Sunday (end of week)
    `);

    const result = getWeeklyLoad(db, weekStart);
    assert.deepStrictEqual(result, { person1: 2, person2: 1 });
  });

  it('should ignore tasks outside the week', () => {
    db.exec(`
      INSERT INTO tasks (id, type, status, assigned_to, due_date) VALUES
      ('1', 'chore', 'assigned', 'person1', '2023-10-22'), -- Sunday before
      ('2', 'chore', 'assigned', 'person1', '2023-10-30')  -- Monday after
    `);

    const result = getWeeklyLoad(db, weekStart);
    assert.deepStrictEqual(result, { person1: 0, person2: 0 });
  });

  it('should ignore tasks with invalid status', () => {
    db.exec(`
      INSERT INTO tasks (id, type, status, assigned_to, due_date) VALUES
      ('1', 'chore', 'pending', 'person1', '2023-10-24'),
      ('2', 'chore', 'rejected', 'person2', '2023-10-24')
    `);

    const result = getWeeklyLoad(db, weekStart);
    assert.deepStrictEqual(result, { person1: 0, person2: 0 });
  });

  it('should handle complex scenarios correctly', () => {
    db.exec(`
      INSERT INTO tasks (id, type, status, assigned_to, due_date) VALUES
      ('1', 'chore', 'assigned', 'person1', '2023-10-23'),
      ('2', 'chore', 'pending', 'person1', '2023-10-23'), -- Ignored status
      ('3', 'chore', 'assigned', 'person1', '2023-10-30'), -- Ignored date
      ('4', 'chore', 'completed', 'person2', '2023-10-29'),
      ('5', 'chore', 'approved', 'person2', '2023-10-24')
    `);

    const result = getWeeklyLoad(db, weekStart);
    assert.deepStrictEqual(result, { person1: 1, person2: 2 });
  });
});
