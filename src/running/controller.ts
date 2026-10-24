import { RunningQueue, type QueueAccount, type QueueEntry, type QueueLock, type QueueStorage } from './queue.ts';
import { RunningApiError, type RunningClient } from './client.ts';
import type { CanonicalRun, ResultPut } from './contract.ts';

export type SyncState = { entries: QueueEntry[]; runs: Record<string, CanonicalRun>; paused: boolean; error: string; retryAt: number | null };
export class RunningController {
  readonly queue: RunningQueue;
  private state: SyncState = { entries: [], runs: {}, paused: true, error: '', retryAt: null };
  private listeners = new Set<() => void>();
  private alive = true;
  private online = true;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private flushing = false;
  private rerun = false;
  private epoch = 0;
  private hidden = false;
  constructor(privateOptions: { account: QueueAccount; storage: QueueStorage; locks: QueueLock; client: Pick<RunningClient, 'result'>; onRun: (run: CanonicalRun) => void; onPrivacyFailure?: (error: unknown) => void }) {
    this.options = privateOptions;
    this.queue = new RunningQueue(privateOptions.account, privateOptions.storage, privateOptions.locks);
  }
  private readonly options: { account: QueueAccount; storage: QueueStorage; locks: QueueLock; client: Pick<RunningClient, 'result'>; onRun: (run: CanonicalRun) => void; onPrivacyFailure?: (error: unknown) => void };
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private publish(patch: Partial<SyncState> = {}) { if (!this.alive) return; this.state = { ...this.state, ...patch, paused: this.queue.isPaused() }; this.listeners.forEach(listener => listener()); }
  async load() {
    const epoch = this.epoch;
    try { const entries = await this.queue.snapshot(); if (epoch === this.epoch && !this.hidden) this.publish({ entries }); } catch (error) { this.pause(); this.publish({ entries: [], error: error instanceof Error ? error.message : 'Saved edits could not be read.' }); }
  }
  async initialize() { const epoch = this.epoch; await this.load(); if (epoch === this.epoch && !this.state.entries.length && !this.state.error && this.alive) { this.queue.resume(this.options.account); this.publish(); } }
  setOnline(online: boolean) { this.online = online; if (online && !this.queue.isPaused()) void this.flush(); }
  pause() { this.epoch++; this.hidden = true; this.queue.pause(); if (this.timer) clearTimeout(this.timer); this.timer = null; this.publish({ entries: [], runs: {}, retryAt: null }); }
  quiesce() { this.epoch++; this.queue.pause(); if (this.timer) clearTimeout(this.timer); this.timer = null; this.publish({ retryAt: null }); }
  async clearPlan(planId: string) { this.quiesce(); await this.queue.clearPlan(planId); await this.load(); const runs = { ...this.state.runs }; for (const [key, run] of Object.entries(runs)) if (run.planId === planId) delete runs[key]; this.publish({ runs }); }
  dispose() { this.pause(); this.alive = false; this.listeners.clear(); }
  async recover() { const epoch = this.epoch; await this.queue.recover(this.options.account); if (!this.alive || epoch !== this.epoch || this.queue.isPaused()) return; this.hidden = false; await this.load(); void this.flush(); }
  async save(planId: string, runId: string, payload: ResultPut, reconcile = false) {
    if (reconcile) await this.queue.reconcile(planId, runId, payload); else await this.queue.enqueue(planId, runId, payload);
    await this.load(); void this.flush();
  }
  async clear() { this.pause(); await this.queue.clear(); this.publish({ entries: [], error: '' }); }
  async flush() {
    if (!this.alive || !this.online || this.queue.isPaused()) return;
    if (this.flushing) { this.rerun = true; return; }
    if (this.state.retryAt !== null && this.state.retryAt > Date.now()) {
      if (!this.timer) this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, this.state.retryAt - Date.now());
      return;
    }
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.flushing = true; const epoch = this.epoch; let retryAfter = 0; let failed = false;
    try {
      const entries = await this.queue.snapshot();
      const runs = new Map(entries.map(entry => [JSON.stringify([entry.planId, entry.runId]), entry]));
      await Promise.all([...runs.values()].map(entry => this.queue.flushRun(entry.planId, entry.runId, async item => {
        try { const { data } = await this.options.client.result(item.planId, item.runId, item.payload); return data; }
        catch (error) { failed = true; if (error instanceof RunningApiError) retryAfter = Math.max(retryAfter, error.retryAfterMs ?? 0); throw error; }
      }, run => { if (this.alive && epoch === this.epoch) { this.publish({ runs: { ...this.state.runs, [JSON.stringify([run.planId, run.id])]: run } }); this.options.onRun(run); } }, error => { this.pause(); this.options.onPrivacyFailure?.(error); })));
      if (!this.alive || epoch !== this.epoch) return;
      await this.load();
      if (this.state.entries.some(entry => entry.state === 'retry-wait') && !this.queue.isPaused()) {
        const delay = Math.max(retryAfter, Math.min(60000, 1000 * 2 ** Math.min(this.attempts++, 6)));
        this.publish({ retryAt: Date.now() + delay }); this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, delay);
      } else if (!failed) { this.attempts = 0; this.publish({ retryAt: null }); }
    } catch (error) { this.publish({ error: error instanceof Error ? error.message : 'Running sync failed. Saved edits are retained.' }); }
    finally { this.flushing = false; if (this.rerun) { this.rerun = false; void this.flush(); } }
  }
}

export function browserQueueLocks(): QueueLock {
  if (!navigator.locks) throw new Error('This browser cannot safely coordinate offline edits across tabs. Use a browser with Web Locks support.');
  return { exclusive: async (name, action) => await navigator.locks.request(name, { mode: 'exclusive' }, action) };
}
