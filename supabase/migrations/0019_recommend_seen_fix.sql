-- Diana 0019: recommend() definitivo — seen materializado + ANN + frío
-- (VERTICE-PLAN-2, fase B; reemplaza el defecto de la 0018).
--
-- Diagnóstico (producción, 2026-10-11): la 0018 tardaba <100 ms ejecutada
-- por el cliente pg (supabase_admin, sin RLS) pero SUPERABA el statement
-- timeout vía PostgREST (usuario autenticado, con RLS). Causa: la 0018
-- conservaba dos subqueries `not exists` CORRELACIONADAS (una contra
-- `watched`, otra contra `history_entries`) evaluadas por cada candidato.
-- Bajo RLS (security invoker), cada candidato re-escanaba las ~N filas del
-- usuario (sin índice sobre media_type/media_id) → candidatos × N × 2
-- visitas a filas → timeout con historiales grandes.
--
-- Fix (este): el conjunto «vistos/valorados» del usuario se materializa UNA
-- vez (CTE `seen`, una sola pasada RLS-filtrada por tabla) y se excluye con
-- un anti-join contra ese conjunto pequeño. El resto ya estaba en la 0018:
--   · `prefs` materializado (afinidad de género, una vez por llamada)
--   · `ann` top-K por HNSW (usuario con vector de gusto) — el índice HNSW
--     de la 0007 (vector_cosine_ops) con el operador `<->`
--   · `cold` populares de sus plataformas (usuario en frío)
--   · score mixto original (0.7·cos + 0.3·géneros) sobre ~1.000 filas
--   · explicación solo sobre el top-N
-- La firma de recommend() no cambia; el orden, el score y el contenido de la
-- explicación tampoco (solo cambia CÓMO se materializan el seen y el ANN).

create or replace function public.recommend(
  p_platforms text[] default '{}',
  p_limit int default 50,
  p_offset int default 0,
  p_types text[] default null
) returns table (
  media_type text,
  tmdb_id int,
  title text,
  poster_path text,
  score numeric,
  explanation text[]
)
language sql stable
security invoker
set search_path = public, extensions
as $$
  with platforms as (
    select case when coalesce(array_length(p_platforms, 1), 0) > 0
                then p_platforms else null end as p
  ),
  taste as (
    select public._user_taste_vector(auth.uid()) as v
  ),
  -- Afinidad de género UNA vez por llamada (0013).
  prefs as materialized (
    select * from public._genre_prefs(auth.uid())
  ),
  -- Vistos/valorados del usuario, UNA vez (0015/0019): normaliza a
  -- (media_type, media_id). Bajo RLS cada tabla se filtra por auth.uid() en
  -- una sola pasada; el anti-join posterior es contra este conjunto pequeño,
  -- NO contra las tablas por cada candidato.
  seen as materialized (
    select distinct media_type, media_id
    from (
      select media_type, media_id
      from public.history_entries
      where user_id = auth.uid()
      union all
      select split_part(key, ':', 1)::text, split_part(key, ':', 2)::int
      from public.watched
      where user_id = auth.uid()
    ) k
  ),
  -- 1) ANN top-K por HNSW (0018): usuario con vector de gusto.
  ann as materialized (
    select
      c.media_type,
      c.tmdb_id,
      c.title,
      c.poster_path,
      c.genre_ids,
      c.popularity,
      f.embedding
    from public.catalog_features f
    join public.catalog_titles c
      on c.tmdb_id = f.tmdb_id and c.media_type = f.media_type
    cross join platforms pl
    cross join taste tv
    where tv.v is not null
      and f.embedding is not null
      and c.title is not null and c.title <> ''   -- sin «stubs» (0013)
      and (pl.p is null or c.platforms_flatrate && pl.p)
      and (p_types is null or c.media_type = any(p_types))
      and not exists (
        select 1 from seen s
        where s.media_type = c.media_type and s.media_id = c.tmdb_id)
    order by f.embedding <-> tv.v
    limit 1000
  ),
  -- 2) Frío (0007/0018): sin vector de gusto → populares de sus plataformas.
  cold as materialized (
    select
      c.media_type,
      c.tmdb_id,
      c.title,
      c.poster_path,
      c.genre_ids,
      c.popularity,
      f.embedding
    from public.catalog_titles c
    cross join platforms pl
    cross join taste tv
    left join public.catalog_features f
      on f.tmdb_id = c.tmdb_id and f.media_type = c.media_type
    where tv.v is null
      and c.title is not null and c.title <> ''
      and (pl.p is null or c.platforms_flatrate && pl.p)
      and (p_types is null or c.media_type = any(p_types))
      and not exists (
        select 1 from seen s
        where s.media_type = c.media_type and s.media_id = c.tmdb_id)
    order by c.popularity desc, c.media_type asc, c.tmdb_id asc
    limit 1000
  ),
  -- 3) Score mixto ORIGINAL sobre ~1.000 filas.
  candidates as (
    select
      x.media_type,
      x.tmdb_id,
      x.title,
      x.poster_path,
      x.popularity,
      case
        when tv.v is null then 0::numeric   -- frío: desempate por popularidad
        else (0.7 * coalesce(1 - extensions.l2_distance(x.embedding, tv.v), 0)
              + 0.3 * coalesce(
                (select avg(pw.weight)
                 from (select unnest(x.genre_ids) as gid) t
                 left join prefs pw on pw.genre_id = t.gid),
                0))::numeric
      end as score
    from (select * from ann union all select * from cold) x
    cross join taste tv
  ),
  -- 4) Top-N paginado (orden sin cambios).
  top as materialized (
    select media_type, tmdb_id, title, poster_path, popularity, score
    from candidates
    order by score desc, popularity desc, media_type asc, tmdb_id asc
    limit greatest(p_limit, 1) offset greatest(p_offset, 0)
  )
  select
    top.media_type,
    top.tmdb_id,
    top.title,
    top.poster_path,
    round(top.score, 4) as score,
    (
      -- «Porque te gustó X» (solo sobre el top-N, 0016).
      coalesce(
        (select array_agg(x.msg)
         from (
           select 'Porque te gustó ' || r.title as msg
           from (
             select h2.title as title,
                    (h2.user_rating - s2.avg_r) as delta,
                    f2.embedding as emb
             from public.history_entries h2
             cross join lateral (select avg(user_rating) as avg_r
                                 from public.history_entries h3
                                 where h3.user_id = auth.uid()) s2
             join public.catalog_features f2
               on f2.tmdb_id = h2.media_id and f2.media_type = h2.media_type
             where h2.user_id = auth.uid()
           ) r
           join public.catalog_features cf
             on cf.tmdb_id = top.tmdb_id and cf.media_type = top.media_type
           where r.delta > 0 and cf.embedding is not null
           order by extensions.l2_distance(cf.embedding, r.emb) asc
           limit 2
         ) x),
         array[]::text[]
            )
    ) as explanation
  from top
  order by top.score desc, top.popularity desc, top.media_type asc, top.tmdb_id asc
$$;

-- Los permisos ya estaban en la 0007 (revoke public/anon, grant
-- authenticated); `create or replace` los conserva, no se repiten.
