// Edge Function `catalog-backfill` (Deno) — VERTICE-PLAN-2, mantenimiento de
// catálogo (2026-10-11).
//
// Rellena las filas de `catalog_titles` que quedaron con `title` vacío: TMDB
// `discover` devuelve de vez en cuando «stubs» (id + poster + popularity, sin
// title/release_date) y una pasada de la sync antigua los escribió vacíos
// (6.121 filas, ~30% de la base). Por cada fila vacía llama al DETALLE de
// TMDB (`/movie/{id}` o `/tv/{id}` en es-ES) y hace upsert de title,
// original_title, year y overview — sin tocar plataformas (las gestiona la
// sync con su merge).
//
// REANUDABLE: cada llamada procesa un presupuesto (títulos y tiempo < 150 s,
// el wall-clock del plan gratuito) y devuelve `remaining`; el workflow
// `catalog-backfill.yml` actúa de BOMBA: repite mientras `remaining > 0`.
//
// Protegida igual que catalog-sync: exige `x-catalog-sync-secret` igual al
// secreto CATALOG_SYNC_SECRET (no ejecutable por un usuario normal).
import { createClient } from 'npm:@supabase/supabase-js@2';

const TMDB = 'https://api.themoviedb.org/3';
const LANG = 'es-ES';
const REQUEST_INTERVAL_MS = 350; // rate-limit de TMDB (60/min)
const MAX_RETRIES = 2;
const PAGE = 100; // filas por lote de lectura
const DEFAULT_TITLES = 60; // títulos de detalle por llamada (~2 min)
const DEFAULT_BUDGET_MS = 2 * 60 * 1000; // < 150 s de wall-clock
const MAX_BUDGET_MS = 140 * 1000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-catalog-sync-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// deno-lint-ignore no-explicit-any
type AnyRecord = Record<string, any>;
let fetchImpl: typeof fetch = globalThis.fetch;
export function _setFetchForTest(f: unknown): void {
  fetchImpl = f as typeof fetch;
}

// Cliente admin a propósito SIN tipos de tabla (misma razón que catalog-sync):
// se despliega con esbuild (sin typecheck) y un genérico Database sin definir
// haría que el editor marque `upsert` con comprobaciones de literal falsas.
// deno-lint-ignore no-explicit-any
let adminClient: any = null;
export function _setSupabaseForTest(c: unknown): void {
  adminClient = c;
}
function getAdmin() {
  if (!adminClient) adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  return adminClient;
}

/** Detalle de un título en es-ES. `null` si ya no existe en TMDB (404). */
async function tmdbDetail(mediaType: 'movie' | 'tv', id: number): Promise<AnyRecord | null> {
  const path = mediaType === 'tv' ? `/tv/${id}` : `/movie/${id}`;
  const url = new URL(TMDB + path);
  url.searchParams.set('language', LANG);
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${Deno.env.get('TMDB_READ_TOKEN')}`, accept: 'application/json' },
    });
    if (res.status === 404) return null;
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (!res.ok) throw new Error(`tmdb ${res.status} ${path}`);
    return (await res.json()) as AnyRecord;
  }
  throw new Error(`tmdb reintentos agotados ${path}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });
  const secret = req.headers.get('x-catalog-sync-secret') ?? '';
  const expected = Deno.env.get('CATALOG_SYNC_SECRET') ?? '';
  if (!expected || secret !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  let body: { count?: number; timeMs?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const maxTitles = Math.max(1, Math.min(Number(body.count) || DEFAULT_TITLES, 200));
  const budgetMs = Math.max(5000, Math.min(Number(body.timeMs) || DEFAULT_BUDGET_MS, MAX_BUDGET_MS));
  const admin = getAdmin();
  const startedAt = Date.now();
  let processed = 0;
  let fixed = 0;
  let missing = 0;
  for (;;) {
    if (processed >= maxTitles || Date.now() - startedAt > budgetMs) break;
    const { data, error } = (await admin
      .from('catalog_titles')
      .select('tmdb_id,media_type,title,original_title,year,overview')
      .eq('title', '')
      .order('tmdb_id', { ascending: true })
      .limit(PAGE)) as unknown as { data: AnyRecord[] | null; error: unknown };
    if (error) throw new Error(String(error));
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (processed >= maxTitles || Date.now() - startedAt > budgetMs) break;
      processed += 1;
      await sleep(REQUEST_INTERVAL_MS);
      let d: AnyRecord | null = null;
      try {
        d = await tmdbDetail(row.media_type, row.tmdb_id);
      } catch {
        // Infraestructura/TMDB: se deja la fila vacía; la siguiente bomba
        // la reintenta (sigue en el conjunto title='').
        continue;
      }
      if (!d) {
        missing += 1; // 404: no se puede rellener (título retirado de TMDB)
        continue;
      }
      const date = row.media_type === 'movie' ? d.release_date : d.first_air_date;
      const title = d.title ?? d.name ?? '';
      if (!title) {
        missing += 1; // el detalle tampoco trae título: nada que hacer
        continue;
      }
      const patch: AnyRecord = {
        tmdb_id: row.tmdb_id,
        media_type: row.media_type,
        title,
        // NO se sobreescriben los campos que ya tienen dato (defensa contra
        // una re-lectura con menos información).
        original_title: row.original_title || d.original_title || d.original_name || '',
        overview: row.overview || d.overview || '',
        updated_at: new Date().toISOString(),
      };
      if (!row.year && date) patch.year = Number(String(date).slice(0, 4));
      const { error: upErr } = await admin.from('catalog_titles').upsert(patch, { onConflict: 'media_type,tmdb_id' });
      if (upErr) throw new Error(String(upErr));
      fixed += 1;
    }
    if (data.length < PAGE) break;
  }
  const { count: remaining } = (await admin
    .from('catalog_titles')
    .select('tmdb_id', { count: 'exact', head: true })
    .eq('title', '')) as unknown as { count: number | null };
  return new Response(JSON.stringify({ processed, fixed, missing, remaining: remaining ?? 0 }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
