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
  let body: { count?: number; timeMs?: number; cleanup?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const admin = getAdmin();

  // LIMPIEZA UNICA (2026-10-11): el primer full completo (run #7) corrió con
  // los ids TMDB ERRÓNEOS del PROVIDER_MAP antiguo: prime-video(9), max(384),
  // apple-tv(531), filmin(275), mubi(387), rtve-play(179) y pluto-tv(362)
  // devolvían 0 resultados en discover (quedaron marcados done con total=0 y
  // con resync=false NUNCA se re-ejecutarían), y rakuten-tv(350) devolvía en
  // realidad el catálogo de Apple TV+ (contenido etiquetado como rakuten-tv).
  // Con los ids correctos verificados en vivo (2026-10-11) esas plataformas
  // sí tienen contenido (thousands of titles). La limpieza: (a) borra el
  // estado de sync de esas plataformas — el próximo `full` resync=false
  // (cron del domingo) las re-ejecuta desde la página 1 con los ids correctos;
  // (b) retira la etiqueta 'rakuten-tv' de todas las filas — cuando los jobs
  // de rakuten-tv (id 35, el real) se re-ejecuten, re-etiquetarán las filas
  // correctas; las falsas (que en realidad son Apple TV+) pierden el label.
  if (body.cleanup) {
    const BAD_PROVIDERS = ['prime-video', 'max', 'apple-tv', 'filmin', 'mubi', 'rtve-play', 'pluto-tv', 'rakuten-tv'];
    const FAKE_LABEL = 'rakuten-tv';
    const { data: st, error: stErr } = (await admin
      .from('catalog_sync_state')
      .select('provider')
      .in('provider', BAD_PROVIDERS)) as unknown as { data: AnyRecord[] | null; error: unknown };
    if (stErr) throw new Error(String(stErr));
    const stateDeleted = st?.length ?? 0;
    const { error: delErr } = await admin.from('catalog_sync_state').delete().in('provider', BAD_PROVIDERS);
    if (delErr) throw new Error(String(delErr));
    let rowsUnlabeled = 0;
    for (;;) {
      const { data: rows, error: selErr } = (await admin
        .from('catalog_titles')
        .select('tmdb_id,media_type,platforms_flatrate,platforms_rent,platforms_buy')
        .or(`platforms_flatrate.cs.{${FAKE_LABEL}},platforms_rent.cs.{${FAKE_LABEL}},platforms_buy.cs.{${FAKE_LABEL}}`)
        .limit(100)) as unknown as { data: AnyRecord[] | null; error: unknown };
      if (selErr) throw new Error(String(selErr));
      if (!rows || rows.length === 0) break;
      for (const row of rows) {
        const strip = (a: string[] | null | undefined) => (a ?? []).filter((x) => x !== FAKE_LABEL);
        const { error: upErr } = await admin
          .from('catalog_titles')
          .update({
            platforms_flatrate: strip(row.platforms_flatrate),
            platforms_rent: strip(row.platforms_rent),
            platforms_buy: strip(row.platforms_buy),
            updated_at: new Date().toISOString(),
          })
          .eq('tmdb_id', row.tmdb_id)
          .eq('media_type', row.media_type);
        if (upErr) throw new Error(String(upErr));
        rowsUnlabeled += 1;
      }
      if (rows.length < 100) break;
    }
    return new Response(JSON.stringify({ cleanup: true, stateDeleted, rowsUnlabeled }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const maxTitles = Math.max(1, Math.min(Number(body.count) || DEFAULT_TITLES, 200));
  const budgetMs = Math.max(5000, Math.min(Number(body.timeMs) || DEFAULT_BUDGET_MS, MAX_BUDGET_MS));
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
