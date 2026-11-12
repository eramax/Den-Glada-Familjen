import type {
  ContentResponse,
  FileEntry,
  MetaResponse,
  SaveResponse,
} from './types';

const API_BASE = 'https://api.github.com';

export interface ApiConfig {
  token: string;
  repo: string;
  branch: string;
}

export interface RepoInfo {
  full_name: string;
  private: boolean;
  default_branch: string;
  permissions?: {
    push?: boolean;
    admin?: boolean;
  };
}

let current: ApiConfig | null = null;

export function configureApi(config: ApiConfig): void {
  current = config;
}

export function clearApi(): void {
  current = null;
}

export function apiConfig(): ApiConfig {
  if (!current) {
    throw new ApiError('لم يتم إعداد الاتصال بـ GitHub.', 401);
  }
  return current;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function textToBase64(text: string): string {
  return toBase64(new TextEncoder().encode(text));
}

function base64ToText(value: string): string {
  return new TextDecoder().decode(fromBase64(value.replace(/\s/g, '')));
}

function buildHeaders(init?: HeadersInit): Headers {
  const config = apiConfig();
  const headers = new Headers(init);
  headers.set('Authorization', `Bearer ${config.token}`);
  headers.set('Accept', 'application/vnd.github+json');
  return headers;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: buildHeaders(init.headers),
    cache: 'no-store',
  });

  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    let message =
      typeof data.message === 'string'
        ? data.message
        : `GitHub API error (${response.status})`;

    if (response.status === 401) {
      message = 'التوكن غير صالح أو منتهي. أعد إدخال التوكن.';
    } else if (response.status === 403) {
      message =
        'لا توجد صلاحية كافية. تأكد أن التوكن يملك Contents: Read and write.';
    } else if (response.status === 404) {
      message = 'الملف غير موجود في المستودع.';
    } else if (response.status === 409) {
      message = 'تم تعديل الملف من مكان آخر. أعد تحميل الصفحة.';
    } else if (response.status === 422) {
      message = `طلب غير صالح من GitHub: ${message}`;
    }

    throw new ApiError(message, response.status);
  }

  return data as T;
}

export async function validateConnection(): Promise<RepoInfo> {
  const config = apiConfig();
  try {
    return await request<RepoInfo>(`/repos/${config.repo}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new ApiError(
        'المستودع غير موجود أو التوكن لا يملك صلاحية الوصول إليه.',
        404,
      );
    }
    throw error;
  }
}

export async function getContent(path: string): Promise<ContentResponse> {
  const config = apiConfig();
  const data = await request<{
    sha: string;
    content?: string;
    size?: number;
    type?: string;
  }>(
    `/repos/${config.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(
      config.branch,
    )}`,
  );

  if (data.type !== 'file') {
    throw new ApiError('الملف غير موجود.', 404);
  }

  return {
    path,
    sha: data.sha,
    text: data.content ? base64ToText(data.content) : '',
  };
}

export async function saveContent(
  path: string,
  sha: string,
  text: string,
): Promise<SaveResponse> {
  const config = apiConfig();
  const body: Record<string, unknown> = {
    message: `content: update ${path}`,
    content: textToBase64(text),
    branch: config.branch,
  };
  if (sha) body.sha = sha;

  const data = await request<{
    content?: { sha?: string };
    commit?: { sha?: string };
  }>(`/repos/${config.repo}/contents/${encodePath(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const commitSha = data.commit?.sha ?? '';
  return {
    ok: true,
    sha: data.content?.sha ?? '',
    commitSha,
    commitUrl: `https://github.com/${config.repo}/commit/${commitSha}`,
  };
}

export async function deleteContent(
  path: string,
  sha: string,
): Promise<SaveResponse> {
  const config = apiConfig();
  const data = await request<{ commit?: { sha?: string } }>(
    `/repos/${config.repo}/contents/${encodePath(path)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `content: delete ${path}`,
        sha,
        branch: config.branch,
      }),
    },
  );

  const commitSha = data.commit?.sha ?? '';
  return {
    ok: true,
    sha: '',
    commitSha,
    commitUrl: `https://github.com/${config.repo}/commit/${commitSha}`,
  };
}

export async function listMeetings(): Promise<{ files: FileEntry[] }> {
  const config = apiConfig();
  const data = await request<
    Array<{ name: string; path: string; sha: string; size: number; type: string }>
  >(
    `/repos/${config.repo}/contents/src/content/meetings?ref=${encodeURIComponent(
      config.branch,
    )}`,
  );

  if (!Array.isArray(data)) {
    throw new ApiError('مجلد اللقاءات غير موجود.', 404);
  }

  return {
    files: data
      .filter((item) => item.type === 'file')
      .map((item) => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        size: item.size,
      })),
  };
}

export async function getMeta(path: string): Promise<MetaResponse> {
  const config = apiConfig();
  const data = await request<{
    sha: string;
    size?: number;
    type?: string;
  }>(
    `/repos/${config.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(
      config.branch,
    )}`,
  );

  return {
    sha: data.sha,
    size: data.size ?? 0,
    type: data.type ?? 'file',
  };
}

export async function upload(
  path: string,
  sha: string,
  dataBase64: string,
): Promise<SaveResponse & { path: string }> {
  const config = apiConfig();
  const body: Record<string, unknown> = {
    message: `content: update image ${path}`,
    content: dataBase64,
    branch: config.branch,
  };
  if (sha) body.sha = sha;

  const data = await request<{
    content?: { sha?: string };
    commit?: { sha?: string };
  }>(`/repos/${config.repo}/contents/${encodePath(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const commitSha = data.commit?.sha ?? '';
  return {
    ok: true,
    path,
    sha: data.content?.sha ?? '',
    commitSha,
    commitUrl: `https://github.com/${config.repo}/commit/${commitSha}`,
  };
}

export const api = {
  getContent,
  saveContent,
  deleteContent,
  listMeetings,
  getMeta,
  upload,
};

export function imageUrl(path: string, version?: string): string {
  const config = apiConfig();
  const base = `https://raw.githubusercontent.com/${config.repo}/${
    config.branch
  }/${encodePath(path)}`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}
