-- Diana 0015: recommend() excluye los vistos con un CTE materializado (2ª
-- parte del fix de performance; VERTICE-PLAN-2, fase B).
--
-- La 0013 materializó las preferencias de género, pero en producción
-- `recommend` seguía superando el statement timeout con ~200 valoraciones.
-- Segunda causa: las exclusiones de «vistos/valorados» eran `not exists`
-- correlacionadas contra `history_entries (user_id, media_type, media_id)`
-- y `watched (user_id, key)`. Ninguna de esas consultas tiene índice
-- (los PKs son (user_id, key) y (user_id, media_id)): por cada candidato
-- (~15.000 con filtros de plataforma) Postgres fetchaba TODAS las filas del
-- usuario (~200+), es decir ≈3M de row fetchs por llamada. Con 30
-- valoraciones cabía en el timeout; con 200 no.
--
-- Fix: un CTE `seen` MATERIALIZED (una sola pasada indexada por los PKs
-- (user_id, key) del usuario) que normaliza a (media_type, media_id):
--   · history_entries → (media_type, media_id) directo.
--   · watched → split_part(key, ':', 1..2) (la key 'tv:7:s1' → (tv, 7):
--     ver un episodio excluye la serie, MISMA semántica que el `like
--     'tv:7:%'` anterior; una película vista entera → (movie, 42)).
-- Y una única anti-join por candidato (hash anti-join sobre ~N filas
-- pequeñas: coste O(1) por candidato, independiente del historial).
--
-- El resto (score, desempate, paginación, explicación, filtro de stubs de
-- la 0013, prefs materializadas) no cambia. La firma de recommend() tampoco.

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
  -- Vistos/valorados del usuario, UNA vez por llamada (ver cabecera):
  -- (media_type, media_id) normalizado de ambas tablas.
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
