import type { UpsertSetLogRequest, WorkoutPlan, WorkoutProgress, WorkoutSession } from '../types/workout';

export interface PendingSet { sessionId: string; request: UpsertSetLogRequest }
export function validateSetRequest(request: UpsertSetLogRequest) {
  const numeric = ['actualReps', 'actualWeightValue', 'actualDurationSeconds', 'actualDistanceValue'] as const;
  for (const field of numeric) {
    const value = request[field];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new Error('Enter valid, non-negative workout values.');
  }
  if (request.actualReps !== undefined && !Number.isInteger(request.actualReps)) throw new Error('Reps must be a whole number.');
  if (request.loadType === 'timed' && request.actualDurationSeconds === undefined) throw new Error('Enter the duration before saving this set.');
  if (request.loadType === 'distance' && request.actualDistanceValue === undefined) throw new Error('Enter the distance before saving this set.');
  if (!['timed', 'distance', 'mixed'].includes(request.loadType) && request.actualReps === undefined) throw new Error('Enter your actual reps before saving this set.');
  if (request.loadType === 'mixed' && request.actualReps === undefined && request.actualDurationSeconds === undefined && request.actualDistanceValue === undefined) throw new Error('Enter at least one measurement before saving this set.');
}
export const LEGACY_QUEUE_KEY = 'flexer-set-log-queue';
export const userPrefix = (userId: string) => `flexer:user:${encodeURIComponent(userId)}:`;
export const queueKey = (userId: string, planId: string) => `${userPrefix(userId)}plan:${encodeURIComponent(planId)}:sets`;

/** Resolve a marker only after the API has verified session ownership and plan membership. */
export function recoverCompletionMarker(storage: Storage, key: string, saved: WorkoutProgress,
  session: WorkoutSession, plan: WorkoutPlan): { progress: WorkoutProgress; resume: boolean } {
  if (session.status === 'completed' && saved.completedWorkouts.includes(session.workoutDayId)) {
    // The server acknowledged both writes. Preserve its latest navigation, even if another
    // tab or device has since advanced. Set queues are separate and must still be retried.
    if (storage.getItem(key) === JSON.stringify(session.id)) storage.removeItem(key);
    return { progress: saved, resume: false };
  }
  if (plan.weeks[session.weekNumber - 1]?.days[session.dayNumber - 1]?.id !== session.workoutDayId) {
    throw new Error('Saved workout no longer matches the plan. Please contact support.');
  }
  return { progress: { ...saved, currentWeek: session.weekNumber - 1, currentDay: session.dayNumber - 1 }, resume: true };
}

export function readPending(storage: Storage, key: string): PendingSet[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  // Do not silently overwrite corrupt storage and lose potentially recoverable logs.
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.some(item => !item || typeof item.sessionId !== 'string' ||
      !item.request || typeof item.request.exerciseId !== 'string' || !Number.isInteger(item.request.setNumber))) {
    throw new Error('Saved workout logs could not be read. Keep this browser data and contact support.');
  }
  return value;
}

const sameSet = (a: PendingSet, b: PendingSet) => a.sessionId === b.sessionId &&
  a.request.exerciseId === b.request.exerciseId && a.request.setNumber === b.request.setNumber;

/** Persist first. Only an acknowledged exact version may be removed. No retry expiry. */
export class DurableSetQueue {
  private inFlight: Promise<void> | null = null;
  constructor(privateStorage: Storage, privateKey: string) { this.storage = privateStorage; this.key = privateKey; }
  private storage: Storage;
  private key: string;
  items() { return readPending(this.storage, this.key); }
  enqueue(item: PendingSet) {
    const next = this.items().filter(old => !sameSet(old, item));
    next.push(item);
    this.storage.setItem(this.key, JSON.stringify(next));
  }
  async flush(send: (item: PendingSet) => Promise<void>) {
    if (this.inFlight) await this.inFlight;
    const run = async () => {
      for (const item of this.items()) {
        await send(item);
        const exact = JSON.stringify(item);
        const next = this.items().filter(current => JSON.stringify(current) !== exact);
        this.storage.setItem(this.key, JSON.stringify(next));
      }
    };
    const operation = run();
    this.inFlight = operation;
    try { await operation; } finally { if (this.inFlight === operation) this.inFlight = null; }
  }
}

/** Legacy records are adopted only after the API proves current-user session ownership and plan. */
export async function migrateLegacyQueue(storage: Storage, queue: DurableSetQueue, planId: string,
  lookup: (sessionId: string) => Promise<{ planId?: string } | null>) {
  const legacy = readPending(storage, LEGACY_QUEUE_KEY);
  for (const item of legacy) {
    const session = await lookup(item.sessionId);
    if (session?.planId !== planId) continue;
    const newer = queue.items().find(current => sameSet(current, item) && current.request.loggedAt >= item.request.loggedAt);
    if (!newer) queue.enqueue(item);
    const exact = JSON.stringify(item);
    const remaining = readPending(storage, LEGACY_QUEUE_KEY).filter(current => JSON.stringify(current) !== exact);
    storage.setItem(LEGACY_QUEUE_KEY, JSON.stringify(remaining));
  }
}

export function clearAccountStorage(storage: Storage, userId: string, ownedLegacy: PendingSet[] = []) {
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => !!key);
  for (const key of keys) if (key.startsWith(userPrefix(userId))) storage.removeItem(key);
  // Historical unscoped display caches are never used as another user's state.
  for (const key of ['workout-progress', 'flexer_progress', 'flexer_theme', 'flexer-theme']) storage.removeItem(key);
  // Only remove legacy records whose session ownership was verified before account deletion.
  const owned = new Set(ownedLegacy.map(item => JSON.stringify(item)));
  if (owned.size) {
    const remaining = readPending(storage, LEGACY_QUEUE_KEY).filter(item => !owned.has(JSON.stringify(item)));
    if (remaining.length) storage.setItem(LEGACY_QUEUE_KEY, JSON.stringify(remaining));
    else storage.removeItem(LEGACY_QUEUE_KEY);
  }
}
