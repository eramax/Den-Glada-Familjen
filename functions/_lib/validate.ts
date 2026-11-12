import { parse as parseYaml } from 'yaml';
import { HttpError } from './http';

export const MAX_CONTENT_BYTES = 300_000;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const PAGE_PATHS = new Set([
  'src/content/pages/site.md',
  'src/content/pages/home.md',
  'src/content/pages/meetings.md',
]);
const MEETING_PATH = /^src\/content\/meetings\/(\d{4}-\d{2}-\d{2})\.md$/;
const IMAGE_PATH =
  /^src\/assets\/images\/(?:uploads\/)?[a-z0-9][a-z0-9._-]*\.(?:jpe?g|png|webp)$/;
const MEETING_IMAGE_SRC =
  /^\.\.\/\.\.\/assets\/images\/(?:uploads\/)?[a-z0-9][a-z0-9._-]*\.(?:jpe?g|png|webp)$/;

export type PageKind = 'site' | 'home' | 'meetings';
export type ContentKind = PageKind | 'meeting';

const PAGE_KEYS: Record<PageKind, readonly string[]> = {
  site: ['brand', 'nav', 'a11y', 'footer'],
  home: [
    'meta',
    'hero',
    'stats',
    'values',
    'about',
    'activities',
    'motto',
    'gallery',
    'join',
    'faq',
    'contact',
  ],
  meetings: ['meta', 'meetingsPage'],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertContentPath(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'مسار الملف مطلوب.');
  }
  if (PAGE_PATHS.has(value) || MEETING_PATH.test(value)) {
    return value;
  }
  throw new HttpError(400, 'مسار ملف غير مسموح.');
}

export function assertImagePath(value: unknown): string {
  if (typeof value !== 'string' || !IMAGE_PATH.test(value)) {
    throw new HttpError(400, 'مسار صورة غير مسموح.');
  }
  return value;
}

export function assertAnyPath(value: unknown): string {
  try {
    return assertContentPath(value);
  } catch {
    return assertImagePath(value);
  }
}

export function contentKind(path: string): ContentKind {
  if (path === 'src/content/pages/site.md') return 'site';
  if (path === 'src/content/pages/home.md') return 'home';
  if (path === 'src/content/pages/meetings.md') return 'meetings';
  return 'meeting';
}

export function parseMarkdown(text: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) {
    throw new HttpError(422, 'ملف MD غير صالح: لا توجد كتلة frontmatter.');
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(match[1]);
  } catch {
    throw new HttpError(422, 'صيغة YAML غير صالحة.');
  }

  if (!isPlainObject(parsed)) {
    throw new HttpError(422, 'frontmatter يجب أن يكون كائنًا.');
  }

  return { data: parsed, body: match[2] };
}

export function validatePageData(
  data: Record<string, unknown>,
  kind: PageKind,
): void {
  const allowed = PAGE_KEYS[kind];

  for (const key of Object.keys(data)) {
    if (key !== 'ar' && key !== 'sv') {
      throw new HttpError(422, `مفتاح غير معروف في الملف: ${key}`);
    }
  }

  for (const lang of ['ar', 'sv'] as const) {
    const block = data[lang];
    if (!isPlainObject(block)) {
      throw new HttpError(422, `الكتلة "${lang}" مفقودة أو غير صالحة.`);
    }
    for (const key of Object.keys(block)) {
      if (!allowed.includes(key)) {
        throw new HttpError(422, `مفتاح غير معروف: ${lang}.${key}`);
      }
    }
  }
}

function assertLocalized(value: unknown, path: string): void {
  if (!isPlainObject(value)) {
    throw new HttpError(422, `${path} يجب أن يحتوي على ar و sv.`);
  }
  for (const lang of ['ar', 'sv'] as const) {
    if (typeof value[lang] !== 'string' || !value[lang].trim()) {
      throw new HttpError(422, `${path}.${lang} مطلوب.`);
    }
  }
}

export function validateMeetingData(data: Record<string, unknown>): void {
  const allowed = new Set([
    'date',
    'tag',
    'topic',
    'summary',
    'takeaway',
    'adults',
    'children',
    'lecture',
    'images',
    'video',
  ]);

  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) {
      throw new HttpError(422, `مفتاح غير معروف في اللقاء: ${key}`);
    }
  }

  if (
    typeof data.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.date)
  ) {
    throw new HttpError(422, 'تاريخ اللقاء غير صالح.');
  }

  for (const key of [
    'tag',
    'topic',
    'summary',
    'takeaway',
    'adults',
    'children',
    'lecture',
  ]) {
    assertLocalized(data[key], key);
  }

  if (!Array.isArray(data.images) || data.images.length < 1 || data.images.length > 4) {
    throw new HttpError(422, 'اللقاء يحتاج من صورة إلى 4 صور.');
  }

  for (const [index, image] of data.images.entries()) {
    if (!isPlainObject(image)) {
      throw new HttpError(422, `الصورة ${index + 1} غير صالحة.`);
    }
    for (const key of Object.keys(image)) {
      if (key !== 'src' && key !== 'alt') {
        throw new HttpError(422, `مفتاح غير معروف في الصورة: ${key}`);
      }
    }
    if (
      typeof image.src !== 'string' ||
      !MEETING_IMAGE_SRC.test(image.src)
    ) {
      throw new HttpError(422, `مسار الصورة ${index + 1} غير مسموح.`);
    }
    assertLocalized(image.alt, `images[${index}].alt`);
  }

  const video = data.video;
  if (!isPlainObject(video)) {
    throw new HttpError(422, 'بيانات الفيديو مطلوبة.');
  }
  for (const key of Object.keys(video)) {
    if (key !== 'url' && key !== 'label' && key !== 'note') {
      throw new HttpError(422, `مفتاح غير معروف في الفيديو: ${key}`);
    }
  }
  if (typeof video.url !== 'string') {
    throw new HttpError(422, 'رابط الفيديو مطلوب.');
  }
  let url: URL;
  try {
    url = new URL(video.url);
  } catch {
    throw new HttpError(422, 'رابط الفيديو غير صالح.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new HttpError(422, 'رابط الفيديو يجب أن يبدأ بـ http أو https.');
  }
  assertLocalized(video.label, 'video.label');
  assertLocalized(video.note, 'video.note');
}

export function detectImageType(bytes: Uint8Array): 'jpg' | 'png' | 'webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

export function assertImageBytes(bytes: Uint8Array, path: string): void {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  const expected = extension === 'jpeg' ? 'jpg' : extension;
  const detected = detectImageType(bytes);
  if (!detected) {
    throw new HttpError(415, 'الملف ليس صورة JPG أو PNG أو WebP صالحة.');
  }
  if (detected !== expected) {
    throw new HttpError(415, 'امتداد الملف لا يطابق نوع الصورة.');
  }
}
