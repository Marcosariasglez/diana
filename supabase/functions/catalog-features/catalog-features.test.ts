/// <reference types="jest" />
/**
 * Pruebas de la Edge Function `catalog-features` (VERTICE-PLAN-2, fase A).
 *
 * Mismo patrón que catalog-sync.test.ts: el cliente service_role y el fetch a
 * TMDB se sustituyen por mocks que registran llamadas; el embedding (Supabase.ai
 * gte-small, inyectable con _setEmbedForTest) devuelve vectores deterministas
 * de 384 dims. Cubre:
 *   - protección por secreto (CATALOG_SYNC_SECRET o CATALOG_FEATURES_SECRET);
 *   - buildEmbedText: caso (a) EN, (c) bilingüe, (b) solo metadatos, truncado;
 *   - candidatos por ANTI-JOIN ordenados por popularity desc (incremental A.3);
 *   - presupuesto de tiempo/títulos (reanuda: el upsert no duplica);
 *   - fallo de TMDB (404/500) → estado error + queda pendiente (se reintenta);
 *   - remaining = anti-join exacto tras el lote.
 */

type Handler = (req: Request) => Promise<Response> | Response;
type Row = Record<string, unknown>;

const denoEnv: Record<string, string | undefined> = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'fake-service-role',
  TMDB_READ_TOKEN: 'fake-tmdb-token',
  CATALOG_SYNC_SECRET: 'sync-secret',
  CATALOG_FEATURES_SECRET: 'features-secret',
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
// Datos: catalog_titles (fuente) y catalog_features (ya generadas)
// ---------------------------------------------------------------------------
let titles: Row[] = [];
let features: Row[] = [];
let featuresState: Row[] = [];
const upserts: Array<{ table: string; row: Row; onConflict: string }> = [];
let remainingOverride: number | null = null;

function chain(table: string) {
  const q = {
    table,
    _select: false,
    _cols: '',
    select(cols?: string) {
      q._select = true;
      q._cols = cols ?? '';
      return q;
    },
    then(onFulfilled?: (v: { data: Row[] | Row | null; error: unknown }) => unknown, onRejected?: (e: unknown) => unknown) {
      let rows: Row[];
      if (table === 'catalog_titles') rows = titles;
      else if (table === 'catalog_features') rows = features;
      else rows = [];
      const p = Promise.resolve({ data: rows.map((r) => ({ ...r })), error: null as unknown });
      return onFulfilled ? p.then(onFulfilled, onRejected) : p;
    },
    async upsert(row: Row | Row[], opts?: { onConflict: string }) {
      const r = Array.isArray(row) ? row[0] : row;
      upserts.push({ table, row: { ...r }, onConflict: opts?.onConflict ?? '' });
      if (table === 'catalog_features') {
        const i = features.findIndex((f) => f.tmdb_id === r.tmdb_id && f.media_type === r.media_type);
        if (i >= 0) features[i] = { ...features[i], ...r };
        else features.push({ ...r });
      } else if (table === 'catalog_features_state') {
        const i = featuresState.findIndex((f) => f.tmdb_id === r.tmdb_id && f.media_type === r.media_type);
        if (i >= 0) featuresState[i] = { ...featuresState[i], ...r };
        else featuresState.push({ ...r });
      }
      return { error: null };
    },
  };
  return q;
}

function candidatesForLimit(limit: number): Row[] {
  // Misma semántica del RPC features_candidates (anti-join, popularity desc).
  const withFeature = new Set(features.map((f) => `${f.media_type}:${f.tmdb_id}`));
  return titles
    .filter((t) => !withFeature.has(`${t.media_type}:${t.tmdb_id}`))
    .sort((a, b) => (b.popularity as number) - (a.popularity as number) || (a.tmdb_id as number) - (b.tmdb_id as number))
    .slice(0, limit)
    .map((t) => ({
      tmdb_id: t.tmdb_id,
      media_type: t.media_type,
      title: t.title,
      original_title: t.original_title,
      overview: t.overview,
      year: t.year,
      original_language: t.original_language,
      runtime: t.runtime,
      genre_ids: t.genre_ids,
      popularity: t.popularity,
    }));
}

function remainingCount(): number {
  if (remainingOverride !== null) return remainingOverride;
  const withFeature = new Set(features.map((f) => `${f.media_type}:${f.tmdb_id}`));
  return titles.filter((t) => !withFeature.has(`${t.media_type}:${t.tmdb_id}`)).length;
}

const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
const mockAdmin = {
  from: (table: string) => chain(table),
  rpc: jest.fn(async (name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn: name, args });
    if (name === 'features_candidates') return { data: candidatesForLimit((args.p_limit as number) ?? 100), error: null };
    if (name === 'features_remaining') return { data: remainingCount(), error: null };
    throw new Error(`rpc no soportado: ${name}`);
  }),
};

