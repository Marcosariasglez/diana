// Edge Function `tmdb` (Deno). Proxy de TMDB con la clave oculta, cache en tmdb_cache y limite por usuario.
// Entrada: POST JSON { action, ... }. Acciones: 'pool' | 'media' | 'season' | 'search' | 'match' | 'providers'.
// Salida: JSON ya normalizado al formato de Diana (src/types/media.ts). Secretos: TMDB_READ_TOKEN.
import { createClient } from 'npm:@supabase/supabase-js@2';

const TMDB = 'https://api.themoviedb.org/3';
const REGION = 'ES';
const LANG = 'es-ES';
const HOUR = 3600 * 1000;
const MAX_HITS_PER_MINUTE = 60;
const MAX_SEASONS = 12;

// provider_id de TMDB -> id de Diana (VERTICE-PLAN-2 D2-1.1).
// UNICAMENTE se deriva de src/constants/providers.ts (único origen de verdad,
// compartido por la app y la función). Los ids `tmdbProviderId: null` (pendientes
// de verificación) NO entran aquí hasta que el dueño confirme el id con la acción
// `providers` (scripts/verify-catalog.mjs lo hace si existe TMDB_READ_TOKEN).
// IMPORT: relativo porque Deno no resuelve el alias `@/` de la app.
import { PROVIDER_BY_TMDB_ID, PROVIDER_FILTER as PROVIDER_FILTER_ES } from '../../../src/constants/providers.ts';

