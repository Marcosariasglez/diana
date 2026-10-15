import type { Media } from '@/types/media';
import type { MediaKey } from '@/types/rating';
import { buildMediaKey } from './mediaKey';

// P7 (F3-2): helpers puros de media, extraídos de `src/mocks/data/catalog.ts`.
// Son lógica real (no datos): el catálogo mock solo conserva sus datos.

/** Clave de historial del titulo completo (pelicula o serie). */
export function mediaKeyOf(media: Media): MediaKey {
  return buildMediaKey({ mediaType: media.media_type, mediaId: media.id });
}

export function titleOf(media: Media): string {
  return media.media_type === 'movie' ? media.title : media.name;
}

export function releaseDateOf(media: Media): string {
  return media.media_type === 'movie' ? media.release_date : media.first_air_date;
}

export function releaseYearOf(media: Media): number {
  return Number(releaseDateOf(media).slice(0, 4));
}

/** Duracion en minutos: runtime en peliculas, episode_run_time[0] en series. */
export function runtimeOf(media: Media): number {
  return media.media_type === 'movie' ? media.runtime : (media.episode_run_time[0] ?? 0);
}

export function mainGenreId(media: Media): number | undefined {
  return media.genres[0]?.id;
}
