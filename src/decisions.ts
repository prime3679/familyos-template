/**
 * Decision recording + preference learning
 * Tracks what gets approved/rejected to improve future proposals
 */

import { type DB } from './db.ts';

export interface DecisionRecord {
  taskId: string;
  taskType: string;
  assignedTo: string;
  approved: boolean;
  dueDate: string;
  swapped?: boolean;
}

export function recordDecision(db: DB, d: DecisionRecord): void {
  const dayOfWeek = new Date(d.dueDate).toLocaleDateString('en-US', { weekday: 'long' });

  db.prepare(`
    INSERT INTO decisions (id, task_id, task_type, assigned_to, approved, day_of_week, week_load_person1, week_load_person2)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0)
  `).run(
    crypto.randomUUID(),
    d.taskId,
    d.taskType,
    d.assignedTo,
    d.approved ? 1 : 0,
    dayOfWeek
  );
}

export interface LearnedPreference {
  taskType: string;
  dayOfWeek: string;
  preferredAssignee: 'person1' | 'person2';
  confidence: number;
  sampleSize: number;
}

// Derive learned preferences from decision history
export function deriveLearnedPreferences(db: DB): LearnedPreference[] {
  const rows = db.prepare(`
    SELECT
      task_type,
      day_of_week,
      assigned_to,
      COUNT(*) as total,
      SUM(approved) as approved_count
    FROM decisions
    WHERE approved = 1
    GROUP BY task_type, day_of_week, assigned_to
    HAVING total >= 3
    ORDER BY task_type, day_of_week
  `).all() as Array<{
    task_type: string;
    day_of_week: string;
    assigned_to: string;
    total: number;
    approved_count: number;
  }>;

  const prefs: LearnedPreference[] = [];

  for (const row of rows) {
    const confidence = row.approved_count / row.total;
    if (confidence >= 0.7) {
      prefs.push({
        taskType: row.task_type,
        dayOfWeek: row.day_of_week,
        preferredAssignee: row.assigned_to as 'person1' | 'person2',
        confidence,
        sampleSize: row.total,
      });
    }
  }

  return prefs;
}

// Print a human-readable summary of what the system has learned
export function printLearningSummary(db: DB): void {
  const prefs = deriveLearnedPreferences(db);

  if (prefs.length === 0) {
    console.log('[learning] Not enough data yet (need 3+ approvals per pattern).');
    return;
  }

  console.log('\n🧠 Learned Preferences:\n');
  for (const p of prefs) {
    const pct = Math.round(p.confidence * 100);
    console.log(`  ${p.taskType} on ${p.dayOfWeek} → ${p.preferredAssignee} (${pct}% confidence, n=${p.sampleSize})`);
  }
  console.log('');
}

// Get confidence for a specific pattern
export function getLearnedConfidence(
  db: DB,
  taskType: string,
  dayOfWeek: string,
  assignee: string
): number {
  const result = db.prepare(`
    SELECT COUNT(*) as total, SUM(approved) as approved
    FROM decisions
    WHERE task_type = ? AND day_of_week = ? AND assigned_to = ?
  `).get(taskType, dayOfWeek, assignee) as { total: number; approved: number } | undefined;

  if (!result || result.total < 2) return 0.5; // not enough data
  return result.approved / result.total;
}
