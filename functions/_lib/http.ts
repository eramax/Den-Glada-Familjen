export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

export function fail(message: string, status = 400, code?: string): Response {
  return json({ error: message, ...(code ? { code } : {}) }, status);
}

export async function readJson<T>(request: Request, maxBytes = 10_000): Promise<T> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new HttpError(413, 'الطلب كبير جدًا.');

  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new HttpError(413, 'الطلب كبير جدًا.');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'صيغة الطلب غير صحيحة.');
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return fail(error.message, error.status);
  console.error(error);
  return fail('حدث خطأ غير متوقع. حاول مرة أخرى.', 500);
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export function assertCsrf(request: Request): void {
  if (!isSameOrigin(request)) {
    throw new HttpError(403, 'طلب غير مسموح.');
  }
  if (request.headers.get('X-Requested-With') !== 'dgf-admin') {
    throw new HttpError(403, 'طلب غير مسموح.');
  }
}
