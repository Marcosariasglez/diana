// VERTICE-PLAN-2, D2-1.5: conversión fila `catalog_titles` <-> `Media` de Diana.
// La base guarda solo `year` (no fecha exacta): la fecha se reconstruye a
// `${year}-01-01` (el motor de mood solo lee el año: releaseYearOf). Las series
// no traen temporadas (se piden aparte vía getTvSeason), así que `seasons: []`.
import type { Media, Movie, TVSeries } from '@/types/media';
import { genresFromIds } from '@/mocks/data/genres';
import type { CatalogRow } from './types';

/** Plataforma disponible en CUALQUIER modalidad (flatrate, alquiler o compra). */
export function availablePlatforms(row: Pick<CatalogRow, 'platforms_flatrate' | 'platforms_rent' | 'platforms_buy'>): string[] {
  const set = new Set<string>();
  for (const p of row.platforms_flatrate) set.add(p);
  for (const p of row.platforms_rent) set.add(p);
  for (const p of row.platforms_buy) set.add(p);
  return [...set];
}

function dateFromYear(year: number | null): string {
  const y = Number.isFinite(year as number) ? (year as number) : new Date().getFullYear();
  return `${y}-01-01`;
}

/** Titulares distintos del original (p. ej. título español + inglés). */
function altTitles(title: string, original: string): string[] {
  if (original && original !== title) return [original];
  return [];
}

/** Fila de `catalog_titles` -> `Media` (movie o tv). */
export function rowToMedia(row: CatalogRow): Media {
  const genres = genresFromIds(row.genre_ids ?? []);
  const platforms = availablePlatforms(row);
  if (row.media_type === 'tv') {
    const tv: TVSeries = {
      id: row.tmdb_id,
      media_type: 'tv',
      name: row.title || row.original_title || `Serie ${row.tmdb_id}`,
      first_air_date: dateFromYear(row.year),
      episode_run_time: row.runtime && row.runtime > 0 ? [row.runtime] : [],
      seasons: [],
      poster_path: row.poster_path ?? null,
      backdrop_path: row.backdrop_path ?? null,
      genres,
      overview: row.overview ?? '',
      vote_average: row.vote_average ?? 0,
      vote_count: row.vote_count ?? 0,
      popularity: row.popularity ?? 0,
      platforms,
      alt_titles: altTitles(row.title || '', row.original_title || ''),
    };
    return tv;
  }
  const movie: Movie = {
    id: row.tmdb_id,
    media_type: 'movie',
    title: row.title || row.original_title || `Película ${row.tmdb_id}`,
    release_date: dateFromYear(row.year),
    runtime: row.runtime ?? 0,
    poster_path: row.poster_path ?? null,
    backdrop_path: row.backdrop_path ?? null,
    genres,
    overview: row.overview ?? '',
    vote_average: row.vote_average ?? 0,
    vote_count: row.vote_count ?? 0,
    popularity: row.popularity ?? 0,
    platforms,
    alt_titles: altTitles(row.title || '', row.original_title || ''),
  };
  return movie;
}

/**
 * `Media` (mock o de la base) -> fila mínima de `catalog_titles` (para
 * construir datasets de prueba / fixtures). Sin temporadas ni detalles: solo
 * lo que la base guarda.
 */
export function mediaToRow(m: Media): CatalogRow {
  const title = m.media_type === 'movie' ? m.title : m.name;
  const year = Number((m.media_type === 'movie' ? m.release_date : m.first_air_date).slice(0, 4)) || null;
  return {
    tmdb_id: m.id,
    media_type: m.media_type,
    title,
    original_title: m.alt_titles[0] ?? title,
    year,
    overview: m.overview ?? '',
    genre_ids: m.genres.map((g) => g.id),
    vote_average: m.vote_average,
    vote_count: m.vote_count,
    popularity: m.popularity,
    runtime: m.media_type === 'movie' ? m.runtime : (m.episode_run_time[0] ?? null),
    poster_path: m.poster_path ?? null,
    backdrop_path: m.backdrop_path ?? null,
    original_language: null,
    // En el mock todas las plataformas son «flatrate» (suscripción).
    platforms_flatrate: [...m.platforms],
    platforms_rent: [],
    platforms_buy: [],
  };
}
