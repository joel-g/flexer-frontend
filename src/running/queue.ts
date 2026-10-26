import type { CanonicalRun, ResultPut } from './contract.ts';
import { pendingDisposition, type PendingDisposition } from './state.ts';
import { RunningIdentityChangedError } from './client.ts';

export interface QueueStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface QueueLock { exclusive<T>(name: string, action: () => Promise<T>): Promise<T> }
export type QueueEntry = { planId: string; runId: string; payload: ResultPut; attempted: boolean; state: 'pending' | PendingDisposition };
type Stored = { version: 1; clearGeneration: number; entries: QueueEntry[] };
export type QueueAccount = Readonly<{ userId: string; incarnation: string }>;
const runKey = (planId: string, runId: string) => JSON.stringify([planId, runId]);
const validRevision = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;

/** The required lock must coordinate all tabs (Web Locks in browser). No unsafe unlocked fallback. */
export class RunningQueue {
  private readonly key: string;
  private epoch = 0;
  private paused = true;
  private clearGeneration: number;
  private readonly account: QueueAccount;
  private readonly storage: QueueStorage;
  private readonly locks: QueueLock;
  constructor(account: QueueAccount, storage: QueueStorage, locks: QueueLock) {
    this.account = { ...account }; this.storage = storage; this.locks = locks;
    if (!account.userId || !account.incarnation) throw new Error('A verified running account is required.');
    this.key = `flexer:running:v1:${JSON.stringify([account.userId, account.incarnation])}`;
    this.clearGeneration = this.read().clearGeneration;
  }
  private read(): Stored {
    const text = this.storage.getItem(this.key);
    if (text === null) return { version: 1, clearGeneration: 0, entries: [] };
    let data: Stored;
    try { data = JSON.parse(text); } catch { throw new Error('Saved running edits are unreadable. They have not been overwritten.'); }
    if (data?.version !== 1 || !validRevision(data.clearGeneration) || !Array.isArray(data.entries) || data.entries.length > 1000 || data.entries.some(entry => !entry || typeof entry.planId !== 'string' || !entry.planId || typeof entry.runId !== 'string' || !entry.runId || typeof entry.attempted !== 'boolean' || !validPayload(entry.payload) || !['pending', 'paused-auth', 'paused-feature', 'needs-correction', 'conflict', 'retry-wait', 'ignore-stale-response'].includes(entry.state)) || new Set(data.entries.map(entry => entry.payload.mutationId)).size !== data.entries.length) throw new Error('Saved running edits are invalid. They have not been overwritten.');
    return data;
  }
  private write(data: Stored) { this.storage.setItem(this.key, JSON.stringify(data)); }
  private transaction<T>(action: (data: Stored) => T): Promise<T> { return this.locks.exclusive(this.key, async () => {
    const data = this.read();
    if (data.clearGeneration !== this.clearGeneration) { this.pause(); throw new RunningIdentityChangedError(); }
    return action(data);
  }); }
  pause() { this.paused = true; this.epoch++; }
  /** Caller must establish fresh auth+incarnation and obtain explicit recovery after ambiguous loss. */
  resume(account: QueueAccount) {
    if (account.userId !== this.account.userId || account.incarnation !== this.account.incarnation) throw new Error('Running edits belong to a different account.');
    this.paused = false;
  }
  isPaused() { return this.paused; }
  /** Explicit same-account recovery, only after fresh authentication AND enabled feature confirmation. */
  async recover(account: QueueAccount) {
    this.pause();
    const epoch = this.epoch;
    const generation = this.read().clearGeneration;
    if (account.userId !== this.account.userId || account.incarnation !== this.account.incarnation) throw new Error('Running edits belong to a different account.');
    await this.locks.exclusive(this.key, async () => {
      const data = this.read();
      if (epoch !== this.epoch || generation !== data.clearGeneration) return;
      for (const entry of data.entries) if (['paused-auth', 'paused-feature', 'ignore-stale-response'].includes(entry.state)) entry.state = 'pending';
      this.write(data);
      this.clearGeneration = data.clearGeneration;
    });
    if (epoch === this.epoch && generation === this.read().clearGeneration) this.resume(account);
  }
  snapshot(): Promise<QueueEntry[]> { return this.transaction(data => structuredClone(data.entries)); }
  /** Only a definitive conflict/validation rejection may be replaced after explicit review. */
  async reconcile(planId: string, runId: string, replacement: ResultPut, newId: () => string = () => crypto.randomUUID()) {
    if (!validPayload(replacement)) throw new Error('Correct the run details before reconciling.');
    const epoch = this.epoch;
    await this.locks.exclusive(`${this.key}:run:${runKey(planId, runId)}`, async () => this.transaction(data => {
      if (this.paused || this.epoch !== epoch) throw new Error('Running edits are paused.');
      const pending = data.entries.filter(item => item.planId === planId && item.runId === runId);
      if (!pending.length || !['conflict', 'needs-correction'].includes(pending[0].state) || pending.slice(1).some(item => item.attempted)) throw new Error('Reload and reconcile the current pending run before editing.');
      if (data.entries.some(item => item.payload.mutationId === replacement.mutationId)) throw new Error('A corrected edit requires a new mutation ID.');
      pending[0].payload = structuredClone(replacement); pending[0].attempted = false; pending[0].state = 'pending';
      pending.slice(1).forEach((entry, index) => { entry.payload = { ...entry.payload, expectedRevision: replacement.expectedRevision + index + 1, mutationId: newId() }; entry.state = 'pending'; });
      if (pending.some(item => !validPayload(item.payload)) || new Set(data.entries.map(item => item.payload.mutationId)).size !== data.entries.length) throw new Error('Reconciled revisions or mutation IDs are invalid.');
      this.write(data);
    }));
  }
  async enqueue(planId: string, runId: string, payload: ResultPut): Promise<void> {
    if (!planId || !runId || !validPayload(payload)) throw new Error('Correct the run details before saving.');
    const epoch = this.epoch;
    await this.transaction(data => {
      if (epoch !== this.epoch || this.paused) throw new Error('Running edits are paused. Reconnect your account before editing.');
      const duplicate = data.entries.find(entry => entry.payload.mutationId === payload.mutationId);
      if (duplicate) {
        if (duplicate.planId !== planId || duplicate.runId !== runId || JSON.stringify(duplicate.payload) !== JSON.stringify(payload)) throw new Error('An existing mutation ID cannot be changed.');
        return;
      }
      const sameRun = data.entries.filter(entry => entry.planId === planId && entry.runId === runId);
      const previous = sameRun.at(-1);
      if (previous && payload.expectedRevision !== previous.payload.expectedRevision + 1) throw new Error('A newer edit must follow the pending run revision.');
      if (data.entries.length >= 1000) throw new Error('Sync or resolve pending edits before adding more.');
      data.entries.push({ planId, runId, payload: structuredClone(payload), attempted: false, state: 'pending' });
      this.write(data); // Failure rejects before the UI may show a saved/optimistic result.
    });
  }
  async flushRun(planId: string, runId: string, send: (entry: QueueEntry) => Promise<CanonicalRun>, acknowledged?: (run: CanonicalRun) => void, privacyFailure?: (error: unknown) => void): Promise<void> {
    if (this.paused) return;
    const epoch = this.epoch;
    await this.locks.exclusive(`${this.key}:run:${runKey(planId, runId)}`, async () => {
      while (!this.paused && epoch === this.epoch) {
        const entry = await this.transaction(data => structuredClone(data.entries.find(item => item.planId === planId && item.runId === runId) ?? null));
        if (!entry || !['pending', 'retry-wait'].includes(entry.state)) return;
        try {
          const prepared = await this.transaction(data => {
            if (epoch !== this.epoch || this.paused) return false;
            const current = data.entries.find(item => item.planId === planId && item.runId === runId);
            if (!current || JSON.stringify(current.payload) !== JSON.stringify(entry.payload)) return false;
            current.attempted = true; this.write(data); return true;
          });
          if (!prepared || epoch !== this.epoch || this.paused) return;
          entry.attempted = true;
          const result = await send(structuredClone(entry));
          if (epoch !== this.epoch || this.paused) return;
          if (!acknowledges(entry, result)) throw new Error('Run save was not acknowledged.');
          await this.transaction(data => {
            if (epoch !== this.epoch || this.paused) return false;
            const index = data.entries.findIndex(item => item.planId === planId && item.runId === runId);
            if (index < 0 || JSON.stringify(data.entries[index].payload) !== JSON.stringify(entry.payload)) return false;
            data.entries.splice(index, 1); this.write(data);
            // Synchronous publication shares the clear-generation critical section.
            if (epoch === this.epoch && !this.paused) acknowledged?.(result);
            return true;
          });
        } catch (error) {
          if (epoch !== this.epoch || this.paused) return;
          const state = pendingDisposition(error);
          if (state === 'paused-auth' || state === 'paused-feature' || state === 'ignore-stale-response') { this.pause(); privacyFailure?.(error); }
          const failureEpoch = this.epoch;
          await this.transaction(data => {
            if (failureEpoch !== this.epoch) return;
            const current = data.entries.find(item => item.payload.mutationId === entry.payload.mutationId);
            if (current) { current.state = state; this.write(data); }
          });
          return; // Backoff scheduling is owned by the later controller; no tight retry loop.
        }
      }
    });
  }
  /** Explicit user-approved signout clear. No resurrection by late in-flight responses. */
  async clearPlan(planId: string) {
    this.pause();
    await this.locks.exclusive(this.key, async () => {
      const data = this.read(); const generation = data.clearGeneration + 1;
      if (!Number.isSafeInteger(generation)) throw new Error('Plan device cleanup failed.');
      this.write({ ...data, clearGeneration: generation, entries: data.entries.filter(entry => entry.planId !== planId) });
      this.clearGeneration = generation;
    });
  }
  async clear() {
    this.pause();
    await this.locks.exclusive(this.key, async () => {
      const generation = this.read().clearGeneration + 1;
      if (!Number.isSafeInteger(generation)) throw new Error('Running storage could not be cleared safely.');
      this.write({ version: 1, clearGeneration: generation, entries: [] });
      this.clearGeneration = generation;
    });
  }
}
function validPayload(payload: ResultPut): boolean {
  if (!payload || typeof payload.mutationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.mutationId) || !validRevision(payload.expectedRevision) || payload.expectedRevision >= Number.MAX_SAFE_INTEGER || !['pending', 'completed', 'skipped'].includes(payload.status)) return false;
  if (payload.effortRpe != null && (!Number.isFinite(payload.effortRpe) || payload.effortRpe < 0 || payload.effortRpe > 10)) return false;
  if (payload.notes != null && (typeof payload.notes !== 'string' || payload.notes.length > 2000)) return false;
  if (payload.status !== 'completed') return payload.actualDate === null && payload.actualDistance === null && payload.durationSeconds === null && payload.paceSecondsPerKm === null && payload.effortRpe == null && (payload.status !== 'pending' || payload.notes == null);
  if (typeof payload.actualDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.actualDate)) return false;
  const [year, month, day] = payload.actualDate.split('-').map(Number);
  const civil = new Date(0); civil.setUTCFullYear(year, month - 1, day);
  if (year < 1 || civil.getUTCFullYear() !== year || civil.getUTCMonth() !== month - 1 || civil.getUTCDate() !== day) return false;
  const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER;
  if (!payload.actualDistance || !['m', 'km', 'mi'].includes(payload.actualDistance.unit) || !positive(payload.actualDistance.value)) return false;
  const meters = payload.actualDistance.value * ({ m: 1, km: 1000, mi: 1609.344 }[payload.actualDistance.unit]);
  if (!positive(meters) || payload.durationSeconds !== null && !positive(payload.durationSeconds) || payload.paceSecondsPerKm !== null && !positive(payload.paceSecondsPerKm) || payload.durationSeconds !== null && payload.paceSecondsPerKm !== null) return false;
  return payload.paceSecondsPerKm === null || positive(payload.paceSecondsPerKm * meters / 1000);
}
function acknowledges(entry: QueueEntry, run: CanonicalRun): boolean {
  const body = entry.payload;
  if (!run || run.planId !== entry.planId || run.id !== entry.runId || run.revision !== body.expectedRevision + 1 || run.status !== body.status || run.actualDate !== body.actualDate || run.effortRpe !== (body.effortRpe ?? null) || run.notes !== (body.notes ?? null)) return false;
  const meters = body.actualDistance ? body.actualDistance.value * ({ m: 1, km: 1000, mi: 1609.344 }[body.actualDistance.unit]) : null;
  const seconds = body.durationSeconds ?? (body.paceSecondsPerKm !== null && meters !== null ? body.paceSecondsPerKm * meters / 1000 : null);
  const equal = (a: number | null, b: number | null) => a === b || a !== null && b !== null && Number.isFinite(a) && Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b));
  const source = body.durationSeconds !== null ? 'entered' : body.paceSecondsPerKm !== null ? 'derived_from_pace' : null;
  return equal(run.actualMeters, meters) && equal(run.durationSeconds, seconds) && run.durationSource === source;
}
