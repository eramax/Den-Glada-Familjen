import { getMeta } from '../../_lib/github';
import { errorResponse, json } from '../../_lib/http';
import { assertAnyPath } from '../../_lib/validate';
import type { PagesFunction } from '../../_lib/types';

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try {
    const path = assertAnyPath(new URL(request.url).searchParams.get('path'));
    const meta = await getMeta(env, path);
    return json(meta);
  } catch (error) {
    return errorResponse(error);
  }
};
