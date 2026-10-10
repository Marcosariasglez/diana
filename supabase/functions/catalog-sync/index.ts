// Edge Function `catalog-sync` (Deno) — VERTICE-PLAN-2, D2-1.3.
// Sincroniza el catálogo completo de España en public.catalog_titles
// (migración 0006). Lo escribe SOLO la función (service_role); el cliente solo
// lee (RLS).
//
// Protegida: exige la cabecera `x-catalog-sync-secret` igual al secreto
// CATALOG_SYNC_SECRET (Supabase secret SIN prefijo SUPABASE_ + mismo valor como
// secreto del repo de GitHub; lo usa el workflow catalog-sync.yml). Un usuario
// normal no puede ejecutarla.
//
// Estrategia (D2-1.3):
//  - Para cada proveedor activo en ES (src/constants/providers.ts) y cada tipo
//    (movie/tv): `discover` con with_watch_providers=<id>, watch_region=ES,
//    with_watch_monetization_types=flatrate (pase 1) y rent|buy (pase 2),
//    SIN mínimo de votos.
//  - Para superar el tope de TMDB (~500 páginas × 20 por consulta), la consulta
//    se parte por RANGOS DE AÑOS (ventanas «AAAA-AAAA») para cada tipo.
//  - REANUDABLE: el progreso (última página por proveedor/tipo/monetización/
//    ventana) vive en catalog_sync_state. Cada ejecución procesa un PRESUPUESTO
//    (páginas y tiempo) y continúa en la siguiente.
//  - Rate-limit respetuoso con TMDB (intervalo entre peticiones) + reintentos
//    con espera exponencial ante 5xx/429/errores de red.
//  - Upsert por lotes (conflicto (media_type, tmdb_id)): no duplica.
//  - Modos: `full` (semanal, todo) y `delta` (diario, solo lo reciente).
//
// IMPORT: los proveedores vienen de src/constants/providers.ts (único origen de
// verdad, D2-1.1), por path relativo (Deno no resuelve el alias `@/`).
//
// FORMAS DE RESPUESTA: tomadas de la documentación v3 de TMDB (/discover,
// /watch/providers). NO verificadas contra la API real: no hay TMDB_READ_TOKEN
// en .env.local; scripts/verify-catalog.mjs lo comprueba cuando el dueño aporta
// el token.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { ES_PROVIDERS, type ProviderDef } from '../../../src/constants/providers.ts';

const TMDB = 'https://api.themoviedb.org/3';
const REGION = 'ES';
const LANG = 'es-ES';

// Presupuesto por ejecución (para ser reanudable). Ajustable por query.
//
// IMPORTANTE (límites del plan gratuito de Supabase, verificado 2026-10-09):
//   - Wall clock máx por worker: 150 s (gratis) / 400 s (de pago).
//   - Timeout de respuesta (idle): 150 s → si la función no responde antes,
//     Supabase devuelve 504. Esta función responde al terminar, así que el
//     presupuesto POR DEFECTO debe caber en < 150 s; el trabajo restante se
//     recupera en la siguiente ejecución (workflow cron/dispatch) gracias a
//     catalog_sync_state.
const DEFAULT_PAGE_BUDGET = 200;                  // páginas de discover por run
const DEFAULT_TIME_BUDGET_MS = 2 * 60 * 1000;     // 2 min por run (< 150 s idle)
const MAX_TIME_BUDGET_MS = 4 * 60 * 1000;         // tope de la opción timeMs
const DEFAULT_BATCH = 100;                        // filas por upsert
const DEFAULT_DELTA_YEARS = 2;                    // `delta`: últimos N años
const DEFAULT_START_YEAR = 1940;
const REQUEST_INTERVAL_MS = 350;                  // rate-limit entre peticiones
const MAX_RETRIES = 3;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-catalog-sync-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------------------------------------------------------------------
// Planificación (FUNCIONES PURAS — las prueban catalog-sync.test.ts)
// ---------------------------------------------------------------------------

