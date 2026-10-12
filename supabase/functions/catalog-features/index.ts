// Edge Function `catalog-features` (Deno) — VERTICE-PLAN-2, fase A (recomendador
// real). Genera las `catalog_features` (embedding gte-small de 384 dims) de los
// títulos que aún no las tienen.
//
// REANUDABLE y REANUDA SOLO: el candidate set es siempre el anti-join
// `catalog_titles` sin feature (RPC `features_candidates`, ordenado por
// popularity desc) — los títulos nuevos del delta diario entran solos, y si un
// título queda `error` la siguiente pasada lo reintenta. `catalog_features_state`
// es solo libro de estado (running/done/error + last_error).
//
// Estrategia de texto (decisión A.1 del plan, gte-small SOLO entiende inglés y
// trunca a 512 tokens):
//   (a) overview EN del detalle TMDB (`/movie/{id}?language=en-US`) → «Title. Overview»
//       truncado a 1600 chars;
//   (c) sin EN → bilingüe: títulos (EN/ES) + overview ES (1200 chars) + metadatos;
//   (b) sin sinopsis en ninguno de los dos → solo metadatos (título, año, idioma,
//       duración, géneros EN).
// NO se llaman /keywords ni /credits: las columnas keywords/director/cast_names
// de la 0007 no las usa ningún RPC (el score es 0.7·cos(embedding) + 0.3·géneros).
//
// Presuesto: 120 s y 40 títulos por defecto (el wall-clock del plan gratuito es
// ~150 s). Ritmo: 250 ms entre llamadas TMDB (el token se comparte con
// catalog-sync y el proxy tmdb: 60/min).
//
// Protegida igual que catalog-sync: cabecera `x-catalog-sync-secret` igual a
// CATALOG_SYNC_SECRET **o** CATALOG_FEATURES_SECRET (así el workflow de GitHub
// reutiliza el secreto de sync sin crear uno nuevo, y el bombeo local puede
// usar su propio secreto).
import { createClient } from 'npm:@supabase/supabase-js@2';
// IMPORT: relativo porque Deno no resuelve el alias `@/` de la app (mismo patrón
// que catalog-sync con providers.ts).
import { genresEnOf } from '../../../src/constants/genresEn.ts';

const TMDB = 'https://api.themoviedb.org/3';
const REQUEST_INTERVAL_MS = 250; // rate-limit del token compartido con la sync
const MAX_RETRIES = 2;
const DEFAULT_TITLES = 40;
const MAX_TITLES = 200;
const DEFAULT_BUDGET_MS = 2 * 60 * 1000;
const MAX_BUDGET_MS = 140 * 1000;
const OVERVIEW_LIMIT = 1600; // ~< 512 tokens EN
const RETRY_OVERVIEW_LIMIT = 1000;
const CANDIDATE_PAGE = 100;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-catalog-sync-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------------------------------------------------------------------
// Inyección para tests (mismo patrón que catalog-backfill/catalog-sync)
// ---------------------------------------------------------------------------
// deno-lint-ignore no-explicit-any
type AnyRecord = Record<string, any>;
let fetchImpl: typeof fetch = globalThis.fetch;
export function _setFetchForTest(f: unknown): void {
  fetchImpl = f as typeof fetch;
}
let sleepImpl = (ms: number) => new Promise((r) => setTimeout(r, ms));
export function _setSleepForTest(f: unknown): void {
  sleepImpl = f as typeof sleepImpl;
}
// deno-lint-ignore no-explicit-any
let adminClient: any = null;
export function _setSupabaseForTest(c: unknown): void {
  adminClient = c;
}
type EmbedFn = (text: string) => Promise<number[]>;
let embedImpl: EmbedFn | null = null;
export function _setEmbedForTest(f: unknown): void {
  embedImpl = f as EmbedFn | null;
}
function getAdmin() {
  if (!adminClient) adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  return adminClient;
}

