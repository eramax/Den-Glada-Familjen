import { base64ToBytes, bytesToBase64 } from './base64';
import { parseCookies, SESSION_COOKIE } from './cookies';
import type { Env } from './types';

// Workers Free enforces a small CPU budget per request. 50k PBKDF2-SHA256
// keeps login comfortably below it; raise it on a paid plan if desired.
const PBKDF2_ITERATIONS = 50_000;
const TOKEN_VERSION = 'v1';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded =
    value.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (value.length % 4)) % 4);
  return base64ToBytes(padded);
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}

export function timingSafeEqualString(a: string, b: string): boolean {
  return timingSafeEqual(encoder.encode(a), encoder.encode(b));
}

async function derivePassword(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * Generates the value for ADMIN_PASSWORD_HASH:
 * pbkdf2-sha256$<iterations>$<salt>$<hash>
 */
export async function hashPassword(
  password: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, iterations);
  return `pbkdf2-sha256$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;

  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 1_000_000) {
    return false;
  }

  let salt: Uint8Array<ArrayBuffer>;
  let expected: Uint8Array<ArrayBuffer>;
  try {
    salt = base64ToBytes(parts[2]);
    expected = base64ToBytes(parts[3]);
  } catch {
    return false;
  }

  if (expected.length !== 32) return false;
  const actual = await derivePassword(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

async function hmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(value)),
  );
}

export interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

export async function signToken(
  secret: string,
  user: string,
  hours: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: user,
    iat: now,
    exp: now + Math.round(hours * 3600),
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await hmac(secret, `${TOKEN_VERSION}.${body}`);
  return `${TOKEN_VERSION}.${body}.${toBase64Url(signature)}`;
}

export async function verifyToken(
  secret: string,
  token: string,
): Promise<SessionPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;

  const expected = await hmac(secret, `${TOKEN_VERSION}.${parts[1]}`);
  let actual: Uint8Array;
  try {
    actual = fromBase64Url(parts[2]);
  } catch {
    return null;
  }
  if (!timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(
      decoder.decode(fromBase64Url(parts[1])),
    ) as SessionPayload;
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSessionUser(
  request: Request,
  env: Env,
): Promise<string | null> {
  if (!env.AUTH_SECRET) return null;
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const payload = await verifyToken(env.AUTH_SECRET, token);
  if (!payload || payload.sub !== env.ADMIN_USER) return null;
  return payload.sub;
}

export function getSessionHours(env: Env): number {
  const value = Number(env.SESSION_HOURS ?? '12');
  if (!Number.isFinite(value)) return 12;
  return Math.min(72, Math.max(1, Math.round(value)));
}
