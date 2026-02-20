export type ExerciseLoadType =
  | 'external_weight'
  | 'bodyweight'
  | 'assisted'
  | 'band'
  | 'machine_level'
  | 'timed'
  | 'distance'
  | 'mixed';

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string; // Can be "8-12", "15", "AMRAP", etc.
  loadType: ExerciseLoadType; // Determines which input fields to show
  weight?: string; // "60 lbs", "25 kg", etc. (for external_weight, assisted, band)
  restSeconds?: number;
  notes?: string;
  instructions?: string;
}

export interface WorkoutDay {
  id: string;
  name: string;
  description?: string;
  exercises: Exercise[];
  estimatedDuration?: number; // in minutes
}

export interface WorkoutWeek {
  weekNumber: number;
  name: string;
  description?: string;
  days: WorkoutDay[];
}

export interface WorkoutPlan {
  id: string;
  name: string;
  description: string;
  duration: string; // "6 weeks", "4 weeks", etc.
  weeks: WorkoutWeek[];
}

export interface SetProgress {
  exerciseId: string;
  setNumber: number; // 1-based (Set 1 of 3, Set 2 of 3, etc.)
  completed: boolean;
  timestamp?: Date;
}

export interface WorkoutProgress {
  currentWeek: number;
  currentDay: number;
  completedWorkouts: string[]; // array of workout day IDs
  currentWorkoutProgress?: {
    workoutId: string;
    currentSetIndex: number; // index in the flattened set array
    completedSets: SetProgress[];
  };
}

// ===== User Profile Types =====

export interface UserProfile {
  id: string | null;
  userId: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  heightCm?: number;
  weightKg?: number;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  workoutFrequency?: number;
  workoutDuration?: number;
  fitnessGoals: string[];
  injuries: string[];
  injuryDetails?: string;
  equipmentAvailable: string[];
  equipmentDetails?: string;
  preferredWorkoutTypes: string[];
  customGoal?: string;
}

export interface ProfileUpdateRequest {
  age?: number;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  experienceLevel?: string;
  workoutFrequency?: number;
  workoutDuration?: number;
  fitnessGoals?: string[];
  injuries?: string[];
  injuryDetails?: string;
  equipmentAvailable?: string[];
  equipmentDetails?: string;
  preferredWorkoutTypes?: string[];
  customGoal?: string;
}

// ===== Plan Response Types =====

export interface PlanResponse {
  id: string;
  name: string;
  description: string;
  durationWeeks: number;
  isActive: boolean;
  createdAt: string;
  planData: WorkoutPlan;
}

// ===== Session/Set Logging Types =====

export type LoadType =
  | 'external_weight'
  | 'bodyweight'
  | 'assisted'
  | 'band'
  | 'machine_level'
  | 'timed'
  | 'distance'
  | 'mixed';

export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

export type WeightUnit = 'lbs' | 'kg';

export interface WorkoutSession {
  id: string;
  workoutDayId: string;
  workoutName: string;
  weekNumber: number;
  dayNumber: number;
  status: SessionStatus;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  totalExercises?: number;
  totalSetsPlanned?: number;
  totalSetsCompleted?: number;
}

export interface WorkoutSetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  loadType: LoadType;
  setNumber: number;
  targetReps?: string;
  targetWeight?: string;
  actualReps?: number;
  actualWeightValue?: number;
  actualWeightUnit?: WeightUnit;
  actualDurationSeconds?: number;
  actualDistanceValue?: number;
  actualDistanceUnit?: 'mi' | 'km' | 'm';
  qualitativeLoadLabel?: string;
  completed: boolean;
  loggedAt: string;
}

export interface SessionDetailResponse {
  session: WorkoutSession;
  setLogs: WorkoutSetLog[];
}

export interface StartSessionRequest {
  planId: string;
  workoutDayId: string;
  weekNumber: number;
  dayNumber: number;
  workoutName: string;
  startedAt: string;
}

export interface StartSessionResponse {
  sessionId: string;
  status: SessionStatus;
  isResume: boolean;
}

export interface UpsertSetLogRequest {
  exerciseId: string;
  exerciseName: string;
  loadType: LoadType;
  setNumber: number;
  targetReps?: string;
  targetWeight?: string;
  actualReps?: number;
  actualWeightValue?: number;
  actualWeightUnit?: WeightUnit;
  actualDurationSeconds?: number;
  actualDistanceValue?: number;
  actualDistanceUnit?: 'mi' | 'km' | 'm';
  qualitativeLoadLabel?: string;
  completed: boolean;
  loggedAt: string;
}

export interface CompleteSessionRequest {
  completedAt: string;
  durationSeconds?: number;
  totalSetsPlanned?: number;
  totalSetsCompleted?: number;
}

// ===== History/Analytics Types =====

export type MetricTier = 'core' | 'enhanced';

export interface WeeklyCompletionPoint {
  weekStart: string;
  completed: number;
}

export interface HistoryAnalyticsSummary {
  totalCompleted: number;
  estimatedTotalSets: number | null;
  completionRate: number | null;
  currentStreakDays: number;
  longestStreakDays: number;
  actualTotalVolume: number | null;
}

export interface WeekOverWeek {
  thisWeekCompleted: number;
  lastWeekCompleted: number;
  delta: number;
}

export interface HistoryAnalytics {
  metricTier: MetricTier;
  range: {
    from: string;
    to: string;
    days: number;
  };
  summary: HistoryAnalyticsSummary;
  weeklySeries: WeeklyCompletionPoint[];
  weekOverWeek: WeekOverWeek;
}

export interface SessionListItem {
  id: string;
  workoutDayId: string;
  workoutName: string;
  weekNumber: number;
  dayNumber: number;
  status: string;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  totalExercises?: number;
  totalSetsCompleted?: number;
}

export interface SessionListResponse {
  items: SessionListItem[];
  nextCursor: string | null;
}

// ===== Consistency/Streak Analytics Types =====

export type ConsistencySourceTier = 'session_derived' | 'legacy_fallback';

export interface ConsistencyScoreComponents {
  adherenceRate: number;      // 0-1
  streakStrength: number;     // 0-1
  recencyBonus: number;       // 0-1
  scheduledWorkouts: number;
  completedWorkouts: number;
}

export interface ConsistencyAnalytics {
  asOf: string;
  rangeDays: number;
  currentStreakDays: number;
  longestStreakDays: number;
  consistencyScore: number;   // 0-100
  previousPeriodScore: number | null;
  delta: number | null;
  components: ConsistencyScoreComponents;
  sourceTier: ConsistencySourceTier;
}
