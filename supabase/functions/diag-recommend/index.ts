// Edge Function `diag-recommend` (Deno) — DIAGNÓSTICO TEMPORAL de la fase B
// (timeout de recommend vía PostgREST en producción). NO es parte del producto:
// se borra tras el diagnóstico (`npx supabase functions delete diag-recommend`)
// junto con las funciones `_diag_*` que crea aquí.
//
// POST { probe: 'postrpc', featured?: number, nofeat?: number }
//   1. Usuario GoTrue + JWT; M valoraciones con feature + N sin feature.
//   2. `_diag_gucs()` DEVUELVE los pg_settings del backend que lo ejecuta:
//      al llamarlo vía /rest/v1/rpc, la respuesta SÍ son los GUC del backend
//      de PostgREST (statement_timeout, work_mem, jit, plan_cache_mode…).
//      Antes se forcea `notify pgrst, 'reload schema'` + reintentos.
//   3. CTEs por separado vía PostgREST (mismo SQL que 0020) + recommend
//      completo vía PostgREST.
//   4. pg_stat_statements (si existe la extensión) → tiempo real del query
//      en el backend de PostgREST.
//   5. Camino DIRECTO pg (RLS real, timeout 0): EXPLAIN (ANALYZE, BUFFERS,
//      TIMINGS) completo.
//   6. Limpieza total (drops, delete_user_data, deleteUser).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Client } from 'npm:pg@8';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(URL_, SERVICE);

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DROP_EXTRA = `drop function if exists public._diag_bodyexplain();`;

