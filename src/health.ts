/**
 * FamilyOS Health Check
 * Run via cron or manually to verify system integrity.
 * node --experimental-sqlite src/health.ts
 */

import { getDb, type DB } from './db.ts';
import { sendTelegram } from './notify.ts';
import { fileURLToPath } from 'url';

export interface HealthReport {
  ok: boolean;
  issues: string[];
  stats: Record<string, unknown>;
}

export function checkHealth(db: DB): HealthReport {
  const issues: string[] = [];
  const stats: Record<string, unknown> = {};

  // 1. Pending proposals older than 48h (primary user hasn't approved)
  const staleProposals = db.prepare(`
    SELECT COUNT(*) as count FROM tasks
    WHERE status = 'proposed'
    AND proposed_at < datetime('now', '-48 hours')
  `).get() as { count: number };

  stats.staleProposals = staleProposals.count;
  if (staleProposals.count > 0) {
    issues.push(`${staleProposals.count} proposals haven't been approved in 48h`);
  }

  // 2. Tasks assigned but no approval recorded this week
  const unconfirmed = db.prepare(`
    SELECT COUNT(*) as count FROM tasks
    WHERE status = 'assigned'
    AND due_date >= date('now', 'weekday 0', '-6 days')
    AND approved_at IS NULL
  `).get() as { count: number };

  stats.unconfirmedAssignments = unconfirmed.count;

  // 3. Missed tasks (assigned but due date passed, not completed)
  const missed = db.prepare(`
    SELECT COUNT(*) as count FROM tasks
    WHERE status = 'assigned'
    AND due_date < date('now')
    AND type IN ('daycare_pickup', 'daycare_dropoff')
  `).get() as { count: number };

  stats.potentiallyMissed = missed.count;
  if (missed.count > 0) {
    issues.push(`${missed.count} tasks past due without completion mark — verify manually`);
  }

  // 4. DB stats
  const totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
  const totalDecisions = db.prepare('SELECT COUNT(*) as count FROM decisions').get() as { count: number };

  stats.totalTasks = totalTasks.count;
  stats.totalDecisions = totalDecisions.count;
  stats.learningActive = totalDecisions.count >= 3;

  return {
    ok: issues.length === 0,
    issues,
    stats,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = getDb();
  const report = checkHealth(db);

  if (!report.ok) {
    const msg = [
      '⚠️ *FamilyOS Health Check*',
      '',
      ...report.issues.map(i => `• ${i}`),
      '',
      `Tasks: ${report.stats.totalTasks} | Decisions: ${report.stats.totalDecisions}`,
    ].join('\n');

    await sendTelegram(msg, true);
    console.log('[health] Issues found:', report.issues);
  } else {
    console.log('[health] ✓ All good');
    console.log('[health] Stats:', JSON.stringify(report.stats, null, 2));
  }

  process.exit(0);
}
