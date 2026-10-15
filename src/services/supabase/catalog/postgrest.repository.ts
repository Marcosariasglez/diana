// VERTICE-PLAN-2, D2-1.5: repositorio del catálogo paginado sobre
// `catalog_titles` vía PostgREST (supabase-js). Solo lectura: RLS permite el
// select a anon/authenticated y no da escritura (la escribe catalog-sync).
//
// NO funciona contra el simulador E2E (no tiene la tabla ni los operadores
// cs./or/websearch_query): se prueba con un cliente Supabase MOCK (Jest),
// igual que delete-account.test.ts. En E2E el build usa CATALOG=mock, así que
// esta rama no se activa.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Media } from '@/types/media';
import { getSupabase } from '@/lib/supabase';
import { rowToMedia } from './mapper';
import type { CatalogRow } from './types';
import {
  buildBrowseQuery,
  buildCandidatesQuery,
  buildCountFilters,
  buildSearchQuery,
  COLUMNS,
  type CatalogFilter,
  type PostgRestQuery,
} from './query';
import type { BrowseParams, CountParams, PageResult, SearchParams } from './types';

import type { RuntimeRange } from './query';
export type { RuntimeRange } from './query';

/** Fuente de candidatos del catálogo (mock o PostgREST): misma firma. */
export interface CatalogSource {
  /** Explorar paginado (chips de plataforma, filtros de género/década). */
  browse(p: BrowseParams): Promise<PageResult<Media>>;
  /** Búsqueda (FTS + trigram). */
  search(p: SearchParams): Promise<PageResult<Media>>;
  /** Nº total de títulos que pasan los filtros (para «Ver N títulos»); null si no se pudo contar. */
  count(p: CountParams): Promise<number | null>;
  /** Títulos por (tipo, ids TMDB). */
  byIds(type: 'movie' | 'tv', ids: number[]): Promise<Media[]>;
  /** Candidatos para el motor mood/feed/grupo (los N más populares filtrados). */
  candidates(platforms: string[], type?: 'movie' | 'tv', limit?: number, runtime?: RuntimeRange): Promise<Media[]>;
  /** «Disponible ahora en mis plataformas» (para «Quiero ver»). */
  availableNow(platforms: string[]): Promise<Media[]>;
  /** Disponibilidad por modalidad de un título (para «Dónde verla» en la ficha). */
  availability(type: 'movie' | 'tv', id: number): Promise<CatalogRow | null>;
}

// El builder de supabase-js es genérico y también es un thenable (se puede
// `await`). Para no acoplar a la versión exacta, tipamos aquí el subconjunto
// de llamadas que usamos; en runtime es el builder real de PostgREST.
type Builder = {
  filter(col: string, op: string, val: string | number): Builder;
  or(val: string): Builder;
  order(by: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): Builder;
  range(from: number, to: number): Builder;
  then?: (
    resolve: (v: { data: unknown[] | null; count?: number | null; error: { message: string } | null }) => void,
    reject: (e: unknown) => void,
  ) => void;
};

/**
 * Un término de orden como lo emite `query.ts`: `columna.dir[.nullsfirst|
 * .nullslast]` (ej. `popularity.desc`, `year.desc.nullslast`).
 */
function parseOrderTerm(term: string): { column: string; ascending: boolean; nullsFirst: boolean } {
  const [column, dir, nulls] = term.split('.');
  return { column, ascending: dir !== 'desc', nullsFirst: nulls === 'nullsfirst' };
}

function applyQuery(sb: SupabaseClient, q: PostgRestQuery): Builder {
  let builder = sb.from('catalog_titles').select(q.select) as unknown as Builder;
  for (const f of q.filters) {
    builder = applyOne(builder, f);
  }
  // `q.order` es una lista multi-columna ya serializada
  // (ej. 'vote_average.desc,vote_count.desc,media_type.asc,tmdb_id.asc');
  // supabase-js no la parsea: `.order()` solo admite UNA columna + opciones,
  // así que se encadena una llamada por término (mismo resultado PostgREST).
  for (const term of q.order.split(',')) {
    const { column, ascending, nullsFirst } = parseOrderTerm(term.trim());
    builder = builder.order(column, { ascending, nullsFirst });
  }
  return builder.range(q.range[0], q.range[1]);
}

function applyOne(b: Builder, f: CatalogFilter): Builder {
  if (f.op === 'or') return b.or(f.val);
  return b.filter(f.col as string, f.op, f.val);
}

async function runQuery(sb: SupabaseClient, q: PostgRestQuery): Promise<CatalogRow[]> {
  const builder = applyQuery(sb, q);
  const res = await new Promise<{ data: unknown[] | null; error: { message: string } | null }>((resolve, reject) => {
    if (typeof builder.then === 'function') builder.then(resolve, reject);
    else reject(new Error('catalog: builder no thenable'));
  });
  if (res.error) throw res.error;
  return (res.data ?? []) as unknown as CatalogRow[];
}

