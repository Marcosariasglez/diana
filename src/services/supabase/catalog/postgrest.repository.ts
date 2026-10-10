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
  buildSearchQuery,
  COLUMNS,
  type CatalogFilter,
  type PostgRestQuery,
} from './query';
import type { BrowseParams, PageResult, SearchParams } from './types';

/** Fuente de candidatos del catálogo (mock o PostgREST): misma firma. */
export interface CatalogSource {
  /** Explorar paginado (chips de plataforma, filtros de género/década). */
  browse(p: BrowseParams): Promise<PageResult<Media>>;
  /** Búsqueda (FTS + trigram). */
  search(p: SearchParams): Promise<PageResult<Media>>;
  /** Títulos por (tipo, ids TMDB). */
  byIds(type: 'movie' | 'tv', ids: number[]): Promise<Media[]>;
  /** Candidatos para el motor mood/feed/grupo (los N más populares filtrados). */
  candidates(platforms: string[], type?: 'movie' | 'tv', limit?: number): Promise<Media[]>;
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
  then?: (resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => void, reject: (e: unknown) => void) => void;
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
    return pageFrom(await runQuery(getSupabase(), q), q);
  },
  async byIds(type: 'movie' | 'tv', ids: number[]): Promise<Media[]> {
    if (ids.length === 0) return [];
    const { data, error } = await getSupabase().from('catalog_titles').select(COLUMNS).eq('media_type', type).in('tmdb_id', ids);
    if (error) throw error;
    return toMedia((data ?? []) as unknown as CatalogRow[]);
  },
  async candidates(platforms: string[], type?: 'movie' | 'tv', limit?: number): Promise<Media[]> {
    const q = buildCandidatesQuery(platforms, type, limit ?? 600);
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
