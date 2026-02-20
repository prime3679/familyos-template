import { describe, it } from 'node:test';
import assert from 'node:assert';
import { filterNewTasks, Task } from './tasks.ts';
import { DB } from './db.ts';

// Mock DB
class MockDB {
  private existingTasks: Set<string>;

  constructor(existingTaskIds: string[] = []) {
    this.existingTasks = new Set(existingTaskIds);
  }

  prepare(sql: string) {
    return {
      get: (id: string) => {
        if (this.existingTasks.has(id)) {
          return { id };
        }
        return undefined;
      }
    };
  }
}

describe('filterNewTasks', () => {
  it('should return an empty array if input is empty', () => {
    const mockDB = new MockDB();
    const tasks: Task[] = [];
    const result = filterNewTasks(mockDB as unknown as DB, tasks);
    assert.deepStrictEqual(result, []);
  });

  it('should return all tasks if none exist in the DB', () => {
    const mockDB = new MockDB([]);
    const tasks: Task[] = [
      { id: 'task1', type: 'errand', status: 'pending', dueDate: '2023-01-01', dayName: 'Monday' },
      { id: 'task2', type: 'errand', status: 'pending', dueDate: '2023-01-02', dayName: 'Tuesday' },
    ];
    const result = filterNewTasks(mockDB as unknown as DB, tasks);
    assert.deepStrictEqual(result, tasks);
  });

  it('should return no tasks if all exist in the DB', () => {
    const mockDB = new MockDB(['task1', 'task2']);
    const tasks: Task[] = [
      { id: 'task1', type: 'errand', status: 'pending', dueDate: '2023-01-01', dayName: 'Monday' },
      { id: 'task2', type: 'errand', status: 'pending', dueDate: '2023-01-02', dayName: 'Tuesday' },
    ];
    const result = filterNewTasks(mockDB as unknown as DB, tasks);
    assert.deepStrictEqual(result, []);
  });

  it('should return only tasks that do not exist in the DB', () => {
    const mockDB = new MockDB(['task1']);
    const tasks: Task[] = [
      { id: 'task1', type: 'errand', status: 'pending', dueDate: '2023-01-01', dayName: 'Monday' },
      { id: 'task2', type: 'errand', status: 'pending', dueDate: '2023-01-02', dayName: 'Tuesday' },
    ];
    const result = filterNewTasks(mockDB as unknown as DB, tasks);
    assert.deepStrictEqual(result, [{ id: 'task2', type: 'errand', status: 'pending', dueDate: '2023-01-02', dayName: 'Tuesday' }]);
  });

  it('should not deduplicate tasks within the input array if they are not in the DB', () => {
    const mockDB = new MockDB([]);
    const tasks: Task[] = [
      { id: 'task1', type: 'errand', status: 'pending', dueDate: '2023-01-01', dayName: 'Monday' },
      { id: 'task1', type: 'errand', status: 'pending', dueDate: '2023-01-01', dayName: 'Monday' },
    ];
    const result = filterNewTasks(mockDB as unknown as DB, tasks);
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result[0], result[1]);
  });
});
