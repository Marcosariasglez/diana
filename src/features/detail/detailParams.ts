import type { MediaType } from '@/types/media';
import type { MediaRef } from '@/types/rating';

export interface DetailParams {
  id: number | null;
  type: MediaType;
  season: number | null;
  episode: number | null;
}

type Raw = string | string[] | undefined;

const first = (v: Raw): string | undefined => (Array.isArray(v) ? v[0] : v);

function positiveInt(v: Raw): number | null {
  const s = first(v);
  if (s === undefined || s.trim() === '') return null;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Normaliza los parametros de ruta de la Ficha. `type` por defecto: movie. */
export function parseDetailParams(raw: {
  id?: Raw;
  type?: Raw;
  season?: Raw;
  episode?: Raw;
}): DetailParams {
  const type: MediaType = first(raw.type) === 'tv' ? 'tv' : 'movie';
  const season = type === 'tv' ? positiveInt(raw.season) : null;
  const episode = season !== null ? positiveInt(raw.episode) : null;
  return { id: positiveInt(raw.id), type, season, episode };
}

export function selectionRef(
  type: MediaType,
  id: number,
  season: number | null,
  episode: number | null,
): MediaRef {
  const ref: MediaRef = { mediaType: type, mediaId: id };
  if (type === 'tv' && season !== null) {
    ref.season = season;
    if (episode !== null) ref.episode = episode;
  }
  return ref;
}

/** "Serie completa", "Temporada 1" o "Temporada 1 · Capítulo 3". */
export function valoringLabel(season: number | null, episode: number | null): string {
  if (season === null) return 'Serie completa';
  if (episode === null) return `Temporada ${season}`;
  return `Temporada ${season} · Capítulo ${episode}`;
}
