export interface AthleteProfile {
  id: string;
  name?: string;
  ftp?: number;
  weight?: number;
  sportSettings?: unknown;
  [key: string]: unknown;
}

export interface Activity {
  name: string;
  type: string;
  start_date_local: string;
  moving_time: number;
  icu_training_load: number;
  icu_atl: number;
  icu_ctl: number;
  icu_weighted_avg_watts: number;
  icu_zone_times?: unknown;
  perceived_exertion?: number;
}

export interface Wellness {
  id: string; // date YYYY-MM-DD
  ctl?: number;
  atl?: number;
  tsb?: number;
  restingHR?: number;
  hrv?: number;
  sleepScore?: number;
}

export interface AthleteData {
  profile: AthleteProfile;
  activities: Activity[];
  wellness: Wellness[];
  syncedAt: string;
  /** Merged in client-side from localStorage before the /api/coach call. */
  weeklyHours?: number;
  preferredDays?: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** A goal race or target event the coach should plan training around. */
export interface TargetEvent {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: string; // e.g. "Race", "Gran Fondo", "Goal Event"
  priority: "A" | "B" | "C";
  notes?: string;
}

export type WorkoutCategory =
  | "WORKOUT"
  | "RACE_A"
  | "RACE_B"
  | "RACE_C"
  | "NOTE";

export interface PlannedWorkout {
  date: string; // YYYY-MM-DD
  name: string;
  type: string;
  description: string;
  planned_duration_seconds: number;
  category: WorkoutCategory | string;
}

export interface PushResult {
  pushed: number;
  errors: string[];
}

/** A single workout inside a coach-generated periodized plan. */
export interface PlanWorkout {
  date: string; // YYYY-MM-DD
  name: string;
  type: string;
  durationMinutes: number;
  description: string;
  intensity: string;
  plannedLoad: number;
}

export interface PlanWeek {
  weekNumber: number;
  phase: string;
  totalHours: number;
  workouts: PlanWorkout[];
}

/** The structured plan emitted by the coach inside a ```plan block. */
export interface GeneratedPlan {
  weeks: PlanWeek[];
}
