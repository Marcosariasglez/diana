-- Diana 0007: recomendador real (VERTICE-PLAN-2, D2-2).
-- ESCRITA, NO DESPLEGADA: la aplica el dueño en Supabase > SQL Editor (paso 1
-- de su lista del Plan 2). REQUIERE que antes se haya aplicado la 0006
-- (catalog_titles) y la extensión `vector` (Supabase > Database > Extensions,
-- paso 2 del dueño; el `create extension` de abajo es idempotente si ya está).
--
-- Contiene:
--   1. catalog_features: señales por título (keywords, director, cast,
--      embedding vector(384) de gte-small) + índice HNSW.
--   2. catalog_features_state: progreso del pase de features (reanudable).
--   3. public.recommend(): candidatos ordenados por afinidad CON explicación
--      («Porque te gustó X»). SECURITY INVOKER: respeta RLS (solo ve las
--      valoraciones/vistos del propio usuario).
--   4. public.predict_tenths(): nota IA calibrada en décimas 10..50 (mismo
--      contrato que predictTenths del cliente). Regresión simple por usuario
--      con >= 20 valoraciones; prior (media del título con shrinkage) si no.
--
-- SEGURIDAD:
--   - catalog_features: catálogo público (solo lectura para
--     anon/authenticated, sin escritura desde el cliente: la escribe
--     catalog-sync con service_role).
--   - catalog_features_state: invisible para el cliente (sin políticas).
--   - recommend / predict_tenths / _*: security invoker o definer privado;
--     el usuario solo ve SUS valoraciones por RLS (prueba de aislamiento en
--     scripts/sql-recommend-test.sql contra un Postgres local).

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- catalog_features: señales por título para el recomendador basado en
-- contenido. Las escribe SOLO la Edge Function catalog-sync (service_role).
-- `embedding` = gte-small (Supabase.ai, 384 dimensiones, normalizado) sobre
-- texto de nombres propios (título, título original, keywords, director y
-- primeros actores): gte-small solo trabaja en inglés (documentación
-- vigente), así que el texto evita la prosa (sinopsis en español).
-- decade/idioma/duración no se duplican: salen de catalog_titles
-- (year/original_language/runtime) en la consulta.
-- ---------------------------------------------------------------------------
create table public.catalog_features (
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  keywords text[] not null default '{}',
  director text not null default '',
  cast_names text[] not null default '{}',   -- nombres de los primeros actores (columna `cast`: reservada en Postgres)
  embedding vector(384),                      -- gte-small, normalizado
  updated_at timestamptz not null default now(),
  primary key (media_type, tmdb_id)
);

create index catalog_features_embedding_hnsw
  on public.catalog_features using hnsw (embedding vector_cosine_ops);

alter table public.catalog_features enable row level security;
create policy "catalog_features public read (anon)"
  on public.catalog_features for select to anon using (true);
create policy "catalog_features public read (authenticated)"
  on public.catalog_features for select to authenticated using (true);
grant select on public.catalog_features to anon, authenticated;
revoke insert, update, delete on public.catalog_features from anon, authenticated, public;

-- Progreso del pase de features (reanudable, como catalog_sync_state).
-- Invisible para el cliente: sin políticas ni privilegios.
create table public.catalog_features_state (
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'error')),
  last_error text,
  updated_at timestamptz not null default now(),
  primary key (media_type, tmdb_id)
);
alter table public.catalog_features_state enable row level security;
revoke all on public.catalog_features_state from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Auxiliares privados (revocados del público; los usan recommend y
-- predict_tenths). Todos «security definer» para poder leer
-- catalog_titles/catalog_features (públicas) y history_entries (RLS por
-- user_id, que aquí siempre se filtra a p_user = auth.uid() en el invokador).
-- ---------------------------------------------------------------------------

-- Prior de un título en décimas 10..50: media de su nota con shrinkage
-- bayesiano hacia la media global (peso 100 votos ficticios).
-- TMDB vote_average (0..10) → décimas de Diana (10..50) = vote_average * 5.
create function public._prior_tenths(p_media_type text, p_tmdb_id int)
returns numeric
language sql stable security definer set search_path = public as $$
  select round(5 * (c.vote_count * c.vote_average
                    + 100 * coalesce((select avg(c2.vote_average)
                                      from public.catalog_titles c2
                                      where c2.vote_count > 0), 6.5))
                   / (c.vote_count + 100), 1)
  from public.catalog_titles c
  where c.media_type = p_media_type and c.tmdb_id = p_tmdb_id
$$;
revoke all on function public._prior_tenths(text, int) from public, anon, authenticated;
grant execute on function public._prior_tenths(text, int) to authenticated;