export interface SyncWindow {
  key: string;             // '1990-1999' | 'delta:2024'
  dateGte: string;         // YYYY-MM-DD (primary_release_date.gte / first_air_date.gte)
  dateLte: string;         // YYYY-MM-DD
}

export interface SyncJob {
  provider: string;        // id de providers.ts
  mediaType: 'movie' | 'tv';
  monetization: 'flatrate' | 'rent|buy';
  window: SyncWindow;
}

/** Ventanas de años de `startYear` a `endYear` (ambos inclusivos) por `step`. */
export function buildYearWindows(startYear: number, endYear: number, step = 10): SyncWindow[] {
  const out: SyncWindow[] = [];
  for (let s = startYear; s <= endYear; s += step) {
    const e = Math.min(s + step - 1, endYear);
    out.push({ key: `${s}-${e}`, dateGte: `${s}-01-01`, dateLte: `${e}-12-31` });
  }
  return out;
}

/** Ventanas del modo `delta`: solo los últimos `years` años. */
export function buildDeltaWindows(currentYear: number, years: number): SyncWindow[] {
  const s = currentYear - years + 1;
  return [{ key: `delta:${s}`, dateGte: `${s}-01-01`, dateLte: `${currentYear}-12-31` }];
}

/**
 * Lista completa de trabajos (orden determinista: proveedor → tipo →
 * monetización → ventana). `full` = todas las ventanas 1940→año actual;
 * `delta` = solo ventanas recientes.
 */
export function planJobs(
  providers: readonly ProviderDef[],
  mode: 'full' | 'delta',
  currentYear: number,
  step = 10,
  deltaYears = DEFAULT_DELTA_YEARS,
  startYear = DEFAULT_START_YEAR,
): SyncJob[] {
  const windows =
    mode === 'full'
      ? buildYearWindows(startYear, currentYear, step)
      : buildDeltaWindows(currentYear, deltaYears);
  const jobs: SyncJob[] = [];
  for (const p of providers) {
    for (const mediaType of ['movie', 'tv'] as const) {
      for (const monetization of ['flatrate', 'rent|buy'] as const) {
        for (const w of windows) {
          jobs.push({ provider: p.id, mediaType, monetization, window: w });
        }
      }
    }
  }
  return jobs;
}

/** Parámetros de discover para un trabajo (sin mínimo de votos). */
export function discoverParams(job: SyncJob): Record<string, string | number> {
  const params: Record<string, string | number> = {
    watch_region: REGION,
    with_watch_providers: String(providerTmdbId(job.provider)),
    with_watch_monetization_types: job.monetization,
    page: 1,
  };
  if (job.mediaType === 'movie') {
    params['primary_release_date.gte'] = job.window.dateGte;
    params['primary_release_date.lte'] = job.window.dateLte;
  } else {
    params['first_air_date.gte'] = job.window.dateGte;
    params['first_air_date.lte'] = job.window.dateLte;
  }
  return params;
}

/** id TMDB de un proveedor (id de providers.ts) → number. */
export function providerTmdbId(providerId: string): number {
  const p = ES_PROVIDERS.find((x) => x.id === providerId);
  if (!p || p.tmdbProviderId == null) throw new Error(`provider sin id TMDB: ${providerId}`);
  return p.tmdbProviderId;
}

/**
 * Convierte un resultado de discover a filas de catalog_titles.
 * Las plataformas salen del campo `watch/providers` de TMDB (si viene); como
 * el discover con `with_watch_providers` ya garantiza que cada resultado está
 * disponible en el proveedor filtrado, ese se añade si la respuesta no lo trae
 * (los campos de discover no incluyen watch/providers por omisión).
 * (Formas de la documentación v3 de TMDB; no verificadas contra la API real.)
 */
