import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { WorkoutProgress, WorkoutDay, WorkoutPlan, PlanResponse, LoadType, WeightUnit, UpsertSetLogRequest, WorkoutSetLog } from '../types/workout';
import { useAuth } from '@clerk/clerk-react';
import { api, sessionApi } from '../services/api';

// Queue item for failed set logs
interface QueuedSetLog {
  sessionId: string;
  request: UpsertSetLogRequest;
  attempts: number;
  lastAttempt: number;
}

const SET_LOG_QUEUE_KEY = 'flexer-set-log-queue';
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 5000;

interface SetLogData {
  exerciseId: string;
  exerciseName: string;
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
  loadType?: LoadType;
}

interface WorkoutContextType {
  currentPlan: WorkoutPlan | null;
  currentPlanId: string | null;
  progress: WorkoutProgress;
  currentWorkout: WorkoutDay | null;
  loading: boolean;
  error: string | null;
  // Session state
  currentSessionId: string | null;
  sessionStartTime: Date | null;
  resumedSetLogs: WorkoutSetLog[];
  // Navigation
  nextWorkout: () => void;
  previousWorkout: () => void;
  completeCurrentWorkout: () => Promise<void>;
  uncompleteWorkout: (workoutDayId: string) => void;
  resetProgress: () => void;
  refreshData: () => Promise<void>;
  deletePlan: () => Promise<boolean>;
  // Session methods
  startWorkoutSession: () => Promise<string | null>;
  logSetCompletion: (data: SetLogData) => Promise<void>;
  endWorkoutSession: (totalSetsPlanned: number, totalSetsCompleted: number) => Promise<void>;
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
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [progress, setProgress] = useState<WorkoutProgress>(() => {
    // Initialize from localStorage for immediate display
    const saved = localStorage.getItem('workout-progress');
    return saved ? JSON.parse(saved) : DEFAULT_PROGRESS;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [resumedSetLogs, setResumedSetLogs] = useState<WorkoutSetLog[]>([]);

  // Debounce timer for syncing to API
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Retry queue for failed set logs
  const retryQueueRef = useRef<QueuedSetLog[]>([]);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load queued set logs from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SET_LOG_QUEUE_KEY);
      if (saved) {
        retryQueueRef.current = JSON.parse(saved);
        if (retryQueueRef.current.length > 0) {
          processRetryQueue();
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save queue to localStorage
  const saveQueueToStorage = useCallback(() => {
    try {
      localStorage.setItem(SET_LOG_QUEUE_KEY, JSON.stringify(retryQueueRef.current));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Process retry queue
  const processRetryQueue = useCallback(async () => {
    if (retryQueueRef.current.length === 0) return;

    const now = Date.now();
    const itemsToRetry = retryQueueRef.current.filter(
      item => now - item.lastAttempt >= RETRY_DELAY_MS && item.attempts < MAX_RETRY_ATTEMPTS
    );

    for (const item of itemsToRetry) {
      try {
        const response = await sessionApi.upsertSetLog(item.sessionId, item.request);
        if (response.success) {
          // Remove from queue on success
          retryQueueRef.current = retryQueueRef.current.filter(q => q !== item);
          console.log('Retry succeeded for set log:', item.request.exerciseName, item.request.setNumber);
        } else {
          // Update attempt count
          item.attempts++;
          item.lastAttempt = now;
          console.warn('Retry failed for set log:', item.request.exerciseName, `(attempt ${item.attempts})`);
        }
      } catch {
        item.attempts++;
        item.lastAttempt = now;
      }
    }

    // Remove items that exceeded max attempts
    const expiredItems = retryQueueRef.current.filter(item => item.attempts >= MAX_RETRY_ATTEMPTS);
    if (expiredItems.length > 0) {
      console.error('Set logs exceeded max retries and were dropped:', expiredItems.length);
      retryQueueRef.current = retryQueueRef.current.filter(item => item.attempts < MAX_RETRY_ATTEMPTS);
    }

    saveQueueToStorage();

    // Schedule next retry if queue still has items
    if (retryQueueRef.current.length > 0) {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(processRetryQueue, RETRY_DELAY_MS);
    }
  }, [saveQueueToStorage]);

  // Add to retry queue
  const addToRetryQueue = useCallback((sessionId: string, request: UpsertSetLogRequest) => {
    retryQueueRef.current.push({
      sessionId,
      request,
      attempts: 1,
      lastAttempt: Date.now(),
    });
    saveQueueToStorage();

    // Start retry timer if not already running
    if (!retryTimerRef.current) {
      retryTimerRef.current = setTimeout(processRetryQueue, RETRY_DELAY_MS);
    }
  }, [saveQueueToStorage, processRetryQueue]);

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
        setCurrentPlanId(plansRes.data.plans[0].id);
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

  const completeCurrentWorkout = async () => {
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

  // Session management methods
  const startWorkoutSession = async (): Promise<string | null> => {
    const workout = getCurrentWorkout();
    if (!workout || !currentPlanId) {
      console.error('Cannot start session: no workout or plan');
      return null;
    }

    try {
      const startTime = new Date();
      const response = await sessionApi.startSession({
        planId: currentPlanId,
        workoutDayId: workout.id,
        weekNumber: progress.currentWeek + 1,
        dayNumber: progress.currentDay + 1,
        workoutName: workout.name,
        startedAt: startTime.toISOString(),
      });

      if (response.success && response.data) {
        const { sessionId, isResume } = response.data;
        setCurrentSessionId(sessionId);
        setSessionStartTime(startTime);

        // If resuming, fetch existing set logs to restore position
        if (isResume) {
          try {
            const detailRes = await sessionApi.getSessionDetail(sessionId);
            if (detailRes.success && detailRes.data?.setLogs) {
              setResumedSetLogs(detailRes.data.setLogs);
              console.log('Session resumed with', detailRes.data.setLogs.length, 'existing set logs');
            }
          } catch (err) {
            console.warn('Failed to fetch set logs for resume:', err);
            setResumedSetLogs([]);
          }
        } else {
          setResumedSetLogs([]);
        }

        console.log('Session started:', sessionId, isResume ? '(resumed)' : '(new)');
        return sessionId;
      } else {
        console.error('Failed to start session:', response.error);
        return null;
      }
    } catch (err) {
      console.error('Error starting session:', err);
      return null;
    }
  };

  const logSetCompletion = async (data: SetLogData): Promise<void> => {
    if (!currentSessionId) {
      console.warn('No active session, skipping set log');
      return;
    }

    const request: UpsertSetLogRequest = {
      exerciseId: data.exerciseId,
      exerciseName: data.exerciseName,
      loadType: data.loadType || 'external_weight',
      setNumber: data.setNumber,
      targetReps: data.targetReps,
      targetWeight: data.targetWeight,
      actualReps: data.actualReps,
      actualWeightValue: data.actualWeightValue,
      actualWeightUnit: data.actualWeightUnit,
      actualDurationSeconds: data.actualDurationSeconds,
      actualDistanceValue: data.actualDistanceValue,
      actualDistanceUnit: data.actualDistanceUnit,
      qualitativeLoadLabel: data.qualitativeLoadLabel,
      completed: true,
      loggedAt: new Date().toISOString(),
    };

    try {
      const response = await sessionApi.upsertSetLog(currentSessionId, request);

      if (!response.success) {
        console.error('Failed to log set, adding to retry queue:', response.error);
        addToRetryQueue(currentSessionId, request);
      }
    } catch (err) {
      console.error('Error logging set, adding to retry queue:', err);
      addToRetryQueue(currentSessionId, request);
    }
  };

  const endWorkoutSession = async (totalSetsPlanned: number, totalSetsCompleted: number): Promise<void> => {
    if (!currentSessionId || !sessionStartTime) {
      console.warn('No active session to end');
      return;
    }

    try {
      const completedAt = new Date();
      const durationSeconds = Math.floor((completedAt.getTime() - sessionStartTime.getTime()) / 1000);

      const response = await sessionApi.completeSession(currentSessionId, {
        completedAt: completedAt.toISOString(),
        durationSeconds,
        totalSetsPlanned,
        totalSetsCompleted,
      });

      if (response.success) {
        console.log('Session completed:', currentSessionId);
      } else {
        console.error('Failed to complete session:', response.error);
      }
    } catch (err) {
      console.error('Error completing session:', err);
    } finally {
      // Clear session state regardless of API result
      setCurrentSessionId(null);
      setSessionStartTime(null);
      setResumedSetLogs([]);
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
        setCurrentPlanId(null);
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
      currentPlanId,
      progress,
      currentWorkout: getCurrentWorkout(),
      loading,
      error,
      currentSessionId,
      sessionStartTime,
      resumedSetLogs,
      nextWorkout,
      previousWorkout,
      completeCurrentWorkout,
      uncompleteWorkout,
      resetProgress,
      refreshData,
      deletePlan,
      startWorkoutSession,
      logSetCompletion,
      endWorkoutSession,
    }}>
      {children}
    </WorkoutContext.Provider>
  );
};
