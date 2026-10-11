-- Diana 0020: fix del vector de gusto (regresión 0007) + títulos sin feature
-- como candidatos (VERTICE-PLAN-2, fase B; reemplaza a la 0019).
--
-- Diagnóstico (producción, 2026-10-11, function diag-recommend temporal):
--   (a) taste_ok=false: `_user_taste_vector` devolvía NULL para un usuario con
--       208 valoraciones sobre títulos que SÍ tienen feature. Causa: la
--       comprobación «vector cero» de la 0007 era
--         `vector_l2_squared_distance(v_result, v_result) = 0`
--       que es IDENTICAMENTE 0 para cualquier vector (distancia a sí mismo)
--       → la función devolvía NULL siempre que el usuario tuviera ≥1
--       valoración con feature. La ruta de contenido (ANN) jamás se ejecutó:
--       TODOS los usuarios corrían el camino frío, y A.6 (evaluar content vs
--       heurística) era imposible.
--   (b) Con el taste NULL siempre, el feed de un usuario con historial grande
--       es «populares de sus plataformas» (cold), no un ranking por afinidad.
--
-- Fix (este):
--   1) `_user_taste_vector`: la comprobación degenerada se decide con datos
--      ENTEROS antes de la aritmética de vectores (todas las notas iguales →
--      vector centrado = 0 → NULL, exacto; evita el residuo ~1e-4 de la suma
--      float32 de pgvector). La comprobación final usa la distancia REAL al
--      vector cero (l2_norm) con epsilon 1e-3: un gusto real tiene norma >>
--      1e-3; el residuo por cancelación en float32 es ~1e-4 o menos.
--      (NULL solo si: sin valoraciones con feature, o todas las notas
--      iguales, o vector ~cero. Comportamiento para el arranque en frío
--      (sin historial) sin cambios.)
--   2) `recommend`: nuevo CTE `nofeat` (títulos reales SIN embedding). La
--      0019 solo dejaba candidatos con feature: con el backfill en curso
--      (290/39.616) el feed se habría reducido a ≤290 títulos. La semántica
--      de la 0007 puntuaba TODO el catálogo (contenido 0 + afinidad de género
--      para los sin embedding); se conserva con `nofeat` acotado a los
--      2.000 más populares (mismo criterio de acotación que `cold`). Score
--      y orden de salida sin cambios para los candidatos existentes.
--
-- La firma de recommend() no cambia; la explicación tampoco (solo sobre el
-- top-N, como 0016/0019).
--
-- Como la 0007: el tipo `vector` vive en el schema `extensions`; se añade a
-- la búsqueda de nombres de ESTA sesión (solo afecta a esta migración).
select set_config('search_path', 'public, extensions', false);

-- ---------------------------------------------------------------------------
-- 1) _user_taste_vector: fix de la comprobación de vector cero.
-- ---------------------------------------------------------------------------
create or replace function public._user_taste_vector(p_user uuid)
returns vector
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_sk vector;      -- Σ K_i·e_i (K_i = 2·nota, entero 1..10)
  v_s0 vector;      -- Σ e_i
  v_result vector;
  v_tmp vector;
  v_zero vector;    -- vector cero (norma de referencia, 0020)
  v_k int;
  n int := 0;
  v_ksum int := 0;
  j int;
  r record;
  v_min numeric;
  v_max numeric;
