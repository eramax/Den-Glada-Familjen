import { getSessionUser } from '../../_lib/auth';
import { assertCsrf, errorResponse, fail } from '../../_lib/http';
import type { PagesFunction } from '../../_lib/types';

export const onRequest: PagesFunction = async (context) => {
  try {
    if (context.request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const user = await getSessionUser(context.request, context.env);
    if (!user) {
      return fail('انتهت الجلسة. سجّل الدخول من جديد.', 401, 'unauthorized');
    }

    context.data.user = user;

    if (!['GET', 'HEAD'].includes(context.request.method)) {
      assertCsrf(context.request);
    }

    const response = await context.next();
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