-- Vector de gusto del usuario: media centrada de (nota - media_del_usuario)
-- * embedding del título valorado, normalizada. Una nota 4.5 (sobre la media)
-- empuja hacia el título; una 1.5 lo aleja. NULL si no hay valoraciones con
-- embedding (arranque en frío) o si el vector resultante es cero.
--
-- Implementación: pgvector 0.8 NO define multiplicación vector·escalar
-- (solo +, - y * entre vectores). Se usa la identidad (notas en pasos de
-- 0.5 → K_i = 2·r_i es entero 1..10):
--     n·Σ(K_i·e_i) − (ΣK_i)·Σe_i  =  2n·Σ(r_i − avg)·e_i
-- es decir, un múltiplo POSITIVO de la suma ponderada (igual vector unitario
-- tras normalizar). Los múltiplos enteros se hacen por suma repetida: con el
-- tope de 200 valoraciones más recientes, ≤ ~4.400 sumas de 384 flots (trivial).
-- SECURITY DEFINER, con el chequeo `p_user = auth.uid()` que impide leer el
-- gusto de otro usuario (misma pauta que los RPC de 0003).
create function public._user_taste_vector(p_user uuid)
returns vector
language plpgsql stable security definer set search_path = public as $$
declare
  v_sk vector;      -- Σ K_i·e_i (K_i = 2·nota, entero 1..10)
  v_s0 vector;      -- Σ e_i
  v_result vector;
  v_tmp vector;
  v_k int;
  n int := 0;
  v_ksum int := 0;
  j int;
  r record;
begin
  if p_user is distinct from auth.uid() then
    raise exception 'bad-user';
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

  if vector_l2_squared_distance(v_result, v_result) = 0 then
    return null;
  end if;
  return l2_normalize(v_result);
end
$$;
revoke all on function public._user_taste_vector(uuid) from public, anon, authenticated;
grant execute on function public._user_taste_vector(uuid) to authenticated;

-- Preferencia por género del usuario, centrada en su media: para cada género
-- g, weight = Σ(nota - media) / Σ|nota - media| ∈ [-1, 1] sobre sus
-- valoraciones que tienen ese género. (Mismo espíritu que el perfil de
-- géneros de la heurística actual, pero centrado y real.)
create function public._genre_prefs(p_user uuid)
returns table (genre_id int, weight numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_avg numeric;
begin
  if p_user is distinct from auth.uid() then
    raise exception 'bad-user';
  end if;

  select coalesce(avg(user_rating), 0) into v_avg
    from public.history_entries
    where user_id = p_user;

  return query
  select g.genre_id,
         round(sum(h.user_rating - v_avg)
               / greatest(sum(abs(h.user_rating - v_avg)), 0.0001), 4)
  from public.history_entries h
  cross join lateral (select unnest(c.genre_ids) as genre_id
                      from public.catalog_titles c
                      where c.tmdb_id = h.media_id
                        and c.media_type = h.media_type) g
  where h.user_id = p_user
  group by g.genre_id;
end
$$;
revoke all on function public._genre_prefs(uuid) from public, anon, authenticated;
grant execute on function public._genre_prefs(uuid) to authenticated;

-- Afinidad de género de un candidato: media de las preferencias de los
-- géneros del candidato (los sin señal no penalizan: 0).
create function public._genre_affinity(p_user uuid, p_genre_ids int[])
returns numeric
language plpgsql stable security definer set search_path = public as $$
begin
  if p_user is distinct from auth.uid() then
    raise exception 'bad-user';
  end if;

  return coalesce(
    (select avg(pw.weight)
     from (select unnest(p_genre_ids) as gid) t
     left join public._genre_prefs(p_user) pw on pw.genre_id = t.gid),
    0);
end
$$;
revoke all on function public._genre_affinity(uuid, int[]) from public, anon, authenticated;
grant execute on function public._genre_affinity(uuid, int[]) to authenticated;

-- ---------------------------------------------------------------------------
-- recommend(): candidatos ordenados por afinidad para el usuario, dentro de
-- sus plataformas, excluyendo vistos y ya valorados, con paginación y
-- explicación.
--
-- SECURITY INVOKER: la RLS de watched/history_entries hace que el usuario
-- solo vea SUS filas (ver scripts/sql-recommend-test.sql).
--
-- score = 0.7 * cos(embedding_candidato, vector_gusto) + 0.3 * afinidad de
-- género, ambos en [-1, 1]. Con 0 valoraciones (arranque en frío) el vector
-- es NULL y el score es 0 para todos: gana el desempate por popularidad
-- («populares en tus plataformas»).
-- ---------------------------------------------------------------------------
create function public.recommend(
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
as $$
  with platforms as (
    select case when coalesce(array_length(p_platforms, 1), 0) > 0
                then p_platforms else null end as p
  ),
  taste as (
    select public._user_taste_vector(auth.uid()) as v
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
        else (0.7 * coalesce(1 - (f.embedding <-> tv.v), 0)
              + 0.3 * public._genre_affinity(auth.uid(), c.genre_ids))::numeric
      end as score
    from public.catalog_titles c
    cross join platforms pl
    cross join taste tv
    left join public.catalog_features f
      on f.tmdb_id = c.tmdb_id and f.media_type = c.media_type
    where (pl.p is null or c.platforms_flatrate && pl.p)
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
           order by (cf.embedding <-> r.emb) asc
           limit 2
         ) x),
         array[]::text[]
            )
    ) as explanation
  from candidates c
  order by c.score desc, c.popularity desc, c.media_type asc, c.tmdb_id asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0)
