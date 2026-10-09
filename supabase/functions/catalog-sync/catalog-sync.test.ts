/// <reference types="jest" />
/**
 * Pruebas de la Edge Function `catalog-sync` (VERTICE-PLAN-2 D2-1.3/D2-1.8).
 *
 * El cliente Supabase (service_role) y el fetch a TMDB se sustituyen por mocks
 * que registran las llamadas (igual que delete-account.test.ts). Las formas de
 * respuesta de TMDB son FIXTURES de la documentación v3: NO verificadas contra
 * la API real (no hay TMDB_READ_TOKEN en .env.local);
 * scripts/verify-catalog.mjs lo comprueba cuando el dueño aporta el token.
 *
 * Cubre: protección por secreto, paginación, parte por rangos de años,
 * reanudación (continúa desde last_page), sin duplicados (upsert con
 * onConflict), reintentos ante 500, y que las plataformas salen como ids
 * ESTABLES de Diana (no ids de TMDB).
 *
 * Se usa `maxJobs:1` + `currentYear` que produce una sola ventana de años para
 * que cada test procese exactamente UN trabajo (el primero: netflix/movie/
 * flatrate) → determinista y rápido sin timers falsos.
 */

type Handler = (req: Request) => Promise<Response> | Response;
type Row = Record<string, unknown>;

const denoEnv: Record<string, string | undefined> = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'fake-service-role',
  TMDB_READ_TOKEN: 'fake-tmdb-token',
  CATALOG_SYNC_SECRET: 'sync-secret',
};
const globals = globalThis as unknown as { Deno: unknown; __handler: Handler };
globals.Deno = {
  env: { get: (k: string) => denoEnv[k] },
  serve: (handler: Handler) => {
    globals.__handler = handler;
  },
};

