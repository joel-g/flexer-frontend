export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string; // Can be "8-12", "15", "AMRAP", etc.
  weight?: string; // "bodyweight", "60 lbs", "previous + 5 lbs", etc.
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
