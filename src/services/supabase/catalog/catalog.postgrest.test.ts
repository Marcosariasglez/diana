/// <reference types="jest" />
/**
 * VERTICE-PLAN-2, D2-1.5: el repositorio PostgREST contra un cliente Supabase
 * MOCK (misma técnica que delete-account.test.ts). Verifica que:
 *  - el repo traduce los parámetros a llamadas PostgREST correctas
 *    (from/select/filter/or/order/range) usando el builder;
 *  - `browse`/`search` devuelven la página maquetada (items Media, nextCursor,
 *    hasMore) a partir de las filas que devuelve la base;
 *  - `byIds` usa eq+in y devuelve solo los ids pedidos;
 *  - `candidates`/`availableNow` aplican el filtro de plataformas;
 *  - un error de la base se propaga (throw).
 */
import { postgrestCatalogSource, resetSearchRpcCache } from './postgrest.repository';
import { COLUMNS } from './query';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
const { getSupabase } = require('@/lib/supabase');

type Row = Record<string, unknown>;

interface OrderCall {
  by: string;
  ascending: boolean;
  nullsFirst: boolean;
}

interface Recorded {
  from: string;
  select: string;
  selectOpts: { count?: string; head?: boolean } | null;
  filters: Array<[string, string, string]>;
  ors: string[];
  eqs: Array<[string, unknown]>;
  ins: Array<[string, unknown]>;
  orders: OrderCall[];
  range: [number, number] | null;
}

function makeClient(rows: Row[]) {
  const calls: Recorded[] = [];
  const client = {
    from(table: string) {
      const rec: Recorded = { from: table, select: '', selectOpts: null, filters: [], ors: [], eqs: [], ins: [], orders: [], range: null };
      calls.push(rec);
      const b = {
        select(cols: string, opts?: { count?: string; head?: boolean }) {
          rec.select = cols;
          rec.selectOpts = opts ?? null;
          return b;
        },
        filter(col: string, op: string, val: string | number) {
          rec.filters.push([col, op, String(val)]);
          return b;
        },
        or(val: string) {
          rec.ors.push(val);
          return b;
        },
        eq(col: string, val: unknown) {
          rec.eqs.push([col, val]);
          return b;
        },
        in(col: string, val: unknown) {
          rec.ins.push([col, val]);
          return b;
        },
        order(by: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
          rec.orders.push({ by, ascending: opts?.ascending ?? true, nullsFirst: opts?.nullsFirst ?? false });
          return b;
        },
        range(from: number, to: number) {
          rec.range = [from, to];
          return b;
        },
        then(
          resolve: (v: { data: Row[] | null; count?: number; error: { message: string } | null }) => void,
          reject: (e: unknown) => void,
        ) {
          let out = [...rows];
          for (const [col, val] of rec.eqs) out = out.filter((r) => r[col] === val);
          for (const [col, op, val] of rec.filters) {
            if (op === 'eq') out = out.filter((r) => String(r[col]) === val);
          }
          for (const [col, arr] of rec.ins) {
            const set = new Set((arr as unknown[]) as unknown[]);
            out = out.filter((r) => set.has(r[col]));
          }
          if ((client as unknown as { fail?: boolean }).fail) {
            reject(new Error('boom'));
            return undefined;
          }
          if (rec.selectOpts?.head) {
            resolve({ data: null, count: out.length, error: null });
            return undefined;
          }
          const [from, to] = rec.range ?? [0, Infinity];
          out = out.slice(from, to + 1);
          resolve({ data: out, error: null });
          return undefined;
        },
      };
      return b;
    },
  };
  // RPC search_titles: 'ok' devuelve filas + total_count; 'missing' imita PostgREST sin la
  // migración 0025 (PGRST202); 'fail' es un error real de la base.
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  let rpcMode: 'ok' | 'missing' | 'fail' = 'missing';
  (client as unknown as { rpc: unknown }).rpc = async (fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args });
    if (rpcMode === 'missing') return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.search_titles' } };
    if (rpcMode === 'fail') return { data: null, error: { code: 'XX000', message: 'boom rpc' } };
    const offset = (args.p_offset as number) ?? 0;
    const page = rows.slice(offset, offset + (args.p_limit as number));
    return { data: page.map((r) => ({ ...r, total_count: String(rows.length) })), error: null };
  };
  return {
    client,
    calls,
    rpcCalls,
    setRpcMode: (m: 'ok' | 'missing' | 'fail') => (rpcMode = m),
    setFail: (f: boolean) => ((client as unknown as { fail?: boolean }).fail = f),
  };
}

function row(over: Partial<Row> & { tmdb_id: number; media_type: string }): Row {
  return {
    title: `T${over.tmdb_id}`,
    original_title: `O${over.tmdb_id}`,
    year: 2000,
    overview: 's',
    genre_ids: [18],
    vote_average: 7,
    vote_count: 10,
    popularity: over.tmdb_id,
    runtime: 100,
    poster_path: null,
    backdrop_path: null,
    original_language: 'es',
    platforms_flatrate: ['netflix'],
    platforms_rent: [],
    platforms_buy: [],
    ...over,
  };
}

