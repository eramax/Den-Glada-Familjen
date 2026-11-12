import { clearSessionCookie } from '../../_lib/cookies';
import { assertCsrf, errorResponse, json } from '../../_lib/http';
import type { PagesFunction } from '../../_lib/types';

export const onRequestPost: PagesFunction = async ({ request }) => {
  try {
    assertCsrf(request);
    const secure = new URL(request.url).protocol === 'https:';
    return json(
      { ok: true },
      200,
      { 'Set-Cookie': clearSessionCookie(secure) },
    );
  } catch (error) {
    return errorResponse(error);
  }
};
