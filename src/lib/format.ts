import type { Lang } from '../i18n';

export const formatMeetingDate = (iso: string, lang: Lang): string =>
  new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(lang === 'ar' ? { numberingSystem: 'latn' } : {}),
  }).format(new Date(`${iso}T12:00:00`));
