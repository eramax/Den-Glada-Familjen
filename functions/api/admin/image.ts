import { getRawFile } from '../../_lib/github';
import { errorResponse } from '../../_lib/http';
import { assertImagePath } from '../../_lib/validate';
import type { PagesFunction } from '../../_lib/types';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try {
    const path = assertImagePath(
      new URL(request.url).searchParams.get('path'),
    );
    const response = await getRawFile(env, path);
    const extension = path.split('.').pop()?.toLowerCase() ?? '';
    const headers = new Headers(response.headers);

    headers.set(
      'Content-Type',
      CONTENT_TYPES[extension] ?? 'application/octet-stream',
    );
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Disposition', 'inline');
    headers.delete('content-encoding');
    headers.delete('content-length');

    return new Response(response.body, { status: 200, headers });
  } catch (error) {
    return errorResponse(error);
  }
};
