-- Diana · Test de ESCALA de recommend() (reproduce la producción: ~33.000
-- candidatos con embedding + 208 valoraciones con embedding) y cronometra la
-- llamada real con EXPLAIN ANALYZE. NO es una migración: solo datos de prueba
-- + un EXPLAIN. Se corre DENTRO del contenedor (ver sql-recommend-scale.mjs)
-- tras aplicar TODAS las migraciones (estado actual de producción).
\set ON_ERROR_STOP on
select set_config('search_path', current_setting('search_path') || ', extensions', false);

-- Role autenticado para RLS (mismo patrón que sql-recommend-test.sql).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'auth_test') then
    create role auth_test login noreplication;
  end if;
end
$$;
grant authenticated to auth_test;

-- ---------------------------------------------------------------------------
-- Datos a escala de producción.
-- ---------------------------------------------------------------------------
do $$
declare
  v_uid uuid := '44444444-4444-4444-4444-444444444444';
  i int;
  v_emb text;
begin
  insert into auth.users (id, email) values (v_uid, 'scale@example.com')
  on conflict (id) do nothing;

  -- Vector de 384 dims, construido UNA vez y reutilizado (barato).
  v_emb := ('[0.1,0.1' || (select string_agg(',0', '') from generate_series(1, 381)) || ',0]');

  -- 208 valoraciones del usuario (con feature/embedding → vector de gusto y
  -- explicación con 208 candidatos delta>0: el caso MÁS caro).
  for i in 1..208 loop
    insert into public.catalog_titles
      (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
    values (100000 + i, 'movie', 'Histo ' || i, 2015, '{18}', 6.5, 200, 10, '{netflix}')
    on conflict (media_type, tmdb_id) do nothing;
    insert into public.catalog_features (tmdb_id, media_type, keywords, director, cast_names, embedding)
    values (100000 + i, 'movie', '{drama}', 'D', '{A}', (v_emb::text)::vector)
    on conflict (media_type, tmdb_id) do nothing;
    insert into public.history_entries
      (user_id, key, media_type, media_id, title, genre_ids, user_rating, ai_prediction_tenths)
    values (v_uid, 'movie:' || (100000 + i), 'movie', 100000 + i, 'Histo ' || i, '{18}', 4.5, 40)
    on conflict (user_id, key) do nothing;
  end loop;

  -- 33.000 candidatos con feature/embedding en netflix (la escala de la base
  -- real: 39.616 títulos, 33.653 con title no vacío).
  for i in 1..33000 loop
    insert into public.catalog_titles
      (tmdb_id, media_type, title, year, genre_ids, vote_average, vote_count, popularity, platforms_flatrate)
    values (200000 + i, 'movie', 'Cand ' || i, 2015 + (i % 10), '{18,35}', 6.5, 200, 5 + (i % 50), '{netflix}')
    on conflict (media_type, tmdb_id) do nothing;
    insert into public.catalog_features (tmdb_id, media_type, keywords, director, cast_names, embedding)
    values (200000 + i, 'movie', '{drama}', 'D', '{A}', (v_emb::text)::vector)
    on conflict (media_type, tmdb_id) do nothing;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- La llamada REAL, como usuario autenticado (RLS real), EXIGIENDO que
-- responda en <5 s (el statement timeout de PostgREST en producción). Si no,
-- el DO falla (ON_ERROR_STOP). Después, EXPLAIN ANALYZE para el plan.
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  set role auth_test;
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
  perform set_config('statement_timeout', '5000', true);
  select count(*) into n from public.recommend('{netflix}'::text[], 50, 0, null);
  if n <> 50 then
    raise exception 'ESCALA: recommend no devolvió 50 en <5 s (devolvió %)', n;
  end if;
  reset role;
end
$$;

set role auth_test;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
explain (analyze, buffers, timing)
select * from public.recommend('{netflix}'::text[], 50, 0, null);
reset role;
