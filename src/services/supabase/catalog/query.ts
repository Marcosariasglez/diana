// VERTICE-PLAN-2, D2-1.5: traduce los parámetros del motor (BrowseParams /
// SearchParams) a filtros PostgREST sobre `catalog_titles`. Es PURO y se
// prueba con fixtures (no hay Supabase real): verifica que se construye el
// filtro correcto (cd. sobre arrays, or para «disponible en mis plataformas»,
// websearch_query para FTS, rango de década, orden y range).
//
// La salida es ESTRUCTurada ({col, op, val}) para poder aplicarla al builder
// de supabase-js con .filter(col, op, val) / .or(val). `toQueryStrings` la
// convierte a la forma `col=op.val` legible (para tests/log).
//
// Sintaxis PostgREST: para arrays se usa `cd` (contains: «el array contiene
// estos elementos»), NO `cs` (contained-by, que además casaría con el array
// vacío {}), y el valor va como literal de array `{a,b}`. `.or()` recibe los
// términos `col.cd.{...}` SEPARADOS POR COMAS sin paréntesis: supabase-js
// añade los paréntesis él mismo.
import { MAX_PAGE_SIZE, type BrowseParams, type CatalogSort, type SearchParams } from './types';

/** Operadores PostgREST que usa el catálogo. */
export type FilterOp = 'eq' | 'cd' | 'gte' | 'lte' | 'or' | 'websearch_query' | 'ilike';

export interface CatalogFilter {
  /** Columna (para `or` es null). */
  col: string | null;
  op: FilterOp;
  val: string;
}

export interface PostgRestQuery {
  filters: CatalogFilter[];
  order: string; // ej. 'popularity.desc,media_type.asc,tmdb_id.asc'
  range: [number, number]; // offset..offset+limit-1
  select: string;
}

export const COLUMNS =
  'tmdb_id,media_type,title,original_title,year,overview,genre_ids,vote_average,vote_count,popularity,runtime,poster_path,backdrop_path,original_language,platforms_flatrate,platforms_rent,platforms_buy';

const SORT_MAP: Record<CatalogSort, string> = {
  popularity: 'popularity.desc',
  vote: 'vote_average.desc,vote_count.desc',
  year: 'year.desc.nullslast',
  title: 'title.asc',
};
const TIE = 'media_type.asc,tmdb_id.asc';

function clampLimit(limit?: number): number {
  if (!Number.isFinite(limit) || (limit as number) <= 0) return 20;
  return Math.min(Math.floor(limit as number), MAX_PAGE_SIZE);
}

/**
 * «Disponible en mis plataformas»: el título está en CUALQUIER modalidad.
 * PostgREST no tiene UNION, así que se traduce a un `or` con los términos
 * `columna.cd.{plataforma}` de los tres arrays (supabase-js añade los
 * paréntesis; `cd` + literal `{…}` es la sintaxis correcta de contains).
 */
export function platformFilter(platforms: readonly string[]): string {
  const combos: string[] = [];
  for (const p of platforms) {
    combos.push(`platforms_flatrate=cd.{${p}}`);
    combos.push(`platforms_rent=cd.{${p}}`);
    combos.push(`platforms_buy=cd.{${p}}`);
  }
  return combos.join(',');
}

export function buildBrowseQuery(p: BrowseParams): PostgRestQuery {
  const filters: CatalogFilter[] = [];
  if (p.type) filters.push({ col: 'media_type', op: 'eq', val: p.type });
  if (p.genre !== undefined) filters.push({ col: 'genre_ids', op: 'cd', val: `{${p.genre}}` });
  if (p.decade !== undefined) {
    const d = Math.floor(p.decade / 10) * 10;
    filters.push({ col: 'year', op: 'gte', val: String(d) }, { col: 'year', op: 'lte', val: String(d + 9) });
  }
  if (p.platforms && p.platforms.length > 0) filters.push({ col: null, op: 'or', val: platformFilter(p.platforms) });
  const sort = `${SORT_MAP[p.sort ?? 'popularity']},${TIE}`;
  const limit = clampLimit(p.limit);
  const offset = Math.max(0, p.cursor ?? 0);
  return { filters, order: sort, range: [offset, offset + limit - 1], select: COLUMNS };
}

/** Búsqueda: FTS en español (websearch_query sobre title_tsv). */
export function buildSearchQuery(p: SearchParams): PostgRestQuery {
  const filters: CatalogFilter[] = [];
  const q = (p.query || '').trim();
  if (p.type) filters.push({ col: 'media_type', op: 'eq', val: p.type });
  if (q) {
    const term = `'${q.replace(/'/g, "''")}'`;
    filters.push({ col: 'title_tsv', op: 'websearch_query', val: term });
  }
  if (p.platforms && p.platforms.length > 0) filters.push({ col: null, op: 'or', val: platformFilter(p.platforms) });
  const limit = clampLimit(p.limit);
  const offset = Math.max(0, p.cursor ?? 0);
  return { filters, order: `popularity.desc,${TIE}`, range: [offset, offset + limit - 1], select: COLUMNS };
}

/** Candidatos: solo plataformas (y tipo), orden por popularidad, sin offset. */
export function buildCandidatesQuery(
  platforms: readonly string[],
  type: 'movie' | 'tv' | undefined,
  limit: number,
): PostgRestQuery {
  const filters: CatalogFilter[] = [];
  if (type) filters.push({ col: 'media_type', op: 'eq', val: type });
  if (platforms.length > 0) filters.push({ col: null, op: 'or', val: platformFilter(platforms) });
  const n = Math.max(1, Math.min(Math.floor(limit), 1000));
  return { filters, order: `popularity.desc,${TIE}`, range: [0, n - 1], select: COLUMNS };
}

/**
 * Convierte un filtro a su forma legible `col=op.val` (o `or=(…)`). Útil para
 * tests y logs; NO se usa para aplicar al builder (eso es `applyFilters`).
 */
export function filterToString(f: CatalogFilter): string {
  if (f.op === 'or') return `or=${f.val}`;
  return `${f.col}=${f.op}.${f.val}`;
}

/** Serializa toda la consulta a query-string legible (tests/log). */
export function toQueryStrings(q: PostgRestQuery): string {
  const parts = [`select=${q.select}`, ...q.filters.map(filterToString), `order=${q.order}`, `limit=${q.range[1] - q.range[0] + 1}`, `offset=${q.range[0]}`];
  return parts.join('&');
}
