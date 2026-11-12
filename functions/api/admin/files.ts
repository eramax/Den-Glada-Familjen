import { listDir } from '../../_lib/github';
import { errorResponse, fail, json } from '../../_lib/http';
import type { PagesFunction } from '../../_lib/types';

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get('dir') !== 'src/content/meetings') {
      return fail('مجلد غير مسموح.', 400);
    }
    const files = await listDir(env, 'src/content/meetings');
    return json({ files });
  } catch (error) {
    return errorResponse(error);
  }
};
