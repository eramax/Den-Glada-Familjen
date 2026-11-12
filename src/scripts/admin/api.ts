import type {
  ContentResponse,
  FileEntry,
  MetaResponse,
  SaveResponse,
  SessionResponse,
} from './types';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Requested-With', 'dgf-admin');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };

  if (!response.ok) {
    throw new ApiError(
      data.error || 'تعذّر إكمال الطلب.',
      response.status,
      data.code,
    );
  }

  return data as T;
}

export const api = {
  session: () => request<SessionResponse>('/api/auth/session'),

  login: (username: string, password: string) =>
    request<{ ok: boolean; user: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
      body: '{}',
    }),

  getContent: (path: string) =>
    request<ContentResponse>(
      `/api/admin/content?path=${encodeURIComponent(path)}`,
    ),

  saveContent: (path: string, sha: string, text: string) =>
    request<SaveResponse>('/api/admin/content', {
      method: 'PUT',
      body: JSON.stringify({ path, sha, text }),
    }),

  deleteContent: (path: string, sha: string) =>
    request<SaveResponse>('/api/admin/content', {
      method: 'DELETE',
      body: JSON.stringify({ path, sha }),
    }),

  listMeetings: () =>
    request<{ files: FileEntry[] }>(
      '/api/admin/files?dir=src%2Fcontent%2Fmeetings',
    ),

  getMeta: (path: string) =>
    request<MetaResponse>(
      `/api/admin/meta?path=${encodeURIComponent(path)}`,
    ),

  upload: (path: string, sha: string, data: string) =>
    request<SaveResponse & { path: string }>('/api/admin/upload', {
      method: 'POST',
      body: JSON.stringify({ path, sha, data }),
    }),
};

export function imageUrl(path: string, version?: string): string {
  const query = new URLSearchParams({ path });
  if (version) query.set('v', version);
  return `/api/admin/image?${query.toString()}`;
}
