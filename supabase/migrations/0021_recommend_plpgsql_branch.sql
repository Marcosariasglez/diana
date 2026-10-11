-- Diana 0021: recommend() con rama en tiempo de ejecución + índice popularity
-- (VERTICE-PLAN-2, fase B; reemplaza a la 0020).
--
-- Diagnóstico (producción, 2026-10-11, function diag-recommend temporal):
--   · El backend de PostgREST (pooler) corre con statement_timeout = 8000 ms
--     y work_mem = 2184 kB (medido vía _diag_gucs() llamado por /rest/v1/rpc).
--   · Cada CTE de la 0020 por separado responde <200 ms vía PostgREST, pero el
--     `recommend` compuesto supera los 8 s (57014). El mismo SQL por el
--     camino directo (rol supabase_admin, RLS real) tarda 0.8–1.8 s.
--   · Causa: la 0020 es `language sql` y los 3 CTEs `ann`/`nofeat`/`cold` son
--     MATERIALIZED. El valor de `taste.v` solo se conoce en tiempo de
--     EJECUCIÓN (es el resultado de _user_taste_vector), así que el planner
--     no poda ninguna rama en tiempo de plan: TODA llamada warm ejecuta los
--     2 escaneos completos de catalog_titles (39.616 filas) — el `nofeat` y
--     el `cold` (que produce 0 filas porque tv.v is null es false, pero el
--     escaneo + left join a catalog_features se ejecuta igual) — más el
--     HNSW de `ann`. Con el backfill creciendo, ese doble escaneo completo
--     por llamada es el cuello.
--
-- Fix:
--   1) ÍNDEX `catalog_titles_popularity_idx` (popularity desc, media_type,
--      tmdb_id): los top-N por popularidad (`nofeat`/`cold`) se leen por
--      índice, sin sort de ~40.000 filas (independiente de work_mem).
--   2) `recommend()` como LANGUAGE PLPGSQL con RAMA EN TIEMPO DE EJECUCIÓN
--      sobre el vector de gusto: usuario con gusto → SOLO ann (HNSW) +
--      nofeat (índice); usuario en frío → SOLO cold (índice). Un solo
--      camino por llamada, sin escaneo desperdiciado.
--   3) `liked` materializado una vez (los valorados sobre su media, con
--      embedding) para la explicación: 50 subconsultas pequeñas contra un
--      conjunto pequeño, en vez de 50 × recomputar el lateral avg del
--      historial completo.
--
-- Contrato sin cambios: firma, columnas, orden (score desc, popularity desc,
-- media_type asc, tmdb_id asc), score (0.7·contenido + 0.3·género; frío → 0)
-- y explicación (hasta 2 «Porque te gustó X»).
--
-- Los permisos ya estaban en la 0007 (revoke anon/public, grant
-- authenticated); `create or replace` los conserva (misma firma).

create index if not exists catalog_titles_popularity_idx
  on public.catalog_titles (popularity desc, media_type, tmdb_id);

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
language plpgsql stable
security invoker
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_platforms text[] := case
                          when coalesce(array_length(p_platforms, 1), 0) > 0
                          then p_platforms else null end;
  v_taste extensions.vector;