const ROWS: Row[] = Array.from({ length: 25 }, (_, i) => row({ tmdb_id: i + 1, media_type: 'movie' }));

describe('repo PostgREST catalog_titles (D2-1.5) — cliente mock', () => {
  let calls: Recorded[];
  let setFail: (f: boolean) => void;
  let rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
  let setRpcMode: (m: 'ok' | 'missing' | 'fail') => void;

  beforeEach(() => {
    resetSearchRpcCache();
    const m = makeClient(ROWS);
    (getSupabase as jest.Mock).mockReturnValue(m.client);
    calls = m.calls;
    setFail = m.setFail;
    rpcCalls = m.rpcCalls;
    setRpcMode = m.setRpcMode;
  });

  it('browse aplica from/select/filters(or)/order(rangos)/range y devuelve la página', async () => {
    const page = await postgrestCatalogSource.browse({ platforms: ['netflix', 'max'], sort: 'vote', cursor: 10, limit: 10 });
    expect(calls.length).toBe(1);
    const rec = calls[0];
    expect(rec.from).toBe('catalog_titles');
    expect(rec.select).toBe(COLUMNS);
    expect(rec.ors.length).toBe(1);
    // Sintaxis PostgREST correcta (verificada contra el PostgREST real):
    // dentro de or=(…) el separador es el PUNTO —col.cs.{…}— (cs = contains
    // @>); la forma con = (col=cs.{…}) da PGRST100 (400) dentro de un or.
    // Sin paréntesis propios (supabase-js los añade al .or()).
    expect(rec.ors[0]).toContain('platforms_flatrate.cs.{netflix}');
    expect(rec.ors[0]).toContain('platforms_buy.cs.{max}');
    expect(rec.ors[0]).not.toContain('=cs.');
    expect(rec.ors[0].startsWith('(')).toBe(false);
    // El orden multi-columna se aplica UNA llamada .order() por término
    // (supabase-js no parsea strings multi-columna).
    expect(rec.orders).toEqual([
      { by: 'vote_average', ascending: false, nullsFirst: false },
      { by: 'vote_count', ascending: false, nullsFirst: false },
      { by: 'media_type', ascending: true, nullsFirst: false },
      { by: 'tmdb_id', ascending: true, nullsFirst: false },
    ]);
    expect(rec.range).toEqual([10, 19]);
    // 25 filas, rango 10..19 → 10 elementos, hasMore (porque la base devuelve
    // el tamaño del límite) y nextCursor 20.
    expect(page.items).toHaveLength(10);
    expect(page.items[0].id).toBe(11); // filas ordenadas por tmdb_id en el fixture
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(20);
    // El media maquetado trae las plataformas unidas.
    expect(page.items[0].platforms).toContain('netflix');
  });

  it('search sin el RPC desplegado degrada al FTS PostgREST (title_tsv websearch_query) y pagina', async () => {
    const page = await postgrestCatalogSource.search({ query: 'gato', limit: 5 });
    const rec = calls[0];
    expect(rec.filters.some(([col, op, val]) => col === 'title_tsv' && op === 'websearch_query' && val === "'gato'")).toBe(true);
    expect(rec.range).toEqual([0, 4]);
    expect(page.items).toHaveLength(5);
    expect(page.nextCursor).toBe(5);
  });

  it('byIds usa eq(media_type)+in(tmdb_id) y devuelve solo los pedidos', async () => {
    const media = await postgrestCatalogSource.byIds('movie', [3, 7]);
    const rec = calls[0];
    expect(rec.eqs).toEqual([['media_type', 'movie']]);
    expect(rec.ins).toEqual([['tmdb_id', [3, 7]]]);
    expect(media.map((m) => m.id).sort((a, b) => a - b)).toEqual([3, 7]);
  });

  it('candidates aplica el filtro de plataformas y devuelve hasta el límite', async () => {
    const media = await postgrestCatalogSource.candidates(['netflix'], 'movie', 5000);
    const rec = calls[0];
    expect(rec.filters).toContainEqual(['media_type', 'eq', 'movie']);
    expect(rec.ors[0]).toContain('platforms_flatrate.cs.{netflix}');
    expect(rec.orders[0]).toEqual({ by: 'popularity', ascending: false, nullsFirst: false });
    expect(rec.range).toEqual([0, 999]);
    expect(media.length).toBe(25); // el fixture tiene 25
  });

  it('un error de la base se propaga (throw)', async () => {
    setFail(true);
    await expect(postgrestCatalogSource.browse({ limit: 5 })).rejects.toThrow('boom');
  });

  it('browse con varios géneros llama a genre_ids ov.{a,b}', async () => {
    await postgrestCatalogSource.browse({ genres: [18, 53], limit: 5 });
    expect(calls[0].filters).toContainEqual(['genre_ids', 'ov', '{18,53}']);
  });

  it('search pasa tipo, géneros y década al builder', async () => {
    await postgrestCatalogSource.search({ query: 'gato', genres: [18], decade: 2010, type: 'movie', limit: 5 });
    const f = calls[0].filters;
    expect(f).toContainEqual(['media_type', 'eq', 'movie']);
    expect(f).toContainEqual(['genre_ids', 'ov', '{18}']);
    expect(f).toContainEqual(['year', 'gte', '2010']);
  });

  it('count usa select con count exact + head, sin order ni range', async () => {
    const n = await postgrestCatalogSource.count({ type: 'movie', genres: [18] });
    const rec = calls[0];
    expect(rec.selectOpts).toEqual({ count: 'exact', head: true });
    expect(rec.orders).toEqual([]);
    expect(rec.range).toBeNull();
    expect(rec.filters).toContainEqual(['genre_ids', 'ov', '{18}']);
    expect(n).toBe(25);
  });

  it('count con texto y sin el RPC desplegado degrada al filtro FTS', async () => {
    await postgrestCatalogSource.count({ query: 'gato' });
    expect(calls[0].filters.some(([col, op]) => col === 'title_tsv' && op === 'websearch_query')).toBe(true);
  });

  describe('search_titles (migración 0025)', () => {
    it('search llama al RPC con texto, filtros, orden y paginación, y no toca la tabla', async () => {
      setRpcMode('ok');
      const page = await postgrestCatalogSource.search({
        query: 'villeneuve',
        platforms: ['netflix'],
        genres: [878],
        decade: 2010,
        type: 'movie',
        sort: 'year',
        cursor: 5,
        limit: 10,
      });
      expect(rpcCalls).toEqual([
        {
          fn: 'search_titles',
          args: {
            p_query: 'villeneuve',
            p_platforms: ['netflix'],
            p_genres: [878],
            p_decade: 2010,
            p_type: 'movie',
            p_sort: 'year',
            p_offset: 5,
            p_limit: 10,
          },
        },
      ]);
      expect(calls).toHaveLength(0); // ni from() ni PostgREST
      expect(page.items).toHaveLength(10);
      expect(page.items[0].id).toBe(6); // offset 5 sobre ids 1..25
      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).toBe(15);
    });

    it('search pasa null por lo que no se filtra y usa los valores por defecto', async () => {
      setRpcMode('ok');
      await postgrestCatalogSource.search({ query: 'gato' });
      expect(rpcCalls[0].args).toEqual({
        p_query: 'gato',
        p_platforms: null,
        p_genres: null,
        p_decade: null,
        p_type: null,
        p_sort: 'popularity',
        p_offset: 0,
        p_limit: 20,
      });
    });

    it('la última página (menos filas que el límite) no tiene siguiente', async () => {
      setRpcMode('ok');
      const page = await postgrestCatalogSource.search({ query: 'gato', cursor: 20, limit: 10 });
      expect(page.items).toHaveLength(5);
      expect(page.hasMore).toBe(false);
      expect(page.nextCursor).toBeNull();
    });

    it('si el RPC no existe degrada a PostgREST y lo recuerda (no reintenta en cada tecla)', async () => {
      await postgrestCatalogSource.search({ query: 'a', limit: 5 });
      await postgrestCatalogSource.search({ query: 'ab', limit: 5 });
      expect(rpcCalls).toHaveLength(1); // solo el primer intento
      expect(calls).toHaveLength(2); // las dos búsquedas fueron por PostgREST
    });

    it('un error real del RPC se propaga y NO marca el RPC como ausente', async () => {
      setRpcMode('fail');
      await expect(postgrestCatalogSource.search({ query: 'gato' })).rejects.toMatchObject({ message: 'boom rpc' });
      setRpcMode('ok');
      await postgrestCatalogSource.search({ query: 'gato' });
      expect(rpcCalls).toHaveLength(2);
    });

    it('count con texto usa total_count del RPC (cuenta también director/actor) con límite 1', async () => {
      setRpcMode('ok');
      const n = await postgrestCatalogSource.count({ query: 'villeneuve', genres: [878], type: 'movie' });
      expect(n).toBe(25);
      expect(rpcCalls[0].args).toMatchObject({ p_query: 'villeneuve', p_genres: [878], p_type: 'movie', p_limit: 1, p_offset: 0 });
      expect(calls).toHaveLength(0);
    });

    it('count con texto devuelve 0 si el RPC no encuentra nada, y null si falla', async () => {
      setRpcMode('ok');
      const emptyClient = makeClient([]);
      emptyClient.setRpcMode('ok');
      (getSupabase as jest.Mock).mockReturnValue(emptyClient.client);
      await expect(postgrestCatalogSource.count({ query: 'nada' })).resolves.toBe(0);
      const failing = makeClient(ROWS);
      failing.setRpcMode('fail');
      (getSupabase as jest.Mock).mockReturnValue(failing.client);
      await expect(postgrestCatalogSource.count({ query: 'gato' })).resolves.toBeNull();
    });
  });

  it('count devuelve null si la base falla (no rompe la UI)', async () => {
    setFail(true);
    await expect(postgrestCatalogSource.count({ genres: [18] })).resolves.toBeNull();
  });
});