$$;
revoke all on function public.recommend(text[], int, int, text[]) from anon, public;
grant execute on function public.recommend(text[], int, int, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- predict_tenths(): nota IA para un título, calibrada en décimas 10..50
-- (mismo contrato que predictTenths del cliente).
--   - Con >= 20 valoraciones: predicción = media_del_usuario*10 +
--     slope * (score(título) - media_score_valorados) * 10, donde slope es
--     la pendiente de la regresión simple (1 predictor: score de contenido)
--     sobre sus valoraciones más recientes (tope 200). Sin señal de
--     contenido suficiente → la media del usuario.
--   - Con < 20: prior del título (media ponderada por votos, shrinkage).
--   - Siempre acotado a [10, 50] y redondeado a décima.
-- SECURITY INVOKER: solo ve las valoraciones del propio usuario.
-- ---------------------------------------------------------------------------
create function public.predict_tenths(p_media_type text, p_tmdb_id int)
returns smallint
language plpgsql stable
security invoker
as $$
declare
  v_uid uuid := auth.uid();
  v_n int;
  v_mean numeric;
  v_cov numeric;
  v_var numeric;
  v_slope numeric;
  v_score_t numeric;
  v_mean_score numeric;
  v_pred numeric;
begin
  if v_uid is null then raise exception 'not-authenticated'; end if;

  select count(*), coalesce(avg(user_rating), 0)
    into v_n, v_mean
    from public.history_entries
    where user_id = v_uid;

  -- Menos de 20 valoraciones: prior del título (D2-2.3).
  if v_n < 20 then
    return greatest(10, least(50, round(coalesce(public._prior_tenths(p_media_type, p_tmdb_id), 30))));
  end if;

  -- Pendiente de la regresión simple sobre (score, nota) de las
  -- valoraciones recientes del usuario.
  select covar_samp(r2.score, r2.r), var_samp(r2.score)
    into v_cov, v_var
    from (
      select h.user_rating as r,
             0.7 * coalesce(1 - (f.embedding <-> public._user_taste_vector(v_uid)), 0)
               + 0.3 * public._genre_affinity(v_uid, c.genre_ids) as score
      from public.history_entries h
      left join public.catalog_features f
        on f.tmdb_id = h.media_id and f.media_type = h.media_type
      left join public.catalog_titles c
        on c.tmdb_id = h.media_id and c.media_type = h.media_type
      where h.user_id = v_uid and f.embedding is not null
      order by h.rated_at desc
      limit 200
    ) r2;

  -- score del candidato y media de los scores valorados (mismo score).
  select
    0.7 * coalesce(1 - (f.embedding <-> public._user_taste_vector(v_uid)), 0)
      + 0.3 * public._genre_affinity(v_uid, c.genre_ids),
    (select coalesce(avg(x.score), 0)
     from (
       select 0.7 * coalesce(1 - (f2.embedding <-> public._user_taste_vector(v_uid)), 0)
                + 0.3 * public._genre_affinity(v_uid, c2.genre_ids) as score
       from public.history_entries h2
       left join public.catalog_features f2
         on f2.tmdb_id = h2.media_id and f2.media_type = h2.media_type
       left join public.catalog_titles c2
         on c2.tmdb_id = h2.media_id and c2.media_type = h2.media_type
       where h2.user_id = v_uid and f2.embedding is not null
       order by h2.rated_at desc
       limit 200
     ) x)
    into v_score_t, v_mean_score
    from public.catalog_titles c
    left join public.catalog_features f
      on f.tmdb_id = c.tmdb_id and f.media_type = c.media_type
    where c.media_type = p_media_type and c.tmdb_id = p_tmdb_id;

  if v_cov is null or coalesce(v_var, 0) < 1e-9 then
    v_pred := v_mean * 10;  -- sin varianza de score: la media del usuario
  else
    v_slope := v_cov / v_var;
    v_pred := v_mean * 10 + v_slope * (v_score_t - v_mean_score) * 10;
  end if;

  return greatest(10, least(50, round(v_pred)));
end
$$;
revoke all on function public.predict_tenths(text, int) from public, anon;
grant execute on function public.predict_tenths(text, int) to authenticated;
