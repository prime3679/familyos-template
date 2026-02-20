// @ts-ignore — Node 22+ built-in SQLite (experimental)
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '..');
const DB_PATH = path.join(DB_DIR, 'familyos.db');

export type DB = InstanceType<typeof DatabaseSync>;

export function getDb(): DB {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  initSchema(db);
  return db;
}

export function initSchema(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      assigned_to TEXT,
      proposed_at TEXT,
      approved_at TEXT,
      due_date TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      proposed_assignee TEXT NOT NULL,
      reasoning TEXT,
      confidence REAL,
      approved INTEGER,
      responded_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      task_type TEXT,
      assigned_to TEXT,
      approved INTEGER,
      day_of_week TEXT,
      week_load_person1 INTEGER,
      week_load_person2 INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  `);
}

export function getApprovalRate(db: DB, taskType: string, assignee: string): number {
  const result = db.prepare(`
    SELECT COUNT(*) as total, SUM(approved) as approved
    FROM decisions WHERE task_type = ? AND assigned_to = ?
  `).get(taskType, assignee) as { total: number; approved: number } | undefined;
  if (!result || result.total === 0) return 0.5;
  return result.approved / result.total;
}

export function getWeeklyLoad(db: DB, weekStart: string): { person1: number; person2: number } {
  const result = db.prepare(`
    SELECT
      SUM(CASE WHEN assigned_to = 'person1' THEN 1 ELSE 0 END) as person1,
      SUM(CASE WHEN assigned_to = 'person2' THEN 1 ELSE 0 END) as person2
    FROM tasks
    WHERE due_date >= ? AND due_date < date(?, '+7 days')
    AND status IN ('assigned','completed','approved')
  `).get(weekStart, weekStart) as { person1: number; person2: number } | undefined;
  return { person1: result?.person1 ?? 0, person2: result?.person2 ?? 0 };
}