begin
  v_taste := public._user_taste_vector(v_uid);

  if v_taste is null then
    -- ---------------------------------------------------------------
    -- FRÍO (0007/0018): sin vector de gusto → populares de sus
    -- plataformas, sin vistos/valorados. Score 0 → desempate por
    -- popularidad. Top-N por índice (0021): sin sort de todo el catálogo.
    -- ---------------------------------------------------------------
    return query
    with seen as materialized (
      -- Columnas calificadas: `media_type` coincide con una columna de
      -- SALIDA de la función (RETURNS TABLE) y en PL/pgSQL una referencia sin
      -- calificar sería ambigua (variable vs columna de tabla).
      select distinct q.mt as media_type, q.mid as media_id
      from (
        select h.media_type as mt, h.media_id as mid
        from public.history_entries h
        where h.user_id = v_uid
        union all
        select split_part(w.key, ':', 1)::text as mt,
               split_part(w.key, ':', 2)::int as mid
        from public.watched w
        where w.user_id = v_uid
      ) q
    )
    select
      c.media_type,
      c.tmdb_id,
      c.title,
      c.poster_path,
      0::numeric as score,
      array[]::text[] as explanation
    from public.catalog_titles c
    where c.title is not null and c.title <> ''   -- sin «stubs» (0013)
      and (v_platforms is null or c.platforms_flatrate && v_platforms)
      and (p_types is null or c.media_type = any(p_types))
      and not exists (
        select 1 from seen s
        where s.media_type = c.media_type and s.media_id = c.tmdb_id)
    order by c.popularity desc, c.media_type asc, c.tmdb_id asc
    limit greatest(p_limit, 1) offset greatest(p_offset, 0);
 else
   -- ---------------------------------------------------------------
   -- CON GUSTO (0018/0020/0021): ann (HNSW top-1.000) + nofeat (índice
   -- top-2.000) → score mixto 0.7·contenido + 0.3·género → top-N →
   -- explicación «Porque te gustó X» (solo sobre el top-N, 0016).
   --
   -- Las ramas son IF/ELSE (mutuamente excluyentes) porque RETURN QUERY
   -- NO termina la función en PL/pgSQL: con dos RETURN QUERY separados el
   -- control caería de la rama fría a la caliente y se concatenarían las
   -- dos salidas (duplicado de filas).
   -- ---------------------------------------------------------------
  return query
  with seen as materialized (
    -- (Ver rama fría: referencias calificadas para evitar ambigüedad con las
    -- columnas de salida de la función.)
    select distinct q.mt as media_type, q.mid as media_id
    from (
      select h.media_type as mt, h.media_id as mid
      from public.history_entries h
      where h.user_id = v_uid
      union all
      select split_part(w.key, ':', 1)::text as mt,
             split_part(w.key, ':', 2)::int as mid
      from public.watched w
      where w.user_id = v_uid
    ) q
  ),
  -- Títulos con embedding, UNA vez (0020): anti-join de `nofeat` sin
  -- re-escanear catalog_features por candidato. (Columnas calificadas:
  -- `media_type`/`tmdb_id` colisionan con columnas de SALIDA en PL/pgSQL.)
  featured as materialized (
    select cf.media_type, cf.tmdb_id
    from public.catalog_features cf
    where cf.embedding is not null
  ),
  -- Afinidad de género UNA vez por llamada (0013).
  prefs as materialized (
    select * from public._genre_prefs(v_uid)
  ),
  -- 1) ANN top-K por HNSW (0018): índice vector_cosine_ops + operador `<->`.
  ann as (
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
    where f.embedding is not null
      and c.title is not null and c.title <> ''   -- sin «stubs» (0013)
      and (v_platforms is null or c.platforms_flatrate && v_platforms)
      and (p_types is null or c.media_type = any(p_types))
      and not exists (
        select 1 from seen s
        where s.media_type = c.media_type and s.media_id = c.tmdb_id)
    order by f.embedding <-> v_taste
    limit 1000
  ),
  -- 2) Sin feature (0020): los títulos reales sin embedding siguen siendo
  --    candidatos (contenido 0 + afinidad de género); top-2.000 por índice
  --    de popularidad (0021): sin sort de ~40.000 filas.
  nofeat as (
    select
      c.media_type,
      c.tmdb_id,
      c.title,
      c.poster_path,
      c.genre_ids,
      c.popularity,
      null::extensions.vector as embedding
    from public.catalog_titles c
    where c.title is not null and c.title <> ''   -- sin «stubs» (0013)
      and not exists (
        select 1 from featured ft
        where ft.media_type = c.media_type and ft.tmdb_id = c.tmdb_id)
      and (v_platforms is null or c.platforms_flatrate && v_platforms)
      and (p_types is null or c.media_type = any(p_types))
      and not exists (
        select 1 from seen s
        where s.media_type = c.media_type and s.media_id = c.tmdb_id)
    order by c.popularity desc, c.media_type asc, c.tmdb_id asc
    limit 2000
  ),
  -- 3) Score mixto ORIGINAL sobre ~1.000 (ann) + ~2.000 (nofeat) filas.
  --    (Sin feature → l2_distance NULL → coalesce 0: solo 0.3·género.)
  candidates as (
    select
      x.media_type,
      x.tmdb_id,
      x.title,
      x.poster_path,
      x.popularity,
      (0.7 * coalesce(1 - extensions.l2_distance(x.embedding, v_taste), 0)
       + 0.3 * coalesce(
         (select avg(pw.weight)
          from (select unnest(x.genre_ids) as gid) t
          left join prefs pw on pw.genre_id = t.gid),
         0))::numeric as score
    from (select * from ann union all select * from nofeat) x
  ),
  -- 4) Top-N paginado (orden sin cambios). (Calificado, como `featured`.)
  top as materialized (
    select c2.media_type, c2.tmdb_id, c2.title, c2.poster_path,
           c2.popularity, c2.score
    from candidates c2
    order by c2.score desc, c2.popularity desc, c2.media_type asc, c2.tmdb_id asc
    limit greatest(p_limit, 1) offset greatest(p_offset, 0)
  ),
  -- Valorados sobre la media con embedding, UNA vez (0021): la explicación
  -- se calcula contra este conjunto pequeño, no contra el historial por fila.
  liked as materialized (
    select h2.title,
           (h2.user_rating - s2.v_avg) as delta,
           f2.embedding as emb
    from public.history_entries h2
    cross join lateral (select avg(user_rating) as v_avg
                        from public.history_entries h3
                        where h3.user_id = v_uid) s2
    join public.catalog_features f2
      on f2.tmdb_id = h2.media_id and f2.media_type = h2.media_type
    where h2.user_id = v_uid
  )
  select
    top.media_type,
    top.tmdb_id,
    top.title,
    top.poster_path,
    round(top.score, 4) as score,
    (
      -- «Porque te gustó X» (solo sobre el top-N, 0016/0021).
      coalesce(
        (select array_agg(x.msg)
         from (
            select 'Porque te gustó ' || r.title as msg
            from liked r
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
  order by top.score desc, top.popularity desc, top.media_type asc, top.tmdb_id asc;
  end if;
end
$$;
