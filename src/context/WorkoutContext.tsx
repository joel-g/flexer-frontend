import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { WorkoutProgress, WorkoutDay, WorkoutPlan, PlanResponse, LoadType, WeightUnit, UpsertSetLogRequest, WorkoutSetLog } from '../types/workout';
import { useAuth } from '@clerk/clerk-react';
import { api, sessionApi } from '../services/api';
import { DurableSetQueue, migrateLegacyQueue, queueKey, userPrefix, validateSetRequest, recoverCompletionMarker } from '../services/workoutStorage';

interface SetLogData {
  exerciseId: string; exerciseName: string; setNumber: number;
  targetReps?: string; targetWeight?: string; actualReps?: number;
  actualWeightValue?: number; actualWeightUnit?: WeightUnit;
  actualDurationSeconds?: number; actualDistanceValue?: number;
  actualDistanceUnit?: 'mi' | 'km' | 'm'; qualitativeLoadLabel?: string; loadType?: LoadType;
}
interface WorkoutContextType {
  currentPlan: WorkoutPlan | null; currentPlanId: string | null;
  progress: WorkoutProgress; currentWorkout: WorkoutDay | null; loading: boolean; error: string | null;
  syncMessage: string | null;
  currentSessionId: string | null; sessionStartTime: Date | null; resumedSetLogs: WorkoutSetLog[];
  nextWorkout: () => void; previousWorkout: () => void;
  completeCurrentWorkout: () => Promise<void>; uncompleteWorkout: (id: string) => void;
  resetProgress: () => void; refreshData: () => Promise<void>; deletePlan: () => Promise<boolean>;
  startWorkoutSession: () => Promise<string | null>;
  logSetCompletion: (data: SetLogData) => Promise<void>;
  endWorkoutSession: (planned: number, completed: number) => Promise<void>;
}
const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);
export const useWorkout = () => {
  const context = useContext(WorkoutContext);
  if (!context) throw new Error('useWorkout must be used within a WorkoutProvider');
  return context;
};
const DEFAULT_PROGRESS: WorkoutProgress = { currentWeek: 0, currentDay: 0, completedWorkouts: [] };
const message = (err: unknown) => err instanceof Error ? err.message : 'Could not save your workout. Please retry.';