const CREATE = `
create or replace function public._diag_gucs()
returns table (name text, setting text)
language sql stable security definer set search_path = public as $$
  select s.name, s.setting from pg_settings s
  where s.name in ('work_mem','statement_timeout','idle_in_transaction_session_timeout',
                   'search_path','jit','jit_above_cost','jit_inline_above_cost','jit_optimize_above_cost',
                   'enable_nestloop','enable_hashjoin','enable_material','enable_sort','enable_memoize',
                   'plan_cache_mode','max_parallel_workers_per_gather','shared_buffers','default_statistics_target')
$$;
create or replace function public._diag_taste()
returns boolean language sql stable security invoker set search_path = public, extensions
as $$ select public._user_taste_vector(auth.uid()) is not null $$;
create or replace function public._diag_seen()
returns int language sql stable security invoker set search_path = public, extensions
as $$ select count(*)::int from (
  select distinct media_type, media_id from (
    select media_type, media_id from public.history_entries where user_id = auth.uid()
    union all
    select split_part(key, ':', 1)::text, split_part(key, ':', 2)::int
    from public.watched where user_id = auth.uid()
  ) k
) s $$;
create or replace function public._diag_ann()
returns int language sql stable security invoker set search_path = public, extensions
as $$
with taste as (select public._user_taste_vector(auth.uid()) as v),
     platforms as (select case when coalesce(array_length('{netflix}'::text[], 1), 0) > 0 then '{netflix}'::text[] else null end as p),
     seen as materialized (
       select distinct media_type, media_id from (
         select media_type, media_id from public.history_entries where user_id = auth.uid()
         union all
         select split_part(key, ':', 1)::text, split_part(key, ':', 2)::int
         from public.watched where user_id = auth.uid()
       ) k
     )
select count(*)::int from (
  select c.tmdb_id
  from public.catalog_features f
  join public.catalog_titles c on c.tmdb_id = f.tmdb_id and c.media_type = f.media_type
  cross join platforms pl cross join taste tv
  where tv.v is not null and f.embedding is not null
    and c.title is not null and c.title <> ''
    and (pl.p is null or c.platforms_flatrate && pl.p)
    and not exists (select 1 from seen s where s.media_type = c.media_type and s.media_id = c.tmdb_id)
  order by f.embedding <-> tv.v
  limit 1000
) a $$;
create or replace function public._diag_nofeat()
returns int language sql stable security invoker set search_path = public, extensions
as $$
with taste as (select public._user_taste_vector(auth.uid()) as v),
     platforms as (select case when coalesce(array_length('{netflix}'::text[], 1), 0) > 0 then '{netflix}'::text[] else null end as p),
     seen as materialized (
       select distinct media_type, media_id from (
         select media_type, media_id from public.history_entries where user_id = auth.uid()
         union all
         select split_part(key, ':', 1)::text, split_part(key, ':', 2)::int
         from public.watched where user_id = auth.uid()
       ) k
     ),
     featured as materialized (select media_type, tmdb_id from public.catalog_features where embedding is not null)
select count(*)::int from (
  select c.tmdb_id
  from public.catalog_titles c
  cross join platforms pl cross join taste tv
  where tv.v is not null
    and c.title is not null and c.title <> ''
    and not exists (select 1 from featured ft where ft.media_type = c.media_type and ft.tmdb_id = c.tmdb_id)
    and (pl.p is null or c.platforms_flatrate && pl.p)
    and not exists (select 1 from seen s where s.media_type = c.media_type and s.media_id = c.tmdb_id)
  order by c.popularity desc, c.media_type asc, c.tmdb_id asc
  limit 2000
) a $$;
create or replace function public._diag_cold()
returns int language sql stable security invoker set search_path = public, extensions
as $$
with taste as (select public._user_taste_vector(auth.uid()) as v),
     platforms as (select case when coalesce(array_length('{netflix}'::text[], 1), 0) > 0 then '{netflix}'::text[] else null end as p),
     seen as materialized (
       select distinct media_type, media_id from (
         select media_type, media_id from public.history_entries where user_id = auth.uid()
         union all
         select split_part(key, ':', 1)::text, split_part(key, ':', 2)::int
         from public.watched where user_id = auth.uid()
       ) k
     )
select count(*)::int from (
  select c.tmdb_id
  from public.catalog_titles c
  cross join platforms pl cross join taste tv
  left join public.catalog_features f on f.tmdb_id = c.tmdb_id and f.media_type = c.media_type
  where tv.v is null
    and c.title is not null and c.title <> ''
    and (pl.p is null or c.platforms_flatrate && pl.p)
    and not exists (select 1 from seen s where s.media_type = c.media_type and s.media_id = c.tmdb_id)
  order by c.popularity desc, c.media_type asc, c.tmdb_id asc
  limit 1000
) a $$;
grant execute on function public._diag_gucs() to authenticated;
grant execute on function public._diag_taste() to authenticated;
grant execute on function public._diag_seen() to authenticated;
grant execute on function public._diag_ann() to authenticated;
grant execute on function public._diag_nofeat() to authenticated;
grant execute on function public._diag_cold() to authenticated;
`;