// ---------------------------------------------------------------------------
// Mock de TMDB (detalle en en-US) y de embedding
// ---------------------------------------------------------------------------
const tmdbRequests: string[] = [];
let tmdbStatusByCall: Array<number | null> = [];
const EMB_TEXTS: string[] = [];

function resetMocks() {
  titles = [];
  features = [];
  featuresState = [];
  upserts.length = 0;
  rpcCalls.length = 0;
  tmdbRequests.length = 0;
  tmdbStatusByCall = [];
  EMB_TEXTS.length = 0;
  remainingOverride = null;
}
beforeEach(resetMocks);

const makeFetch = () =>
  (async (url: URL | string) => {
    const u = String(url);
    tmdbRequests.push(u);
    const forced = tmdbStatusByCall.shift() ?? null;
    if (forced) return new Response('err', { status: forced });
    const m = u.match(/\/(movie|tv)\/(\d+)\?/);
    if (!m) return new Response('nf', { status: 404 });
    const id = Number(m[2]);
    // Fijo por id: el EN existe salvo cuando el id es par (entonces sin
    // overview EN → caso (c)); el id 777404 simula 404.
    if (id === 777404) return new Response('nf', { status: 404 });
    const hasEn = id % 2 === 1;
    const body = hasEn
      ? { title: `EN Title ${id}`, name: `EN Name ${id}`, overview: `EN overview for movie ${id}. A story of adventure.` }
      : { title: `Title ${id}`, name: `Name ${id}`, overview: '' };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

const EMB_DIM = 384;
const makeEmbed = () =>
  (async (text: string) => {
    EMB_TEXTS.push(text);
    const v = new Array<number>(EMB_DIM).fill(0);
    v[text.length % EMB_DIM] = 1; // vector unitario determinista por longitud
    return v;
  }) as (text: string) => Promise<number[]>;

const handler = (): Handler => globals.__handler as Handler;
const post = (secret: string | null, body?: Record<string, unknown>) =>
  handler()(
    new Request('https://fn.local', {
      method: 'POST',
      headers: secret ? { 'x-catalog-sync-secret': secret, 'Content-Type': 'application/json' } : {},
      body: JSON.stringify(body ?? {}),
    }),
  );

function title(t: Partial<Row>): Row {
  return {
    tmdb_id: 0,
    media_type: 'movie',
    title: 'T',
    original_title: 'OT',
    overview: 'OV ES',
    year: 2020,
    original_language: 'es',
    runtime: 120,
    genre_ids: [18, 27],
    popularity: 1,
    ...t,
  };
}

// ---------------------------------------------------------------------------
// Protección
// ---------------------------------------------------------------------------
describe('protección por secreto', () => {
  beforeEach(() => {
    fn._setFetchForTest(makeFetch());
    fn._setEmbedForTest(makeEmbed());
    fn._setSleepForTest(() => Promise.resolve());
    fn._setSupabaseForTest(mockAdmin);
    titles = [title({ tmdb_id: 1 })];
  });

  it('401 sin cabecera', async () => {
    expect((await post(null)).status).toBe(401);
  });

  it('401 con secreto equivocado', async () => {
    expect((await post('nope')).status).toBe(401);
  });

  it('200 con CATALOG_SYNC_SECRET (reutilizado por el workflow de GitHub)', async () => {
    expect((await post('sync-secret')).status).toBe(200);
  });

  it('200 con CATALOG_FEATURES_SECRET (bombeo local)', async () => {
    expect((await post('features-secret')).status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// buildEmbedText (decisión A.1): 3 casos + truncado
// ---------------------------------------------------------------------------
describe('buildEmbedText', () => {
  const base = {
    title: 'El título',
    originalTitle: 'The Original',
    overviewEs: 'Una sinopsis en español.',
    year: 2021,
    language: 'es',
    runtime: 130,
    genreIds: [18, 27],
  };

  it('(a) overview EN presente → «Title. Overview» (sin metadatos) truncado a 1600', () => {
    const t = fn.buildEmbedText({ ...base, en: { title: 'The Original', overview: 'An english plot.' } });
    expect(t).toBe('The Original. An english plot.');
  });

  it('(a) el overview EN largo se trunca a 1600 chars', () => {
    const long = 'x'.repeat(2000);
    const t = fn.buildEmbedText({ ...base, en: { title: 'T', overview: long } });
    expect(t.length).toBe(1600);
  });

  it('(c) sin EN → bilingüe: ambos títulos + sinopsis ES + metadatos EN', () => {
    const t = fn.buildEmbedText({ ...base, en: { title: 'The Original', overview: '' } });
    expect(t).toBe('The Original. El título. Una sinopsis en español. Year 2021. Language: es. Runtime: 130 min. Genres: Drama, Horror');
  });

  it('(b) sin sinopsis en ninguno de los dos → solo metadatos', () => {
    const t = fn.buildEmbedText({ ...base, overviewEs: '', en: null });
    expect(t).toBe('The Original. El título. Year 2021. Language: es. Runtime: 130 min. Genres: Drama, Horror');
  });

  it('géneros desconocidos se omiten y el idioma vació es «unknown»', () => {
    const t = fn.buildEmbedText({ ...base, language: '', runtime: null, genreIds: [99999], en: null });
    expect(t).toBe('The Original. El título. Una sinopsis en español. Year 2021. Language: unknown');
  });
});

// ---------------------------------------------------------------------------
// Flujo completo con fixtures
// ---------------------------------------------------------------------------
describe('flujo del backfill', () => {
  beforeEach(() => {
    fn._setFetchForTest(makeFetch());
    fn._setEmbedForTest(makeEmbed());
    fn._setSleepForTest(() => Promise.resolve());
    fn._setSupabaseForTest(mockAdmin);
  });

  it('genera features solo para el anti-join, en orden de popularidad, sin duplicar', async () => {
    // 3 títulos sin feature (popularidad 30 > 20 > 10) + 1 con feature (pop 100:
    // si el anti-join fallara iría PRIMERO).
    titles = [
      title({ tmdb_id: 101, popularity: 30 }), // impar → EN (a)
      title({ tmdb_id: 102, popularity: 20 }), // par → bilingüe (c)
      title({ tmdb_id: 103, popularity: 10, overview: '' }), // par + sin ES → (c) sin sinopsis
      title({ tmdb_id: 999, popularity: 100 }),
    ];
    features = [title({ tmdb_id: 999, popularity: 100 })];

    const res = await post('features-secret');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { processed: number; embedded: number; remaining: number };
    expect(body.processed).toBe(3);
    expect(body.embedded).toBe(3);
    expect(body.remaining).toBe(0);

    // Orden: 101, 102, 103 (NO 999, que ya tiene feature).
    expect(tmdbRequests.map((u) => u.match(/\/(movie|tv)\/(\d+)/)?.[2])).toEqual(['101', '102', '103']);
    // Todos en en-US.
    for (const u of tmdbRequests) expect(u).toContain('language=en-US');
    // Upserts con onConflict y keywords/director/cast vacíos (decisión A.1).
    expect(upserts.filter((u) => u.table === 'catalog_features')).toHaveLength(3);
    for (const u of upserts) {
      if (u.table === 'catalog_features') {
        expect(u.onConflict).toBe('media_type,tmdb_id');
        expect(u.row.keywords).toEqual([]);
        expect(u.row.director).toBe('');
        expect(u.row.cast_names).toEqual([]);
        expect(u.row.embedding).toHaveLength(EMB_DIM);
      }
    }
    // Estado: 3 done.
    expect(featuresState.filter((s) => s.status === 'done')).toHaveLength(3);
    // El upsert NO duplicó: 101/102/103 + 999.
    expect(features).toHaveLength(4);
  });

  it('reanuda: un segundo run tras 1 feature generada no la repite', async () => {
    titles = [title({ tmdb_id: 101, popularity: 30 }), title({ tmdb_id: 102, popularity: 20 })];
    await post('sync-secret');
    expect(features).toHaveLength(2);

    const upsertsBefore = upserts.length;
    // Run 2: anti-join vacío → nada que hacer.
    const res2 = await post('sync-secret');
    const body2 = (await res2.json()) as { processed: number; remaining: number };
    expect(body2.processed).toBe(0);
    expect(body2.remaining).toBe(0);
    expect(upserts.length).toBe(upsertsBefore);
    expect(features).toHaveLength(2); // sin duplicados
  });

  it('incremental (A.3): un título NUEVO del delta entra en el siguiente run', async () => {
    titles = [title({ tmdb_id: 101, popularity: 30 })];
    await post('sync-secret');
    expect(features).toHaveLength(1);

    titles.push(title({ tmdb_id: 555, popularity: 999 })); // llega del delta diario
    const res = await post('sync-secret');
    const body = (await res.json()) as { processed: number };
    expect(body.processed).toBe(1);
    expect(features.some((f) => f.tmdb_id === 555)).toBe(true);
  });

  it('TMDB 404 (título fuera de TMDB) → usa el texto local (c) y sigue embebido (fallback)', async () => {
    titles = [title({ tmdb_id: 777404, popularity: 30 }), title({ tmdb_id: 103, popularity: 20 })];
    const res = await post('sync-secret');
    const body = (await res.json()) as { processed: number; embedded: number; errors: number; remaining: number; fallback: number };
    expect(body.processed).toBe(2);
    expect(body.embedded).toBe(2); // el 404 también: el catálogo trae los datos ES
    expect(body.errors).toBe(0);
    expect(body.remaining).toBe(0);
    expect(body.fallback).toBe(1); // solo el 404 (el 103 es impar → tiene EN)
    expect(featuresState.find((s) => s.tmdb_id === 777404)?.status).toBe('done');
  });

  it('TMDB 500 persistente → estado error, queda pendiente y se reintenta', async () => {
    titles = [title({ tmdb_id: 101, popularity: 30 }), title({ tmdb_id: 103, popularity: 20 })];
    // 3 llamadas 500 (reintento agotado) para el 101; el 103 responde bien.
    tmdbStatusByCall = [500, 500, 500, null];
    const res = await post('sync-secret');
    const body = (await res.json()) as { processed: number; embedded: number; errors: number; remaining: number };
    expect(body.processed).toBe(2);
    expect(body.embedded).toBe(1); // solo el 103
    expect(body.errors).toBe(1);
    expect(body.remaining).toBe(1); // el 101 sigue pendiente
    expect(featuresState.find((s) => s.tmdb_id === 101)?.status).toBe('error');
    expect(featuresState.find((s) => s.tmdb_id === 103)?.status).toBe('done');
  });

  it('fallo de embedding → estado error y queda pendiente', async () => {
    fn._setEmbedForTest(async () => {
      throw new Error('modelo caído');
    });
    titles = [title({ tmdb_id: 101, popularity: 30 })];
    const res = await post('sync-secret');
    const body = (await res.json()) as { embedded: number; errors: number; remaining: number };
    expect(body.embedded).toBe(0);
    expect(body.errors).toBe(1);
    expect(body.remaining).toBe(1);
    expect(featuresState[0].status).toBe('error');
    expect(features).toHaveLength(0);
  });

  it('reintento de TMDB con backoff ante 429 (1 llamada extra antes de continuar)', async () => {
    titles = [title({ tmdb_id: 101, popularity: 30 })];
    tmdbStatusByCall = [429]; // primera llamada 429, segunda OK
    const res = await post('sync-secret');
    const body = (await res.json()) as { embedded: number };
    expect(body.embedded).toBe(1);
    expect(tmdbRequests.filter((u) => u.includes('101')).length).toBe(2);
  });

  it('presupuesto de TÍTULOS: con maxTitles=1 procesa uno y el resto queda', async () => {
    titles = [title({ tmdb_id: 101, popularity: 30 }), title({ tmdb_id: 102, popularity: 20 })];
    const res = await post('sync-secret', { maxTitles: 1 });
    const body = (await res.json()) as { processed: number; remaining: number };
    expect(body.processed).toBe(1);
    expect(body.remaining).toBe(1);
    // El siguiente run recoge el que quedó (reanuda).
    const res2 = await post('sync-secret');
    const body2 = (await res2.json()) as { remaining: number };
    expect(body2.remaining).toBe(0);
  });

  it('presupuesto de TIEMPO: con budget mínimo se detiene a tiempo', async () => {
    let now = 0;
    const realDateNow = Date.now;
    Date.now = () => {
      now += 5000; // cada 5000 ms consumidos
      return now;
    };
    try {
      titles = [title({ tmdb_id: 101, popularity: 30 }), title({ tmdb_id: 102, popularity: 20 }), title({ tmdb_id: 103, popularity: 10 })];
      const res = await post('sync-secret', { timeMs: 6000 });
      const body = (await res.json()) as { processed: number; remaining: number };
      expect(body.processed).toBeLessThanOrEqual(2);
      expect(body.remaining).toBeGreaterThanOrEqual(1);
    } finally {
      Date.now = realDateNow;
    }
  });

  it('response incluye fallback (cuenta de títulos sin overview EN)', async () => {
    titles = [title({ tmdb_id: 101, popularity: 30 }), title({ tmdb_id: 102, popularity: 20 })];
    const res = await post('sync-secret');
    const body = (await res.json()) as { fallback: number };
    expect(body.fallback).toBe(1); // 102 es par → sin EN
  });

  it('los textos embbedidos usan el overview EN cuando existe', async () => {
    titles = [title({ tmdb_id: 101, popularity: 30 })];
    await post('sync-secret');
    expect(EMB_TEXTS[0]).toContain('EN overview for movie 101');
  });
});
