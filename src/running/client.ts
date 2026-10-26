import type { AccountState, Activation, ApiResponse, Archive, Bootstrap, CanonicalPlan, CanonicalRun, DraftCreate, ErrorCode, FieldError, PlanListData, PlanListQuery, PreferencesPut, ResultPut, SchedulePut, StateData } from './contract.ts';
import type { RunningHistoryData, RunningHistoryQuery, RunningAnalyticsData, RunningAnalyticsQuery } from './contract.ts';
import { validAnalytics, validHistory } from './historyValidation.ts';

type Failure = Extract<ApiResponse<never>, { success: false }>;
type Fetcher = (input: string, init: RequestInit) => Promise<Response>;
type Auth = { userId: string; getToken: () => Promise<string | null> };
export type AccountScope = Readonly<{ userId: string | null; incarnation: string | null; epoch: number }>;
export interface RunningResponse<T> { data: T; status: number }

export class RunningIdentityChangedError extends Error {
  constructor() { super('Account changed. The previous response was ignored.'); this.name = 'RunningIdentityChangedError'; }
}

export class RunningApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fieldErrors: FieldError[];
  readonly current?: Failure['current'];
  readonly requestId?: string;
  readonly retryAfterMs: number | null;
  constructor(status: number, failure: Omit<Failure, 'success' | 'requestId'> & { requestId?: string }, retryAfterMs: number | null = null) {
    super(failure.error);
    this.name = 'RunningApiError';
    this.status = status;
    this.code = failure.code;
    this.fieldErrors = failure.fieldErrors ?? [];
    this.current = failure.current;
    this.requestId = failure.requestId;
    this.retryAfterMs = retryAfterMs;
  }
}

const codes: ReadonlySet<string> = new Set<ErrorCode>(['AUTH_REQUIRED', 'FEATURE_DISABLED', 'NOT_FOUND', 'REVISION_CONFLICT', 'STALE_OPERATION', 'OPERATION_ID_REUSED', 'ACCOUNT_REPLACED', 'SCHEDULE_COLLISION', 'HISTORY_CHANGED', 'PAYLOAD_TOO_LARGE', 'VALIDATION_FAILED', 'RATE_LIMITED', 'TEMPORARY_FAILURE']);
const segment = (id: string) => {
  if (!id) throw new Error('A resource ID is required.');
  return encodeURIComponent(id);
};
const fallbackCode = (status: number): ErrorCode => status === 401 ? 'AUTH_REQUIRED' : status === 404 ? 'NOT_FOUND' : status === 409 ? 'REVISION_CONFLICT' : status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 429 ? 'RATE_LIMITED' : status >= 400 && status < 500 ? 'VALIDATION_FAILED' : 'TEMPORARY_FAILURE';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const revision = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
function validRun(value: unknown, planId: string, runId: string, expectedRevision: number): value is CanonicalRun {
  if (!record(value) || value.id !== runId || value.planId !== planId || value.revision !== expectedRevision + 1 || !revision(value.revision) || !date(value.originalDate) || !date(value.scheduledDate)) return false;
  if (value.notes !== null && typeof value.notes !== 'string') return false;
  if (value.effortRpe !== null && !(typeof value.effortRpe === 'number' && Number.isFinite(value.effortRpe) && value.effortRpe >= 0 && value.effortRpe <= 10)) return false;
  if (value.status === 'pending' || value.status === 'skipped') return value.actualDate === null && value.actualMeters === null && value.durationSeconds === null && value.durationSource === null && value.effortRpe === null && (value.status !== 'pending' || value.notes === null);
  return value.status === 'completed' && date(value.actualDate) && positive(value.actualMeters) && (value.durationSeconds === null ? value.durationSource === null : positive(value.durationSeconds) && ['entered', 'derived_from_pace'].includes(String(value.durationSource)));
}
function retryAfter(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Math.min(Number(value) * 1000, 86_400_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.min(date - Date.now(), 86_400_000)) : null;
}

