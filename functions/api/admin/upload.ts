import {
  approximateBase64Bytes,
  base64ToBytes,
  bytesToBase64,
} from '../../_lib/base64';
import { commitUrl, putFile } from '../../_lib/github';
import { errorResponse, fail, json, readJson } from '../../_lib/http';
import {
  assertImageBytes,
  assertImagePath,
  MAX_IMAGE_BYTES,
} from '../../_lib/validate';
import type { PagesFunction } from '../../_lib/types';

interface UploadBody {
  path?: unknown;
  sha?: unknown;
  data?: unknown;
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await readJson<UploadBody>(
      request,
      Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 20_000,
    );
    const path = assertImagePath(body.path);

    if (typeof body.data !== 'string') {
      return fail('بيانات الصورة مطلوبة.', 400);
    }

    const base64 = body.data.includes(',')
      ? body.data.slice(body.data.indexOf(',') + 1)
      : body.data;

    if (approximateBase64Bytes(base64) > MAX_IMAGE_BYTES) {
      return fail('حجم الصورة أكبر من 4MB.', 413);
    }

    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(base64);
    } catch {
      return fail('بيانات الصورة غير صالحة.', 400);
    }

    if (bytes.length > MAX_IMAGE_BYTES) {
      return fail('حجم الصورة أكبر من 4MB.', 413);
    }

    assertImageBytes(bytes, path);

    const sha =
      typeof body.sha === 'string' && body.sha ? body.sha : undefined;
    const result = await putFile(
      env,
      path,
      bytesToBase64(bytes),
      `content: update image ${path}`,
      sha,
    );

    return json({
      ok: true,
      path,
      sha: result.sha,
      commitSha: result.commitSha,
      commitUrl: commitUrl(env, result.commitSha),
    });
  } catch (error) {
    return errorResponse(error);
  }
};
