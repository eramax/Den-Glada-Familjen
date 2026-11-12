export type JsonObject = Record<string, unknown>;

export interface PageData {
  ar: JsonObject;
  sv: JsonObject;
  [key: string]: unknown;
}

export interface ContentResponse {
  path: string;
  sha: string;
  text: string;
}

export interface SaveResponse {
  ok: boolean;
  sha: string;
  commitSha: string;
  commitUrl: string;
}

export interface FileEntry {
  name: string;
  path: string;
  sha: string;
  size: number;
}

export interface MetaResponse {
  sha: string;
  size: number;
  type: string;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: string;
}

export interface Localized {
  ar: string;
  sv: string;
}

export interface MeetingImage {
  src: string;
  alt: Localized;
}

export interface MeetingData {
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