// Sin aliases: desde la verificación en vivo (2026-10-10) los ids de
// providers.ts son los CANÓNICOS de TMDB (Prime Video=119, HBO Max=1899…),
// así que PROVIDER_BY_TMDB_ID ya los mapea directamente.
const PROVIDER_MAP: Record<number, string> = Object.fromEntries(PROVIDER_BY_TMDB_ID.entries());
// Filtro `with_watch_providers`: solo proveedores ACTIVOS EN ESPAÑA (no los
// desactualizados que se conservan solo para no romper datos guardados).
const PROVIDER_FILTER = PROVIDER_FILTER_ES;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function tmdb(path: string, params: Record<string, string | number> = {}) {
  const url = new URL(TMDB + path);
  url.searchParams.set('language', LANG);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${Deno.env.get('TMDB_READ_TOKEN')}`, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`tmdb ${res.status} ${path}`);
  return await res.json();
}

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const { data } = await admin.from('tmdb_cache').select('payload, fetched_at').eq('cache_key', key).maybeSingle();
  if (data && Date.now() - new Date(data.fetched_at).getTime() < ttlMs) return data.payload as T;
  const payload = await load();
  await admin.from('tmdb_cache').upsert({ cache_key: key, payload, fetched_at: new Date().toISOString() });
  return payload;
}

// deno-lint-ignore no-explicit-any
type Any = any;

function platformsOf(d: Any): string[] {
  const flat: Any[] = d?.['watch/providers']?.results?.[REGION]?.flatrate ?? [];
  const ids = new Set<string>();
  for (const p of flat) if (PROVIDER_MAP[p.provider_id]) ids.add(PROVIDER_MAP[p.provider_id]);
  return [...ids];
}

function base(d: Any) {
  return {
    id: d.id as number,
    poster_path: (d.poster_path ?? null) as string | null,
    backdrop_path: (d.backdrop_path ?? null) as string | null,
    genres: ((d.genres ?? []) as Any[]).map((g) => ({ id: g.id, name: g.name })),
    overview: (d.overview ?? '') as string,
    vote_average: (d.vote_average ?? 0) as number,
    vote_count: (d.vote_count ?? 0) as number,
    popularity: (d.popularity ?? 0) as number,
    platforms: platformsOf(d),
  };
}

function normalizeMovie(d: Any) {
  const alt = [d.original_title].filter((t: string | undefined) => t && t !== d.title);
  return {
    ...base(d),
    media_type: 'movie' as const,
    title: d.title as string,
    release_date: (d.release_date ?? '') as string,
    runtime: (d.runtime ?? 0) as number,
    alt_titles: alt as string[],
  };
}

function normalizeTv(d: Any, seasons: Any[] = []) {
  const alt = [d.original_name].filter((t: string | undefined) => t && t !== d.name);
  return {
    ...base(d),
    media_type: 'tv' as const,
    name: d.name as string,
    first_air_date: (d.first_air_date ?? '') as string,
    episode_run_time: (d.episode_run_time ?? []) as number[],
    seasons,
    alt_titles: alt as string[],
  };
}

function normalizeSeason(s: Any) {
  return {
    season_number: s.season_number as number,
    episode_count: ((s.episodes ?? []) as Any[]).length || (s.episode_count as number) || 0,
    episodes: ((s.episodes ?? []) as Any[]).map((e) => ({
      episode_number: e.episode_number as number,
      name: (e.name ?? '') as string,
      runtime: (e.runtime ?? 0) as number,
      still_path: (e.still_path ?? null) as string | null,
    })),
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R | null>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) {
        const item = items[i++];
        try {
          const r = await fn(item);
          if (r) out.push(r);
        } catch (_) {
          // un titulo que falla no rompe el pool
        }
      }
    }),
  );
  return out;
}

async function fetchMedia(type: 'movie' | 'tv', id: number, withEpisodes: boolean) {
  const d = await tmdb(`/${type}/${id}`, { append_to_response: 'watch/providers', watch_region: REGION });
  if (type === 'movie') return normalizeMovie(d);
  let seasons: Any[] = [];
  if (withEpisodes) {
    const nums = ((d.seasons ?? []) as Any[])
      .map((s) => s.season_number as number)
      .filter((n) => n >= 1)
      .slice(0, MAX_SEASONS);
    seasons = (await mapLimit(nums, 4, async (n) => normalizeSeason(await tmdb(`/tv/${id}/season/${n}`)))).sort(
      (a, b) => a.season_number - b.season_number,
    );
  } else {
    seasons = ((d.seasons ?? []) as Any[])
      .filter((s) => s.season_number >= 1)
      .map((s) => ({ season_number: s.season_number, episode_count: s.episode_count ?? 0, episodes: [] }));
  }
  return normalizeTv(d, seasons);
}

// Pool de candidatos para feed, mood, mazo de onboarding y mazo de grupo (~300+ títulos de todas las plataformas en ES).
async function buildPool() {
  const common = {
    watch_region: REGION,
    with_watch_providers: PROVIDER_FILTER,
    with_watch_monetization_types: 'flatrate',
  };
  const jobs: Array<{ type: 'movie' | 'tv'; params: Record<string, string | number> }> = [];

  // Películas populares (más páginas para mayor cobertura)
  for (const page of [1, 2, 3, 4, 5]) {
    jobs.push({ type: 'movie', params: { ...common, sort_by: 'popularity.desc', 'vote_count.gte': 100, page } });
  }
  // Películas mejor valoradas
  for (const page of [1, 2, 3]) {
    jobs.push({
      type: 'movie',
      params: { ...common, sort_by: 'vote_average.desc', 'vote_count.gte': 100, 'vote_average.gte': 6.5, page },
    });
  }
  // Películas recientes (últimos 2 años)
  for (const page of [1, 2]) {
    jobs.push({ type: 'movie', params: { ...common, sort_by: 'primary_release_date.desc', 'vote_count.gte': 50, 'primary_release_date.gte': '2024-01-01', page } });
  }
  // Películas por género
  for (const genreId of [28, 35, 80, 18, 53, 10749, 16, 10752, 99, 14, 10402]) {
    jobs.push({ type: 'movie', params: { ...common, sort_by: 'popularity.desc', 'with_genres': genreId, 'vote_count.gte': 50, page: 1 } });
  }

  // Series populares
  for (const page of [1, 2, 3, 4]) {
    jobs.push({ type: 'tv', params: { ...common, sort_by: 'popularity.desc', 'vote_count.gte': 100, page } });
  }
  // Series mejor valoradas
  for (const page of [1, 2]) {
    jobs.push({
      type: 'tv',
      params: { ...common, sort_by: 'vote_average.desc', 'vote_count.gte': 100, 'vote_average.gte': 7, page },
    });
  }
  // Series recientes
  for (const page of [1, 2]) {
    jobs.push({ type: 'tv', params: { ...common, sort_by: 'first_air_date.desc', 'vote_count.gte': 50, 'first_air_date.gte': '2024-01-01', page } });
  }
  // Series por género
  for (const genreId of [10759, 16, 35, 80, 18, 9648, 10765, 10767, 10768, 10762, 10770]) {
    jobs.push({ type: 'tv', params: { ...common, sort_by: 'popularity.desc', 'with_genres': genreId, 'vote_count.gte': 50, page: 1 } });
  }

  const pages = await mapLimit(jobs, 8, async (j) => ({ type: j.type, res: await tmdb(`/discover/${j.type}`, j.params) }));
  const seen = new Set<string>();
  const ids: Array<{ type: 'movie' | 'tv'; id: number }> = [];
  for (const p of pages) {
    for (const r of (p.res.results ?? []) as Any[]) {
      const k = `${p.type}:${r.id}`;
      if (!seen.has(k)) {
        seen.add(k);
        ids.push({ type: p.type, id: r.id });
      }
    }
  }
  const media = await mapLimit(ids, 15, async (x) => fetchMedia(x.type, x.id, false));
  return media.filter((m) => m.platforms.length > 0 && m.genres.length > 0);
}

const EPISODE_PATTERN = /\b[ts]\s*(\d+)\s*[·\-.]?\s*e\s*(\d+)\b/i;

async function search(query: string, kind: string, page: number) {
  const match = query.match(EPISODE_PATTERN);
  const text = query.replace(EPISODE_PATTERN, '').trim() || query;
  const res = await tmdb('/search/multi', { query: text, page, include_adult: 'false' });
  const hits = ((res.results ?? []) as Any[]).filter((r) => r.media_type === 'movie' || r.media_type === 'tv');
  const results: Any[] = [];
  for (const r of hits) {
    if (r.media_type === 'movie' && (kind === 'all' || kind === 'movie')) {
      results.push({ kind: 'movie', label: 'Película', mediaId: r.id, mediaType: 'movie', title: r.title, poster_path: r.poster_path ?? null });
    }
    if (r.media_type === 'tv' && (kind === 'all' || kind === 'tv')) {
      results.push({ kind: 'tv', label: 'Serie', mediaId: r.id, mediaType: 'tv', title: r.name, poster_path: r.poster_path ?? null });
    }
  }
  if (kind === 'all' || kind === 'episode') {
    for (const r of hits.filter((h) => h.media_type === 'tv').slice(0, 2)) {
      const seasonNumber = match ? Number(match[1]) : 1;
      let season: Any = null;
      try {
        season = await tmdb(`/tv/${r.id}/season/${seasonNumber}`);
      } catch (_) {
        continue;
      }
      const wanted: number[] = match ? [Number(match[2])] : [1, 2];
      for (const n of wanted) {
        const ep = ((season.episodes ?? []) as Any[]).find((e) => e.episode_number === n);
        if (!ep) continue;
        results.push({
          kind: 'episode', label: 'Capítulo', mediaId: r.id, mediaType: 'tv',
          title: `${r.name} T${seasonNumber} · E${n}`, seriesTitle: r.name,
          seasonNumber, episodeNumber: n, poster_path: r.poster_path ?? null,
        });
      }
    }
  }
  return { results, hasMore: (res.page ?? 1) < (res.total_pages ?? 1) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: auth } = await admin.auth.getUser(jwt);
  if (!auth?.user) return json({ error: 'unauthorized' }, 401);
  const { data: hits } = await admin.rpc('bump_api_hits', { p_user: auth.user.id });
  if (typeof hits === 'number' && hits > MAX_HITS_PER_MINUTE) return json({ error: 'rate-limited' }, 429);

  let body: Any;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: 'bad-json' }, 400);
  }

  try {
    switch (body.action) {
      case 'pool':
        return json(await cached('pool:v1', 24 * HOUR, buildPool));
      case 'media': {
        const type = body.type === 'tv' ? 'tv' : body.type === 'movie' ? 'movie' : null;
        const id = Number(body.id);
        if (!type || !Number.isInteger(id) || id <= 0) return json({ error: 'bad-input' }, 400);
        return json(await cached(`media:${type}:${id}:v1`, 24 * HOUR, () => fetchMedia(type, id, true)));
      }
      case 'season': {
        const id = Number(body.id);
        const n = Number(body.season);
        if (!Number.isInteger(id) || !Number.isInteger(n) || id <= 0 || n < 1) return json({ error: 'bad-input' }, 400);
        return json(await cached(`season:${id}:${n}:v1`, 24 * HOUR, async () => normalizeSeason(await tmdb(`/tv/${id}/season/${n}`))));
      }
      case 'search': {
        const query = String(body.query ?? '').trim().slice(0, 100);
        const kind = ['all', 'movie', 'tv', 'episode'].includes(body.kind) ? body.kind : 'all';
        const page = Math.min(Math.max(Number(body.page ?? 1) || 1, 1), 5);
        if (query.length < 2) return json({ results: [], hasMore: false });
        return json(await cached(`search:${kind}:${page}:${query.toLowerCase()}:v1`, 6 * HOUR, () => search(query, kind, page)));
      }
      case 'match': {
        // Cruce de Letterboxd: [{ name, year }] (max 40) -> [{ i, id, title, genre_ids }] (id null si no hay coincidencia).
        const items = (Array.isArray(body.items) ? body.items : []).slice(0, 40) as Any[];
        const out = await mapLimit(items.map((it, i) => ({ it, i })), 5, async ({ it, i }) => {
          const name = String(it?.name ?? '').trim().slice(0, 150);
          const year = Number(it?.year) || 0;
          if (!name) return { i, id: null as number | null };
          const hit = await cached(`match:${name.toLowerCase()}:${year}:v1`, 30 * 24 * HOUR, async () => {
            for (const y of year ? [year, year - 1, year + 1] : [0]) {
              const params: Record<string, string | number> = { query: name, include_adult: 'false' };
              if (y) params.year = y;
              const res = await tmdb('/search/movie', params);
              const r = ((res.results ?? []) as Any[])[0];
              if (r) return { id: r.id as number, title: r.title as string, genre_ids: (r.genre_ids ?? []) as number[] };
            }
            return { id: null as number | null };
          });
          return { i, ...hit };
        });
        return json(out.sort((a, b) => a.i - b.i));
      }
      case 'providers': {
        const res = await tmdb('/watch/providers/movie', { watch_region: REGION });
        return json(((res.results ?? []) as Any[]).map((p) => ({ id: p.provider_id, name: p.provider_name, mapped: PROVIDER_MAP[p.provider_id] ?? null })));
      }
      default:
        return json({ error: 'unknown-action' }, 400);
    }
  } catch (e) {
    return json({ error: 'upstream', detail: String((e as Error).message ?? e) }, 502);
  }
});