const DROP = `
drop function if exists public._diag_gucs();
drop function if exists public._diag_taste();
drop function if exists public._diag_seen();
drop function if exists public._diag_ann();
drop function if exists public._diag_nofeat();
drop function if exists public._diag_cold();
`;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'post-only' });
  const secret = req.headers.get('x-catalog-sync-secret');
  const ok = secret && (secret === Deno.env.get('CATALOG_FEATURES_SECRET') || secret === Deno.env.get('CATALOG_SYNC_SECRET'));
  if (!ok) return json({ error: 'unauthorized' });
  const body = (await req.json().catch(() => ({}))) as {
    featured?: number;
    nofeat?: number;
    extra_sql?: string;
    extra_rest?: string[];
  };
  const M = Math.max(0, Math.min(400, Number(body.featured) || 50));
  const N = Math.max(0, Math.min(800, Number(body.nofeat) || 0));

  const pg = new Client({ connectionString: Deno.env.get('SUPABASE_DB_URL')! });
  await pg.connect();
  let uid = '';
  try {
    await pg.query(`set statement_timeout = '0'`);

    // 1 · Usuario + valoraciones.
    const email = `diana-pgd-${Date.now().toString(36)}@ejemplo.com`;
    const password = `Tmp-${Date.now()}-pD7!`;
    const cu = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (cu.error || !cu.data?.user) return json({ error: `createUser: ${cu.error?.message}` });
    uid = cu.data.user.id;
    const si = await admin.auth.signInWithPassword({ email, password });
    if (si.error || !si.data?.session?.access_token) return json({ error: `signIn: ${si.error?.message}` });
    const jwt = si.data.session.access_token;

    const ft = await pg.query(
      `select f.tmdb_id, f.media_type, c.title, c.genre_ids
         from public.catalog_features f
         join public.catalog_titles c on c.tmdb_id = f.tmdb_id and c.media_type = f.media_type
        where f.embedding is not null and c.title is not null and c.title <> ''
        order by f.tmdb_id limit $1`, [M],
    );
    const nf = await pg.query(
      `select c.tmdb_id, c.media_type, c.title, c.genre_ids
         from public.catalog_titles c
        where c.title is not null and c.title <> ''
          and not exists (select 1 from public.catalog_features f
                          where f.tmdb_id = c.tmdb_id and f.media_type = c.media_type)
        order by c.popularity desc, c.tmdb_id limit $1`, [N],
    );
    const all = [
      ...(ft.rows as { tmdb_id: number; media_type: string; title: string; genre_ids: number[] }[]),
      ...(nf.rows as { tmdb_id: number; media_type: string; title: string; genre_ids: number[] }[]),
    ].map((r, i) => [uid, `${r.media_type}:${r.tmdb_id}`, r.media_type, r.tmdb_id, r.title, r.genre_ids, i % 2 ? 4.5 : 4, 40]);
    for (const r of all) {
      await pg.query(
        `insert into public.history_entries
           (user_id, key, media_type, media_id, title, genre_ids, user_rating, ai_prediction_tenths, source)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'letterboxd')
         on conflict (user_id, key) do nothing`, r,
      );
    }
    const nR = await pg.query(`select count(*)::int as n from public.history_entries where user_id = $1`, [uid]);

    // 2 · Temporales + reload de PostgREST.
    await pg.query(CREATE);
    if (body.extra_sql) await pg.query(body.extra_sql);
    await pg.query(`notify pgrst, 'reload schema'`);

    const callRest = async (fn: string, args: Record<string, unknown> | null = null) => {
      const t = Date.now();
      try {
        const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
          method: 'POST',
          headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
          body: args ? JSON.stringify(args) : undefined,
        });
        const text = await res.text().catch(() => '');
        return { ms: Date.now() - t, status: res.status, ok: res.ok, val: text.slice(0, 4000) };
      } catch (e) {
        return { ms: Date.now() - t, status: null, ok: false, val: String(e).slice(0, 400) };
      }
    };

    // 3 · GUCs del backend de PostgREST (el RPC SÍ corre en ese backend).
    let gucsPgrst: { name: string; setting: string }[] = [];
    let gucsErr: string | null = null;
    for (const waitMs of [4_000, 20_000, 20_000]) {
      await sleep(waitMs);
      const g = await callRest('_diag_gucs');
      if (g.ok) {
        try { gucsPgrst = JSON.parse(g.val) as { name: string; setting: string }[]; } catch { gucsErr = `parse: ${g.val.slice(0, 200)}`; }
        break;
      }
      gucsErr = `HTTP ${g.status}: ${g.val.slice(0, 200)}`;
    }

    // 4 · CTEs por separado vía PostgREST (+ extra_rest, p.ej. _diag_bodyexplain).
    const parts: Record<string, unknown> = {};
    if (gucsPgrst.length > 0) {
      for (const fn of ['_diag_taste', '_diag_seen', '_diag_ann', '_diag_nofeat', '_diag_cold', ...(body.extra_rest ?? [])]) {
        parts[fn] = await callRest(fn);
      }
    }

    // 5a · recommend completo vía PostgREST.
    let p1: Record<string, unknown>;
    {
      const t0 = Date.now();
      try {
        const res = await fetch(`${URL_}/rest/v1/rpc/recommend`, {
          method: 'POST',
          headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ p_platforms: ['netflix'], p_limit: 50, p_offset: 0 }),
        });
        const text = await res.text().catch(() => '');
        let parsed: unknown = null;
        try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 300); }
        p1 = { ms: Date.now() - t0, status: res.status, ok: res.ok,
          error: res.ok ? null : (parsed as { message?: string })?.message ?? String(parsed).slice(0, 200),
          rows: Array.isArray(parsed) ? (parsed as unknown[]).length : null };
      } catch (e) {
        p1 = { ms: Date.now() - t0, status: null, ok: false, error: String(e).slice(0, 200), rows: null };
      }
    }

    // 5b · pg_stat_statements (tiempo real en el backend PostgREST).
    let pgs: Record<string, unknown> = {};
    try {
      const has = await pg.query(`select exists (select 1 from pg_extension where extname = 'pg_stat_statements') as e`);
      if ((has.rows[0] as { e: boolean }).e) {
        const s = await pg.query(
          `select calls, rows, round(total_exec_time::numeric, 1) as total_ms, round(mean_exec_time::numeric, 1) as mean_ms
             from pg_stat_statements
            where query ilike '%public.recommend%'
            order by total_exec_time desc limit 5`,
        );
        pgs = { rows: s.rows as unknown };
      } else {
        pgs = { note: 'pg_stat_statements no instalada' };
      }
    } catch (e) {
      pgs = { error: String(e).slice(0, 200) };
    }

    // 5c · Camino DIRECTO pg (RLS real, timeout 0) + EXPLAIN con timings.
    let direct: Record<string, unknown> = {};
    try {
      await pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
      await pg.query(`set role authenticated`);
      const t1 = Date.now();
      try {
        const w = await pg.query(`select count(*)::int as n from public.recommend('{netflix}'::text[], 50, 0, null)`);
        direct = { ms: Date.now() - t1, rows: w.rows[0]?.n ?? null, error: null };
      } catch (e) {
        direct = { ms: Date.now() - t1, rows: null, error: String(e) };
      }
      try {
        const ex = await pg.query(`explain (analyze, buffers, timing) select * from public.recommend('{netflix}'::text[], 50, 0, null)`);
        direct.plan = ((ex.rows[0] as Record<string, string>)?.['QUERY PLAN'] ?? null);
      } catch (e) {
        direct.plan_error = String(e);
      }
    } finally {
      await pg.query(`reset role`).catch(() => undefined);
      await pg.query(`select set_config('request.jwt.claim.sub', '', false)`).catch(() => undefined);
    }

    // 6 · Limpieza.
    await pg.query(DROP);
    await pg.query(DROP_EXTRA);
    const svc = createClient(URL_, SERVICE);
    const dr = await svc.rpc('delete_user_data', { p_target_user_id: uid });
    const du = await admin.auth.admin.deleteUser(uid);
    await sleep(1500);
    const c1 = await pg.query(`select count(*)::int as n from public.history_entries where user_id = $1`, [uid]);

    return json({
      uid, featured: M, nofeat: N, ratings: nR.rows[0]?.n,
      gucs_pgrst: gucsPgrst, gucs_err: gucsErr, parts, p1, direct, pg_stat_statements: pgs,
      cleanup: {
        delete_user_data: dr.error ? String(dr.error.message) : 'ok',
        delete_user: du ? 'ok' : 'fallo',
        history_left: c1.rows[0]?.n,
      },
    });
  } catch (e) {
    try { await pg.query(DROP); await pg.query(DROP_EXTRA); } catch { /* ya no hay */ }
    if (uid) {
      const svc = createClient(URL_, SERVICE);
      const dr = await svc.rpc('delete_user_data', { p_target_user_id: uid });
      void dr;
      await admin.auth.admin.deleteUser(uid).catch(() => undefined);
    }
    return json({ error: String(e), uid });
  } finally {
    await pg.end();
  }
});
