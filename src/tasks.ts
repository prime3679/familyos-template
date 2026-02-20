import { type DB, getWeeklyLoad, getApprovalRate } from './db.ts';
import { getWeekEvents, getMonday, addDays, formatDate, dayOfWeek } from './calendar.ts';
import { getPreferences, isHardBlock, getWorkoutDays, getDropoffDays } from './preferences.ts';

export interface Task {
  id: string;
  type: 'daycare_pickup' | 'daycare_dropoff' | 'meal' | 'errand' | 'date_night';
  dueDate: string;
  dayName: string;
  status: 'pending' | 'proposed' | 'approved' | 'assigned' | 'completed' | 'skipped';
  assignedTo?: 'person1' | 'person2';
  metadata?: Record<string, unknown>;
}

export interface Proposal {
  task: Task;
  suggestedAssignee: 'person1' | 'person2';
  reasoning: string;
  confidence: number;
}

// Identify coordination needs for the coming week
export function identifyWeeklyTasks(db: DB): Task[] {
  const monday = getMonday();
  const events = getWeekEvents(monday);
  const tasks: Task[] = [];
  const today = formatDate(new Date());
  const prefs = getPreferences();

  const dropoffDays = getDropoffDays();

  // Check each weekday for childcare needs
  for (let i = 0; i < 5; i++) {
    const date = addDays(monday, i);
    const dateStr = formatDate(date);

    // Skip days that have already passed
    if (dateStr < today) continue;
    const dayName = dayOfWeek(dateStr);

    // Only schedule dropoff/pickup on configured days (or all weekdays if not configured)
    const isDropoffDay = dropoffDays.length === 0 || dropoffDays.includes(dayName);

    if (!isDropoffDay) continue;

    // Check if there's a childcare event on this day
    const childName = prefs.childcare?.child_name?.toLowerCase() ?? '';
    const hasChildcareEvent = events.some(e =>
      e.start.startsWith(dateStr) &&
      (e.title.toLowerCase().includes('daycare') ||
       e.title.toLowerCase().includes('school') ||
       (childName && e.title.toLowerCase().includes(childName)) ||
       e.title.toLowerCase().includes('pickup') ||
       e.title.toLowerCase().includes('dropoff'))
    );

    tasks.push({
      id: `dropoff-${dateStr}`,
      type: 'daycare_dropoff',
      dueDate: dateStr,
      dayName,
      status: 'pending',
      metadata: { hasChildcareEvent }
    });

    tasks.push({
      id: `pickup-${dateStr}`,
      type: 'daycare_pickup',
      dueDate: dateStr,
      dayName,
      status: 'pending',
      metadata: { hasChildcareEvent }
    });
  }

  // Check for date night opportunity
  const lastDateNight = getLastDateNight(db);
  const daysSinceLastDateNight = lastDateNight
    ? Math.floor((Date.now() - new Date(lastDateNight).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const dateNightPrefs = prefs.date_nights;
  const minDays = dateNightPrefs?.min_frequency === 'weekly' ? 7
    : dateNightPrefs?.min_frequency === 'biweekly' ? 14 : 28;

  if (daysSinceLastDateNight >= minDays) {
    // Find a good Friday or Saturday
    const preferredDateNightDays = dateNightPrefs?.preferred_days ?? ['Friday', 'Saturday'];
    for (let i = 4; i <= 5; i++) {
      const date = addDays(monday, i);
      const dateStr = formatDate(date);
      const dn = dayOfWeek(dateStr);
      const hasConflict = events.some(e => e.start.startsWith(dateStr));

      if (!hasConflict && preferredDateNightDays.includes(dn)) {
        tasks.push({
          id: `date-night-${dateStr}`,
          type: 'date_night',
          dueDate: dateStr,
          dayName: dn,
          status: 'pending',
          metadata: { daysSinceLastDateNight }
        });
        break;
      }
    }
  }

  return tasks;
}

// Core assignment logic — who should do this task?
export function proposeAssignment(
  db: DB,
  task: Task,
  partnerEvents: Array<{ start: string; end: string; title: string; allDay: boolean }> = [],
  approvalRates?: Map<string, number>,
): Proposal {
  const monday = getMonday(new Date(task.dueDate));
  const load = getWeeklyLoad(db, formatDate(monday));

  const person1Load = load.person1;
  const person2Load = load.person2;

  let suggestedAssignee: 'person1' | 'person2' = 'person1';
  let reasoning = '';
  let confidence = 0.6;

  // Hard blocks first
  if (isHardBlock(task.dayName, task.type)) {
    suggestedAssignee = 'person2';
    reasoning = `Person1 has a hard constraint on ${task.dayName}`;
    confidence = 0.95;
    return { task, suggestedAssignee, reasoning, confidence };
  }

  // Preference-based routing
  const workoutDays = getWorkoutDays();

  if (task.type === 'daycare_pickup') {
    // Balance load for pickup
    suggestedAssignee = person1Load <= person2Load ? 'person1' : 'person2';
    reasoning = `Balancing weekly load (person1: ${person1Load}, person2: ${person2Load})`;
    confidence = 0.65;
  } else if (task.type === 'daycare_dropoff') {
    // Dropoff is AM — if person1 has a workout, they're already up early
    const isWorkoutDay = workoutDays.includes(task.dayName);
    if (isWorkoutDay) {
      suggestedAssignee = 'person1';
      reasoning = `Person1 is already up early for workout on ${task.dayName}`;
      confidence = 0.8;
    } else {
      suggestedAssignee = person1Load <= person2Load ? 'person1' : 'person2';
      reasoning = `Balancing weekly load (person1: ${person1Load}, person2: ${person2Load})`;
      confidence = 0.65;
    }
  } else if (task.type === 'date_night') {
    suggestedAssignee = 'person1'; // Primary user initiates date night planning
    reasoning = `It's been ${task.metadata?.daysSinceLastDateNight} days since your last date night`;
    confidence = 0.9;
  } else if (task.type === 'errand') {
    suggestedAssignee = person1Load <= person2Load ? 'person1' : 'person2';
    reasoning = `Balancing weekly errands`;
    confidence = 0.6;
  }

  // Check partner's calendar for conflicts on this task's day
  if (suggestedAssignee === 'person2' && partnerEvents.length > 0) {
    const taskDate = task.dueDate;
    const partnerConflict = partnerEvents.find(e => {
      const eventDate = e.start.split('T')[0];
      return eventDate === taskDate;
    });
    if (partnerConflict) {
      suggestedAssignee = 'person1';
      reasoning = `Partner has "${partnerConflict.title}" on ${task.dayName} — reassigned to person1`;
      confidence = 0.9;
    }
  }

  // Factor in historical approval rate
  let approvalRate: number;
  if (approvalRates) {
    approvalRate = approvalRates.get(`${task.type}:${suggestedAssignee}`) ?? 0.5;
  } else {
    approvalRate = getApprovalRate(db, task.type, suggestedAssignee);
  }

  if (approvalRate < 0.4) {
    // Historically rejected — flip
    suggestedAssignee = suggestedAssignee === 'person1' ? 'person2' : 'person1';
    reasoning += ` (historical approval rate low — reassigned)`;
    confidence = Math.max(confidence - 0.1, 0.5);
  }

  return { task, suggestedAssignee, reasoning, confidence };
}

function getLastDateNight(db: DB): string | null {
  const result = db.prepare(`
    SELECT due_date FROM tasks
    WHERE type = 'date_night' AND status IN ('completed', 'approved', 'assigned')
    ORDER BY due_date DESC LIMIT 1
  `).get() as { due_date: string } | undefined;
  return result?.due_date ?? null;
}

// Filter out tasks already in DB
export function filterNewTasks(db: DB, tasks: Task[]): Task[] {
  return tasks.filter(task => {
    const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(task.id);
    return !existing;
  });
}

// Persist tasks to DB
export function saveTasks(db: DB, tasks: Task[]): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO tasks (id, type, status, due_date, metadata)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const task of tasks) {
    stmt.run(task.id, task.type, task.status, task.dueDate, JSON.stringify(task.metadata ?? {}));
  }
}
