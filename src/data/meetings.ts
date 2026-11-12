import type { ImageMetadata } from 'astro';
import { getCollection } from 'astro:content';

export type Localized = {
  ar: string;
  sv: string;
};

export interface MeetingImage {
  src: ImageMetadata;
  alt: Localized;
}

export interface Meeting {
  id: string;
  date: string;
  tag: Localized;
  topic: Localized;
  summary: Localized;
  takeaway: Localized;
  adults: Localized;
  children: Localized;
  lecture: Localized;
  images: MeetingImage[];
  video: {
    url: string;
    label: Localized;
    note: Localized;
  };
}

/**
 * Loads every meeting from src/content/meetings, newest first.
 * Add a new meeting by creating a Markdown file in that folder — or from
 * the admin panel at /admin/.
 */
export async function getMeetings(): Promise<Meeting[]> {
  const entries = await getCollection('meetings');

  return entries
    .map((entry) => ({
      id: entry.id,
      ...entry.data,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
