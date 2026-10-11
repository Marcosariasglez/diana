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

-- El tipo `vector` (y sus operadores) vive en el schema `extensions` (0007
-- crea la extensión ahí, como en Supabase). Esta sesión de pruebas conecta
-- con el search_path por defecto (sin `extensions`), así que lo apéndalo:
-- afecta solo a esta sesión, no a nada global.
select set_config('search_path', current_setting('search_path') || ', extensions', false);

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

-- ---------------------------------------------------------------------------
-- TEST 5 · 0012: afinidad de sala (create_room + confirm_mood por banco).
-- ---------------------------------------------------------------------------
do $$
declare
  v_alba uuid := '11111111-1111-1111-1111-111111111111';
  v_code text;
  v_affinity text;
begin
  set role auth_test;
  perform set_config('request.jwt.claim.sub', v_alba::text, false);

  -- (a) Sala exprés: se confirma con sus 2 preguntas (con la 0003 fallaría:
  --     confirm_mood exigía siempre las 4 fijas).
  v_code := public.create_room('Alba', 'express');
  select affinity into v_affinity from public.rooms where code = v_code;
  perform public._assert(v_affinity = 'express', '0012: affinity no se guardó: ' || v_affinity);
  perform public.start_match(v_code);
  perform public.set_mood_answer(v_code, 'time', 'h2');
  perform public.set_mood_answer(v_code, 'energy', 'calm');
  perform public.confirm_mood(v_code, '[{"mediaType":"movie","mediaId":1001}]'::jsonb);
  select phase into v_affinity from public.rooms where code = v_code;
  perform public._assert(v_affinity = 'swipe', '0012: sala exprés no se confirmó con 2 respuestas (phase ' || v_affinity || ')');

  -- (b) Sala cinéfilo: exige 6; con 4 → mood-incomplete; con 6 → OK.
  v_code := public.create_room('Alba C', 'cinefilo');
  perform public.start_match(v_code);
  perform public.set_mood_answer(v_code, 'time', 'h2');
  perform public.set_mood_answer(v_code, 'energy', 'intense');
  perform public.set_mood_answer(v_code, 'company', 'friends');
  perform public.set_mood_answer(v_code, 'platforms', 'netflix');
  begin
    perform public.confirm_mood(v_code, '[]'::jsonb);
    perform public._assert(false, '0012: sala cinéfilo se confirmó sin era/pace');
  exception when raise_exception then
    null; -- esperado: mood-incomplete
  end;
  perform public.set_mood_answer(v_code, 'era', 'classic');
  perform public.set_mood_answer(v_code, 'pace', 'fast');
  perform public.confirm_mood(v_code, '[]'::jsonb);
  select phase into v_affinity from public.rooms where code = v_code;
  perform public._assert(v_affinity = 'swipe', '0012: sala cinéfilo no se confirmó con 6 respuestas (phase ' || v_affinity || ')');

  -- (c) Llamada LEGADA de 1 argumento (clientes ya desplegados) → intermedio.
  v_code := public.create_room('Legacy');
  select affinity into v_affinity from public.rooms where code = v_code;
  perform public._assert(v_affinity = 'intermedio', '0012: create_room de 1 arg no crea intermedio: ' || v_affinity);

  -- (d) Afinidad inválida → bad-input.
  begin
    perform public.create_room('Mala', 'turbo');
    perform public._assert(false, '0012: se aceptó una afinidad inválida');
  exception when raise_exception then
    null; -- esperado
  end;

  reset role;
end
$$;

-- ---------------------------------------------------------------------------
-- TEST 6 · 0013: recommend no devuelve «stubs» (title='') y responde con
--          historial grande. (El stub entra en los candidatos por plataforma;
--          sin el filtro de 0013 aparecería en el feed.)
-- ---------------------------------------------------------------------------
do $$
declare
  v_alba uuid := '11111111-1111-1111-1111-111111111111';
  n int;
