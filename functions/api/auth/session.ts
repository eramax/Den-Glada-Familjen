import { getSessionUser } from '../../_lib/auth';
import { errorResponse, json } from '../../_lib/http';
import type { PagesFunction } from '../../_lib/types';

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try {
    if (!env.AUTH_SECRET) return json({ authenticated: false });
    const user = await getSessionUser(request, env);
    if (!user) return json({ authenticated: false });
    return json({ authenticated: true, user });
  } catch (error) {
    return errorResponse(error);
  }
};
