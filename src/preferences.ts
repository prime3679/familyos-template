import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREFS_PATH = path.join(__dirname, '..', 'config', 'preferences.yaml');

export interface FamilyMember {
  name: string;
  role: 'primary' | 'partner';
}

export interface WorkoutEntry {
  day: string;
  type: string;
  time?: string;
}

export interface BlockedTime {
  day: string;
  time: string;
  label: string;
}

export interface Preferences {
  family: {
    person1: FamilyMember;
    person2: FamilyMember;
  };
  childcare: {
    child_name: string;
    dropoff_days: string[];
    dropoff_time: string;
    pickup_time: string;
    earliest_morning: string;
  };
  fitness: {
    workouts: WorkoutEntry[];
    min_per_week: number;
  };
  work: {
    heavy_days: string[];
    blocked_times: BlockedTime[];
  };
  notifications: {
    quiet_start: string;
    quiet_end: string;
  };
  // Legacy fields (kept for compatibility)
  daycare?: {
    preferred_pickup_days?: string[];
    preferred_dropoff_days?: string[];
    hard_constraints?: string[];
    pickup_time?: string;
    dropoff_time?: string;
  };
  workouts?: {
    schedule?: string[];
    typical_time?: string;
  };
  date_nights?: {
    min_frequency?: string;
    preferred_days?: string[];
    babysitter_needed?: boolean;
  };
  errands?: {
    preferred_days?: string[];
    max_per_week?: number;
  };
}

let cached: Preferences | null = null;

export function resetPreferencesCache() {
  cached = null;
}

export function getPreferences(): Preferences {
  if (cached) return cached;
  if (!fs.existsSync(PREFS_PATH)) {
    throw new Error(
      `preferences.yaml not found at ${PREFS_PATH}\n` +
      `Copy config/preferences.example.yaml → config/preferences.yaml and fill in your details.`
    );
  }
  const raw = fs.readFileSync(PREFS_PATH, 'utf8');
  cached = yaml.load(raw) as Preferences;
  return cached;
}

export function isQuietHours(): boolean {
  const prefs = getPreferences();
  const now = new Date();
  const hour = now.getHours();

  const quietStart = prefs.notifications?.quiet_start ?? '21:00';
  const quietEnd = prefs.notifications?.quiet_end ?? '07:00';

  const startH = parseHour(quietStart);
  const endH = parseHour(quietEnd);

  // quiet wraps midnight: e.g. 21:00 - 07:00
  if (startH > endH) return hour >= startH || hour < endH;
  return hour >= startH && hour < endH;
}

// Parse "10:00pm" → 22, "6:00am" → 6, "22:00" → 22, "07:00" → 7
function parseHour(timeStr: string): number {
  const s = timeStr.toLowerCase().trim();
  const pm = s.includes('pm');
  const am = s.includes('am');
  const numeric = s.replace(/[apm\s]/g, '');
  const [h] = numeric.split(':').map(Number);
  if (pm && h !== 12) return h + 12;
  if (am && h === 12) return 0;
  return h;
}

export function getWorkoutDays(): string[] {
  const prefs = getPreferences();
  // Support both new (fitness.workouts) and legacy (workouts.schedule) format
  if (prefs.fitness?.workouts) {
    return prefs.fitness.workouts.map(w => capitalize(w.day));
  }
  return prefs.workouts?.schedule ?? [];
}

export function getDropoffDays(): string[] {
  const prefs = getPreferences();
  if (prefs.childcare?.dropoff_days) {
    return prefs.childcare.dropoff_days.map(d => capitalize(d));
  }
  return prefs.daycare?.preferred_dropoff_days ?? [];
}

export function getPickupDays(): string[] {
  const prefs = getPreferences();
  // Default: pickup on non-dropoff days, or use legacy config
  return prefs.daycare?.preferred_pickup_days ?? [];
}

export function isHardBlock(dayName: string, taskType: string): boolean {
  const prefs = getPreferences();

  // Work heavy days block family task proposals
  if (prefs.work?.heavy_days?.map(d => capitalize(d)).includes(capitalize(dayName))) {
    if (taskType === 'errand' || taskType === 'meal') return true;
  }

  // Check legacy hard constraints
  return (prefs.daycare?.hard_constraints ?? []).some(c =>
    c.toLowerCase().includes(dayName.toLowerCase()) &&
    c.toLowerCase().includes('never')
  );
}

export function prefersDay(taskType: 'pickup' | 'dropoff' | 'errand', dayName: string): boolean {
  if (taskType === 'pickup') return getPickupDays().includes(dayName);
  if (taskType === 'dropoff') return getDropoffDays().includes(dayName);
  if (taskType === 'errand') {
    const prefs = getPreferences();
    return (prefs.errands?.preferred_days ?? []).includes(dayName);
  }
  return false;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
