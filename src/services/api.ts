// API client for Flexer backend

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8787';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: string[];
}

export class ApiClient {
  private getToken: (() => Promise<string | null>) | null = null;
  private authEpoch = 0;

  setTokenGetter(getter: (() => Promise<string | null>) | null) {
    this.authEpoch++;
    this.getToken = getter;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const epoch = this.authEpoch;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.getToken) {
      const token = await this.getToken();
      if (epoch !== this.authEpoch) throw new Error("Account changed. Please retry.");
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    if (!this.getToken) throw new Error("Sign in before loading your data.");
    return headers;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const epoch = this.authEpoch;
    const headers = await this.getHeaders();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(API_BASE_URL + path, {
        method, headers, signal: controller.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const result = await response.json() as ApiResponse<T>;
      if (epoch !== this.authEpoch) throw new Error('Account changed. Please retry.');
      if (!response.ok) return { ...result, success: false, error: result.error || 'Request failed. Please retry.' };
      return result;
    } finally { clearTimeout(timer); }
  }
  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body?: unknown) { return this.request<T>('POST', path, body); }
  put<T>(path: string, body?: unknown) { return this.request<T>('PUT', path, body); }
  delete<T>(path: string) { return this.request<T>('DELETE', path); }

}

export const api = new ApiClient();
export type { ApiResponse };

// ===== Session API Methods =====

import type {
  StartSessionRequest,
  StartSessionResponse,
  UpsertSetLogRequest,
  CompleteSessionRequest,
  HistoryAnalytics,
  SessionListResponse,
  ConsistencyAnalytics,
  SessionDetailResponse,
} from '../types/workout';

export const sessionApi = {
  async startSession(data: StartSessionRequest): Promise<ApiResponse<StartSessionResponse>> {
    return api.post('/sessions/start', data);
  },

  async getSessionDetail(sessionId: string): Promise<ApiResponse<SessionDetailResponse>> {
    return api.get(`/sessions/${sessionId}`);
  },

  async upsertSetLog(sessionId: string, data: UpsertSetLogRequest): Promise<ApiResponse<{ setLogId: string }>> {
    return api.put(`/sessions/${sessionId}/sets`, data);
  },

  async completeSession(sessionId: string, data: CompleteSessionRequest): Promise<ApiResponse<{ sessionId: string; status: string }>> {
    return api.post(`/sessions/${sessionId}/complete`, data);
  },
};

export const historyApi = {
  async getAnalytics(rangeDays = 56, planId?: string): Promise<ApiResponse<HistoryAnalytics>> {
    let path = `/history/analytics?rangeDays=${rangeDays}`;
    if (planId) path += `&planId=${planId}`;
    return api.get(path);
  },

  async listSessions(
    options: {
      limit?: number;
      cursor?: string;
      planId?: string;
      from?: string;
      to?: string;
    } = {}
  ): Promise<ApiResponse<SessionListResponse>> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.planId) params.set('planId', options.planId);
    if (options.from) params.set('from', options.from);
    if (options.to) params.set('to', options.to);
    const queryString = params.toString();
    return api.get(`/history${queryString ? `?${queryString}` : ''}`);
  },
};

export const analyticsApi = {
  async getConsistency(rangeDays = 28, planId?: string): Promise<ApiResponse<ConsistencyAnalytics>> {
    const params = new URLSearchParams({ rangeDays: String(rangeDays) });
    if (planId) params.set('planId', planId);
    return api.get(`/analytics/consistency?${params}`);
  },
};
