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
import { postgrestCatalogSource } from './postgrest.repository';
import { COLUMNS } from './query';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
const { getSupabase } = require('@/lib/supabase');

type Row = Record<string, unknown>;

interface Recorded {
  from: string;
  select: string;
  filters: Array<[string, string, string]>;
  ors: string[];
  eqs: Array<[string, unknown]>;
  ins: Array<[string, unknown]>;
  order: string | null;
  range: [number, number] | null;
}

function makeClient(rows: Row[]) {
  const calls: Recorded[] = [];
  const client = {
    from(table: string) {
      const rec: Recorded = { from: table, select: '', filters: [], ors: [], eqs: [], ins: [], order: null, range: null };
      calls.push(rec);
      const b = {
        select(cols: string) {
          rec.select = cols;
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
        order(by: string) {
          rec.order = by;
          return b;
        },
        range(from: number, to: number) {
          rec.range = [from, to];
          return b;
        },
        then(resolve: (v: { data: Row[] | null; error: { message: string } | null }) => void, reject: (e: unknown) => void) {
          let out = [...rows];
          for (const [col, val] of rec.eqs) out = out.filter((r) => r[col] === val);
          for (const [col, op, val] of rec.filters) {
            if (op === 'eq') out = out.filter((r) => String(r[col]) === val);
          }
          for (const [col, arr] of rec.ins) {
            const set = new Set((arr as unknown[]) as unknown[]);
            out = out.filter((r) => set.has(r[col]));
          }
          const [from, to] = rec.range ?? [0, Infinity];
          out = out.slice(from, to + 1);
          if ((client as unknown as { fail?: boolean }).fail) reject(new Error('boom'));
          else resolve({ data: out, error: null });
          return undefined;
        },
      };
      return b;
    },
  };
  return { client, calls, setFail: (f: boolean) => ((client as unknown as { fail?: boolean }).fail = f) };
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

  beforeEach(() => {
    const m = makeClient(ROWS);
    (getSupabase as jest.Mock).mockReturnValue(m.client);
    calls = m.calls;
    setFail = m.setFail;
  });

  it('browse aplica from/select/filters(or)/order/range y devuelve la página', async () => {
    const page = await postgrestCatalogSource.browse({ platforms: ['netflix', 'max'], sort: 'vote', cursor: 10, limit: 10 });
    expect(calls.length).toBe(1);
    const rec = calls[0];
    expect(rec.from).toBe('catalog_titles');
    expect(rec.select).toBe(COLUMNS);
    expect(rec.ors.length).toBe(1);
    expect(rec.ors[0]).toContain('platforms_flatrate=cs.netflix');
    expect(rec.ors[0]).toContain('platforms_buy=cs.max');
    expect(rec.order).toBe('vote_average.desc,vote_count.desc,media_type.asc,tmdb_id.asc');
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

  it('search aplica el FTS (title_tsv websearch_query) y pagina', async () => {
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
    expect(rec.ors[0]).toContain('platforms_flatrate=cs.netflix');
    expect(rec.range).toEqual([0, 999]);
    expect(media.length).toBe(25); // el fixture tiene 25
  });

  it('un error de la base se propaga (throw)', async () => {
    setFail(true);
    await expect(postgrestCatalogSource.browse({ limit: 5 })).rejects.toThrow('boom');
  });
});
