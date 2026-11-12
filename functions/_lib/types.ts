export interface Env {
  ADMIN_USER: string;
  ADMIN_PASSWORD_HASH: string;
  AUTH_SECRET: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
  GITHUB_API_BASE?: string;
  SESSION_HOURS?: string;
}

export interface Data {
  user: string;
}

export interface PagesContext<E = Env, D = Data> {
  request: Request;
  env: E;
  params: Record<string, string | string[]>;
  data: D;
  next: () => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
}

export type PagesFunction<E = Env, D = Data> = (
  context: PagesContext<E, D>,
) => Response | Promise<Response>;