// ---------------------------------------------------------------------------
// Estrategia de texto para el embedding (decisión A.1) — pura, testeada
// ---------------------------------------------------------------------------
export interface FeatureSource {
  /** Título ES del catálogo. */
  title: string;
  originalTitle: string;
  /** Sinopsis ES ya guardada en catalog_titles (la sync la trajo de es-ES). */
  overviewEs: string;
  year: number | null;
  language: string;
  runtime: number | null;
  genreIds: number[];
  /** Detalle TMDB en en-US (nulo si 404 o fallo → la función lo trata aparte). */
  en: { title: string; overview: string } | null;
}

export function buildEmbedText(s: FeatureSource): string {
  const genres = genresEnOf(s.genreIds).join(', ');
  const meta: string[] = [`Year ${s.year ?? '?'}`, `Language: ${s.language || 'unknown'}`];
  if (s.runtime && s.runtime > 0) meta.push(`Runtime: ${s.runtime} min`);
  if (genres) meta.push(`Genres: ${genres}`);

  const enTitle = (s.en?.title ?? '').trim();
  const enOverview = (s.en?.overview ?? '').trim();
  if (enOverview) {
    // (a) La mejor señal para un modelo solo en inglés: la sinopsis EN.
    return `${enTitle || s.title}. ${enOverview}`.slice(0, OVERVIEW_LIMIT);
  }
  const other = s.originalTitle.trim();
  const base =
    other && other.toLowerCase() !== (s.title || '').toLowerCase()
      ? `${other}. ${s.title}`.trim()
      : (s.title || other || 'Untitled');
  if (s.overviewEs.trim()) {
    // (c) Bilingüe: títulos EN/ES + sinopsis ES (peor que la EN, mejor que nada).
    // Sin el punto final de la sinopsis (la mayoría llevan «.»): no queda «..».
    const ovEs = s.overviewEs.trim().replace(/\.\s*$/, '').slice(0, 1200);
    return `${base}. ${ovEs}. ${meta.join('. ')}`;
  }
  // (b) Sin sinopsis en ningún idioma: solo metadatos.
  return `${base}. ${meta.join('. ')}`;
}

