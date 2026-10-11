-- Diana 0013: performance de recommend() y exclusión de «stubs» del catálogo
-- (VERTICE-PLAN-2, fase B: verificación Letterboxd contra el catálogo real).
--
-- Hallazgo (producción, 2026-10-11): con ~200 valoraciones importadas de
-- Letterboxd, `recommend` pasaba el statement timeout de PostgREST (~5 s)
-- («canceling statement due to statement timeout»), mientras que con 30
-- valoraciones respondía en <1 s. El feed (que cae a la heurística si el
-- RPC falla) se rompería justo para los usuarios con el historial que este
-- plan quiere alimentar.
--
-- Causa: el CTE `candidates` llama a `_genre_affinity(auth.uid(), …)` para
-- CADA candidato del catálogo (~40.000), y cada llamada a `_genre_affinity`
-- re-ejecuta `_genre_prefs(user)` (JOIN del historial completo del usuario
-- contra catalog_titles + group by). Coste total ≈
-- candidatos × valoraciones (8M+ lookups indexados). La afinidad de género
-- de un candidato es la media de un SUBCONJUNTO fijo de las preferencias
-- del usuario: basta con materializar `_genre_prefs(user)` UNA vez por
-- llamada (CTE `prefs`) y hacer un hash join por género. El vector de gusto
-- (`_user_taste_vector`) ya se materializaba (CTE `taste`).
--
-- Segundo hallazgo: catalog-sync había dejado «stubs» (filas con title='',
-- year NULL, sin plataformas, popularity inflada: ~6.000 de 39.616). En
-- frío, recommend desempata por popularity → esos stubs ganarían el feed
-- como «Película N»/«Serie N». Se excluyen del CTE de candidatos (solo
-- títulos con `title` no vacía; los stubs SÍ pueden tener feature, que el
-- backfill ya generó —no hay datos que perder: su texto de embedding era
-- solo metadatos—).
--
-- El score, el desempate, la paginación y la explicación no cambian: solo
-- cambia CÓMO se calcula la afinidad de género (resultado idéntico: es la
-- misma media sobre las mismas preferencias) y los candidatos sin título no
-- compiten. `predict_tenths` y `_user_taste_vector` quedan intactos.
--
-- MIGRACIÓN FORWARD (no reabrir 0007): la firma de recommend() no cambia.

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
  -- Preferencias de género del usuario materializadas UNA vez por llamada
  -- (antes: re-ejecutadas por cada candidato → timeout con historiales
  -- grandes; el resultado es el mismo: media sobre el subconjunto de
  -- preferencias de los géneros del candidato). `materialized` explícito:
  -- sin él el planificador podría INLINAR el CTE (referencia única) y
  -- re-ejecutar _genre_prefs por cada candidato (el bug que esto corrige).
  prefs as materialized (
    select * from public._genre_prefs(auth.uid())
  ),
  candidates as (
    select
      c.media_type,
      c.tmdb_id,
      c.title,
      c.poster_path,
      c.genre_ids,
      c.popularity,
      case
        when tv.v is null then 0::numeric   -- frío: desempate por popularidad
        else (0.7 * coalesce(1 - extensions.l2_distance(f.embedding, tv.v), 0)
              + 0.3 * coalesce(
                (select avg(pw.weight)
                 from (select unnest(c.genre_ids) as gid) t
                 left join prefs pw on pw.genre_id = t.gid),
                0))::numeric
      end as score
    from public.catalog_titles c
    cross join platforms pl
    cross join taste tv
    left join public.catalog_features f
      on f.tmdb_id = c.tmdb_id and f.media_type = c.media_type
    where c.title is not null and c.title <> ''   -- sin «stubs» (ver cabecera)
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
  )
  select
    c.media_type,
    c.tmdb_id,
    c.title,
    c.poster_path,
    round(c.score, 4) as score,
    (
      -- «Porque te gustó X» (hasta 2 títulos valorados sobre la media, con
      -- máximo parecido de contenido al candidato). Correlacionado por fila:
      -- para los tamaños del plan (miles de candidatos) es aceptable.
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
             on cf.tmdb_id = c.tmdb_id and cf.media_type = c.media_type
           where r.delta > 0 and cf.embedding is not null
           order by extensions.l2_distance(cf.embedding, r.emb) asc
           limit 2
         ) x),
         array[]::text[]
            )
    ) as explanation
  from candidates c
  order by c.score desc, c.popularity desc, c.media_type asc, c.tmdb_id asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0)
$$;

-- Los permisos ya estaban en la 0007 (revoke public/anon, grant
-- authenticated); `create or replace` los conserva, no se repiten.