begin
  insert into public.catalog_titles
    (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
  values (8001, 'movie', '', null, '{18}', 7.0, 500, 999999, '{netflix}')
  on conflict (media_type, tmdb_id) do nothing;

  set role auth_test;
  perform set_config('request.jwt.claim.sub', v_alba::text, false);
  select count(*) into n from public.recommend('{netflix}'::text[], 50, 0, null);
  perform public._assert(n > 0, '0013: recommend no devolvió candidatos: ' || n);
  select count(*) into n
  from public.recommend('{netflix}'::text[], 50, 0, null) where tmdb_id = 8001;
  perform public._assert(n = 0, '0013: el stub (title vacío) aparece en el feed: ' || n);
  select count(*) into n
  from public.recommend('{netflix}'::text[], 50, 0, null) where coalesce(title, '') = '';
  perform public._assert(n = 0, '0013: hay filas del feed sin título: ' || n);
  reset role;
end
$$;

-- ---------------------------------------------------------------------------
-- TEST 7 · 0014: features_candidates/remaining saltan los stubs.
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
  v_manual int;
  v_found boolean;
begin
  insert into public.catalog_titles
    (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
  values (8002, 'movie', 'Película Real', 2019, '{35}', 6.0, 100, 50, '{netflix}')
  on conflict (media_type, tmdb_id) do nothing;

  -- El stub 8001 (title '', popularity 999999) ya existe por el TEST 6.
  -- (La función no usa auth.uid(): en Supabase la llama service_role; aquí
  -- corre como postgres, que tiene lectura sobre catalog_.*.)
  select exists (select 1 from public.features_candidates(10) where tmdb_id = 8002) into v_found;
  perform public._assert(v_found, '0014: features_candidates no devuelve el título real sin feature');
  select exists (select 1 from public.features_candidates(10) where tmdb_id = 8001) into v_found;
  perform public._assert(not v_found, '0014: features_candidates devuelve el stub (title vacío)');
  select public.features_remaining() into n;
  select count(*) into v_manual
  from public.catalog_titles c
  where c.title is not null and c.title <> ''
    and not exists (select 1 from public.catalog_features f
                    where f.tmdb_id = c.tmdb_id and f.media_type = c.media_type);
  perform public._assert(n = v_manual, '0014: features_remaining ' || n || ' != ' || v_manual || ' (títulos reales sin feature)');
end
$$;

-- ---------------------------------------------------------------------------
-- TEST 8 · 0015: seen CTE — la semántica de exclusión se mantiene (un
--          episodio visto excluye la serie entera; una película vista
--          excluye la película) y el orden no cambia.
-- ---------------------------------------------------------------------------
do $$
declare
  v_alba uuid := '11111111-1111-1111-1111-111111111111';
  n int;
begin
  -- Títulos de prueba (con plataformas, para que entren en el feed):
  -- 9001 'Serie V' (tv) con un episodio visto por Alba → debe EXCLUIRSE.
  -- 9002 'Peli V' (movie) vista entera → debe EXCLUIRSE.
  -- 9003 'Peli N' (movie) sin ver → debe APLICAR.
  insert into public.catalog_titles
    (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
  values
    (9001, 'tv', 'Serie V', 2021, '{18}', 8.0, 1000, 70, '{netflix}'),
    (9002, 'movie', 'Peli V', 2021, '{18}', 8.0, 1000, 71, '{netflix}'),
    (9003, 'movie', 'Peli N', 2021, '{18}', 8.0, 1000, 72, '{netflix}')
  on conflict (media_type, tmdb_id) do nothing;

  insert into public.watched (user_id, key)
  values
    (v_alba, 'tv:9001:1:e2'),   -- un episodio de la serie
    (v_alba, 'movie:9002')      -- película vista entera
  on conflict (user_id, key) do nothing;

  set role auth_test;
  perform set_config('request.jwt.claim.sub', v_alba::text, false);
  select count(*) into n
  from public.recommend('{netflix}'::text[], 100, 0, null) where tmdb_id = 9001;
  perform public._assert(n = 0, '0015: la serie con un episodio visto SÍ aparece (esperado 0): ' || n);
  select count(*) into n
  from public.recommend('{netflix}'::text[], 100, 0, null) where tmdb_id = 9002;
  perform public._assert(n = 0, '0015: la película vista SÍ aparece (esperado 0): ' || n);
  select count(*) into n
  from public.recommend('{netflix}'::text[], 100, 0, null) where tmdb_id = 9003;
  perform public._assert(n = 1, '0015: la película no vista NO aparece (esperado 1): ' || n);
  reset role;
end
$$;

-- ---------------------------------------------------------------------------
-- TEST 9 · 0016 (escala): recommend() responde con un historial grande
--          (250 valoraciones con embedding) y ~2.000 candidatos, dentro del
--          statement timeout de PostgREST (5 s). Sin el top-N materializado
--          (0016), la explicación se corría por cada candidato y el timeout
--          saltaba (reproducido en producción: 208 valoraciones → error).
--          Con la 0020 este test cubre el camino ANN (el vector de gusto
--          deja de ser NULL); sin la 0020 corría el camino frío.
-- ---------------------------------------------------------------------------
do $$
declare
  v_carlos uuid := '33333333-3333-3333-3333-333333333333';
  i int;
  n int;
begin
  insert into auth.users (id, email) values (v_carlos, 'carlos@example.com')
  on conflict (id) do nothing;

  -- 250 títulos valorados por Carlos (con feature/embedding → el vector de
  -- gusto se calcula y la explicación tiene 250 candidatos delta>0: el
  -- caso MÁS caro).
  for i in 0..249 loop
    insert into public.catalog_titles
      (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
    values (10000 + i, 'movie', 'Visto ' || i, 2010 + (i % 15), '{18}', 6.5, 200, 10, '{netflix}')
    on conflict (media_type, tmdb_id) do nothing;
    insert into public.catalog_features (tmdb_id, media_type, keywords, director, cast_names, embedding)
    values (10000 + i, 'movie', '{drama}', 'Dir V', '{Actor V}',
            (('[0.1,0.1' || (select string_agg(',0', '') from generate_series(1, 381)) || ',0]'::text)::vector))
    on conflict (media_type, tmdb_id) do nothing;
    insert into public.history_entries
      (user_id, key, media_type, media_id, title, genre_ids, user_rating, ai_prediction_tenths)
    values (v_carlos, 'movie:' || (10000 + i), 'movie', 10000 + i, 'Visto ' || i, '{18}', 4.5, 40)
    on conflict (user_id, key) do nothing;
  end loop;

  -- ~2.000 candidatos no vistos (con feature/embedding): el CTE de
  -- candidatos es grande y cada fila sin el fix disparaba la explicación.
  for i in 0..1999 loop
    insert into public.catalog_titles
      (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
    values (20000 + i, 'movie', 'Candidato ' || i, 2015 + (i % 10), '{18,35}', 6.5, 200, 5 + (i % 50), '{netflix}')
    on conflict (media_type, tmdb_id) do nothing;
    insert into public.catalog_features (tmdb_id, media_type, keywords, director, cast_names, embedding)
    values (20000 + i, 'movie', '{drama}', 'Dir C', '{Actor C}',
            (('[0.08,0.1' || (select string_agg(',0', '') from generate_series(1, 381)) || ',0]'::text)::vector))
    on conflict (media_type, tmdb_id) do nothing;
  end loop;

  -- Como usuario autenticado, con el MISMO statement timeout que PostgREST
  -- (5 s en producción): si recommend no responde a tiempo, el DO falla.
  set role auth_test;
  perform set_config('request.jwt.claim.sub', v_carlos::text, false);
  perform set_config('statement_timeout', '5000', true);   -- local a la sesión
  select count(*) into n
  from public.recommend('{netflix}'::text[], 50, 0, null);
  perform public._assert(n = 50,
    '0016: recommend(250 valoraciones, 2.000 candidatos) no devolvió 50 en <5 s (devolvió ' || n || ')');
  reset role;
end
$$;

-- ---------------------------------------------------------------------------
-- TEST 10 · 0020: _user_taste_vector no es NULL para un usuario con mezcla de
--          notas sobre títulos con feature (regresión: la comprobación «vector
--          cero» de la 0007 era `l2(v, v) = 0`, SIEMPRE cierta → NULL para
--          todos los usuarios y la ruta de contenido estaba muerta; en
--          producción el backfill tenía 290 features con embedding no nulo
--          y el diagnóstico medió taste_ok=false para 208 valoraciones).
--          (b) Degenerado (todas las notas iguales → vector centrado = 0):
--          NULL de forma determinista. (c) Sin valoraciones: NULL.
-- ---------------------------------------------------------------------------
do $$
declare
  v_dani uuid := '44444444-5555-4444-4444-555555555555';
  v_elena uuid := '55555555-6666-4666-4666-666666666666';
  v_zero extensions.vector;
  v_dist numeric;
begin
  insert into auth.users (id, email) values
    (v_dani, 'dani@example.com'),
    (v_elena, 'elena@example.com')
  on conflict (id) do nothing;

  v_zero := ('[0' || (select string_agg(',0', '') from generate_series(1, 383)) || ']')::vector;

  -- Dani: 4 valoraciones CON feature, mezcladas (5.0, 5.0, 4.5, 1.0) → señal real.
  insert into public.catalog_titles
    (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
  values
    (8101, 'movie', 'Drama Mix 1', 2015, '{18}', 6.5, 100, 10, '{netflix}'),
    (8102, 'movie', 'Drama Mix 2', 2016, '{18}', 6.5, 100, 10, '{netflix}'),
    (8103, 'movie', 'Terror Mix', 2017, '{27}', 6.5, 100, 10, '{netflix}'),
    (8104, 'movie', 'Comedia Mix', 2018, '{35}', 6.5, 100, 10, '{netflix}')
  on conflict (media_type, tmdb_id) do nothing;
  insert into public.catalog_features (tmdb_id, media_type, keywords, director, cast_names, embedding)
  values
    (8101, 'movie', '{drama}', 'D', '{A}',
     ('[0.1,0.1' || (select string_agg(',0', '') from generate_series(1, 381)) || ',0]')::vector),
    (8102, 'movie', '{drama}', 'D', '{A}',
     ('[0.1,0.1' || (select string_agg(',0', '') from generate_series(1, 381)) || ',0]')::vector),
    (8103, 'movie', '{terror}', 'T', '{C}',
     ('[-0.05,0.02' || (select string_agg(',0.02', '') from generate_series(1, 381)) || ',0]')::vector),
    (8104, 'movie', '{comedia}', 'C', '{E}',
     ('[-0.1,0.01' || (select string_agg(',0.01', '') from generate_series(1, 381)) || ',0]')::vector)
  on conflict (media_type, tmdb_id) do nothing;
  insert into public.history_entries
    (user_id, key, media_type, media_id, title, genre_ids, user_rating, ai_prediction_tenths)
  values
    (v_dani, 'movie:8101', 'movie', 8101, 'Drama Mix 1', '{18}', 5.0, 45),
    (v_dani, 'movie:8102', 'movie', 8102, 'Drama Mix 2', '{18}', 5.0, 45),
    (v_dani, 'movie:8103', 'movie', 8103, 'Terror Mix', '{27}', 4.5, 40),
    (v_dani, 'movie:8104', 'movie', 8104, 'Comedia Mix', '{35}', 1.0, 20)
  on conflict (user_id, key) do nothing;

  -- Elena: 3 valoraciones CON feature, TODAS iguales (4.0) → vector centrado 0.
  insert into public.history_entries
    (user_id, key, media_type, media_id, title, genre_ids, user_rating, ai_prediction_tenths)
  values
    (v_elena, 'movie:8101', 'movie', 8101, 'Drama Mix 1', '{18}', 4.0, 40),
    (v_elena, 'movie:8102', 'movie', 8102, 'Drama Mix 2', '{18}', 4.0, 40),
    (v_elena, 'movie:8103', 'movie', 8103, 'Terror Mix', '{27}', 4.0, 40)
  on conflict (user_id, key) do nothing;

  set role auth_test;

  -- (a) Mezcla de notas → vector NO nulo y normalizado (distancia al 0 ≈ 1).
  perform set_config('request.jwt.claim.sub', v_dani::text, false);
  perform public._assert(
    public._user_taste_vector(v_dani) is not null,
    '0020: _user_taste_vector es NULL con mezcla de notas sobre títulos con feature '
      || '(regresión 0007: l2(v, v) = 0 era siempre cierta)');
  select extensions.l2_distance(public._user_taste_vector(v_dani), v_zero) into v_dist;
  perform public._assert(v_dist is not null and abs(v_dist - 1.0) < 1e-3,
    '0020: el vector de gusto no está normalizado (distancia al 0: ' || coalesce(v_dist::text, 'null') || ')');

  -- (b) Todas las notas iguales → vector centrado 0 → NULL determinista.
  perform set_config('request.jwt.claim.sub', v_elena::text, false);
  perform public._assert(
    public._user_taste_vector(v_elena) is null,
    '0020: _user_taste_vector no es NULL con todas las notas iguales (vector centrado 0)');

  -- (c) Sin valoraciones → NULL (arranque en frío, comportamiento previo).
  perform set_config('request.jwt.claim.sub',
    '22222222-2222-2222-2222-222222222222'::text, false);
  perform public._assert(
    public._user_taste_vector('22222222-2222-2222-2222-222222222222') is null,
    '0020: _user_taste_vector no es NULL para un usuario sin valoraciones');

  reset role;
end
$$;

select 'OK 0007+0012+0013+0014+0015+0016+0020: recommend/predict_tenths/afinidad/stubs/seen/top-N/vector-gusto verificados contra Postgres+pgvector local' as resultado;
