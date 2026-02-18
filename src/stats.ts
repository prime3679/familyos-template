/**
 * FamilyOS Stats
 * Optionally publishes stats to a local path (e.g. a personal site).
 * Set STATS_OUTPUT_PATH env var to enable. Otherwise, just logs to console.
 */

import fs from 'fs';
import path from 'path';
import { type DB } from './db.ts';

// Optional: set STATS_OUTPUT_PATH to write stats JSON to a file
// e.g. STATS_OUTPUT_PATH=/var/www/html/familyos-stats.json
const STATS_OUTPUT_PATH = process.env.STATS_OUTPUT_PATH ?? '';

export interface FamilyOsStats {
  weeksRunning: number;
  proposalsSent: number;
  approvalRate: number | null;
  lastScan: string;
  updatedAt: string;
}

export function computeStats(db: DB): FamilyOsStats {
  // Weeks running = weeks since first task was created
  const firstTask = db.prepare(`SELECT MIN(created_at) as first FROM tasks`).get() as { first: string | null };
  const weeksRunning = firstTask.first
    ? Math.max(1, Math.floor((Date.now() - new Date(firstTask.first).getTime()) / (1000 * 60 * 60 * 24 * 7)))
    : 0;

  // Total proposals sent
  const proposalCount = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE status != 'pending'`).get() as { count: number };

  // Approval rate
  const decisions = db.prepare(`
    SELECT COUNT(*) as total, SUM(approved) as approved FROM decisions
  `).get() as { total: number; approved: number };
  const approvalRate = decisions.total > 0 ? decisions.approved / decisions.total : null;

  // Last scan time
  const lastTask = db.prepare(`SELECT MAX(created_at) as last FROM tasks`).get() as { last: string | null };

  return {
    weeksRunning,
    proposalsSent: proposalCount.count,
    approvalRate,
    lastScan: lastTask.last ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function publishStats(db: DB): boolean {
  const stats = computeStats(db);

  // Always log to console
  console.log(`[stats] Weeks: ${stats.weeksRunning} | Proposals: ${stats.proposalsSent} | Approval rate: ${stats.approvalRate !== null ? Math.round(stats.approvalRate * 100) + '%' : 'n/a'}`);

  // Optionally write to file
  if (!STATS_OUTPUT_PATH) return true;

  try {
    const dir = path.dirname(STATS_OUTPUT_PATH);
    if (!fs.existsSync(dir)) {
      console.warn(`[stats] Output directory not found: ${dir} — skipping file write`);
      return false;
    }

    fs.writeFileSync(STATS_OUTPUT_PATH, JSON.stringify(stats, null, 2));
    console.log(`[stats] Stats written to ${STATS_OUTPUT_PATH}`);
    return true;
  } catch (e) {
    console.error('[stats] Write failed:', e);
    return false;
  }
}
