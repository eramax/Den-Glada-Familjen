import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export interface ParsedMarkdown<T = Record<string, unknown>> {
  data: T;
  body: string;
}

export function parseMarkdown<T = Record<string, unknown>>(
  text: string,
): ParsedMarkdown<T> {
  const match = text.match(
    /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/,
  );
  if (!match) {
    throw new Error('ملف MD غير صالح: لا توجد كتلة frontmatter.');
  }

  const data = parseYaml(match[1]) as T & { date?: unknown };
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('محتوى frontmatter غير صالح.');
  }

  // Astro's YAML parser turns an unquoted date into a Date object.
  if (data.date instanceof Date) {
    data.date = data.date.toISOString().slice(0, 10);
  }

  return { data, body: match[2] };
}

export function serializeMarkdown(data: unknown, body: string): string {
  let yaml = stringifyYaml(data, { lineWidth: 0 });
  yaml = yaml.replace(
    /^date: (\d{4}-\d{2}-\d{2})$/m,
    "date: '$1'",
  );
  const normalizedBody = body.startsWith('\n') ? body : `\n${body}`;
  return `---\n${yaml}---\n${normalizedBody}`;
}
