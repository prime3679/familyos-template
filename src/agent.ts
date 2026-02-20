/**
 * FamilyOS Agent — v0.1
 * Self-hosted family coordination agent.
 *
 * Run modes:
 *   --scan     : identify tasks, propose assignments, send for approval
 *   --remind   : send day-of reminders for today's tasks
 *   --status   : print current week's task status
 *   (default)  : --scan
 */

import { getDb, getAllApprovalRates } from './db.ts';
import { identifyWeeklyTasks, proposeAssignment, filterNewTasks, saveTasks, type Proposal } from './tasks.ts';
import { formatWeeklyProposal, formatDailyReminder, sendTelegram, emailPartner } from './notify.ts';
import { formatDate, getPartnerEvents } from './calendar.ts';
import { publishStats } from './stats.ts';

const SUPERMEMORY_KEY = process.env.SUPERMEMORY_API_KEY ?? '';

async function querySupermemory(q: string): Promise<string> {
  if (!SUPERMEMORY_KEY) return '';
  try {
    const res = await fetch('https://api.supermemory.ai/v3/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPERMEMORY_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, limit: 4 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return '';
    const data = await res.json() as { results?: Array<{ title?: string; chunks?: Array<{ content?: string }> }> };
    return (data.results ?? [])
      .flatMap(r => (r.chunks ?? []).map(c => c.content ?? ''))
      .filter(Boolean)
      .slice(0, 4)
      .join('\n---\n');
  } catch {
    return '';
  }
}

const args = process.argv.slice(2);
const mode = args.find(a => a.startsWith('--'))?.slice(2) ?? 'scan';

const db = getDb();

async function runScan(): Promise<void> {
  console.log('[agent] Running weekly scan...');

  // Pull context before proposing
  const today = new Date();
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 10);
  const from = formatDate(today);
  const to = formatDate(weekEnd);

  // Partner's calendar
  const partnerEvents = getPartnerEvents(from, to);
  if (partnerEvents.length > 0) {
    console.log(`[agent] Partner calendar: ${partnerEvents.length} events in next 10 days`);
    partnerEvents.forEach(e => console.log(`  Partner: ${e.start.split('T')[0]} — ${e.title}`));
  } else {
    console.log('[agent] Partner calendar: no events found');
  }

  // Supermemory context (optional — set SUPERMEMORY_API_KEY to enable)
  const [familyContext, actionContext] = await Promise.all([
    querySupermemory('partner schedule travel appointments this week family constraints'),
    querySupermemory('pending family tasks childcare appointments health'),
  ]);
  if (familyContext || actionContext) {
    console.log('[agent] Supermemory context loaded');
  }

  // Build context string to include in proposal message
  const partnerCalendarContext = partnerEvents.length > 0
    ? `\n📅 Partner's schedule:\n${partnerEvents.map(e => `  • ${e.start.split('T')[0]} — ${e.title}${e.allDay ? ' (all day)' : ''}`).join('\n')}`
    : '';

  const allTasks = identifyWeeklyTasks(db);
  const newTasks = filterNewTasks(db, allTasks);

  if (newTasks.length === 0) {
    console.log('[agent] No new tasks to propose this week.');
    return;
  }

  // Generate proposals — aware of partner's calendar
  const approvalRates = getAllApprovalRates(db);
  const proposals: Proposal[] = [];
  for (const task of newTasks) {
    const proposal = proposeAssignment(db, task, partnerEvents, approvalRates);
    proposals.push(proposal);
  }

  // Save tasks to DB
  saveTasks(db, newTasks);

  // Mark as proposed
  for (const p of proposals) {
    db.prepare(`UPDATE tasks SET status = 'proposed', proposed_at = datetime('now') WHERE id = ?`)
      .run(p.task.id);
  }

  // Format and send proposal (with partner's calendar context appended)
  const message = formatWeeklyProposal(proposals, partnerCalendarContext);
  if (message) {
    const sent = await sendTelegram(message);
    console.log(`[agent] Telegram proposal ${sent ? 'sent' : 'queued (quiet hours)'}`);
    console.log(message);

    // CC partner via email
    await emailPartner(proposals, partnerCalendarContext);
  }

  // Publish stats (optional — requires PersonalSite setup, see stats.ts)
  publishStats(db);
}

async function runRemind(): Promise<void> {
  console.log('[agent] Checking today\'s tasks...');

  const today = formatDate(new Date());
  const todayTasks = db.prepare(`
    SELECT * FROM tasks
    WHERE due_date = ? AND status IN ('approved', 'assigned')
  `).all(today) as Array<{ id: string; type: string; assigned_to: string }>;

  if (todayTasks.length === 0) {
    console.log('[agent] No tasks due today.');
    return;
  }

  const proposals = todayTasks.map(t => ({
    task: { id: t.id, type: t.type as Proposal['task']['type'], dueDate: today, dayName: '', status: 'assigned' as const },
    suggestedAssignee: (t.assigned_to ?? 'person1') as 'person1' | 'person2',
    reasoning: '',
    confidence: 1.0
  }));

  const message = formatDailyReminder(proposals);
  if (message) {
    await sendTelegram(message, true); // urgent = bypass quiet hours for AM reminders
    console.log('[agent] Reminders sent.');
  }
}

function runStatus(): void {
  const tasks = db.prepare(`
    SELECT type, due_date, status, assigned_to
    FROM tasks
    WHERE due_date >= date('now', 'weekday 0', '-6 days')
    ORDER BY due_date, type
  `).all() as Array<{ type: string; due_date: string; status: string; assigned_to: string }>;

  console.log('\n📅 FamilyOS — This Week\n');
  if (tasks.length === 0) {
    console.log('  No tasks scheduled yet. Run --scan to generate proposals.');
    return;
  }

  for (const t of tasks) {
    const assignee = t.assigned_to ? ` → ${t.assigned_to}` : '';
    console.log(`  ${t.due_date} [${t.status}] ${t.type}${assignee}`);
  }
  console.log('');
}

// Main
switch (mode) {
  case 'scan':
    await runScan();
    break;
  case 'remind':
    await runRemind();
    break;
  case 'status':
    runStatus();
    break;
  default:
    await runScan();
}

process.exit(0);
