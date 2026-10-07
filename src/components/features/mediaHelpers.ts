import type { Media } from '@/types/media';
import { formatRuntime, yearOf } from '@/utils/format';

export function mediaTitle(media: Media): string {
  return media.media_type === 'movie' ? media.title : media.name;
}

export function mediaYear(media: Media): number {
  return yearOf(media.media_type === 'movie' ? media.release_date : media.first_air_date);
}

/** "2022 · 1h 41m" (series: duracion tipica del capitulo si existe). */
export function mediaMeta(media: Media): string {
  const year = mediaYear(media);
  const minutes =
    media.media_type === 'movie' ? media.runtime : (media.episode_run_time[0] ?? 0);
  const parts: string[] = [];
  if (Number.isFinite(year) && year > 0) parts.push(String(year));
  if (minutes > 0) parts.push(formatRuntime(minutes));
  return parts.join(' · ');
}

export const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

export function posterUri(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${TMDB_POSTER_BASE}${path}`;
}