// ---------------------------------------------------------------------------
// TMDB (detalle en en-US, 1 llamada/título)
// ---------------------------------------------------------------------------
async function tmdbDetailEn(
  mediaType: 'movie' | 'tv',
  id: number,
): Promise<{ title: string; overview: string } | null> {
  const path = mediaType === 'tv' ? `/tv/${id}` : `/movie/${id}`;
  const url = new URL(TMDB + path);
  url.searchParams.set('language', 'en-US');
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${Deno.env.get('TMDB_READ_TOKEN')}`, accept: 'application/json' },
    });
    if (res.status === 404) return null;
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleepImpl(1000 * 2 ** attempt);
      continue;
    }
    if (!res.ok) throw new Error(`tmdb ${res.status} ${path}`);
    const d = (await res.json()) as AnyRecord;
    return { title: d.title ?? d.name ?? '', overview: d.overview ?? '' };
  }
  throw new Error(`tmdb reintentos agotados ${path}`);
}

// ---------------------------------------------------------------------------
// Embedding gte-small (Supabase.ai integrado del runtime, 384 dims)
// ---------------------------------------------------------------------------
// deno-lint-ignore no-explicit-any
let aiSession: any = null;
interface AiSession {
  run(text: string, opts: { mean_pool: boolean; normalize: boolean }): Promise<unknown>;
}
/** El runtime de Supabase expone `Supabase.ai` como global del edge. */
function aiGlobal(): { ai: { Session: new (model: string) => AiSession } } {
  // deno-lint-ignore no-explicit-any
  return (globalThis as any).Supabase;
}
async function embedReal(text: string): Promise<number[]> {
  if (!aiSession) aiSession = new (aiGlobal().ai.Session)('gte-small');
  const out = await aiSession.run(text, { mean_pool: true, normalize: true });
  const v: unknown = Array.isArray(out) ? out : (out as { data?: unknown[] })?.data;
  if (!Array.isArray(v) || v.length === 0) throw new Error('respuesta de embedding no válida');
  return v as number[];
}
async function embed(text: string): Promise<number[]> {
  if (embedImpl) return embedImpl(text);
  try {
    return await embedReal(text);
  } catch (e) {
    // Defensa barata (decisión A.1): si el texto supera lo que el modelo acepta,
    // recortar a 1000 chars y reintentar una vez.
    if (text.length > RETRY_OVERVIEW_LIMIT) {
      try {
        return await embedReal(text.slice(0, RETRY_OVERVIEW_LIMIT));
      } catch {
        throw e;
      }
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
function validSecret(header: string | null): boolean {
  if (!header) return false;
  const a = Deno.env.get('CATALOG_SYNC_SECRET') ?? '';
  const b = Deno.env.get('CATALOG_FEATURES_SECRET') ?? '';
  return (a !== '' && header === a) || (b !== '' && header === b);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });
  if (!validSecret(req.headers.get('x-catalog-sync-secret'))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  let body: { maxTitles?: number; timeMs?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const maxTitles = Math.max(1, Math.min(Number(body.maxTitles) || DEFAULT_TITLES, MAX_TITLES));
  const budgetMs = Math.max(5000, Math.min(Number(body.timeMs) || DEFAULT_BUDGET_MS, MAX_BUDGET_MS));
  const startedAt = Date.now();
  const admin = getAdmin();
  const stateUpsert = (
    tmdbId: number,
    mediaType: 'movie' | 'tv' | 'short' | 'documentary',
    status: 'running' | 'done' | 'error',
    lastError: string | null,
  ) =>
    (admin
      .from('catalog_features_state')
      .upsert(
        {
          tmdb_id: tmdbId,
          media_type: mediaType,
          status,
          last_error: lastError,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'media_type,tmdb_id' },
      ) as Promise<{ error: unknown }>);

  let processed = 0;
  let embedded = 0;
  let fallback = 0;
  let errors = 0;

  for (;;) {
    if (processed >= maxTitles || Date.now() - startedAt > budgetMs) break;
    const { data, error } = (await admin.rpc('features_candidates', {
      p_limit: Math.min(CANDIDATE_PAGE, maxTitles - processed),
    })) as unknown as { data: AnyRecord[] | null; error: unknown };
    if (error) throw new Error(String(error));
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (processed >= maxTitles || Date.now() - startedAt > budgetMs) break;
      processed += 1;
      await sleepImpl(REQUEST_INTERVAL_MS);
      let en: { title: string; overview: string } | null = null;
      try {
        en = await tmdbDetailEn(row.media_type, row.tmdb_id);
      } catch {
        // Fallo de TMDB/infraestructura: se deja pendiente (sigue en el
        // anti-join) y la siguiente pasada lo reintenta.
        errors += 1;
        await stateUpsert(row.tmdb_id, row.media_type, 'error', 'tmdb-detail');
        continue;
      }
      const text = buildEmbedText({
        title: row.title,
        originalTitle: row.original_title ?? '',
        overviewEs: row.overview ?? '',
        year: row.year ?? null,
        language: row.original_language ?? '',
        runtime: row.runtime ?? null,
        genreIds: row.genre_ids ?? [],
        en,
      });
      if (!en || !en.overview) fallback += 1;
      let vector: number[] | null = null;
      try {
        vector = await embed(text);
      } catch {
        errors += 1;
        await stateUpsert(row.tmdb_id, row.media_type, 'error', 'embedding');
        continue;
      }
      if (!vector) {
        errors += 1;
        await stateUpsert(row.tmdb_id, row.media_type, 'error', 'embedding-null');
        continue;
      }
      const { error: upErr } = (await admin
        .from('catalog_features')
        .upsert(
          {
            tmdb_id: row.tmdb_id,
            media_type: row.media_type,
            keywords: [],
            director: '',
            cast_names: [],
            embedding: vector,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'media_type,tmdb_id' },
        )) as { error: unknown };
      if (upErr) throw new Error(String(upErr));
      embedded += 1;
      await stateUpsert(row.tmdb_id, row.media_type, 'done', null);
    }
    if (data.length < CANDIDATE_PAGE) break;
  }

  const { data: remaining } = (await admin.rpc('features_remaining')) as unknown as {
    data: number | null;
  };
  return new Response(
    JSON.stringify({ processed, embedded, fallback, errors, remaining: remaining ?? 0 }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
