import type { MediaRef } from '@/types/rating';
import type { SearchResult } from '@/types/search';

/** MediaRef del resultado seleccionado (un capitulo incluye season y episode). */
export function refOf(r: SearchResult): MediaRef {
  const ref: MediaRef = { mediaType: r.mediaType, mediaId: r.mediaId };
  if (r.kind === 'episode' && r.seasonNumber !== undefined && r.episodeNumber !== undefined) {
    ref.season = r.seasonNumber;
    ref.episode = r.episodeNumber;
  }
  return ref;
}

/** "Capítulo · Temporada 1 · Episodio 3", "Película" o "Serie". */
export function subtitleOf(r: SearchResult): string {
  if (r.kind === 'episode') return `Capítulo · Temporada ${r.seasonNumber} · Episodio ${r.episodeNumber}`;
  return r.label;
}
