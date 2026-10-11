-- Diana 0018: recommend() con pre-filtrado ANN (HNSW) — el fix definitivo
-- de performance (VERTICE-PLAN-2, fase B).
--
-- Medida real (Docker, Postgres+pgvector, 33.000 candidatos con embedding
-- + 208 valoraciones; scripts/sql-recommend-scale.mjs): con las correcciones
-- 0013–0017, `recommend` tardaba 110.123 ms (41M de buffer accesses). El
-- cuello de botella NO era un subquery: era el escaneo COMPLETO de los
-- 33.000 embeddings (l2_distance por fila + GROUP BY de un vector de 384
-- dims). El statement timeout de PostgREST es ~5 s: con cobertura completa
-- del catálogo, recommend «content» era intratables en cualquier caso.
--
-- Clave: el índice HNSW de la 0007 es `hnsw (embedding vector_cosine_ops)`,
-- pero `l2_distance` pertenece a `vector_l2_ops` → el índice NUNCA se usaba
-- (escaneo completo). Como los vectores están normalizados (gte-small con
-- normalize: true), la distancia coseno es MONÓTONA con l2
-- (l2² = 2·(1−cos)): basta con SELECCIONAR por distancia coseno (operador
-- `<->`, que SÍ usa el HNSW) y calcular el score con la fórmula ORIGINAL.
--
-- Diseño (patrón ANN + rerank, el estándar en recomendación por contenido):
--   1. `ann`: top-K (1.000) candidatos más parecidos al vector de gusto vía
--      HNSW (milisegundos, no dependiente del tamaño del catálogo), con los
--      filtros de título/plataforma/tipo/vistos aplicados EN LA MISMA query
--      (así el top-K no se llena de candidatos fuera de plataforma).
--   2. `cold`: si el usuario no tiene vector de gusto (frío), top-K por
--      popularidad dentro de sus plataformas (misma semántica que la 0007:
--      score 0 para todos, desempate por popularidad).
--   3. `candidates`: score mixto ORIGINAL (0.7·(1−l2) + 0.3·afinidad de
--      géneros) SOLO sobre ~1.000 filas (barato, sin GROUP BY de vectores).
--   4. `top`: top-N paginado (orden score/popularity, sin cambios).
--   5. `explanation`: solo sobre el top-N (0016).
--
-- Precisión: el top-50 por score mixto puede, en principio, contener un
-- candidato que no entre en el top-1.000 por coseno puro; con K=1.000 el
-- recall es muy alto (y el feed es una muestra, no una lista exhaustiva).
-- El score y el contenido de la explicación no cambian para el candidato
-- seleccionado; la firma de recommend() tampoco.

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
  -- Preferencias de género UNA vez por llamada (0013): sin esto, el join de
  -- la afinidad recomputaría _genre_prefs por cada candidato.
  prefs as materialized (
    select * from public._genre_prefs(auth.uid())
  ),
  -- 1) ANN top-K por HNSW (0018): los más parecidos al gusto del usuario,
  --    ya con los filtros de feed. Orden por distancia coseno `<->` (usa el
  --    índice HNSW de la 0007; l2_distance NO lo usa).
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
      -- no visto (título entero o cualquier episodio) ni ya valorado
      and not exists (
        select 1 from public.watched w
        where w.user_id = auth.uid()
          and (w.key = c.media_type || ':' || c.tmdb_id
               or w.key like c.media_type || ':' || c.tmdb_id || ':%'))
      and not exists (
        select 1 from public.history_entries h
        where h.user_id = auth.uid()
          and h.media_type = c.media_type
          and h.media_id = c.tmdb_id)
    order by f.embedding <-> tv.v
    limit 1000
  ),
  -- 2) Frío (sin vector de gusto): populares de sus plataformas (0007).
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
        select 1 from public.watched w
        where w.user_id = auth.uid()
          and (w.key = c.media_type || ':' || c.tmdb_id
               or w.key like c.media_type || ':' || c.tmdb_id || ':%'))
      and not exists (
        select 1 from public.history_entries h
        where h.user_id = auth.uid()
          and h.media_type = c.media_type
          and h.media_id = c.tmdb_id)
    order by c.popularity desc, c.media_type asc, c.tmdb_id asc
    limit 1000
  ),
  -- 3) Score mixto ORIGINAL sobre ~1.000 filas (barato).
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
      -- «Porque te gustó X» (hasta 2 títulos valorados sobre la media, con
      -- máximo parecido de contenido al candidato). Solo sobre el top-N.
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
