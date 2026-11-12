import { base64ToText } from './base64';
import { HttpError } from './http';
import type { Env } from './types';

const DEFAULT_REPO = 'eramax/Den-Glada-Familjen';
const DEFAULT_BRANCH = 'main';
const API_VERSION = '2022-11-28';

interface GitHubFile {
  sha: string;
  content?: string;
  encoding?: string;
  size?: number;
  type?: string;
  name?: string;
  path?: string;
}

interface GitHubDirectoryItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: string;
}

export interface GitHubConfig {
  repo: string;
  branch: string;
  api: string;
}

export function githubConfig(env: Env): GitHubConfig {
  return {
    repo: env.GITHUB_REPO || DEFAULT_REPO,
    branch: env.GITHUB_BRANCH || DEFAULT_BRANCH,
    api: (env.GITHUB_API_BASE || 'https://api.github.com').replace(/\/$/, ''),
  };
}

function buildHeaders(env: Env, extra?: HeadersInit): Headers {
  if (!env.GITHUB_TOKEN) {
    throw new HttpError(500, 'GitHub token غير مضبوط على الخادم.');
  }
  const headers = new Headers(extra);
  headers.set('Authorization', `Bearer ${env.GITHUB_TOKEN}`);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/vnd.github+json');
  }
  headers.set('X-GitHub-Api-Version', API_VERSION);
  headers.set('User-Agent', 'dgf-admin');
  return headers;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function request(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { api } = githubConfig(env);
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: buildHeaders(env, init.headers),
  });

  if (response.ok) return response;

  let message = `GitHub API error (${response.status})`;
  try {
    const data = (await response.json()) as { message?: string };
    if (data?.message) message = data.message;
  } catch {
    // Ignore non-JSON error bodies.
  }

  if (response.status === 401 || response.status === 403) {
    throw new HttpError(
      502,
      'تعذّر الوصول إلى GitHub. تحقق من صلاحية التوكن وصلاحيات المستودع.',
    );
  }
  if (response.status === 404) {
    throw new HttpError(404, 'الملف غير موجود في المستودع.');
  }
  if (response.status === 409) {
    throw new HttpError(409, 'تم تعديل الملف من مكان آخر. أعد تحميل الصفحة.');
  }
  throw new HttpError(502, `خطأ من GitHub: ${message}`);
}

export async function getFile(
  env: Env,
  path: string,
): Promise<{ sha: string; text: string; size: number }> {
  const { repo, branch } = githubConfig(env);
  const response = await request(
    env,
    `/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
  );
  const data = (await response.json()) as GitHubFile;
  if (data.type !== 'file' || typeof data.content !== 'string') {
    throw new HttpError(404, 'الملف غير موجود في المستودع.');
  }
  return {
    sha: data.sha,
    text: base64ToText(data.content),
    size: data.size ?? 0,
  };
}

export async function getRawFile(env: Env, path: string): Promise<Response> {
  const { repo, branch } = githubConfig(env);
  return request(
    env,
    `/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
    { headers: { Accept: 'application/vnd.github.raw' } },
  );
}

export async function getMeta(
  env: Env,
  path: string,
): Promise<{ sha: string; size: number; type: string }> {
  const { repo, branch } = githubConfig(env);
  const response = await request(
    env,
    `/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
  );
  const data = (await response.json()) as GitHubFile;
  return {
    sha: data.sha,
    size: data.size ?? 0,
    type: data.type ?? 'file',
  };
}

export async function putFile(
  env: Env,
  path: string,
  contentBase64: string,
  message: string,
  sha?: string,
): Promise<{ sha: string; commitSha: string }> {
  const { repo, branch } = githubConfig(env);
  const body: Record<string, unknown> = {
    message,
    content: contentBase64,
    branch,
  };
  if (sha) body.sha = sha;

  const response = await request(
    env,
    `/repos/${repo}/contents/${encodePath(path)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = (await response.json()) as {
    content?: { sha?: string };
    commit?: { sha?: string };
  };
  return {
    sha: data.content?.sha ?? '',
    commitSha: data.commit?.sha ?? '',
  };
}

export async function deleteFile(
  env: Env,
  path: string,
  sha: string,
  message: string,
): Promise<{ commitSha: string }> {
  const { repo, branch } = githubConfig(env);
  const response = await request(
    env,
    `/repos/${repo}/contents/${encodePath(path)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sha, branch }),
    },
  );
  const data = (await response.json()) as { commit?: { sha?: string } };
  return { commitSha: data.commit?.sha ?? '' };
}

export async function listDir(
  env: Env,
  dir: string,
): Promise<Array<{ name: string; path: string; sha: string; size: number }>> {
  const { repo, branch } = githubConfig(env);
  const response = await request(
    env,
    `/repos/${repo}/contents/${encodePath(dir)}?ref=${encodeURIComponent(branch)}`,
  );
  const data = (await response.json()) as GitHubDirectoryItem[] | GitHubDirectoryItem;
  if (!Array.isArray(data)) {
    throw new HttpError(404, 'المجلد غير موجود في المستودع.');
  }
  return data
    .filter((item) => item.type === 'file')
    .map((item) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      size: item.size,
    }));
}

export function commitUrl(env: Env, sha: string): string {
  const { repo } = githubConfig(env);
  return `https://github.com/${repo}/commit/${sha}`;
}