begin
  if p_user is distinct from auth.uid() then
    raise exception 'bad-user';
  end if;

  -- 0020: caso degenerado EXACTO con enteros. Si todas las notas (sobre
  -- títulos con feature) son iguales, cada (r_i − media) = 0 y el vector
  -- centrado es 0 → NULL, sin pasar por la aritmética float (con la suma
  -- repetida de float32 de pgvector el residuo ~1e-4 haría la comprobación
  -- final no determinista). Si no hay valoraciones con feature → NULL
  -- (arranque en frío; comportamiento previo).
  select min(user_rating), max(user_rating)
    into v_min, v_max
    from public.history_entries h
    join public.catalog_features f
      on f.tmdb_id = h.media_id and f.media_type = h.media_type
    where h.user_id = p_user and f.embedding is not null;
  v_zero := ('[' || repeat('0,', 383) || '0]')::extensions.vector;
  if v_min is null then
    return null;
  end if;
  if v_min = v_max then
    return null;
  end if;

  for r in
    select (h.user_rating * 2)::int as k, f.embedding as emb
    from public.history_entries h
    join public.catalog_features f
      on f.tmdb_id = h.media_id and f.media_type = h.media_type
    where h.user_id = p_user and f.embedding is not null
    order by h.rated_at desc
    limit 200
  loop
    v_k := r.k;
    -- S_K: e_i exactamente K_i veces (la 1ª con coalesce, el resto en el loop)
    v_sk := coalesce(v_sk, r.emb);
    for j in 2..v_k loop
      v_sk := v_sk + r.emb;
    end loop;
    -- S_0: e_i una vez
    v_s0 := coalesce(v_s0, r.emb);
    n := n + 1;
    v_ksum := v_ksum + v_k;
  end loop;

  if n = 0 then
    return null;
  end if;

  -- n·S_K
  v_result := v_sk;
  for j in 2..n loop
    v_result := v_result + v_sk;
  end loop;
  -- (ΣK_i)·S_0
  if v_ksum > 0 then
    v_tmp := v_s0;
    for j in 2..v_ksum loop
      v_tmp := v_tmp + v_s0;
    end loop;
    v_result := v_result - v_tmp;
  end if;

  -- 0020: comprobación REAL de vector cero: la 0007 usaba
  -- `vector_l2_squared_distance(v_result, v_result) = 0`, que es 0 para
  -- CUALQUIER vector (distancia de un vector a sí mismo) → NULL siempre →
  -- la ruta de contenido estaba muerta para todos los usuarios. Con el
  -- chequeo min=max previo, el único caso que llega aquí con norma ~0 son
  -- residuos de cancelación en float32 (≤ ~1e-4); un gusto real tiene
  -- norma >> 1e-3 (comparación en el cuadrado: 1e-6).
  if vector_l2_squared_distance(v_result, v_zero) < 1e-6 then
    return null;
  end if;
  return l2_normalize(v_result);
end
$$;
revoke all on function public._user_taste_vector(uuid) from public, anon, authenticated;
grant execute on function public._user_taste_vector(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) recommend(): 0019 + CTE nofeat (sin feature → 2.000 populares, score de
--    género; la semántica de la 0007 de «todo el catálogo es candidato»).
-- ---------------------------------------------------------------------------
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
  -- Títulos con embedding, UNA vez (0020): para el anti-join de `nofeat` sin
  -- re-escanear catalog_features por candidato (crece con el backfill).
  featured as materialized (
    select media_type, tmdb_id
    from public.catalog_features
    where embedding is not null
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
  -- 2) Sin feature (0020): los títulos reales sin embedding siguen siendo
  --    candidatos (semántica 0007: contenido 0 + afinidad de género), para
  --    que el feed no se reduzca a los títulos ya backfillados mientras el
  --    backfill crece. Top-2.000 por popularidad (mismo criterio que cold).
  nofeat as materialized (
    select
      c.media_type,
      c.tmdb_id,
      c.title,
      c.poster_path,
      c.genre_ids,
      c.popularity,
      null::extensions.vector as embedding
    from public.catalog_titles c
    cross join platforms pl
    cross join taste tv
    where tv.v is not null
      and c.title is not null and c.title <> ''   -- sin «stubs» (0013)
      and not exists (
        select 1 from featured ft
        where ft.media_type = c.media_type and ft.tmdb_id = c.tmdb_id)
      and (pl.p is null or c.platforms_flatrate && pl.p)
      and (p_types is null or c.media_type = any(p_types))
      and not exists (
        select 1 from seen s
        where s.media_type = c.media_type and s.media_id = c.tmdb_id)
    order by c.popularity desc, c.media_type asc, c.tmdb_id asc
    limit 2000
  ),
  -- 3) Frío (0007/0018): sin vector de gusto → populares de sus plataformas.
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
  -- 4) Score mixto ORIGINAL sobre ~1.000 (ann) + ~2.000 (nofeat) filas.
  --    (Sin feature → l2_distance NULL → coalesce 0: solo 0.3·género.)
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
    from (select * from ann union all select * from nofeat union all select * from cold) x
    cross join taste tv
  ),
  -- 5) Top-N paginado (orden sin cambios).
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