export const WorkoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { userId } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<WorkoutPlan | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [progress, setProgress] = useState<WorkoutProgress>(DEFAULT_PROGRESS);
  const progressRef = useRef(progress);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [resumedSetLogs, setResumedSetLogs] = useState<WorkoutSetLog[]>([]);
  const queueRef = useRef<DurableSetQueue | null>(null);
  const alive = useRef(true);
  const startRef = useRef<Promise<string | null> | null>(null);
  const progressWrites = useRef<Promise<void>>(Promise.resolve());
  const sessionRef = useRef<string | null>(null);
  const storageKey = userId && currentPlanId ? `${userPrefix(userId)}plan:${encodeURIComponent(currentPlanId)}:progress` : null;
  const completionKey = storageKey ? `${storageKey}:completion` : null;

  const flushLogs = useCallback(async () => {
    const queue = queueRef.current;
    if (!queue) return;
    await queue.flush(async item => {
      if (!alive.current) throw new Error('Workout closed. Saved logs will retry next time.');
      const response = await sessionApi.upsertSetLog(item.sessionId, item.request);
      if (!response.success) throw new Error(response.error || 'Set not saved. Please retry.');
    });
    if (alive.current) setSyncMessage(queue.items().length ? 'Some sets are waiting to sync.' : null);
  }, []);

  useEffect(() => {
    alive.current = true;
    const retry = () => { void flushLogs().catch(err => { if (alive.current) setSyncMessage(message(err)); }); };
    const timer = setInterval(retry, 15000);
    window.addEventListener('online', retry);
    return () => { alive.current = false; clearInterval(timer); window.removeEventListener('online', retry); };
  }, [flushLogs]);

  const loadFromApi = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true); setError(null);
      const [plansRes, progressRes] = await Promise.all([
        api.get<{ plans: PlanResponse[] }>('/plans?active=true'), api.get<WorkoutProgress>('/progress'),
      ]);
      if (!plansRes.success || !progressRes.success) throw new Error(plansRes.error || progressRes.error || 'Could not load workouts');
      if (!alive.current) return;
      const plan = plansRes.data?.plans[0];
      setCurrentPlan(plan?.planData ?? null); setCurrentPlanId(plan?.id ?? null);
      const saved = progressRes.data ?? DEFAULT_PROGRESS;
      const week = Number.isInteger(saved.currentWeek) && saved.currentWeek >= 0 && saved.currentWeek < (plan?.planData.weeks.length ?? 0) ? saved.currentWeek : 0;
      const day = Number.isInteger(saved.currentDay) && saved.currentDay >= 0 && saved.currentDay < (plan?.planData.weeks[week]?.days.length ?? 0) ? saved.currentDay : 0;
      const normalized = { ...saved, currentWeek: week, currentDay: day, completedWorkouts: Array.isArray(saved.completedWorkouts) ? saved.completedWorkouts : [] };
      if (plan) {
        const pendingKey = `${userPrefix(userId)}plan:${encodeURIComponent(plan.id)}:progress:completion`;
        const pending = localStorage.getItem(pendingKey);
        if (pending) {
          const pendingId: unknown = JSON.parse(pending);
          if (typeof pendingId !== 'string') throw new Error('Saved completion could not be read. Keep this browser data and contact support.');
          const detail = await sessionApi.getSessionDetail(pendingId);
          if (!detail.success || !detail.data || detail.data.session.planId !== plan.id) throw new Error('Could not restore your pending workout completion. Please reconnect and retry.');
          const session = detail.data.session;
          const recovery = recoverCompletionMarker(localStorage, pendingKey, normalized, session, plan.planData);
          Object.assign(normalized, recovery.progress);
          if (recovery.resume) {
            sessionRef.current = pendingId; setCurrentSessionId(pendingId);
            setSessionStartTime(new Date(session.startedAt)); setResumedSetLogs(detail.data.setLogs);
          } else {
            sessionRef.current = null; setCurrentSessionId(null);
            setSessionStartTime(null); setResumedSetLogs([]);
          }
        }
      }
      progressRef.current = normalized; setProgress(normalized);
      if (plan) {
        const queue = new DurableSetQueue(localStorage, queueKey(userId, plan.id));
        queue.items(); // Validate before allowing another write to this cache.
        queueRef.current = queue;
        try {
          await migrateLegacyQueue(localStorage, queue, plan.id, async id => {
            if (!alive.current) throw new Error('Account changed. Resume this workout after signing in.');
            const detail = await sessionApi.getSessionDetail(id);
            if (!alive.current) throw new Error('Account changed. Resume this workout after signing in.');
            return detail.success ? detail.data?.session ?? null : null;
          });
          await flushLogs();
        } catch (err) { if (alive.current) setSyncMessage(message(err)); }
      }
    } catch (err) { if (alive.current) setError(message(err)); }
    finally { if (alive.current) setLoading(false); }
  }, [userId, flushLogs]);
  useEffect(() => { void loadFromApi(); }, [loadFromApi]);

  const saveProgress = async (next: WorkoutProgress) => {
    const write = progressWrites.current.catch(() => {}).then(async () => {
      if (!alive.current) throw new Error('Workout closed before progress could be saved.');
      const response = await api.put('/progress', {
        currentWeek: next.currentWeek, currentDay: next.currentDay,
        completedWorkouts: next.completedWorkouts, currentWorkoutState: next.currentWorkoutProgress,
      });
      if (!response.success) throw new Error(response.error || 'Progress could not be saved');
    });
    progressWrites.current = write;
    await write;
    if (alive.current) { progressRef.current = next; setProgress(next); }
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const currentWorkout = currentPlan?.weeks[progress.currentWeek]?.days[progress.currentDay] ?? null;
  const navigateWorkout = async (direction: number) => {
    if (!currentPlan) return;
    try {
      await flushLogs();
      const next = { ...progressRef.current };
      const week = currentPlan.weeks[next.currentWeek];
      if (!week) return;
      if (direction > 0) {
        if (next.currentDay < week.days.length - 1) next.currentDay++;
        else if (next.currentWeek < currentPlan.weeks.length - 1) { next.currentWeek++; next.currentDay = 0; }
      } else if (next.currentDay > 0) next.currentDay--;
      else if (next.currentWeek > 0) { next.currentWeek--; next.currentDay = currentPlan.weeks[next.currentWeek].days.length - 1; }
      await saveProgress(next);
      sessionRef.current = null; setCurrentSessionId(null); setSessionStartTime(null); setResumedSetLogs([]);
    } catch (err) { setSyncMessage(message(err)); }
  };
  const completeCurrentWorkout = async () => {
    if (!currentWorkout) throw new Error('Workout unavailable');
    const next = { ...progressRef.current, completedWorkouts: [...new Set([...progressRef.current.completedWorkouts, currentWorkout.id])] };
    await saveProgress(next);
    if (completionKey) localStorage.removeItem(completionKey);
    // Only clear the session after both server completion and progress acknowledgement.
    sessionRef.current = null; setCurrentSessionId(null); setSessionStartTime(null); setResumedSetLogs([]);
  };
  const startWorkoutSession = (): Promise<string | null> => {
    if (sessionRef.current) return Promise.resolve(sessionRef.current);
    if (startRef.current) return startRef.current;
    const start = async () => {
      if (!currentWorkout || !currentPlanId) return null;
      try {
        const now = new Date();
        const response = await sessionApi.startSession({ planId: currentPlanId, workoutDayId: currentWorkout.id,
          weekNumber: progressRef.current.currentWeek + 1, dayNumber: progressRef.current.currentDay + 1,
          workoutName: currentWorkout.name, startedAt: now.toISOString() });
        if (!response.success || !response.data) throw new Error(response.error || 'Could not start workout');
        const id = response.data.sessionId;
        // Fetch authoritative original start time and sets, also on resumed sessions.
        const detail = await sessionApi.getSessionDetail(id);
        if (!detail.success || !detail.data) throw new Error(detail.error || 'Could not restore workout');
        if (!alive.current) return null;
        const began = new Date(detail.data.session.startedAt);
        if (!Number.isFinite(began.getTime())) throw new Error('Workout start time is invalid');
        sessionRef.current = id; setCurrentSessionId(id); setSessionStartTime(began);
        setResumedSetLogs(detail.data.setLogs); setSyncMessage(null);
        return id;
      } catch (err) { if (alive.current) setSyncMessage(message(err)); return null; }
    };
    startRef.current = start().finally(() => { startRef.current = null; });
    return startRef.current;
  };
  const logSetCompletion = async (data: SetLogData) => {
    const id = sessionRef.current ?? await startWorkoutSession();
    const queue = queueRef.current;
    if (!id || !queue) throw new Error('Connect to start this workout before logging sets.');
    const request: UpsertSetLogRequest = { ...data, loadType: data.loadType ?? 'external_weight', completed: true, loggedAt: new Date().toISOString() };
    validateSetRequest(request);
    queue.enqueue({ sessionId: id, request }); // Storage failure prevents advancing; no data silently lost.
    try { await flushLogs(); } catch { setSyncMessage('Sets saved on this device. Reconnect and retry before finishing.'); }
  };
  const endWorkoutSession = async (totalSetsPlanned: number, totalSetsCompleted: number) => {
    const id = sessionRef.current;
    if (!id || !sessionStartTime) throw new Error('No active session. Please reconnect and resume.');
    await flushLogs();
    if (queueRef.current?.items().some(item => item.sessionId === id)) throw new Error('Some sets still need to sync. Retry when connected.');
    if (!completionKey) throw new Error('Workout storage is unavailable. Please retry.');
    localStorage.setItem(completionKey, JSON.stringify(id));
    const completedAt = new Date();
    const response = await sessionApi.completeSession(id, { completedAt: completedAt.toISOString(),
      durationSeconds: Math.max(0, Math.floor((completedAt.getTime() - sessionStartTime.getTime()) / 1000)), totalSetsPlanned, totalSetsCompleted });
    if (!response.success) throw new Error(response.error || 'Workout completion was not saved. Please retry.');
  };
  const resetProgress = () => { void saveProgress(DEFAULT_PROGRESS).catch(err => setSyncMessage(message(err))); };
  const uncompleteWorkout = (id: string) => {
    void saveProgress({ ...progressRef.current, completedWorkouts: progressRef.current.completedWorkouts.filter(value => value !== id) }).catch(err => setSyncMessage(message(err)));
  };
  const deletePlan = async () => {
    if (!currentPlanId) return false;
    try {
      await flushLogs();
      const response = await api.delete(`/plans/${currentPlanId}`);
      if (!response.success) throw new Error(response.error || 'Could not delete plan');
      if (storageKey) localStorage.removeItem(storageKey);
      queueRef.current = null; setCurrentPlan(null); setCurrentPlanId(null);
      progressRef.current = DEFAULT_PROGRESS; setProgress(DEFAULT_PROGRESS);
      return true;
    } catch (err) { setSyncMessage(message(err)); return false; }
  };
  return <WorkoutContext.Provider value={{ currentPlan, currentPlanId, progress, currentWorkout, loading, error, syncMessage,
    currentSessionId, sessionStartTime, resumedSetLogs,
    nextWorkout: () => { void navigateWorkout(1); }, previousWorkout: () => { void navigateWorkout(-1); },
    completeCurrentWorkout, uncompleteWorkout, resetProgress, refreshData: loadFromApi, deletePlan,
    startWorkoutSession, logSetCompletion, endWorkoutSession }}>{children}</WorkoutContext.Provider>;
};
