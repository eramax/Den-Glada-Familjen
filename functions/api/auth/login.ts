import {
  getSessionHours,
  signToken,
  timingSafeEqualString,
  verifyPassword,
} from '../../_lib/auth';
import { sessionCookie } from '../../_lib/cookies';
import {
  assertCsrf,
  errorResponse,
  fail,
  getClientIp,
  json,
  readJson,
} from '../../_lib/http';
import {
  checkRateLimit,
  clearFailures,
  recordFailure,
} from '../../_lib/rate-limit';
import type { PagesFunction } from '../../_lib/types';

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    assertCsrf(request);

    if (!env.ADMIN_USER || !env.ADMIN_PASSWORD_HASH || !env.AUTH_SECRET) {
      return fail('لم تُضبط إعدادات الدخول على الخادم.', 500);
    }
    if (env.AUTH_SECRET.length < 32) {
      return fail('AUTH_SECRET قصير جدًا. استخدم 32 حرفًا على الأقل.', 500);
    }

    const ip = getClientIp(request);
    const rate = checkRateLimit(ip);
    if (rate.limited) {
      return json(
        { error: 'محاولات كثيرة. حاول بعد قليل.' },
        429,
        { 'Retry-After': String(rate.retryAfter) },
      );
    }

    const body = await readJson<LoginBody>(request, 4096);
    const username =
      typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username || !password) {
      return fail('أدخل اسم المستخدم وكلمة السر.', 400);
    }

    const passwordOk = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
    const userOk = timingSafeEqualString(username, env.ADMIN_USER);

    if (!passwordOk || !userOk) {
      recordFailure(ip);
      await new Promise((resolve) => setTimeout(resolve, 350));
      return fail('اسم المستخدم أو كلمة السر غير صحيحة.', 401);
    }

    clearFailures(ip);
    const hours = getSessionHours(env);
    const token = await signToken(env.AUTH_SECRET, env.ADMIN_USER, hours);
    const secure = new URL(request.url).protocol === 'https:';

    return json(
      { ok: true, user: env.ADMIN_USER },
      200,
      { 'Set-Cookie': sessionCookie(token, hours * 3600, secure) },
    );
  } catch (error) {
    return errorResponse(error);
  }
};