/** No singleton or global identity. The auth boundary must explicitly initialize this client. */
export class RunningClient {
  private auth: Auth | null = null;
  private incarnation: string | null = null;
  private epoch = 0;
  private controllers = new Set<AbortController>();
  private failureHandler: ((error: unknown) => void) | null = null;
  onFailure(handler: ((error: unknown) => void) | null) { this.failureHandler = handler; }
  cancelPending() { this.invalidate(); }
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly timeoutMs: number;
  constructor(baseUrl: string, fetcher: Fetcher = (url, init) => fetch(url, init), timeoutMs = 15000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
  }
  setIdentity(userId: string | null, getToken: (() => Promise<string | null>) | null) {
    this.invalidate();
    this.auth = userId && getToken ? { userId, getToken } : null;
    this.incarnation = null;
  }
  /** Call only with an acknowledged, current account response. Never use this value for ownership. */
  bindIncarnation(scope: AccountScope, incarnation: string) {
    this.assertScope(scope);
    if (!incarnation) throw new Error('Account incarnation is required.');
    if (this.incarnation !== incarnation) { this.invalidate(); this.incarnation = incarnation; }
  }
  scope(): AccountScope { return { userId: this.auth?.userId ?? null, incarnation: this.incarnation, epoch: this.epoch }; }
  private invalidate() { this.epoch++; for (const controller of this.controllers) controller.abort(); this.controllers.clear(); }
  private assertScope(scope: AccountScope) {
    if (scope.epoch !== this.epoch || scope.userId !== (this.auth?.userId ?? null) || scope.incarnation !== this.incarnation) throw new RunningIdentityChangedError();
  }
  private async request<T>(method: string, path: string, options: { body?: unknown; text?: string; operationId?: string; revision?: number; mutation?: boolean; validate?: (data: unknown) => boolean } = {}): Promise<RunningResponse<T>> {
    try { return await this.performRequest<T>(method, path, options); }
    catch (error) { this.failureHandler?.(error); throw error; }
  }
  private async performRequest<T>(method: string, path: string, options: { body?: unknown; text?: string; operationId?: string; revision?: number; mutation?: boolean; validate?: (data: unknown) => boolean }): Promise<RunningResponse<T>> {
    const scope = this.scope();
    const auth = this.auth;
    if (!auth) throw new RunningApiError(401, { code: 'AUTH_REQUIRED', error: 'Sign in before loading running data.' });
    if (options.mutation && !scope.incarnation) throw new RunningApiError(409, { code: 'ACCOUNT_REPLACED', error: 'Load your current running account before making changes.' });
    let token: string | null;
    try { token = await auth.getToken(); } catch {
      this.assertScope(scope);
      throw new RunningApiError(401, { code: 'AUTH_REQUIRED', error: 'Sign in again to sync running data.' });
    }
    this.assertScope(scope);
    if (!token) throw new RunningApiError(401, { code: 'AUTH_REQUIRED', error: 'Sign in again to sync running data.' });
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    if (options.mutation) headers.set('X-Account-Incarnation', scope.incarnation!);
    if (options.operationId) headers.set('X-Operation-Id', options.operationId);
    if (options.revision !== undefined) {
      if (!Number.isSafeInteger(options.revision) || options.revision < 0) throw new RunningApiError(422, { code: 'VALIDATION_FAILED', error: 'A valid revision is required.' });
      headers.set('If-Match', `"${options.revision}"`);
    }
    const body = options.text ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
    if (body !== undefined) {
      headers.set('Content-Type', options.text !== undefined ? 'text/plain; charset=utf-8' : 'application/json');
      if (new TextEncoder().encode(body).length > (options.text !== undefined ? 1048576 : 65536)) throw new RunningApiError(413, { code: 'PAYLOAD_TOO_LARGE', error: 'The request is too large. Reduce it before retrying.' });
    }
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(this.baseUrl + '/running' + path, { method, headers, body, signal: controller.signal, credentials: 'omit' });
      this.assertScope(scope);
      let result: unknown;
      try { result = await response.json(); } catch {
        this.assertScope(scope);
        throw new RunningApiError(response.ok ? 503 : response.status, { code: fallbackCode(response.ok ? 503 : response.status), error: 'The server response could not be read. Your pending changes are retained.' }, retryAfter(response.headers.get('Retry-After')));
      }
      this.assertScope(scope);
      if (result && typeof result === 'object' && 'success' in result) {
        if (response.ok && result.success === true && 'data' in result && record(result.data) && (!options.validate || options.validate(result.data))) return { data: result.data as T, status: response.status };
        if (result.success === false && 'code' in result && typeof result.code === 'string' && codes.has(result.code)) {
          const failure = result as Failure;
          throw new RunningApiError(response.status, { code: failure.code, error: typeof failure.error === 'string' ? failure.error : 'The request was not accepted.', fieldErrors: Array.isArray(failure.fieldErrors) ? failure.fieldErrors : [], current: failure.current, requestId: failure.requestId }, retryAfter(response.headers.get('Retry-After')));
        }
      }
      throw new RunningApiError(response.ok ? 503 : response.status, { code: fallbackCode(response.ok ? 503 : response.status), error: 'The request was not acknowledged. Your pending changes are retained.' }, retryAfter(response.headers.get('Retry-After')));
    } catch (error) {
      this.assertScope(scope);
      if (error instanceof RunningApiError) throw error;
      throw new RunningApiError(503, { code: 'TEMPORARY_FAILURE', error: 'Running sync is temporarily unavailable. Your pending changes are retained.' });
    } finally { clearTimeout(timer); this.controllers.delete(controller); }
  }
  state() { return this.request<StateData>('GET', '/state'); }
  history(query: RunningHistoryQuery) {
    const search = new URLSearchParams({ view: query.view, from: query.from, to: query.to, limit: String(query.limit) });
    if (query.planId) search.set('planId', query.planId); if (query.cursor) search.set('cursor', query.cursor);
    return this.request<RunningHistoryData>('GET', `/history?${search}`, { validate: data => validHistory(data, query) });
  }
  analytics(query: RunningAnalyticsQuery) {
    const search = new URLSearchParams({ from: query.from, to: query.to }); if (query.planId) search.set('planId', query.planId);
    return this.request<RunningAnalyticsData>('GET', `/analytics?${search}`, { validate: data => validAnalytics(data, query) });
  }
  bootstrap(body: Bootstrap = {}) { return this.request<AccountState>('POST', '/account/bootstrap', { body }); }
  preferences(body: PreferencesPut) { return this.request<AccountState>('PUT', '/account', { body, mutation: true }); }
  plan(id: string) { return this.request<CanonicalPlan>('GET', `/plans/${segment(id)}`); }
  plans(query: PlanListQuery) {
    if (!['draft', 'archived', 'all'].includes(query.lifecycle) || !Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 50) throw new RunningApiError(422, { code: 'VALIDATION_FAILED', error: 'Invalid plan list options.' });
    const search = new URLSearchParams({ lifecycle: query.lifecycle, limit: String(query.limit) });
    if (query.cursor !== null) search.set('cursor', query.cursor);
    return this.request<PlanListData>('GET', `/plans?${search}`);
  }
  createDraft(body: DraftCreate, operationId: string) { return this.request<CanonicalPlan>('POST', '/drafts', { body, operationId, mutation: true }); }
  importPlan(id: string, text: string, revision: number, operationId: string) { return this.request<CanonicalPlan>('PUT', `/plans/${segment(id)}/import`, { text, revision, operationId, mutation: true }); }
  activate(id: string, body: Activation, operationId: string) { return this.request<CanonicalPlan>('PUT', `/plans/${segment(id)}/activation`, { body, operationId, mutation: true }); }
  archive(id: string, body: Archive, operationId: string) { return this.request<CanonicalPlan>('PUT', `/plans/${segment(id)}/archive`, { body, operationId, mutation: true }); }
  result(planId: string, runId: string, body: ResultPut) { return this.request<CanonicalRun>('PUT', `/plans/${segment(planId)}/runs/${segment(runId)}/result`, { body, mutation: true, validate: data => validRun(data, planId, runId, body.expectedRevision) && data.status === body.status && data.actualDate === body.actualDate }); }
  schedule(planId: string, runId: string, body: SchedulePut) { return this.request<CanonicalRun>('PUT', `/plans/${segment(planId)}/runs/${segment(runId)}/schedule`, { body, mutation: true, validate: data => validRun(data, planId, runId, body.expectedRevision) && data.status === 'pending' && data.scheduledDate === body.date }); }
  deletePlan(id: string, revision: number) { return this.request<{ deleted: true }>('DELETE', `/plans/${segment(id)}`, { revision, mutation: true, validate: data => record(data) && data.deleted === true }); }
}
