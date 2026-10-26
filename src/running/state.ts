import type { CanonicalRun, StateData } from './contract.ts';
import { RunningApiError, RunningIdentityChangedError } from './client.ts';
import type { AccountScope } from './client.ts';

export type PendingDisposition = 'paused-auth' | 'paused-feature' | 'needs-correction' | 'conflict' | 'retry-wait' | 'ignore-stale-response';
/** Classification only. No persistence, replay, bootstrap, retries or discards happen here. */
export function pendingDisposition(error: unknown): PendingDisposition {
  if (error instanceof RunningIdentityChangedError) return 'ignore-stale-response';
  if (!(error instanceof RunningApiError)) return 'retry-wait';
  if (error.status === 401 || error.code === 'AUTH_REQUIRED') return 'paused-auth';
  if (error.code === 'FEATURE_DISABLED') return 'paused-feature';
  if (error.status === 409 || error.code === 'NOT_FOUND') return 'conflict';
  if (error.status === 413 || error.status === 422 || error.code === 'VALIDATION_FAILED') return 'needs-correction';
  if (error.status >= 400 && error.status < 500 && error.status !== 429) return 'needs-correction';
  return 'retry-wait';
}

export type RunningView = { phase: 'signed-out' | 'loading' | 'ready' | 'disabled' | 'error'; data: StateData | null; error: PendingDisposition | null };
type Ticket = Readonly<{ epoch: number; request: number }>;
const sameScope = (a: AccountScope, b: AccountScope) => a.epoch === b.epoch && a.userId === b.userId && a.incarnation === b.incarnation;

/** In-memory state only. Account transitions synchronously hide all private data. */
export class RunningState {
  private scope: AccountScope = { userId: null, incarnation: null, epoch: 0 };
  private request = 0;
  private runs = new Map<string, CanonicalRun>();
  private view: RunningView = { phase: 'signed-out', data: null, error: null };
  bind(scope: AccountScope) {
    if (sameScope(scope, this.scope)) return;
    this.scope = { ...scope };
    this.request++;
    this.runs.clear();
    this.view = { phase: scope.userId ? 'loading' : 'signed-out', data: null, error: null };
  }
  snapshot(): RunningView { return structuredClone(this.view); }
  begin(): Ticket {
    if (!this.scope.userId) throw new Error('Initialize the authenticated account first.');
    this.view = { phase: 'loading', data: this.view.data, error: null };
    return { epoch: this.scope.epoch, request: ++this.request };
  }
  accept(ticket: Ticket, data: StateData): boolean {
    if (ticket.epoch !== this.scope.epoch || ticket.request !== this.request || !this.scope.userId) return false;
    if (data.enabled && data.account && this.scope.incarnation && data.account.incarnation !== this.scope.incarnation) return false;
    this.view = { phase: data.enabled ? 'ready' : 'disabled', data: structuredClone(data), error: null };
    return true;
  }
  fail(ticket: Ticket, error: unknown): boolean {
    if (ticket.epoch !== this.scope.epoch || ticket.request !== this.request || !this.scope.userId) return false;
    const disposition = pendingDisposition(error);
    if (disposition === 'ignore-stale-response') return false;
    if (disposition === 'paused-auth' || disposition === 'paused-feature') this.runs.clear();
    this.view = { phase: disposition === 'paused-feature' ? 'disabled' : 'error', data: null, error: disposition };
    return true;
  }
  acceptRun(scope: AccountScope, expectedPlanId: string, expectedRunId: string, run: CanonicalRun): boolean {
    if (!sameScope(scope, this.scope) || !scope.userId || !scope.incarnation || run.planId !== expectedPlanId || run.id !== expectedRunId || !Number.isSafeInteger(run.revision) || run.revision < 0) return false;
    const key = `${expectedPlanId}:${expectedRunId}`;
    if ((this.runs.get(key)?.revision ?? -1) >= run.revision) return false;
    this.runs.set(key, structuredClone(run));
    return true;
  }
  run(planId: string, runId: string): CanonicalRun | null { return structuredClone(this.runs.get(`${planId}:${runId}`) ?? null); }
}
