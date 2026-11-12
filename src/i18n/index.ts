import { getEntry } from 'astro:content';
import { ar } from './ar';
import { sv } from './sv';
import { assertShape } from '../lib/content-shape';
import { deepMerge } from '../lib/deep-merge';
import type { Dict, Lang } from './types';

export const dictionaries: Record<Lang, Dict> = { ar, sv };

export type PageId = 'home' | 'meetings';

/**
 * Loads the editable Markdown for the requested page and layers it over the
 * fallback dictionary. The Markdown is the source of truth; the TS dictionary
 * only provides defaults for keys that are not present in the file.
 */
export async function getDict(lang: Lang, page: PageId = 'home'): Promise<Dict> {
  const [site, pageEntry] = await Promise.all([
    getEntry('pages', 'site'),
    getEntry('pages', page),
  ]);

  const merged = deepMerge(
    dictionaries[lang],
    site?.data[lang] ?? {},
    pageEntry?.data[lang] ?? {},
  );

  assertShape(dictionaries[lang], merged, `pages.${page}.${lang}`);
  return merged as Dict;
}

export const otherLang = (lang: Lang): Lang => (lang === 'ar' ? 'sv' : 'ar');

export const paths: Record<Lang, string> = {
  ar: '/',
  sv: '/sv/',
};

export const meetingPaths: Record<Lang, string> = {
  ar: '/meetings/',
  sv: '/sv/moten/',
};

export const langNames: Record<Lang, string> = {
  ar: 'العربية',
  sv: 'Svenska',
};

export type { Dict, Lang };
