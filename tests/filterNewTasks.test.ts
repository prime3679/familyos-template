// @ts-ignore — Node 22+ built-in SQLite (experimental)
import { DatabaseSync } from 'node:sqlite';
import { test, describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { initSchema, type DB } from '../src/db.ts';
import { filterNewTasks, type Task } from '../src/tasks.ts';

describe('filterNewTasks', () => {
  let db: DB;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    initSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should filter out tasks that already exist in the database', () => {
    // Insert existing tasks
    const existingTask1: Task = {
      id: 'task-1',
      type: 'errand',
      dueDate: '2023-01-01',
      dayName: 'Monday',
      status: 'pending'
    };
    const stmt = db.prepare('INSERT INTO tasks (id, type, status, due_date) VALUES (?, ?, ?, ?)');
    stmt.run(existingTask1.id, existingTask1.type, existingTask1.status, existingTask1.dueDate);

    // Prepare input tasks
    const inputTasks: Task[] = [
      existingTask1,
      {
        id: 'task-2',
        type: 'errand',
        dueDate: '2023-01-02',
        dayName: 'Tuesday',
        status: 'pending'
      },
      {
        id: 'task-3',
        type: 'errand',
        dueDate: '2023-01-03',
        dayName: 'Wednesday',
        status: 'pending'
      }
    ];

    const result = filterNewTasks(db, inputTasks);

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, 'task-2');
    assert.strictEqual(result[1].id, 'task-3');
  });

  it('should return all tasks if none exist in the database', () => {
    const inputTasks: Task[] = [
      {
        id: 'task-1',
        type: 'errand',
        dueDate: '2023-01-01',
        dayName: 'Monday',
        status: 'pending'
      },
      {
        id: 'task-2',
        type: 'errand',
        dueDate: '2023-01-02',
        dayName: 'Tuesday',
        status: 'pending'
      }
    ];

    const result = filterNewTasks(db, inputTasks);

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, 'task-1');
    assert.strictEqual(result[1].id, 'task-2');
  });

  it('should return empty array if all tasks exist in the database', () => {
    const task1: Task = {
      id: 'task-1',
      type: 'errand',
      dueDate: '2023-01-01',
      dayName: 'Monday',
      status: 'pending'
    };
    const stmt = db.prepare('INSERT INTO tasks (id, type, status, due_date) VALUES (?, ?, ?, ?)');
    stmt.run(task1.id, task1.type, task1.status, task1.dueDate);

    const inputTasks: Task[] = [task1];

    const result = filterNewTasks(db, inputTasks);

    assert.strictEqual(result.length, 0);
  });

  it('should handle empty input array', () => {
      const result = filterNewTasks(db, []);
      assert.strictEqual(result.length, 0);
  });
});
