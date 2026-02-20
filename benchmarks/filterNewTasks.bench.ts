// @ts-ignore — Node 22+ built-in SQLite (experimental)
import { DatabaseSync } from 'node:sqlite';
import { initSchema, type DB } from '../src/db.ts';
import { filterNewTasks, type Task } from '../src/tasks.ts';

function runBenchmark() {
  const db = new DatabaseSync(':memory:');
  initSchema(db);

  const EXISTING_COUNT = 1000;
  const NEW_COUNT = 1000;
  const TOTAL_COUNT = EXISTING_COUNT + NEW_COUNT;

  console.log(`Setting up benchmark with ${EXISTING_COUNT} existing tasks and ${NEW_COUNT} new tasks...`);

  // Insert existing tasks
  const insertStmt = db.prepare('INSERT INTO tasks (id, type, status, due_date) VALUES (?, ?, ?, ?)');
  const inputTasks: Task[] = [];

  for (let i = 0; i < EXISTING_COUNT; i++) {
    const id = `task-${i}`;
    insertStmt.run(id, 'errand', 'pending', '2023-01-01');
    inputTasks.push({
      id,
      type: 'errand',
      dueDate: '2023-01-01',
      dayName: 'Monday',
      status: 'pending'
    });
  }

  for (let i = EXISTING_COUNT; i < TOTAL_COUNT; i++) {
    const id = `task-${i}`;
    inputTasks.push({
      id,
      type: 'errand',
      dueDate: '2023-01-01',
      dayName: 'Monday',
      status: 'pending'
    });
  }

  // Shuffle inputTasks to simulate real scenario
  for (let i = inputTasks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [inputTasks[i], inputTasks[j]] = [inputTasks[j], inputTasks[i]];
  }

  console.log('Running filterNewTasks...');
  const start = performance.now();
  const result = filterNewTasks(db, inputTasks);
  const end = performance.now();

  console.log(`Filtered ${inputTasks.length} tasks in ${(end - start).toFixed(4)}ms`);
  console.log(`Result count: ${result.length} (expected ${NEW_COUNT})`);

  if (result.length !== NEW_COUNT) {
    console.error('ERROR: Result count mismatch!');
    process.exit(1);
  }
}

runBenchmark();