jest.mock('npm:@supabase/supabase-js@2', () => ({
  createClient: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fn = require('./index');

// ---------------------------------------------------------------------------
// Mock de service_role: catalog_sync_state + catalog_titles
// ---------------------------------------------------------------------------

const syncState: Row[] = [];
const titles: Row[] = [];
const upsertCalls: Array<{ table: string; rows: Row[]; onConflict: string }> = [];

function chain(table: string) {
  const q = {
    table,
    _eq: {} as Record<string, unknown>,
    _select: false,
    select() {
      q._select = true;
      return q;
    },
    eq(col: string, val: unknown) {
      q._eq[col] = val;
      return q;
    },
    async maybeSingle() {
      if (q._select) {
        const match = syncState.filter((r) => Object.entries(q._eq).every(([k, v]) => r[k] === v));
        return { data: match[0] ?? null, error: null };
      }
      return { data: null, error: null };
    },
    async upsert(rows: Row | Row[], opts?: { onConflict: string }) {
      const list = Array.isArray(rows) ? rows : [rows];
      if (table === 'catalog_sync_state') {
        for (const r of list) {
          const key = { provider: r.provider, media_type: r.media_type, monetization: r.monetization, range_key: r.range_key };
          const i = syncState.findIndex((x) => Object.entries(key).every(([k, v]) => x[k] === v));
          if (i >= 0) syncState[i] = { ...syncState[i], ...r };
          else syncState.push(r);
        }
        return { error: null };
      }
      upsertCalls.push({ table, rows: list, onConflict: opts?.onConflict ?? '' });
      for (const r of list) {
        const i = titles.findIndex((t) => t.tmdb_id === r.tmdb_id && t.media_type === r.media_type);
        if (i >= 0) titles[i] = { ...titles[i], ...r };
        else titles.push(r);
      }
      return { error: null };
    },
  };
  return q;
}
const mockAdmin = { from: (table: string) => chain(table) };

// ---------------------------------------------------------------------------
// Mock de TMDB: páginas de discover deterministas
// ---------------------------------------------------------------------------

interface DiscoverResponse {
  page: number;
  results: unknown[];
  total_results: number;
  total_pages: number;
}
let discoverPages: Record<string, DiscoverResponse> = {}; // clave `${mediaType}:${page}`
const tmdbRequests: string[] = [];
let fetchImpl: (url: URL | string) => Promise<Response>;

function makeFetch(statusesByMovieCall: Record<number, number> = {}): (url: URL | string) => Promise<Response> {
  let movieCall = 0;
  return async (url: URL | string) => {
    const u = String(url);
    tmdbRequests.push(u);
    const m = u.match(/\/discover\/(movie|tv)\?([^#]*)/);
    if (!m) return new Response('nf', { status: 404 });
    const [, mediaType, qs] = m;
    const params = new URLSearchParams(qs);
    const page = Number(params.get('page') ?? 1);
    if (mediaType === 'movie') {
      const forced = statusesByMovieCall[movieCall];
      movieCall += 1;
      if (forced) return new Response('err', { status: forced });
    }
    const resp = discoverPages[`${mediaType}:${page}`];
    if (!resp) return new Response('nf', { status: 404 });
    return new Response(JSON.stringify(resp), { status: 200 });
  };
}

function page(mediaType: 'movie' | 'tv', page: number, results: unknown[], total: number, total_pages: number): void {
  discoverPages[`${mediaType}:${page}`] = { page, results, total_results: total, total_pages: total_pages };
}

function titleRow(id: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    media_type: 'movie',
    title: `Titulo ${id}`,
    original_title: `Original ${id}`,
    release_date: '2005-06-15',
    genre_ids: [18],
    vote_average: 7.1,
    vote_count: 120,
    popularity: 42,
    runtime: 100,
    poster_path: `/p${id}.jpg`,
    backdrop_path: null,
    original_language: 'es',
    ...overrides,
  };
}

async function post(body: unknown, secret = 'sync-secret'): Promise<Response> {
  const req = new Request('http://localhost/catalog-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'x-catalog-sync-secret': secret } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return globals.__handler(req);
}

interface JobResult {
  provider: string;
  media_type: string;
  monetization: string;
  range_key: string;
  synced: number;
  pages: number;
  total: number;
  done: boolean;
  error?: string;
}
interface SyncBody {
  mode: string;
  processed: number;
  stopped: boolean;
  results: JobResult[];
}

describe('Edge Function catalog-sync (D2-1.3)', () => {
  beforeEach(() => {
    syncState.length = 0;
    titles.length = 0;
    upsertCalls.length = 0;
    discoverPages = {};
    tmdbRequests.length = 0;
    fetchImpl = makeFetch();
    fn._setSupabaseForTest(mockAdmin);
    fn._setFetchForTest(fetchImpl);
  });

  it('sin secreto → 401 (nunca ejecutable por un usuario normal)', async () => {
    const res = await post({ mode: 'full', currentYear: 1949 }, '');
    expect(res.status).toBe(401);
    expect(tmdbRequests.length).toBe(0);
  });

  it('secreto incorrecto → 401', async () => {
    const res = await post({ mode: 'full', currentYear: 1949 }, 'otro');
    expect(res.status).toBe(401);
    expect(tmdbRequests.length).toBe(0);
  });

  it('pagina: procesa varias páginas hasta total_pages y no duplica (upsert por lote)', async () => {
    const r1 = Array.from({ length: 20 }, (_, i) => titleRow(100 + i));
    const r2 = Array.from({ length: 20 }, (_, i) => titleRow(120 + i));
    page('movie', 1, r1, 40, 2);
    page('movie', 2, r2, 40, 2);
    page('tv', 1, [], 0, 1);

    const res = await post({ mode: 'full', currentYear: 1949, pages: 5, timeMs: 60_000, maxJobs: 1 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as SyncBody;
    expect(body.processed).toBe(1);
    const job = body.results[0];
    expect(job.provider).toBe('netflix');
    expect(job.media_type).toBe('movie');
    expect(job.monetization).toBe('flatrate');
    expect(job.done).toBe(true);
    expect(job.synced).toBe(40);
    expect(titles.length).toBe(40); // 20+20 sin duplicar
    expect(upsertCalls.length).toBeGreaterThan(0);
    expect(upsertCalls[0].onConflict).toBe('media_type,tmdb_id');
  });

  it('parte por rangos de años: el discover lleva gte/lte de la ventana y sin mínimo de votos', async () => {
    page('movie', 1, [titleRow(1)], 1, 1);
    page('tv', 1, [], 0, 1);

    const res = await post({ mode: 'full', currentYear: 1949, pages: 5, timeMs: 60_000, maxJobs: 1 });
    expect(res.status).toBe(200);
    const movieReq = tmdbRequests.find((u) => u.includes('/discover/movie'));
    expect(movieReq).toBeDefined();
    const params = new URLSearchParams(movieReq!.split('?')[1]);
    expect(params.get('primary_release_date.gte')).toBe('1940-01-01');
    expect(params.get('primary_release_date.lte')).toBe('1949-12-31');
    expect(params.get('watch_region')).toBe('ES');
    expect(params.get('with_watch_providers')).toBe('8'); // netflix
    expect(params.get('with_watch_monetization_types')).toBe('flatrate');
    expect(params.get('vote_count.gte')).toBeNull(); // sin filtro de votos
  });

  it('reanuda: con last_page guardado, continúa DESDE esa página (no vuelve a la 1)', async () => {
    syncState.push({
      provider: 'netflix',
      media_type: 'movie',
      monetization: 'flatrate',
      range_key: '1940-1949',
      last_page: 1,
      last_total: 40,
      status: 'running',
      last_error: null,
      last_synced_at: null,
      updated_at: null,
    });
    page('movie', 2, [titleRow(500)], 1, 1);

    const res = await post({ mode: 'full', currentYear: 1949, pages: 5, timeMs: 60_000, maxJobs: 1 });
    expect(res.status).toBe(200);
    expect(tmdbRequests.some((u) => /page=2/.test(u) && u.includes('/discover/movie'))).toBe(true);
    expect(tmdbRequests.some((u) => /page=1/.test(u) && u.includes('/discover/movie'))).toBe(false);
  });

  it('upsert con el mismo título ya sincronizado NO duplica (idempotente)', async () => {
    titles.push(titleRow(1, { platforms_flatrate: ['netflix'] }));
    page('movie', 1, [titleRow(1)], 1, 1);

    const res = await post({ mode: 'full', currentYear: 1949, pages: 5, timeMs: 60_000, maxJobs: 1 });
    expect(res.status).toBe(200);
    expect(titles.filter((t) => t.tmdb_id === 1 && t.media_type === 'movie').length).toBe(1);
  });

  it('mode delta: solo procesa ventanas recientes (range_key delta:AAAA)', async () => {
    page('movie', 1, [titleRow(1)], 1, 1);
    page('tv', 1, [], 0, 1);

    const res = await post({ mode: 'delta', currentYear: 2026, pages: 10, timeMs: 60_000, maxJobs: 1 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as SyncBody;
    expect(body.results.length).toBe(1);
    expect(body.results[0].range_key).toMatch(/^delta:/);
    const movieReq = tmdbRequests.find((u) => u.includes('/discover/movie'))!;
    const params = new URLSearchParams(movieReq.split('?')[1]);
    expect(params.get('primary_release_date.gte')).toBe('2025-01-01');
  });

  it('reintenta ante 500 y luego continúa (infraestructura)', async () => {
    fetchImpl = makeFetch({ 0: 500 }); // primera llamada a /discover/movie → 500
    fn._setFetchForTest(fetchImpl);
    page('movie', 1, [titleRow(1)], 1, 1);

    const res = await post({ mode: 'full', currentYear: 1949, pages: 5, timeMs: 60_000, maxJobs: 1 });
    expect(res.status).toBe(200);
    const movieCalls = tmdbRequests.filter((x) => x.includes('/discover/movie'));
    expect(movieCalls.length).toBeGreaterThanOrEqual(2); // 500 + reintento
    expect(titles.length).toBe(1); // el reintento terminó sincronizando
  });

  it('las filas derivan de providers (ids estables de Diana, no ids de TMDB)', async () => {
    page('movie', 1, [titleRow(1)], 1, 1);
    page('tv', 1, [], 0, 1);

    const res = await post({ mode: 'full', currentYear: 1949, pages: 5, timeMs: 60_000, maxJobs: 1 });
    expect(res.status).toBe(200);
    const t = titles.find((x) => x.tmdb_id === 1);
    expect(t).toBeDefined();
    expect(Array.isArray(t!.platforms_flatrate)).toBe(true);
    expect((t!.platforms_flatrate as string[]).includes('netflix')).toBe(true);
    expect((t!.platforms_flatrate as string[]).includes('8')).toBe(false);
  });
});
