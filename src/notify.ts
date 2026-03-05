import { exec } from 'child_process';
import { promisify } from 'util';
import { type Proposal } from './tasks.ts';
import { isQuietHours, getPreferences } from './preferences.ts';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '';

const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY ?? '';
const PARTNER_EMAIL = process.env.PARTNER_EMAIL ?? '';
const AGENTMAIL_FROM_EMAIL = process.env.AGENTMAIL_FROM_EMAIL ?? '';

// Format a weekly proposal batch into a clean Telegram message
export function formatWeeklyProposal(proposals: Proposal[], partnerContext = ''): string {
  if (proposals.length === 0) return '';

  const lines: string[] = [
    '📅 *FamilyOS — Weekly Schedule Proposal*',
    `Week of ${getWeekLabel()}`,
    ''
  ];

  const grouped = groupProposalsByDay(proposals);

  for (const [date, dayProposals] of grouped) {
    const dayName = dayProposals[0].task.dayName;
    lines.push(`*${dayName} (${formatDisplayDate(date)})*`);
    for (const p of dayProposals) {
      const icon = taskIcon(p.task.type);
      const assignee = capitalize(p.suggestedAssignee);
      lines.push(`  ${icon} ${taskLabel(p.task.type)} → ${assignee}`);
    }
    lines.push('');
  }

  if (partnerContext) {
    lines.push(partnerContext);
    lines.push('');
  }

  lines.push('Reply *APPROVE* to confirm, or tell me what to change.');

  return lines.join('\n');
}

export function formatDailyReminder(proposals: Proposal[]): string {
  if (proposals.length === 0) return '';
  const lines = ['⏰ *FamilyOS — Today\'s Reminders*', ''];
  for (const p of proposals) {
    const icon = taskIcon(p.task.type);
    lines.push(`${icon} ${taskLabel(p.task.type)} — ${capitalize(p.suggestedAssignee)}`);
  }
  return lines.join('\n');
}

export function formatAlert(message: string): string {
  return `🔔 *FamilyOS Alert*\n\n${message}`;
}

// Send via Telegram API
export async function sendTelegram(message: string, urgent = false): Promise<boolean> {
  if (!urgent && isQuietHours()) {
    console.log('[notify] Quiet hours — message suppressed until morning');
    return false;
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[notify] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
    return false;
  }

  // Try direct Telegram API first (most reliable)
  const sent = await sendTelegramDirect(message);
  if (sent) return true;

  // Fallback: openclaw message tool
  try {
    const escaped = message.replace(/'/g, "'\\''");
    await promisify(exec)(
      `openclaw message send --channel telegram --target ${TELEGRAM_CHAT_ID} --message '${escaped}'`,
      { encoding: 'utf8', timeout: 10000 }
    );
    return true;
  } catch (e) {
    console.error('[notify] Both Telegram methods failed:', e);
    return false;
  }
}

async function sendTelegramDirect(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Helpers
function taskIcon(type: string): string {
  const icons: Record<string, string> = {
    daycare_pickup: '🧒',
    daycare_dropoff: '🏫',
    meal: '🍽️',
    errand: '🛒',
    date_night: '🌙',
  };
  return icons[type] ?? '📌';
}

function taskLabel(type: string): string {
  // Use child name from preferences if available
  let childName = 'Child';
  try {
    const prefs = getPreferences();
    childName = (prefs as Record<string, unknown> & { childcare?: { child_name?: string } }).childcare?.child_name ?? 'Child';
  } catch { /* preferences not loaded yet */ }

  const labels: Record<string, string> = {
    daycare_pickup: `${childName} pickup`,
    daycare_dropoff: `${childName} dropoff`,
    meal: 'Dinner',
    errand: 'Errands',
    date_night: 'Date night',
  };
  return labels[type] ?? type;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getWeekLabel(): string {
  const monday = new Date();
  const day = monday.getDay();
  monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1));
  return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupProposalsByDay(proposals: Proposal[]): [string, Proposal[]][] {
  const byDay = new Map<string, Proposal[]>();
  for (const p of proposals) {
    const existing = byDay.get(p.task.dueDate) ?? [];
    existing.push(p);
    byDay.set(p.task.dueDate, existing);
  }
  return [...byDay.entries()].sort();
}

// Format weekly proposal as plain-text email for partner
export function formatWeeklyProposalEmail(proposals: Proposal[], partnerContext = ''): { subject: string; text: string } {
  const subject = `FamilyOS — Week of ${getWeekLabel()}`;

  let partnerName = 'Partner';
  let primaryName = 'Primary';
  try {
    const prefs = getPreferences() as Record<string, unknown> & {
      family?: { person1?: { name?: string }; person2?: { name?: string } }
    };
    primaryName = prefs.family?.person1?.name ?? 'Primary';
    partnerName = prefs.family?.person2?.name ?? 'Partner';
  } catch { /* preferences not loaded */ }

  if (proposals.length === 0) {
    return { subject, text: 'Nothing to coordinate this week. Have a good one!' };
  }

  const lines: string[] = [
    `Hi ${partnerName},`,
    ``,
    `Here's the family coordination plan FamilyOS put together for the week of ${getWeekLabel()}:`,
    ``
  ];

  const grouped = groupProposalsByDay(proposals);

  for (const [date, dayProposals] of grouped) {
    const dayName = dayProposals[0].task.dayName;
    lines.push(`${dayName} (${formatDisplayDate(date)})`);
    for (const p of dayProposals) {
      lines.push(`  • ${taskLabel(p.task.type)} → ${capitalize(p.suggestedAssignee)}`);
    }
    lines.push('');
  }

  if (partnerContext) {
    lines.push('');
    lines.push(partnerContext.replace(/\*/g, '')); // strip markdown for email
  }

  lines.push('');
  lines.push(`${primaryName} sees this too and approves the final plan.`);
  lines.push(`Reply to this email if anything doesn't work for you.`);
  lines.push(``);
  lines.push(`— FamilyOS`);

  return { subject, text: lines.join('\n') };
}

// Send weekly proposal email to partner via AgentMail
export async function emailPartner(proposals: Proposal[], partnerContext = ''): Promise<boolean> {
  if (!AGENTMAIL_API_KEY) {
    console.error('[notify] AGENTMAIL_API_KEY not set — skipping partner email');
    return false;
  }

  if (!PARTNER_EMAIL) {
    console.error('[notify] PARTNER_EMAIL not set — skipping partner email');
    return false;
  }

  if (!AGENTMAIL_FROM_EMAIL) {
    console.error('[notify] AGENTMAIL_FROM_EMAIL not set — skipping partner email');
    return false;
  }

  const { subject, text } = formatWeeklyProposalEmail(proposals, partnerContext);

  try {
    const res = await fetch(
      `https://api.agentmail.to/v0/inboxes/${AGENTMAIL_FROM_EMAIL}/messages/send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AGENTMAIL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ to: [PARTNER_EMAIL], subject, text })
      }
    );

    if (res.ok) {
      console.log(`[notify] Partner email sent → ${PARTNER_EMAIL}`);
      return true;
    } else {
      const err = await res.text();
      console.error(`[notify] Partner email failed: ${res.status} ${err}`);
      return false;
    }
  } catch (e) {
    console.error('[notify] Partner email error:', e);
    return false;
  }
}
