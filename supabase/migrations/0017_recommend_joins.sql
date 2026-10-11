-- Diana 0017: recommend() con joins de conjunto (4ª parte del fix de
-- performance; VERTICE-PLAN-2, fase B).
--
-- Tras la 0013 (prefs materializadas), la 0015 (seen materializado) y la
-- 0016 (top-N antes de la explicación), `recommend` seguía pasando el
-- statement timeout en PRODUCCIÓN (catálogo real ~33.000 candidatos),
-- mientras que el test de escala local (2.000 candidatos, 5 s) pasaba.
-- Las dos piezas que quedaban por-candidato eran SUBQUERIES correlacionadas
-- ejecutadas una vez por fila de `candidates` (~15.000–30.000):
--   · la afinidad de género: (select avg(pw.weight) from unnest(c.genre_ids)
--     t left join prefs pw on …)
--   · la exclusión de vistos: not exists (select 1 from seen s where …)
-- Cada ejecución de subquery lleva su overhead de plan; multiplicado por
-- decenas de miles de candidatos se pasa el budget del plan gratuito.
--
-- Fix: ambos se convierten en JOINS planos sobre los CTEs materializados
-- (una sola pasada por conjunto, hash join/anti-join):
--   · left join prefs pw on pw.genre_id = any(c.genre_ids) + GROUP BY por
--     candidato: avg(pw.weight) es la MISMA media que el subquery original
--     (los géneros sin preferencia no aportan filas; sin coincidencias →
--     avg NULL → coalesce 0, igual que antes).
--   · left join seen s … + where s.media_id is null (anti-join): misma
--     exclusión que el not exists.
--
-- Score, desempate, paginación, explicación (top-N de la 0016) y la firma
-- de recommend() no cambian.

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
      c.popularity,
      case
        when tv.v is null then 0::numeric   -- frío: desempate por popularidad
        else (0.7 * coalesce(1 - extensions.l2_distance(f.embedding, tv.v), 0)
              + 0.3 * coalesce(avg(pw.weight), 0))::numeric
      end as score
    from public.catalog_titles c
    cross join platforms pl
    cross join taste tv
    left join public.catalog_features f
      on f.tmdb_id = c.tmdb_id and f.media_type = c.media_type
    -- Afinidad de género como JOIN de conjunto (0017): avg(pw.weight) es la
    -- misma media que el subquery por-candidato de la 0013/0015/0016.
    left join prefs pw on pw.genre_id = any(c.genre_ids)
    -- Vistos/valorados como ANTI-JOIN de conjunto (0015/0017).
    left join seen s
      on s.media_type = c.media_type and s.media_id = c.tmdb_id
    where c.title is not null and c.title <> ''   -- sin «stubs» (0013)
      and (pl.p is null or c.platforms_flatrate && pl.p)
      and (p_types is null or c.media_type = any(p_types))
      and s.media_id is null
    group by c.media_type, c.tmdb_id, c.title, c.poster_path, c.popularity,
             tv.v, f.embedding
  ),
  -- Top-N ordenado materializado ANTES de la explicación (0016).
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
