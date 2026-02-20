import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { getApprovalRate, initSchema, type DB } from './db.ts';

describe('getApprovalRate', () => {
  let db: DB;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    initSchema(db);
  });

  afterEach(() => {
    if (db) db.close();
  });

  test('should return 0.5 when no decisions exist', () => {
    const rate = getApprovalRate(db, 'cleanup', 'person1');
    assert.strictEqual(rate, 0.5);
  });

  test('should return correct approval rate for existing decisions', () => {
    // Insert decisions
    const insert = db.prepare(`
      INSERT INTO decisions (id, task_type, assigned_to, approved)
      VALUES (?, ?, ?, ?)
    `);

    // person1: 2 approvals, 1 rejection for 'cleanup' -> 2/3 = 0.666...
    insert.run('1', 'cleanup', 'person1', 1);
    insert.run('2', 'cleanup', 'person1', 1);
    insert.run('3', 'cleanup', 'person1', 0);

    const rate1 = getApprovalRate(db, 'cleanup', 'person1');
    assert.ok(Math.abs(rate1 - 2/3) < 0.0001, `Expected 0.666..., got ${rate1}`);
  });

  test('should distinguish between assignees and task types', () => {
    const insert = db.prepare(`
      INSERT INTO decisions (id, task_type, assigned_to, approved)
      VALUES (?, ?, ?, ?)
    `);

    // person1 cleanup: 1 approval
    insert.run('1', 'cleanup', 'person1', 1);

    // person2 cleanup: 0 approvals (rejection)
    insert.run('2', 'cleanup', 'person2', 0);

    // person1 shopping: 0 approvals (rejection)
    insert.run('3', 'shopping', 'person1', 0);

    assert.strictEqual(getApprovalRate(db, 'cleanup', 'person1'), 1.0);
    assert.strictEqual(getApprovalRate(db, 'cleanup', 'person2'), 0.0);
    assert.strictEqual(getApprovalRate(db, 'shopping', 'person1'), 0.0);
  });

  test('should handle edge cases', () => {
    // Task type not in DB
    const rateUnknown = getApprovalRate(db, 'unknown_task', 'person1');
    assert.strictEqual(rateUnknown, 0.5);
  });
});
