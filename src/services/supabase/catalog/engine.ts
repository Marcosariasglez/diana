// VERTICE-PLAN-2, D2-1.5: motor de consulta PURO sobre filas `catalog_titles`.
// Filtra, ordena y pagina. Es la única fuente de verdad de la semántica de
// browse/search/candidates: el repo mock lo usa directamente, el repo
// PostgREST traduce los mismos parámetros a filtros SQL (mismo resultado).
import type { MediaType } from '@/types/media';
import { availablePlatforms } from './mapper';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type BrowseParams,
  type CatalogRow,
  type CountParams,
  type PageResult,
  type SearchParams,
} from './types';

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

type Scope = Pick<BrowseParams, 'type' | 'genre' | 'genres' | 'decade' | 'platforms'>;

/** Filtros compartidos por browse, search y count: tipo, género(s), década y plataformas. */
function inScope(r: CatalogRow, p: Scope, decade: [number, number] | null): boolean {
  if (p.type && r.media_type !== p.type) return false;
  if (p.genre !== undefined && !r.genre_ids.includes(p.genre)) return false;
  if (p.genres && p.genres.length > 0 && !r.genre_ids.some((g) => p.genres!.includes(g))) return false;
  if (decade && (r.year === null || r.year < decade[0] || r.year > decade[1])) return false;
  if (p.platforms && p.platforms.length > 0 && !availablePlatforms(r).some((x) => p.platforms!.includes(x))) return false;
  return true;
}

/** Aplica el filtro de `browse`. Devuelve las filas que pasan (sin ordenar). */
export function filterBrowse(rows: readonly CatalogRow[], p: BrowseParams): CatalogRow[] {
  const decade = p.decade !== undefined ? decadeRange(p.decade) : null;
  return rows.filter((r) => inScope(r, p, decade));
}

/** Aplica el filtro de `search` (substring en minúsculas sobre título/original) más los filtros comunes. */
export function filterSearch(rows: readonly CatalogRow[], p: SearchParams): CatalogRow[] {
  const q = (p.query || '').trim().toLowerCase();
  if (!q) return [];
  const decade = p.decade !== undefined ? decadeRange(p.decade) : null;
  return rows.filter((r) => {
    if (!inScope(r, p, decade)) return false;
    return (r.title || '').toLowerCase().includes(q) || (r.original_title || '').toLowerCase().includes(q);
  });
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
  return sortAndPage(filtered, compareRows(p.sort ?? 'popularity'), p.cursor ?? 0, clampLimit(p.limit));
}

/** Cuántas filas pasan el filtro (con texto cuenta como búsqueda), sin paginar. */
export function countRows(rows: readonly CatalogRow[], p: CountParams): number {
  return p.query?.trim() ? filterSearch(rows, { ...p, query: p.query }).length : filterBrowse(rows, p).length;
}

/** Rango de duración (B4). */
export interface RuntimeRange {
  min?: number;
  max?: number;
}

/**
 * Candidatos para el motor de mood/feed/grupo: los `limit` más populares
 * (300–1000) que cumplen el filtro de plataformas (y tipo, si se da). No se
 * pagina: se devuelve la lista completa para que el ranking la ordene por
 * afinidad. `limit` se acota a [300, 1000] por defecto.
 *
 * @param runtime — rango de duración (B4). Filtra runtime > 0 siempre,
 *                   y aplica min/max cuando existen.
 */
export function candidatesRows(
  rows: readonly CatalogRow[],
  platforms: readonly string[],
  type: MediaType | undefined,
  limit?: number,
  runtime?: RuntimeRange,
): CatalogRow[] {
  const n = Math.max(1, Math.min(Math.floor(limit ?? 600), 1000));
  const filtered = filterBrowse(rows, { platforms, type });
  const candidates = filtered.filter((r) => {
    // B4: exige runtime > 0
    if (r.runtime === null || r.runtime <= 0) return false;
    if (runtime?.min !== undefined && r.runtime < runtime.min) return false;
    if (runtime?.max !== undefined && r.runtime > runtime.max) return false;
    return true;
  });
  return [...candidates].sort(compareRows('popularity')).slice(0, n);
}

/** Filtro «disponible ahora en mis plataformas» (para «Quiero ver»). */
export function availableNow(rows: readonly CatalogRow[], platforms: readonly string[]): CatalogRow[] {
  return filterBrowse(rows, { platforms });
}
