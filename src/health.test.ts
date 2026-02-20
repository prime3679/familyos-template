import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { initSchema } from './db.ts';
import { checkHealth } from './health.ts';

describe('checkHealth', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    initSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  test('should return ok for empty database', () => {
    const report = checkHealth(db);
    assert.strictEqual(report.ok, true);
    assert.strictEqual(report.issues.length, 0);
    assert.strictEqual(report.stats.totalTasks, 0);
  });

  test('should report stale proposals (> 48h)', () => {
    db.exec(`
      INSERT INTO tasks (id, type, status, proposed_at, due_date)
      VALUES ('t1', 'meal', 'proposed', datetime('now', '-50 hours'), date('now', '+1 day'))
    `);

    const report = checkHealth(db);
    assert.strictEqual(report.ok, false);
    assert.match(report.issues[0], /1 proposals haven't been approved in 48h/);
    assert.strictEqual(report.stats.staleProposals, 1);
  });

  test('should NOT report fresh proposals (< 48h)', () => {
    db.exec(`
      INSERT INTO tasks (id, type, status, proposed_at, due_date)
      VALUES ('t1', 'meal', 'proposed', datetime('now', '-10 hours'), date('now', '+1 day'))
    `);

    const report = checkHealth(db);
    assert.strictEqual(report.ok, true);
    assert.strictEqual(report.stats.staleProposals, 0);
  });

  test('should count unconfirmed assignments', () => {
    // Insert a task due today, assigned but not approved
    db.exec(`
      INSERT INTO tasks (id, type, status, due_date, approved_at)
      VALUES ('t1', 'meal', 'assigned', date('now'), NULL)
    `);

    const report = checkHealth(db);
    // Note: unconfirmed assignments are tracked in stats but do not trigger an issue in current logic
    assert.strictEqual(report.stats.unconfirmedAssignments, 1);
    assert.strictEqual(report.ok, true);
  });

  test('should report missed tasks (past due)', () => {
    // assigned, due yesterday, daycare type
    db.exec(`
      INSERT INTO tasks (id, type, status, due_date)
      VALUES ('t1', 'daycare_pickup', 'assigned', date('now', '-1 day'))
    `);

    const report = checkHealth(db);
    assert.strictEqual(report.ok, false);
    assert.match(report.issues[0], /1 tasks past due without completion mark/);
    assert.strictEqual(report.stats.potentiallyMissed, 1);
  });

  test('should calculate DB stats', () => {
    db.exec(`INSERT INTO tasks (id, type, status, due_date) VALUES ('t1', 'meal', 'pending', '2023-01-01')`);
    db.exec(`INSERT INTO tasks (id, type, status, due_date) VALUES ('t2', 'meal', 'pending', '2023-01-01')`);
    db.exec(`INSERT INTO decisions (id) VALUES ('d1')`);

    const report = checkHealth(db);
    assert.strictEqual(report.stats.totalTasks, 2);
    assert.strictEqual(report.stats.totalDecisions, 1);
    assert.strictEqual(report.stats.learningActive, false);

    db.exec(`INSERT INTO decisions (id) VALUES ('d2')`);
    db.exec(`INSERT INTO decisions (id) VALUES ('d3')`);
    const report2 = checkHealth(db);
    assert.strictEqual(report2.stats.learningActive, true); // >= 3
  });
});
