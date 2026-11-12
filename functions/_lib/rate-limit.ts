interface Attempt {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, Attempt>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function prune(now: number): void {
  if (attempts.size < 1_000) return;
  for (const [key, attempt] of attempts) {
    if (attempt.resetAt <= now) attempts.delete(key);
  }
}

export function checkRateLimit(key: string): {
  limited: boolean;
  retryAfter: number;
} {
  const now = Date.now();
  prune(now);
  const attempt = attempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    return { limited: false, retryAfter: 0 };
  }
  if (attempt.count >= MAX_ATTEMPTS) {
    return {
      limited: true,
      retryAfter: Math.ceil((attempt.resetAt - now) / 1000),
    };
  }
  return { limited: false, retryAfter: 0 };
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const attempt = attempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  attempt.count += 1;
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
