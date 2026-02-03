import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { WorkoutProgress, WorkoutDay, WorkoutPlan, PlanResponse } from '../types/workout';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../services/api';

interface WorkoutContextType {
  currentPlan: WorkoutPlan | null;
  progress: WorkoutProgress;
  currentWorkout: WorkoutDay | null;
  loading: boolean;
  error: string | null;
  nextWorkout: () => void;
  previousWorkout: () => void;
  completeCurrentWorkout: () => void;
  uncompleteWorkout: (workoutDayId: string) => void;
  resetProgress: () => void;
  refreshData: () => Promise<void>;
  deletePlan: () => Promise<boolean>;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const useWorkout = () => {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkout must be used within a WorkoutProvider');
  }
  return context;
};

interface WorkoutProviderProps {
  children: ReactNode;
}

const DEFAULT_PROGRESS: WorkoutProgress = {
  currentWeek: 0,
  currentDay: 0,
  completedWorkouts: [],
};

export const WorkoutProvider: React.FC<WorkoutProviderProps> = ({ children }) => {
  const { isSignedIn, getToken } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<WorkoutPlan | null>(null);
  const [progress, setProgress] = useState<WorkoutProgress>(() => {
    // Initialize from localStorage for immediate display
    const saved = localStorage.getItem('workout-progress');
    return saved ? JSON.parse(saved) : DEFAULT_PROGRESS;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer for syncing to API
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set up API token getter
  useEffect(() => {
    api.setTokenGetter(getToken);
  }, [getToken]);

  // Load data from API when signed in
  useEffect(() => {
    if (isSignedIn) {
      loadFromApi();
    } else {
      setLoading(false);
    }
  }, [isSignedIn]);

  // Save progress to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('workout-progress', JSON.stringify(progress));
  }, [progress]);

  // Sync progress to API (debounced)
  const syncProgressToApi = useCallback(async (newProgress: WorkoutProgress) => {
    if (!isSignedIn) return;

    // Clear any pending sync
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    // Debounce API sync by 1 second
    syncTimerRef.current = setTimeout(async () => {
      try {
        await api.put('/progress', {
          currentWeek: newProgress.currentWeek,
          currentDay: newProgress.currentDay,
          completedWorkouts: newProgress.completedWorkouts,
          currentWorkoutState: newProgress.currentWorkoutProgress,
        });
      } catch (err) {
        console.error('Failed to sync progress:', err);
      }
    }, 1000);
  }, [isSignedIn]);

  async function loadFromApi() {
    try {
      setLoading(true);
      setError(null);

      // Fetch plan and progress in parallel
      const [plansRes, progressRes] = await Promise.all([
        api.get<{ plans: PlanResponse[] }>('/plans?active=true'),
        api.get<WorkoutProgress>('/progress'),
      ]);

      if (plansRes.success && plansRes.data?.plans.length) {
        setCurrentPlan(plansRes.data.plans[0].planData);
      }

      if (progressRes.success && progressRes.data) {
        setProgress(progressRes.data);
      }
    } catch (err) {
      console.error('Failed to load from API:', err);
      setError('Failed to load workout data');
    } finally {
      setLoading(false);
    }
  }

  const refreshData = async () => {
    await loadFromApi();
  };

  const getCurrentWorkout = (): WorkoutDay | null => {
    if (!currentPlan) return null;
    if (progress.currentWeek >= currentPlan.weeks.length) {
      return null; // Plan completed
    }

    const currentWeek = currentPlan.weeks[progress.currentWeek];
    if (progress.currentDay >= currentWeek.days.length) {
      return null; // Week completed
    }

    return currentWeek.days[progress.currentDay];
  };

  const nextWorkout = () => {
    if (!currentPlan) return;

    setProgress(prev => {
      const newProgress = { ...prev };
      const currentWeek = currentPlan.weeks[newProgress.currentWeek];

      if (newProgress.currentDay < currentWeek.days.length - 1) {
        // Next day in current week
        newProgress.currentDay++;
      } else if (newProgress.currentWeek < currentPlan.weeks.length - 1) {
        // Next week, first day
        newProgress.currentWeek++;
        newProgress.currentDay = 0;
      }

      syncProgressToApi(newProgress);
      return newProgress;
    });
  };

  const previousWorkout = () => {
    if (!currentPlan) return;

    setProgress(prev => {
      const newProgress = { ...prev };

      if (newProgress.currentDay > 0) {
        // Previous day in current week
        newProgress.currentDay--;
      } else if (newProgress.currentWeek > 0) {
        // Previous week, last day
        newProgress.currentWeek--;
        const prevWeek = currentPlan.weeks[newProgress.currentWeek];
        newProgress.currentDay = prevWeek.days.length - 1;
      }

      syncProgressToApi(newProgress);
      return newProgress;
    });
  };

  const completeCurrentWorkout = () => {
    const currentWorkout = getCurrentWorkout();
    if (currentWorkout) {
      setProgress(prev => {
        const newProgress = {
          ...prev,
          completedWorkouts: [...prev.completedWorkouts, currentWorkout.id],
        };
        syncProgressToApi(newProgress);
        return newProgress;
      });
    }
  };

  const resetProgress = () => {
    const newProgress = DEFAULT_PROGRESS;
    setProgress(newProgress);
    syncProgressToApi(newProgress);
  };

  const uncompleteWorkout = (workoutDayId: string) => {
    setProgress(prev => {
      const newProgress = {
        ...prev,
        completedWorkouts: prev.completedWorkouts.filter(id => id !== workoutDayId),
      };
      syncProgressToApi(newProgress);
      return newProgress;
    });
  };

  const deletePlan = async (): Promise<boolean> => {
    if (!currentPlan) return false;

    try {
      // Find the plan ID - we need to fetch it since we only store planData
      const plansRes = await api.get<{ plans: { id: string }[] }>('/plans?active=true');
      if (!plansRes.success || !plansRes.data?.plans.length) {
        return false;
      }

      const planId = plansRes.data.plans[0].id;
      const deleteRes = await api.delete(`/plans/${planId}`);

      if (deleteRes.success) {
        // Clear local state
        setCurrentPlan(null);
        setProgress(DEFAULT_PROGRESS);
        localStorage.removeItem('workout-progress');
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete plan:', err);
      return false;
    }
  };

  return (
    <WorkoutContext.Provider value={{
      currentPlan,
      progress,
      currentWorkout: getCurrentWorkout(),
      loading,
      error,
      nextWorkout,
      previousWorkout,
      completeCurrentWorkout,
      uncompleteWorkout,
      resetProgress,
      refreshData,
      deletePlan,
    }}>
      {children}
    </WorkoutContext.Provider>
  );
};
