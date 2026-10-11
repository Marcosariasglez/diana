-- Diana 0016: recommend() calcula la explicación SOLO sobre el top-N
-- (3ª y definitiva parte del fix de performance; VERTICE-PLAN-2, fase B).
--
-- Tras la 0013 (prefs materializadas) y la 0015 (seen materializado),
-- `recommend` seguía superando el statement timeout (~5 s de PostgREST) con
-- ~200 valoraciones, pero respondía con ~30. La última pieza que escala con
-- el tamaño del historial del usuario: el subquery de `explanation`
-- («Porque te gustó X») se corría correlacionado contra el CTE `candidates`
-- COMPLETO (~15.000–30.000 filas con plataforma+filter), y por fila hacía
-- `historial × l2_distance`. Con 30 valoraciones ese coste cabía en el
-- timeout; con 200 no.
--
-- Fix: el top-N ordenado se materializa EN UN CTE (`top`) ANTES de
-- calcular `explanation`; así el subquery caro corre solo N veces (N =
-- p_limit, p. ej. 50), independientemente del nº de candidatos ni del
-- tamaño del historial. Score, desempate, paginación y el contenido de la
-- explicación no cambian; la firma de recommend() tampoco.

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
  prefs as materialized (
    select * from public._genre_prefs(auth.uid())
  ),
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
    where c.title is not null and c.title <> ''   -- sin «stubs» (0013)
      and (pl.p is null or c.platforms_flatrate && pl.p)
      and (p_types is null or c.media_type = any(p_types))
      -- no visto (título entero o cualquier episodio) ni ya valorado
      and not exists (
        select 1 from seen s
        where s.media_type = c.media_type and s.media_id = c.tmdb_id)
  ),
  -- Top-N ordenado materializado ANTES de la explicación (0016): el subquery
  -- caro de `explanation` corre solo N veces, no por cada candidato. Lleva
  -- `popularity` para el ORDER BY final (un CTE materializado no garantiza el
  -- orden a la consulta externa: el orden lo impone el ORDER BY de abajo).
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
