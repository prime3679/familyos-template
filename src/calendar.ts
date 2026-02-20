import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  calendar: string;
  allDay: boolean;
  location?: string;
}

// Set these in your .env file
const PRIMARY_ACCOUNT = process.env.PRIMARY_GOOGLE_ACCOUNT ?? '';
const PARTNER_ACCOUNT = process.env.PARTNER_GOOGLE_ACCOUNT ?? '';
const PARTNER_CALENDAR_ID = process.env.PARTNER_CALENDAR_ID ?? PARTNER_ACCOUNT;

function parseEvents(raw: string, calendarLabel: string): CalendarEvent[] {
  const parsed = JSON.parse(raw);
  return (parsed.events ?? parsed ?? []).map((e: Record<string, unknown>) => ({
    id: String(e.id ?? e.eventId ?? ''),
    title: String(e.summary ?? e.title ?? ''),
    start: String(e.start?.dateTime ?? e.start?.date ?? e.start ?? ''),
    end: String(e.end?.dateTime ?? e.end?.date ?? e.end ?? ''),
    calendar: calendarLabel,
    allDay: !!(e.start as Record<string, unknown>)?.date && !(e.start as Record<string, unknown>)?.dateTime,
    location: e.location ? String(e.location) : undefined,
  }));
}

export function getEvents(from: string, to: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  if (!PRIMARY_ACCOUNT) {
    console.warn('[calendar] PRIMARY_GOOGLE_ACCOUNT not set — skipping primary calendar');
    return events;
  }

  // Primary user's calendar
  try {
    const raw = execSync(
      `gog calendar events primary --from "${from}" --to "${to}" --account ${PRIMARY_ACCOUNT} --json`,
      { encoding: 'utf8', timeout: 15000 }
    );
    events.push(...parseEvents(raw, 'person1'));
  } catch { /* silent */ }

  // Partner's shared calendar (if configured)
  if (PARTNER_ACCOUNT && PARTNER_CALENDAR_ID) {
    try {
      const raw = execSync(
        `gog calendar events "${PARTNER_CALENDAR_ID}" --from "${from}" --to "${to}" --account ${PARTNER_ACCOUNT} --json`,
        { encoding: 'utf8', timeout: 15000 }
      );
      events.push(...parseEvents(raw, 'person2'));
    } catch { /* silent */ }
  }

  return events;
}

export async function getPartnerEvents(from: string, to: string): Promise<CalendarEvent[]> {
  if (!PARTNER_ACCOUNT || !PARTNER_CALENDAR_ID) {
    console.warn('[calendar] PARTNER_GOOGLE_ACCOUNT / PARTNER_CALENDAR_ID not set — skipping partner calendar');
    return [];
  }
  try {
    const { stdout } = await execAsync(
      `gog calendar events "${PARTNER_CALENDAR_ID}" --from "${from}" --to "${to}" --account ${PARTNER_ACCOUNT} --json`,
      { encoding: 'utf8', timeout: 15000 }
    );
    return parseEvents(stdout, 'person2');
  } catch {
    return [];
  }
}

export function getWeekEvents(weekStart: Date): CalendarEvent[] {
  const from = formatDate(weekStart);
  const to = formatDate(addDays(weekStart, 7));
  return getEvents(from, to);
}

export function getTodayEvents(): CalendarEvent[] {
  return getEvents('today', 'tomorrow');
}

export function addCalendarEvent(title: string, date: string, time: string, durationMinutes = 60): boolean {
  if (!PRIMARY_ACCOUNT) return false;
  try {
    execSync(
      `gog calendar create primary --summary "${title}" --start "${date}T${time}" --duration ${durationMinutes} --account ${PRIMARY_ACCOUNT}`,
      { encoding: 'utf8', timeout: 15000 }
    );
    return true;
  } catch {
    return false;
  }
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getMonday(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...6=Sat
  // Always return the Monday of the CURRENT week (or next Mon if today is Sun)
  const diff = day === 0 ? 1 : day === 1 ? 0 : -(day - 1);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dayOfWeek(dateStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(dateStr).getDay()];
}

export function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}