/** Cuenta filas con los mismos filtros (HEAD + count exact: no baja datos). null si falla. */
async function runCount(sb: SupabaseClient, filters: CatalogFilter[]): Promise<number | null> {
  try {
    let builder = sb
      .from('catalog_titles')
      .select('tmdb_id', { count: 'exact', head: true }) as unknown as Builder;
    for (const f of filters) builder = applyOne(builder, f);
    const res = await new Promise<{ count?: number | null; error: { message: string } | null }>((resolve, reject) => {
      if (typeof builder.then === 'function') builder.then(resolve, reject);
      else reject(new Error('catalog: builder no thenable'));
    });
    return res.error || typeof res.count !== 'number' ? null : res.count;
  } catch {
    return null;
  }
}

/** Fila del RPC `search_titles`: las columnas de catalog_titles + el total antes de paginar. */
type SearchRpcRow = CatalogRow & { total_count?: number | string | null };

// Estado del RPC `search_titles` (migración 0025): undefined = sin probar,
// true = responde, false = no desplegado (la búsqueda degrada a PostgREST por
// título y no se reintenta en cada tecla).
let searchRpcAvailable: boolean | undefined;

/** Solo para tests: olvida si el RPC existía. */
export function resetSearchRpcCache(): void {
  searchRpcAvailable = undefined;
}

/** «No existe esa función»: PostgREST (PGRST202) o Postgres (42883). Cualquier otro error es real. */
function isMissingRpc(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    /could not find the function|function .* does not exist/i.test(error.message ?? '')
  );
}

/**
 * Llama a `search_titles` con la misma paginación que la consulta PostgREST
 * (`q` ya trae el offset/limit acotados). null = el RPC no está desplegado;
 * un error real de la base se propaga.
 */
async function callSearchRpc(p: SearchParams, q: PostgRestQuery): Promise<SearchRpcRow[] | null> {
  if (searchRpcAvailable === false) return null;
  const { data, error } = await getSupabase().rpc('search_titles', {
    p_query: p.query,
    p_platforms: p.platforms && p.platforms.length > 0 ? [...p.platforms] : null,
    p_genres: p.genres && p.genres.length > 0 ? [...p.genres] : null,
    p_decade: p.decade ?? null,
    p_type: p.type ?? null,
    p_sort: p.sort ?? 'popularity',
    p_offset: q.range[0],
    p_limit: q.range[1] - q.range[0] + 1,
  });
  if (error) {
    if (isMissingRpc(error)) {
      searchRpcAvailable = false;
      return null;
    }
    throw error;
  }
  searchRpcAvailable = true;
  return (data ?? []) as unknown as SearchRpcRow[];
}

function toMedia(rows: CatalogRow[]): Media[] {
  return rows.map(rowToMedia);
}

function pageFrom(rows: CatalogRow[], q: PostgRestQuery): PageResult<Media> {
  const limit = q.range[1] - q.range[0] + 1;
  const hasMore = rows.length === limit;
  return { items: toMedia(rows), nextCursor: hasMore ? q.range[1] + 1 : null, hasMore };
}

/** Repositorio del catálogo paginado sobre PostgREST (solo lectura). */
export const postgrestCatalogSource: CatalogSource = {
  async browse(p: BrowseParams): Promise<PageResult<Media>> {
    const q = buildBrowseQuery(p);
    return pageFrom(await runQuery(getSupabase(), q), q);
  },
  async search(p: SearchParams): Promise<PageResult<Media>> {
    const q = buildSearchQuery(p);
    // Con la migración 0025: título + original + full-text + director + reparto.
    // Sin ella: solo título (FTS) por PostgREST.
    const viaRpc = await callSearchRpc(p, q);
    return pageFrom(viaRpc ?? (await runQuery(getSupabase(), q)), q);
  },
  async count(p: CountParams): Promise<number | null> {
    if (p.query?.trim()) {
      // Con texto el total sale del propio RPC (cuenta también director/actor).
      try {
        const sp: SearchParams = { ...p, query: p.query, cursor: 0, limit: 1 };
        const rows = await callSearchRpc(sp, buildSearchQuery(sp));
        if (rows) {
          const total = rows.length === 0 ? 0 : Number(rows[0].total_count);
          return Number.isFinite(total) ? total : null;
        }
      } catch {
        return null;
      }
    }
    return runCount(getSupabase(), buildCountFilters(p));
  },
  async byIds(type: 'movie' | 'tv', ids: number[]): Promise<Media[]> {
    if (ids.length === 0) return [];
    const { data, error } = await getSupabase().from('catalog_titles').select(COLUMNS).eq('media_type', type).in('tmdb_id', ids);
    if (error) throw error;
    return toMedia((data ?? []) as unknown as CatalogRow[]);
  },
  async candidates(platforms: string[], type?: 'movie' | 'tv', limit?: number, runtime?: RuntimeRange): Promise<Media[]> {
    const q = buildCandidatesQuery(platforms, type, limit ?? 600, runtime);
    return toMedia(await runQuery(getSupabase(), q));
  },
  async availableNow(platforms: string[]): Promise<Media[]> {
    const q = buildCandidatesQuery(platforms, undefined, 1000);
    return toMedia(await runQuery(getSupabase(), q));
  },
  async availability(type: 'movie' | 'tv', id: number): Promise<CatalogRow | null> {
    const { data, error } = await getSupabase()
      .from('catalog_titles')
      .select(COLUMNS)
      .eq('media_type', type)
      .eq('tmdb_id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as CatalogRow | null) ?? null;
  },
};
