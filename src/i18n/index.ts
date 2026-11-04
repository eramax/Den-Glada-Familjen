import { ar } from './ar';
import { sv } from './sv';
import type { Dict, Lang } from './types';

export const dictionaries: Record<Lang, Dict> = { ar, sv };

export const getDict = (lang: Lang): Dict => dictionaries[lang];

export const otherLang = (lang: Lang): Lang => (lang === 'ar' ? 'sv' : 'ar');

export const paths: Record<Lang, string> = {
  ar: '/',
  sv: '/sv/',
};

export const langNames: Record<Lang, string> = {
  ar: 'العربية',
  sv: 'Svenska',
};

export type { Dict, Lang };
