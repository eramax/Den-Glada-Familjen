import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const localizedString = z.object({
  ar: z.string(),
  sv: z.string(),
});

/**
 * محتوى الصفحات الثابتة.
 * كل ملف يحتوي كتلة `ar` وكتلة `sv` حتى يحررهما المدير من لوحة التحكم.
 */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    ar: z.record(z.string(), z.any()),
    sv: z.record(z.string(), z.any()),
  }),
});

/**
 * لقاء أسبوعي واحد. اسم الملف هو التاريخ (YYYY-MM-DD).
 * الصور تُحل نسبةً إلى ملف اللقاء نفسه.
 */
const meetings = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/meetings' }),
  schema: ({ image }) =>
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      tag: localizedString,
      topic: localizedString,
      summary: localizedString,
      takeaway: localizedString,
      adults: localizedString,
      children: localizedString,
      lecture: localizedString,
      images: z
        .array(
          z.object({
            src: image(),
            alt: localizedString,
          }),
        )
        .min(1)
        .max(4),
      video: z.object({
        url: z.url(),
        label: localizedString,
        note: localizedString,
      }),
    }),
});

export const collections = { pages, meetings };
