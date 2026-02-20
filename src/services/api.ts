// API client for Flexer backend

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: string[];
}

class ApiClient {
  private getToken: (() => Promise<string | null>) | null = null;

  setTokenGetter(getter: () => Promise<string | null>) {
    this.getToken = getter;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: await this.getHeaders(),
    });
    return response.json();
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  }

  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      headers: await this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });
    return response.json();
  }
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
} from '../types/workout';

export const sessionApi = {
  async startSession(data: StartSessionRequest): Promise<ApiResponse<StartSessionResponse>> {
    return api.post('/sessions/start', data);
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
