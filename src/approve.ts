/**
 * FamilyOS Approval Handler
 *
 * Called when the primary user responds to a proposal.
 * Usage:
 *   node --experimental-sqlite src/approve.ts --approve
 *   node --experimental-sqlite src/approve.ts --reject "swap wednesday pickup to person2"
 *   node --experimental-sqlite src/approve.ts --swap "wednesday pickup" person2
 */

import { getDb } from './db.ts';
import { sendTelegram } from './notify.ts';
import { recordDecision } from './decisions.ts';

const args = process.argv.slice(2);
const action = args[0];
const detail = args[1];

const db = getDb();

async function approveAll(): Promise<void> {
  // Approve all pending proposed tasks for this week
  const pending = db.prepare(`
    SELECT * FROM tasks WHERE status = 'proposed'
    ORDER BY due_date ASC
  `).all() as Array<{ id: string; type: string; due_date: string; assigned_to: string }>;

  if (pending.length === 0) {
    console.log('[approve] No pending proposals.');
    return;
  }

  const stmt = db.prepare(`
    UPDATE tasks SET status = 'assigned', assigned_to = (
      SELECT proposed_assignee FROM proposals WHERE task_id = tasks.id ORDER BY created_at DESC LIMIT 1
    ), approved_at = datetime('now')
    WHERE id = ?
  `);

  for (const task of pending) {
    stmt.run(task.id);
    // Record decision for learning
    const proposal = db.prepare(`
      SELECT * FROM proposals WHERE task_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(task.id) as { proposed_assignee: string; confidence: number } | undefined;

    if (proposal) {
      recordDecision(db, {
        taskId: task.id,
        taskType: task.type,
        assignedTo: proposal.proposed_assignee,
        approved: true,
        dueDate: task.due_date,
      });
    }
  }

  await sendTelegram(
    `✅ *FamilyOS — Week confirmed*\n\n${pending.length} tasks assigned. I'll remind you day-of. Have a good week.`,
    false
  );
  console.log(`[approve] Approved ${pending.length} tasks.`);
}

async function rejectAndReplan(instruction: string): Promise<void> {
  // Mark current proposals as rejected, replan with instruction as context
  db.prepare(`UPDATE tasks SET status = 'pending' WHERE status = 'proposed'`).run();

  await sendTelegram(
    `↩️ *FamilyOS — Got it, replanning...*\n\nNote: "${instruction}"\n\nI'll send a revised proposal shortly.`,
    false
  );
  console.log(`[approve] Rejected + replanning with: ${instruction}`);

  // Re-run scan with the instruction baked into context
  // To implement: parse instruction, update preferences, then re-run agent.ts --scan
  console.log('[approve] Run: node --experimental-sqlite src/agent.ts --scan');
}

async function swapAssignment(taskDesc: string, newAssignee: 'person1' | 'person2'): Promise<void> {
  // Find the task by description and swap assignee
  const taskType = descToType(taskDesc);
  const dayName = extractDay(taskDesc);

  const task = db.prepare(`
    SELECT * FROM tasks
    WHERE type = ? AND status = 'proposed'
    ORDER BY due_date ASC LIMIT 1
  `).get(taskType) as { id: string; due_date: string } | undefined;

  if (!task) {
    await sendTelegram(`⚠️ Couldn't find that task. Try: APPROVE or describe what to change.`);
    return;
  }

  db.prepare(`
    UPDATE tasks SET assigned_to = ?, status = 'assigned', approved_at = datetime('now')
    WHERE id = ?
  `).run(newAssignee, task.id);

  recordDecision(db, {
    taskId: task.id,
    taskType,
    assignedTo: newAssignee,
    approved: true,
    dueDate: task.due_date,
    swapped: true,
  });

  await sendTelegram(`✅ Swapped — ${taskType.replace('_', ' ')} on ${task.due_date} → ${newAssignee}`);
  console.log(`[approve] Swapped ${taskType} to ${newAssignee}`);
}

// Main
switch (action) {
  case '--approve':
    await approveAll();
    break;
  case '--reject':
    await rejectAndReplan(detail ?? 'no details provided');
    break;
  case '--swap': {
    const newAssignee = args[2] as 'person1' | 'person2';
    await swapAssignment(detail ?? '', newAssignee);
    break;
  }
  default:
    console.log('Usage: --approve | --reject "instruction" | --swap "task desc" [person1|person2]');
}

process.exit(0);

// Helpers
function descToType(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes('pickup')) return 'daycare_pickup';
  if (d.includes('dropoff') || d.includes('drop off')) return 'daycare_dropoff';
  if (d.includes('meal') || d.includes('dinner')) return 'meal';
  if (d.includes('errand') || d.includes('grocery')) return 'errand';
  if (d.includes('date')) return 'date_night';
  return 'daycare_pickup';
}

function extractDay(desc: string): string {
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const d = desc.toLowerCase();
  return days.find(day => d.includes(day)) ?? '';
}