export function toCatalogRows(
  results: unknown[],
  providerId: string,
  monetization: 'flatrate' | 'rent|buy',
): Record<string, unknown>[] {
  // deno-lint-ignore no-explicit-any
  const rows: Record<string, unknown>[] = [];
  const tmdbIdToProvider = new Map<number, string>();
  for (const p of ES_PROVIDERS) if (p.tmdbProviderId != null) tmdbIdToProvider.set(p.tmdbProviderId, p.id);
  for (const raw of results) {
    const r = raw as {
      id: number;
      media_type?: 'movie' | 'tv';
      title?: string;
      name?: string;
      original_title?: string;
      original_name?: string;
      release_date?: string;
      first_air_date?: string;
      genre_ids?: number[];
      vote_average?: number;
      vote_count?: number;
      popularity?: number;
      runtime?: number;
      episode_run_time?: number[];
      poster_path?: string | null;
      backdrop_path?: string | null;
      original_language?: string;
      'watch/providers'?: {
        results?: Record<
          string,
          {
            flatrate?: { provider_id: number }[];
            rent?: { provider_id: number }[];
            buy?: { provider_id: number }[];
          }
        >;
      };
    };
    if (!r.id) continue;
    const mediaType = r.media_type === 'tv' ? 'tv' : 'movie';
    const date = mediaType === 'movie' ? (r.release_date ?? '') : (r.first_air_date ?? '');
    const esProviders = r['watch/providers']?.results?.[REGION];
    const toIds = (list?: { provider_id: number }[]) =>
      (list ?? []).map((x) => tmdbIdToProvider.get(x.provider_id)).filter((x): x is string => x !== undefined);
    const flat = toIds(esProviders?.flatrate);
    const rent = toIds(esProviders?.rent);
    const buy = toIds(esProviders?.buy);
    if (monetization === 'flatrate' && !flat.includes(providerId)) flat.push(providerId);
    if (monetization === 'rent|buy') {
      if (!rent.includes(providerId)) rent.push(providerId);
      if (!buy.includes(providerId)) buy.push(providerId);
    }
    const runtime =
      mediaType === 'movie'
        ? (r.runtime ?? null)
        : r.episode_run_time && r.episode_run_time.length > 0
          ? Math.round(r.episode_run_time.reduce((a, b) => a + b, 0) / r.episode_run_time.length)
          : null;
    rows.push({
      tmdb_id: r.id,
      media_type: mediaType,
      title: mediaType === 'movie' ? (r.title ?? '') : (r.name ?? ''),
      original_title: mediaType === 'movie' ? (r.original_title ?? r.title ?? '') : (r.original_name ?? r.name ?? ''),
      year: date ? Number(date.slice(0, 4)) : null,
      overview: '',
      genre_ids: r.genre_ids ?? [],
      vote_average: r.vote_average ?? 0,
      vote_count: r.vote_count ?? 0,
      popularity: r.popularity ?? 0,
      runtime,
      poster_path: r.poster_path ?? null,
      backdrop_path: r.backdrop_path ?? null,
      original_language: r.original_language ?? null,
      platforms_flatrate: [...new Set(flat)],
      platforms_rent: [...new Set(rent)],
      platforms_buy: [...new Set(buy)],
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Cliente TMDB con rate-limit + reintentos
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
type AnyRecord = Record<string, any>;

let fetchImpl: typeof fetch = globalThis.fetch;
export function _setFetchForTest(f: unknown): void {
  fetchImpl = f as typeof fetch;
}

async function tmdbDiscover(mediaType: 'movie' | 'tv', params: Record<string, string | number>): Promise<AnyRecord> {
  const path = `/discover/${mediaType}`;
  const url = new URL(TMDB + path);
  url.searchParams.set('language', LANG);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${Deno.env.get('TMDB_READ_TOKEN')}`, accept: 'application/json' },
      });
      if (res.ok) return (await res.json()) as AnyRecord;
      if (res.status === 429 || res.status >= 500) {
        // Rate/infraestructura: reintento con espera exponencial.
        lastErr = new Error(`tmdb ${res.status} ${path}`);
        if (attempt < MAX_RETRIES) {
          await sleep(REQUEST_INTERVAL_MS * 2 ** (attempt + 1));
          continue;
        }
        throw lastErr;
      }
      // 4xx (salvo 429): parámetro malo o credencial inválida: no reintenta.
      // El cuerpo va en el error: TMDB lo explica (p. ej. "Invalid API key…"
      // cuando se envió una clave v3 o un digest en vez del token v4 JWT).
      let detail = '';
      try {
        detail = (await res.text()).slice(0, 200);
      } catch {
        /* sin cuerpo */
      }
      throw new Error(`tmdb ${res.status} ${path} ${detail}`.trim());
    } catch (e) {
      if (e instanceof TypeError) {
        // Error de red: reintento.
        lastErr = e;
        if (attempt < MAX_RETRIES) {
          await sleep(REQUEST_INTERVAL_MS * 2 ** (attempt + 1));
          continue;
        }
      }
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('tmdb fetch falló');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

interface RunBudget {
  pages: number;
  timeMs: number;
}

let adminClient: ReturnType<typeof createClient> | null = null;
export function _setSupabaseForTest(c: unknown): void {
  adminClient = c as ReturnType<typeof createClient>;
}
function getAdmin() {
  if (!adminClient) {
    adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  }
  return adminClient;
}

interface JobResult {
  provider: string;
  media_type: 'movie' | 'tv';
  monetization: string;
  range_key: string;
  synced: number;
  pages: number;
  total: number;
  done: boolean;
  error?: string;
  /** true si se omitió porque ya estaba terminado y la run no pedía re-sincronizar. */
  skipped?: boolean;
}

async function syncJob(job: SyncJob, budget: RunBudget, startedAt: number, resync: boolean): Promise<JobResult> {
  const admin = getAdmin();
  const stateKey = {
    provider: job.provider,
    media_type: job.mediaType,
    monetization: job.monetization,
    range_key: job.window.key,
  };
  // REANUDABLE: lee el estado anterior de este trabajo.
  const { data: prev } = await admin
    .from('catalog_sync_state')
    .select('last_page, last_total, status')
    .eq('provider', job.provider)
    .eq('media_type', job.mediaType)
    .eq('monetization', job.monetization)
    .eq('range_key', job.window.key)
    .maybeSingle();
  const prevRow = prev as { last_page?: number; last_total?: number; status?: string } | null;
  // resync=false (la «bomba» del workflow): si el trabajo ya terminó, se SALTA
  // en vez de re-sincronizarlo desde la página 1; así un lote grande avanza
  // solo con lo pendiente y la bomba puede terminar (re-sincronizar todo en
  // cada iteración haría que un full nunca acabara).
  if (!resync && prevRow?.status === 'done') {
    return { ...stateKey, synced: 0, pages: 0, total: prevRow.last_total ?? 0, done: true, skipped: true };
  }
  // Si la pasada se interrumpió (running/error) por el presupuesto de tiempo o
  // páginas, continúa DESDE la última página guardada. Si ya terminó (done) es
  // una re-sincronización (novedades y cambios de disponibilidad) y vuelve a
  // empezar por la página 1 para capturar lo nuevo.
  const incomplete = prevRow != null && (prevRow.status === 'running' || prevRow.status === 'error');
  const startPage = incomplete ? (prevRow.last_page ?? 0) : 0;
  let total = incomplete ? (prevRow.last_total ?? 0) : 0;
  await admin
    .from('catalog_sync_state')
    .upsert({ ...stateKey, status: 'running', last_error: null, last_page: startPage, updated_at: new Date().toISOString() });

  let page = startPage;
  let done = false;
  let synced = 0;
  for (;;) {
    if (Date.now() - startedAt > budget.timeMs || page - startPage >= budget.pages) break;
    const next = page + 1;
    await sleep(REQUEST_INTERVAL_MS); // rate-limit
    const params = { ...discoverParams(job), page: next };
    let res: AnyRecord;
    try {
      res = await tmdbDiscover(job.mediaType, params);
    } catch (e) {
      await admin
        .from('catalog_sync_state')
        .upsert({ ...stateKey, status: 'error', last_error: String(e), updated_at: new Date().toISOString() });
      return { ...stateKey, synced, pages: page - startPage, total, done: false, error: String(e) };
    }
    total = res.total_results ?? total;
    const rows = toCatalogRows(res.results ?? [], job.provider, job.monetization);
    for (let i = 0; i < rows.length; i += DEFAULT_BATCH) {
      const batch = rows.slice(i, i + DEFAULT_BATCH);
      const { error } = await admin.from('catalog_titles').upsert(batch, { onConflict: 'media_type,tmdb_id' });
      if (error) {
        await admin
          .from('catalog_sync_state')
          .upsert({ ...stateKey, status: 'error', last_error: String(error), updated_at: new Date().toISOString() });
        return { ...stateKey, synced, pages: page - startPage, total, done: false, error: String(error) };
      }
      synced += batch.length;
    }
    await admin
      .from('catalog_sync_state')
      .upsert({ ...stateKey, status: 'running', last_page: next, last_total: total, updated_at: new Date().toISOString() });
    page = next;
    const pages = res.total_pages ?? 1;
    if (!res.results || res.results.length < 20 || page >= pages) {
      done = true;
      break;
    }
  }
  if (done) {
    await admin
      .from('catalog_sync_state')
      .upsert({
        ...stateKey,
        status: 'done',
        last_page: page,
        last_total: total,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
  }
  return { ...stateKey, synced, pages: page - startPage, total, done };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });

  // Protegida: solo con el secreto (nunca ejecutable por un usuario normal).
  const secret = req.headers.get('x-catalog-sync-secret') ?? '';
  const expected = Deno.env.get('CATALOG_SYNC_SECRET') ?? '';
  if (!expected || secret !== expected) {
    // Diagnóstico sin exponer el secreto: SHA-256 y longitud de lo RECIBIDO
    // (para compararlo con el valor configurado en el lado que manda la
    // petición) y longitud de lo esperado. Un mismatch típico: salto de
    // línea o espacios al copiar el secret.
    const digest = async (s: string): Promise<string> =>
      Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    return new Response(
      JSON.stringify({
        error: 'unauthorized',
        received: { len: secret.length, sha256: await digest(secret) },
        expectedLen: expected.length,
      }),
      { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  let body: { mode?: string; pages?: number; timeMs?: number; currentYear?: number; maxJobs?: number; resync?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const mode = body.mode === 'delta' ? 'delta' : 'full';
  const budget: RunBudget = {
    pages: Math.max(1, Math.min(Number(body.pages) || DEFAULT_PAGE_BUDGET, 2000)),
    timeMs: Math.max(1_000, Math.min(Number(body.timeMs) || DEFAULT_TIME_BUDGET_MS, MAX_TIME_BUDGET_MS)),
  };
  const currentYear = Number(body.currentYear) || new Date().getFullYear();
  // Límite opcional de trabajos por run (debug/avanzado gradual; por defecto sin tope).
  const maxJobs = Number.isFinite(Number(body.maxJobs)) && Number(body.maxJobs) > 0 ? Math.floor(Number(body.maxJobs)) : Infinity;
  // resync=false → saltar lo ya terminado (solo avanza lo pendiente, para la
  // bomba del workflow). Por defecto (true) se re-sincroniza todo desde la
  // página 1 para capturar novedades y cambios de disponibilidad.
  const resync = body.resync !== false;

  const jobs = planJobs(ES_PROVIDERS, mode, currentYear);
  const startedAt = Date.now();
  const results: JobResult[] = [];
  let stopped = false;
  for (let i = 0; i < jobs.length; i++) {
    if (stopped || i >= maxJobs) break;
    const job = jobs[i];
    const r = await syncJob(job, budget, startedAt, resync);
    results.push(r);
    if (Date.now() - startedAt > budget.timeMs) stopped = true;
  }
  return new Response(JSON.stringify({ mode, processed: results.length, stopped, results }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
