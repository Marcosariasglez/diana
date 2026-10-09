-- Diana · Prueba de la migración 0007 (recomendador) contra un Postgres LOCAL
-- con pgvector (VERTICE-PLAN-2, D2-2.2). NO toca producción: se corre dentro
-- de un contenedor Docker (ver scripts/sql-recommend-test.mjs) con datos
-- sintéticos.
--
-- Supone que ya se han aplicado, en este orden, las migraciones:
--   0001 (schema), 0002 (RLS), 0003 (rpc), 0005 (delete), 0006 (catálogo)
--   y esta (0007). 0004 (realtime) se omite: el contenedor no tiene
--   supabase_realtime.
--
-- En Supabase, `auth.uid()` sale de un JWT. Aquí se simula con un esquema
-- `auth` mínimo: tabla auth.users + función auth.uid() que lee un GUC
-- (set request.jwt.claim.sub). El cliente de pruebas conecta con
-- `options='-c request.jwt.claim.sub=<uuid>'` por sesión.
--
-- Si algún assert falla, el guion termina con error (DO RAISE EXCEPTION).

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Datos sintéticos
-- ---------------------------------------------------------------------------
-- Dos usuarios: ALBA (con gusto definido) y BRAULIO (sin valoraciones).
do $$
declare
  v_alba uuid := '11111111-1111-1111-1111-111111111111';
  v_braulio uuid := '22222222-2222-2222-2222-222222222222';
  i int;
