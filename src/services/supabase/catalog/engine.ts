// VERTICE-PLAN-2, D2-1.5: motor de consulta PURO sobre filas `catalog_titles`.
// Filtra, ordena y pagina. Es la única fuente de verdad de la semántica de
// browse/search/candidates: el repo mock lo usa directamente, el repo
// PostgREST traduce los mismos parámetros a filtros SQL (mismo resultado).
import type { MediaType } from '@/types/media';
import { availablePlatforms } from './mapper';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type BrowseParams, type CatalogRow, type PageResult, type SearchParams } from './types';

function clampLimit(limit?: number): number {
  if (!Number.isFinite(limit) || (limit as number) <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(limit as number), MAX_PAGE_SIZE);
}

function decadeRange(decade: number): [number, number] {
  const d = Math.floor(decade / 10) * 10;
  return [d, d + 9];
}

/** Orden estable: el comparador de `sort` y, como desempate, media_type + tmdb_id. */
function compareRows(sort: BrowseParams['sort']): (a: CatalogRow, b: CatalogRow) => number {
  const tie = (a: CatalogRow, b: CatalogRow) =>
    a.media_type === b.media_type ? a.tmdb_id - b.tmdb_id : a.media_type < b.media_type ? -1 : 1;
  switch (sort) {
    case 'vote':
      return (a, b) => b.vote_average - a.vote_average || b.vote_count - a.vote_count || tie(a, b);
    case 'year':
      return (a, b) => (b.year ?? -1) - (a.year ?? -1) || tie(a, b);
    case 'title':
      return (a, b) => (a.title || '').localeCompare(b.title || '', 'es') || tie(a, b);
    case 'popularity':
    default:
      return (a, b) => b.popularity - a.popularity || tie(a, b);
  }
}

/** Aplica el filtro de `browse`. Devuelve las filas que pasan (sin ordenar). */
export function filterBrowse(rows: readonly CatalogRow[], p: BrowseParams): CatalogRow[] {
  const out: CatalogRow[] = [];
  const platforms = p.platforms;
  const decade = p.decade !== undefined ? decadeRange(p.decade) : null;
  for (const r of rows) {
    if (p.type && r.media_type !== p.type) continue;
    if (p.genre !== undefined && !r.genre_ids.includes(p.genre)) continue;
    if (decade && (r.year === null || r.year < decade[0] || r.year > decade[1])) continue;
    if (platforms && platforms.length > 0) {
      const avail = availablePlatforms(r);
      if (!avail.some((x) => platforms.includes(x))) continue;
    }
    out.push(r);
  }
  return out;
}

/** Aplica el filtro de `search` (substring en minúsculas sobre título/original). */
export function filterSearch(rows: readonly CatalogRow[], p: SearchParams): CatalogRow[] {
  const q = (p.query || '').trim().toLowerCase();
  const out: CatalogRow[] = [];
  if (!q) return out;
  const platforms = p.platforms;
  for (const r of rows) {
    if (p.type && r.media_type !== p.type) continue;
    const t = (r.title || '').toLowerCase();
    const o = (r.original_title || '').toLowerCase();
    if (!t.includes(q) && !o.includes(q)) continue;
    if (platforms && platforms.length > 0) {
      const avail = availablePlatforms(r);
      if (!avail.some((x) => platforms.includes(x))) continue;
    }
    out.push(r);
  }
  return out;
}

/** Ordena (estable) y pagina a partir del cursor (offset). */
export function sortAndPage<T>(items: T[], cmp: (a: T, b: T) => number, cursor: number, limit: number): PageResult<T> {
  const sorted = [...items].sort(cmp);
  const start = Math.max(0, cursor);
  const slice = sorted.slice(start, start + limit);
  const hasMore = start + limit < sorted.length;
  return { items: slice, nextCursor: hasMore ? start + limit : null, hasMore };
}

/** Comodín: filtrar + ordenar + pagina para browse. */
export function browseRows(rows: readonly CatalogRow[], p: BrowseParams): PageResult<CatalogRow> {
  const filtered = filterBrowse(rows, p);
  return sortAndPage(filtered, compareRows(p.sort ?? 'popularity'), p.cursor ?? 0, clampLimit(p.limit));
}

/** Comodín: filtrar + ordenar por relevancia (popularidad) + pagina para search. */
export function searchRows(rows: readonly CatalogRow[], p: SearchParams): PageResult<CatalogRow> {
  const filtered = filterSearch(rows, p);
  return sortAndPage(filtered, compareRows('popularity'), p.cursor ?? 0, clampLimit(p.limit));
}

/**
 * Candidatos para el motor de mood/feed/grupo: los `limit` más populares
 * (300–1000) que cumplen el filtro de plataformas (y tipo, si se da). No se
 * pagina: se devuelve la lista completa para que el ranking la ordene por
 * afinidad. `limit` se acota a [300, 1000] por defecto.
 */
export function candidatesRows(
  rows: readonly CatalogRow[],
  platforms: readonly string[],
  type: MediaType | undefined,
  limit?: number,
): CatalogRow[] {
  const n = Math.max(1, Math.min(Math.floor(limit ?? 600), 1000));
  const filtered = filterBrowse(rows, { platforms, type });
  return [...filtered].sort(compareRows('popularity')).slice(0, n);
}

/** Filtro «disponible ahora en mis plataformas» (para «Quiero ver»). */
export function availableNow(rows: readonly CatalogRow[], platforms: readonly string[]): CatalogRow[] {
  return filterBrowse(rows, { platforms });
}
