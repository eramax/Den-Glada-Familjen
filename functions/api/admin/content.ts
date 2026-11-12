import { textToBase64 } from '../../_lib/base64';
import {
  commitUrl,
  deleteFile,
  getFile,
  putFile,
} from '../../_lib/github';
import { errorResponse, fail, json, readJson } from '../../_lib/http';
import {
  assertContentPath,
  contentKind,
  MAX_CONTENT_BYTES,
  parseMarkdown,
  validateMeetingData,
  validatePageData,
} from '../../_lib/validate';
import type { PagesFunction } from '../../_lib/types';

interface SaveBody {
  path?: unknown;
  sha?: unknown;
  text?: unknown;
}

interface DeleteBody {
  path?: unknown;
  sha?: unknown;
}

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const path = assertContentPath(url.searchParams.get('path'));
    const file = await getFile(env, path);
    return json({ path, sha: file.sha, text: file.text });
  } catch (error) {
    return errorResponse(error);
  }
};

export const onRequestPut: PagesFunction = async ({ request, env }) => {
  try {
    const body = await readJson<SaveBody>(
      request,
      MAX_CONTENT_BYTES + 10_000,
    );
    const path = assertContentPath(body.path);

    if (typeof body.text !== 'string') {
      return fail('نص الملف مطلوب.', 400);
    }
    if (new TextEncoder().encode(body.text).length > MAX_CONTENT_BYTES) {
      return fail('الملف كبير جدًا.', 413);
    }

    const parsed = parseMarkdown(body.text);
    const kind = contentKind(path);

    if (kind === 'meeting') {
      validateMeetingData(parsed.data);
      if (!path.endsWith(`${String(parsed.data.date)}.md`)) {
        return fail('اسم الملف يجب أن يطابق تاريخ اللقاء.', 422);
      }
    } else {
      validatePageData(parsed.data, kind);
    }

    const sha =
      typeof body.sha === 'string' && body.sha ? body.sha : undefined;
    const result = await putFile(
      env,
      path,
      textToBase64(body.text),
      `content: update ${path}`,
      sha,
    );

    return json({
      ok: true,
      sha: result.sha,
      commitSha: result.commitSha,
      commitUrl: commitUrl(env, result.commitSha),
    });
  } catch (error) {
    return errorResponse(error);
  }
};

export const onRequestDelete: PagesFunction = async ({ request, env }) => {
  try {
    const body = await readJson<DeleteBody>(request, 10_000);
    const path = assertContentPath(body.path);

    if (contentKind(path) !== 'meeting') {
      return fail('يمكن حذف اللقاءات فقط.', 400);
    }
    if (typeof body.sha !== 'string' || !body.sha) {
      return fail('sha مطلوب للحذف.', 400);
    }

    const result = await deleteFile(
      env,
      path,
      body.sha,
      `content: delete ${path}`,
    );

    return json({
      ok: true,
      commitSha: result.commitSha,
      commitUrl: commitUrl(env, result.commitSha),
    });
  } catch (error) {
    return errorResponse(error);
  }
};