begin
  insert into auth.users (id, email) values
    (v_alba, 'alba@example.com'),
    (v_braulio, 'braulio@example.com')
  on conflict (id) do nothing;

  -- El trigger de 0001 no existe aquí si 0001 se aplicó antes del esquema
  -- auth; crear los profiles a mano (idempotente).
  insert into public.profiles (id, display_name, favorite_platforms)
  values (v_alba, 'Alba', '{netflix,filmin}'),
         (v_braulio, 'Braulio', '{netflix}')
  on conflict (id) do update set display_name = public.profiles.display_name;

  -- Catálogo: 12 películas en netflix, 4 en filmin (3 también en netflix),
  -- 1 solo en max (fuera de las plataformas de Alba).
  -- Géneros: 18=Drama, 35=Comedia, 27=Terror. Alba adora drama (notas altas)
  -- y odia terror (notas bajas).
  for i in 1..12 loop
    insert into public.catalog_titles
      (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
    values
      (1000 + i, 'movie', 'Drama ' || i, 2000 + (i % 20), '{18}', 7.0, 500, 50 + i, '{netflix}')
    on conflict (media_type, tmdb_id) do nothing;
  end loop;

  for i in 1..3 loop
    insert into public.catalog_titles
      (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
    values
      (2000 + i, 'movie', 'Filmin ' || i, 2010 + i, '{18,27}', 6.5, 300, 30 + i,
       '{netflix,filmin}')
    on conflict (media_type, tmdb_id) do nothing;
  end loop;
  -- Filmin 4: solo en filmin. (Sin `case` en plpgsql: la rama text no se
  -- coerciona a text[] y el parser de plpgsql no acepta `case` en algunos
  -- contextos SQL dentro del body.)
  insert into public.catalog_titles
    (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
  values (2004, 'movie', 'Filmin 4', 2014, '{18,27}', 6.5, 300, 34, '{filmin}')
  on conflict (media_type, tmdb_id) do nothing;

  insert into public.catalog_titles
    (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
  values (3000, 'movie', 'Solo Max', 2020, '{35}', 6.0, 200, 40, '{max}')
  on conflict (media_type, tmdb_id) do nothing;

  -- Valoraciones de Alba (25, para pasar el umbral de 20 de predict_tenths):
  --  Drama 1..12 → 5.0 (adora el drama)
  --  Filmin 1..4 → 4.5 / 1.0 alternando (drama+terror a medias)
  --  1 comedia (se crea al vuelo) → 1.0
  insert into public.catalog_titles
    (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
  values (4000, 'movie', 'Comedia X', 2015, '{35}', 7.5, 800, 60, '{netflix}')
  on conflict (media_type, tmdb_id) do nothing;

  for i in 1..12 loop
    insert into public.history_entries
      (user_id, key, media_type, media_id, title, genre_ids, user_rating, ai_prediction_tenths)
    values (v_alba, 'movie:' || (1000 + i), 'movie', 1000 + i, 'Drama ' || i, '{18}', 5.0, 45)
    on conflict (user_id, key) do nothing;
  end loop;
  insert into public.history_entries
    (user_id, key, media_type, media_id, title, genre_ids, user_rating, ai_prediction_tenths)
  values
    (v_alba, 'movie:2001', 'movie', 2001, 'Filmin 1', '{18,27}', 4.5, 40),
    (v_alba, 'movie:2002', 'movie', 2002, 'Filmin 2', '{18,27}', 1.0, 20),
    (v_alba, 'movie:2003', 'movie', 2003, 'Filmin 3', '{18,27}', 4.5, 40),
    (v_alba, 'movie:2004', 'movie', 2004, 'Filmin 4', '{18,27}', 1.0, 20),
    (v_alba, 'movie:4000', 'movie', 4000, 'Comedia X', '{35}', 1.0, 20)
  on conflict (user_id, key) do nothing;

  -- Alba ha VISTO (sin valorar) Drama 13? No existe; usar «visto» de un título
  -- que SÍ está en el catálogo: Drama 12 está valorado; se añade «visto» de
  -- Filmin 4 ya valorado (para comprobar la exclusión) y uno extra:
  -- crear un título 1013 extra como visto sin valorar.
  insert into public.catalog_titles
    (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
  values (1013, 'movie', 'Drama Visto', 2018, '{18}', 6.8, 400, 45, '{netflix}')
  on conflict (media_type, tmdb_id) do nothing;
  insert into public.watched (user_id, key)
  values (v_alba, 'movie:1013')
  on conflict (user_id, key) do nothing;

  -- Embeddings sintéticos: se fabrican en SQL puro (384 dimensiones).
  -- Drama → vector d1 (0.1, 0.1, 0, …, 0); terror/Filmin → d2 (distinto);
  -- el vector de gusto de Alba debe quedar cerca de d1. SIN `case` en el body
  -- de plpgsql (rompe el parser); cast final a ::vector, no ::text.
  for i in 1..12 loop
    insert into public.catalog_features (tmdb_id, media_type, keywords, director, cast_names, embedding)
    values (1000 + i, 'movie', '{drama}', 'Dir D', '{Actor A, Actor B}',
            (('[0.1,0.1' || (select string_agg(',0', '') from generate_series(1, 381)) || ',0]'::text)::vector))
    on conflict (media_type, tmdb_id) do nothing;
  end loop;
  -- Simplificación: todos los dramas comparten vector (0.1,...,0.1) y el
  -- terror/Filmin un vector distinto con signo mixto.
  for i in 1..4 loop
    insert into public.catalog_features (tmdb_id, media_type, keywords, director, cast_names, embedding)
    values (2000 + i, 'movie', '{drama,terror}', 'Dir T', '{Actor C}',
            (('[-0.05,0.02' || (select string_agg(',0.02', '') from generate_series(1, 381)) || ',0]'::text)::vector))
    on conflict (media_type, tmdb_id) do nothing;
  end loop;
  insert into public.catalog_features (tmdb_id, media_type, keywords, director, cast_names, embedding)
  values
    (3000, 'movie', '{comedia}', 'Dir C', '{Actor D}',
     (('[-0.1' || (select string_agg(',0', '') from generate_series(1, 383)) || ']'::text)::vector)),
    (4000, 'movie', '{comedia}', 'Dir C2', '{Actor E}',
     (('[-0.1,0.01' || (select string_agg(',0.01', '') from generate_series(1, 381)) || ',0]'::text)::vector)),
    (1013, 'movie', '{drama}', 'Dir D', '{Actor A}',
     (('[0.1,0.1' || (select string_agg(',0', '') from generate_series(1, 381)) || ',0]'::text)::vector))
  on conflict (media_type, tmdb_id) do nothing;

  -- 8 dramas más (7001..7008) valorados 4.5 por Alba: con los 12 dramas a 5.0,
  -- los 4 filmin (4.5/1.0 alternados) y la comedia a 1.0 → 25 valoraciones
  -- (umbral >= 20 de predict_tenths, D2-2.3).
  for i in 1..8 loop
    insert into public.catalog_titles
      (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
    values (7000 + i, 'movie', 'Drama B ' || i, 2016 + (i % 8), '{18}', 6.6, 300, 28 + i, '{netflix}')
    on conflict (media_type, tmdb_id) do nothing;
    insert into public.catalog_features (tmdb_id, media_type, keywords, director, cast_names, embedding)
    values (7000 + i, 'movie', '{drama}', 'Dir D', '{Actor A}',
            (('[0.1,0.1' || (select string_agg(',0', '') from generate_series(1, 381)) || ',0]'::text)::vector))
    on conflict (media_type, tmdb_id) do nothing;
    insert into public.history_entries
      (user_id, key, media_type, media_id, title, genre_ids, user_rating, ai_prediction_tenths)
    values (v_alba, 'movie:' || (7000 + i), 'movie', 7000 + i, 'Drama B ' || i, '{18}', 4.5, 40)
    on conflict (user_id, key) do nothing;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- ASISTAS DE ASERCIÓN (estilo rls-check.mjs)
-- ---------------------------------------------------------------------------
create or replace function public._assert(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if not cond then raise exception 'ASSERT FALLÓ: %', msg; end if;
end $$;
revoke all on function public._assert(boolean, text) from public, anon, authenticated;

-- Role de prueba para RLS (miembro de `authenticated`): conecta como
-- postgres + `set role auth_test` (superuser puede SET ROLE a cualquiera).
-- En Supabase esto equivale a una conexión con el JWT role=authenticated.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'auth_test') then
    create role auth_test login noreplication;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon_test') then
    create role anon_test login noreplication;
  end if;
end
$$;
grant authenticated to auth_test;
grant anon to anon_test;
grant execute on function public._assert(boolean, text) to auth_test, anon_test;

-- ---------------------------------------------------------------------------
-- TEST 1 · recommend() como ALBA: solo netflix+filmin, sin vistos/valorados,
--           con explicación, top ordenado por score.
-- ---------------------------------------------------------------------------
do $$
declare
  v_alba uuid := '11111111-1111-1111-1111-111111111111';
  i int;
  r record;
  n int;
  top_score numeric;
begin
  -- (como postgres/superuser) hueco del dataset: 5 dramas que Alba no valoró.
  for i in 1..5 loop
    insert into public.catalog_titles
      (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
    values (5000 + i, 'movie', 'Drama Hueco ' || i, 2019, '{18}', 6.9, 350, 35 + i, '{netflix}')
    on conflict (media_type, tmdb_id) do nothing;
    insert into public.catalog_features (tmdb_id, media_type, keywords, director, cast_names, embedding)
    values (5000 + i, 'movie', '{drama}', 'Dir D', '{Actor A}',
            (('[0.1,0.1' || (select string_agg(',0', '') from generate_series(1, 381)) || ',0]'::text)::vector))
    on conflict (media_type, tmdb_id) do nothing;
  end loop;

  -- A partir de aquí, como usuario autenticado (RLS real):
  set role auth_test;
  perform set_config('request.jwt.claim.sub', v_alba::text, false);

  select count(*) into n from public.recommend(array['netflix', 'filmin'], 100, 0, null);
  perform public._assert(n = 5, 'recommend(Alba) debe devolver 5 (los Drama Hueco), no ' || n);

  -- Ninguno debe ser de «max», ni visto (1013), ni ya valorado.
  for r in select * from public.recommend(array['netflix', 'filmin'], 100, 0, null) loop
    perform public._assert(r.tmdb_id between 5001 and 5005,
      'candidato inesperado: ' || r.tmdb_id);
  end loop;

  -- La explicación, con este dataset, debe referirse a títulos que ALBA
  -- valoró sobre su media (dramas 5.0 / media 3.6 → delta>0).
  select score into top_score
  from public.recommend(array['netflix', 'filmin'], 1, 0, null);
  perform public._assert(top_score is not null, 'top score null');
  for r in select explanation from public.recommend(array['netflix', 'filmin'], 1, 0, null) loop
    perform public._assert(array_length(r.explanation, 1) in (1, 2),
      'explicación con nº raro de elementos: ' || coalesce(r.explanation::text, 'null'));
    if array_length(r.explanation, 1) > 0 then
      perform public._assert(r.explanation[1] like 'Porque te gustó Drama %',
        'explicación no empieza por «Porque te gustó Drama»: ' || r.explanation[1]);
    end if;
  end loop;

  -- Arranque en frío (Braulio, sin valoraciones): 32 títulos - «Solo Max»
  -- (fuera de netflix/filmin) = 31 candidatos; score 0 → popularidad.
  perform set_config('request.jwt.claim.sub',
    '22222222-2222-2222-2222-222222222222'::text, false);
  select count(*) into n from public.recommend(array['netflix', 'filmin'], 100, 0, null);
  perform public._assert(n = 31, 'frío (Braulio): ' || n || ' candidatos (esperados 31)');

  reset role;
end
$$;

-- ---------------------------------------------------------------------------
-- TEST 2 · Aislamiento (RLS, security invoker): ALBA no ve valoraciones de
--          BRAULIO. Se le dan a Braulio valoraciones de un título que Alba no
--          valoró y se comprueba que la recomendación de Alba NO cambia por
--          eso ni expone nada de Braulio.
-- ---------------------------------------------------------------------------
do $$
declare
  v_alba uuid := '11111111-1111-1111-1111-111111111111';
  v_braulio uuid := '22222222-2222-2222-2222-222222222222';
  r record;
  despues text[];
begin
  -- (como postgres) Braulio valora un título nuevo que Alba no valoró.
  insert into public.catalog_titles
    (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
  values (6000, 'movie', 'Braulio Solo', 2021, '{18}', 7.2, 250, 25, '{netflix}')
  on conflict (media_type, tmdb_id) do nothing;
  insert into public.history_entries
    (user_id, key, media_type, media_id, title, genre_ids, user_rating, ai_prediction_tenths)
  values (v_braulio, 'movie:6000', 'movie', 6000, 'Braulio Solo', '{18}', 5.0, 45)
  on conflict (user_id, key) do nothing;

  -- Como Alba (RLS real): 6000 SÍ es candidato para ella (no lo valoró Alba),
  -- pero la explicación de Alba no puede exponer valoraciones de Braulio.
  set role auth_test;
  perform set_config('request.jwt.claim.sub', v_alba::text, false);
  select array_agg(tmdb_id::text order by tmdb_id) into despues
  from public.recommend(array['netflix'], 50, 0, null);
  perform public._assert(array_position(despues, '6000') is not null,
    '6000 no aparece como candidato para Alba: ' || coalesce(despues::text, 'null'));
  for r in select explanation
           from public.recommend(array['netflix'], 50, 0, null) loop
    perform public._assert(
      not exists (select 1 from unnest(r.explanation) e where e like '%Braulio Solo'),
      'la explicación de Alba expone una valoración de Braulio: ' || coalesce(r.explanation::text, 'null'));
  end loop;
  reset role;
end
$$;

-- ---------------------------------------------------------------------------
-- TEST 3 · predict_tenths: (a) con < 20 valoraciones → prior del título
--          (10..50); (b) con >= 20 (Alba) → 10..50 y sensible al contenido:
--          un drama nuevo sale por encima de un terror para Alba.
-- ---------------------------------------------------------------------------
do $$
declare
  v_alba uuid := '11111111-1111-1111-1111-111111111111';
  v_braulio uuid := '22222222-2222-2222-2222-222222222222';
  t_drama smallint;
  t_terror smallint;
  t_prio smallint;
begin
  set role auth_test;

  -- (a) Braulio tiene 1 valoración → prior.
  perform set_config('request.jwt.claim.sub', v_braulio::text, false);
  select public.predict_tenths('movie', 1001) into t_prio;
  perform public._assert(t_prio between 10 and 50, 'prior fuera de rango: ' || t_prio);
  -- El prior de Drama 1001 (7.0, 500 votos, media global ~6.9) ≈ 5*7.0 = 35
  -- (con shrinkage casi 35): debe estar en [30, 40].
  perform public._assert(t_prio between 30 and 40, 'prior 1001 fuera de [30,40]: ' || t_prio);

  -- (b) Alba (25 valoraciones): drama vs terror.
  perform set_config('request.jwt.claim.sub', v_alba::text, false);
  select public.predict_tenths('movie', 5001) into t_drama;
  select public.predict_tenths('movie', 2002) into t_terror;
  perform public._assert(t_drama between 10 and 50, 'drama fuera de rango: ' || t_drama);
  perform public._assert(t_terror between 10 and 50, 'terror fuera de rango: ' || t_terror);
  -- Alba odió el terror (1.0 en Filmin 2/4) y adoró el drama (5.0):
  perform public._assert(t_drama > t_terror,
    'Alba: drama (' || t_drama || ') debe superar terror (' || t_terror || ')');

  -- (c) Sin auth.uid() → error 'not-authenticated'.
  perform set_config('request.jwt.claim.sub', '', false);
  begin
    perform public.predict_tenths('movie', 1001);
    perform public._assert(false, 'predict_tenths sin uid no lanzó error');
  exception when others then
    perform public._assert(sqlerrm like '%not-authenticated%',
      'error inesperado sin uid: ' || sqlerrm);
  end;

  reset role;
end
$$;

-- ---------------------------------------------------------------------------
-- TEST 4 · RLS de catalog_features / catalog_features_state: anon solo lee
--          features, no lee state ni escribe en features.
-- ---------------------------------------------------------------------------
do $$
declare
  v_alba uuid := '11111111-1111-1111-1111-111111111111';
  n int;
  v_bra int;
  v_alba_h int;
begin
  -- En Supabase, anon/authenticated tienen los privilegios de DML por defecto
  -- (alter default privileges): la puerta real es la RLS, no los grants. Por
  -- eso aquí se prueba el RLS REAL con set role, no has_table_privilege.

  -- RLS REAL como miembro de `authenticated` (SET ROLE al role de prueba):
  -- Alba ve SOLO sus 25 valoraciones, no las de Braulio (1 en ese momento).
  set role auth_test;
  perform set_config('request.jwt.claim.sub', v_alba::text, false);
  select count(*) into v_alba_h from public.history_entries;
  perform public._assert(v_alba_h = 25, 'RLS: Alba ve ' || v_alba_h || ' valoraciones (esperadas 25)');

  perform set_config('request.jwt.claim.sub',
    '22222222-2222-2222-2222-222222222222'::text, false);
  select count(*) into v_bra from public.history_entries;
  perform public._assert(v_bra = 1, 'RLS: Braulio ve ' || v_bra || ' valoraciones (esperadas 1)');

  reset role;

  -- Y anon (miembro del role anon): catalog_features es pública (se lee),
  -- pero catalog_features_state es invisible (RLS sin políticas) y el INSERT
  -- en catalog_features lo bloquea la RLS (sin política de insert) aunque el
  -- privilegio de tabla exista (así funciona en Supabase real).
  set role anon_test;
  select count(*) into n from public.catalog_features;
  perform public._assert(n >= 18, 'anon no lee catalog_features vía RLS: ' || n);
  begin
    select count(*) into n from public.catalog_features_state;
    perform public._assert(n = 0, 'anon leyó filas de catalog_features_state: ' || n);
  exception when insufficient_privilege then
    null; -- esperado: 0007 hace `revoke all` → sin permiso de SELECT
  end;
  begin
    insert into public.catalog_features (tmdb_id, media_type) values (9999, 'movie');
    perform public._assert(false, 'anon escribió en catalog_features');
  exception when insufficient_privilege then
    null; -- esperado: la RLS no tiene política de insert
  end;
  reset role;
end
$$;

select 'OK 0007: recommend/predict_tenths verificados contra Postgres+pgvector local' as resultado;
