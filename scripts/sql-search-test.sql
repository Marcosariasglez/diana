-- Diana · Test LOCAL de la migración 0025 (RPC search_titles). SOLO el
-- contenedor de pruebas; NO se aplica en producción. Cada assert lanza una
-- excepción si cae (ON_ERROR_STOP está activo en el runner).
\set ON_ERROR_STOP on

-- Datos sintéticos (insertados como postgres: el cliente no puede escribir).
insert into public.catalog_titles
  (tmdb_id, media_type, title, original_title, year, genre_ids, popularity, vote_average, vote_count,
   platforms_flatrate, directors, cast_top)
values
  (1, 'movie', 'Dune: Parte dos', 'Dune: Part Two', 2024, '{878,12}', 90, 8.3, 900, '{max}',
     '{"Denis Villeneuve"}', '{"Timothée Chalamet","Zendaya"}'),
  (2, 'movie', 'La llegada', 'Arrival', 2016, '{878,18}', 70, 7.9, 800, '{netflix}',
     '{"Denis Villeneuve"}', '{"Amy Adams"}'),
  (3, 'movie', 'Incendies', 'Incendies', 2010, '{18}', 40, 8.3, 500, '{filmin}',
     '{"Denis Villeneuve"}', '{"Lubna Azabal"}'),
  (4, 'movie', 'Dune', 'Dune', 1984, '{878}', 20, 6.3, 400, '{}',
     '{"David Lynch"}', '{"Kyle MacLachlan"}'),
  (5, 'movie', 'Sicario', 'Sicario', 2015, '{53,80}', 60, 7.6, 700, '{netflix}',
     '{"Denis Villeneuve"}', '{"Emily Blunt"}'),
  (6, 'movie', 'Anatomía de una caída', 'Anatomie d''une chute', 2023, '{18,80}', 50, 7.7, 600, '{max}',
     '{"Justine Triet"}', '{"Sandra Hüller"}'),
  (7, 'tv', 'Dune: La profecía', 'Dune: Prophecy', 2024, '{878}', 10, 7.0, 100, '{max}', '{}', '{}'),
  (8, 'movie', '', 'Sin título', 2000, '{18}', 99, 5.0, 10, '{netflix}', '{"Denis Villeneuve"}', '{}'),
  (9, 'movie', 'Amélie', 'Le Fabuleux Destin d''Amélie Poulain', 2001, '{35,10749}', 55, 7.9, 650, '{filmin}',
     '{"Jean-Pierre Jeunet"}', '{"Audrey Tautou"}'),
  (10, 'movie', 'Lobo 100%', 'Wolf 100', 2020, '{16}', 5, 6.0, 50, '{}', '{}', '{}'),
  (11, 'movie', 'Lobo 1000', 'Wolf 1000', 2020, '{16}', 4, 6.0, 50, '{}', '{}', '{}'),
  (12, 'movie', 'A_B', 'A_B', 2019, '{18}', 3, 6.0, 50, '{}', '{}', '{}'),
  (13, 'movie', 'AxB', 'AxB', 2019, '{18}', 2, 6.0, 50, '{}', '{}', '{}');
-- Un título sin créditos rellenados (directors/cast_top NULL: migración de créditos tardía).
insert into public.catalog_titles (tmdb_id, media_type, title, year, popularity, directors, cast_top)
values (14, 'movie', 'Sin créditos', 2005, 1, null, null);

do $$
declare
  r int[];
begin
  -- 1 · Director: «villeneuve» encuentra sus 4 títulos y NO el de título vacío ni el de Lynch.
  r := array(select tmdb_id from public.search_titles('villeneuve'));
  if not (r @> '{1,2,3,5}') or cardinality(r) <> 4 then
    raise exception 'assert-1: villeneuve → % (esperado {1,2,3,5})', r;
  end if;

  -- 2 · Reparto: «zendaya» y «blunt».
  r := array(select tmdb_id from public.search_titles('zendaya'));
  if r <> '{1}' then raise exception 'assert-2a: zendaya → %', r; end if;
  r := array(select tmdb_id from public.search_titles('blunt'));
  if r <> '{5}' then raise exception 'assert-2b: blunt → %', r; end if;

  -- 3 · Relevancia: título exacto primero, luego prefijo por popularidad.
  r := array(select tmdb_id from public.search_titles('dune'));
  if r <> '{4,1,7}' then raise exception 'assert-3: dune → % (esperado {4,1,7})', r; end if;

  -- 4 · Sin tildes y sin mayúsculas, en título y en créditos.
  r := array(select tmdb_id from public.search_titles('ANATOMIA'));
  if r <> '{6}' then raise exception 'assert-4a: ANATOMIA → %', r; end if;
  r := array(select tmdb_id from public.search_titles('anatomía'));
  if r <> '{6}' then raise exception 'assert-4b: anatomía → %', r; end if;
  r := array(select tmdb_id from public.search_titles('amelie'));
  if r <> '{9}' then raise exception 'assert-4c: amelie → %', r; end if;
  r := array(select tmdb_id from public.search_titles('timothee'));
  if r <> '{1}' then raise exception 'assert-4d: timothee → %', r; end if;
  r := array(select tmdb_id from public.search_titles('hüller'));
  if r <> '{6}' then raise exception 'assert-4e: hüller → %', r; end if;

  -- 5 · Parcial (mientras se escribe).
  r := array(select tmdb_id from public.search_titles('villen'));
  if r <> '{}' and not (r @> '{1}') then raise exception 'assert-5a: villen → %', r; end if;
  r := array(select tmdb_id from public.search_titles('villeneu'));
  if cardinality(r) <> 4 then raise exception 'assert-5b: villeneu → %', r; end if;

  -- 6 · Los comodines de LIKE se tratan como texto literal.
  r := array(select tmdb_id from public.search_titles('100%'));
  if r <> '{10}' then raise exception 'assert-6a: 100%% → %', r; end if;
  r := array(select tmdb_id from public.search_titles('a_b'));
  if r <> '{12}' then raise exception 'assert-6b: a_b → %', r; end if;

  -- 7 · Texto vacío o solo espacios → nada. Filas sin título nunca salen.
  if exists (select 1 from public.search_titles('')) then raise exception 'assert-7a: vacío devuelve filas'; end if;
  if exists (select 1 from public.search_titles('   ')) then raise exception 'assert-7b: espacios devuelve filas'; end if;
  if exists (select 1 from public.search_titles('sin titulo') where tmdb_id = 8) then
    raise exception 'assert-7c: salió una fila con título vacío';
  end if;

  -- 8 · Filtros.
  r := array(select tmdb_id from public.search_titles('villeneuve', p_genres => '{878}'));
  if not (r @> '{1,2}') or cardinality(r) <> 2 then raise exception 'assert-8a: género 878 → %', r; end if;
  r := array(select tmdb_id from public.search_titles('villeneuve', p_decade => 2010));
  if not (r @> '{2,3,5}') or cardinality(r) <> 3 then raise exception 'assert-8b: década 2010 → %', r; end if;
  r := array(select tmdb_id from public.search_titles('dune', p_type => 'tv'));
  if r <> '{7}' then raise exception 'assert-8c: tipo tv → %', r; end if;
  r := array(select tmdb_id from public.search_titles('villeneuve', p_platforms => '{netflix}'));
  if not (r @> '{2,5}') or cardinality(r) <> 2 then raise exception 'assert-8d: netflix → %', r; end if;
  r := array(select tmdb_id from public.search_titles('villeneuve', '{netflix,filmin}', '{18}', 2010, 'movie'));
  if r <> '{2,3}' and r <> '{3,2}' then raise exception 'assert-8e: combinados → %', r; end if;
  -- Arrays vacíos = sin filtro.
  r := array(select tmdb_id from public.search_titles('villeneuve', p_genres => '{}', p_platforms => '{}'));
  if cardinality(r) <> 4 then raise exception 'assert-8f: arrays vacíos filtran → %', r; end if;

  -- 9 · Orden explícito (mismo nivel de relevancia: todos son coincidencia de director).
  r := array(select tmdb_id from public.search_titles('villeneuve', p_sort => 'year'));
  if r <> '{1,2,5,3}' then raise exception 'assert-9a: sort year → %', r; end if;
  r := array(select tmdb_id from public.search_titles('villeneuve', p_sort => 'title'));
  if r <> '{1,3,2,5}' then raise exception 'assert-9b: sort title → %', r; end if;
  r := array(select tmdb_id from public.search_titles('villeneuve', p_sort => 'vote'));
  if r <> '{1,3,2,5}' and r <> '{3,1,2,5}' then raise exception 'assert-9c: sort vote → %', r; end if;
  r := array(select tmdb_id from public.search_titles('villeneuve'));
  if r <> '{1,2,5,3}' then raise exception 'assert-9d: popularidad por defecto → %', r; end if;

  -- 10 · Paginación sin solapes y límites acotados.
  r := array(select tmdb_id from public.search_titles('villeneuve', p_limit => 2, p_offset => 0))
    || array(select tmdb_id from public.search_titles('villeneuve', p_limit => 2, p_offset => 2));
  if r <> '{1,2,5,3}' then raise exception 'assert-10a: páginas → %', r; end if;
  if (select count(*) from public.search_titles('villeneuve', p_limit => 0)) <> 1 then
    raise exception 'assert-10b: limit 0 debería acotarse a 1';
  end if;
  if (select count(*) from public.search_titles('villeneuve', p_offset => -5)) <> 4 then
    raise exception 'assert-10c: offset negativo debería acotarse a 0';
  end if;
  -- total_count: nº total antes de paginar, igual en todas las filas y con los filtros aplicados.
  if exists (select 1 from public.search_titles('villeneuve', p_limit => 2) where total_count <> 4) then
    raise exception 'assert-10d: total_count de villeneuve debería ser 4 en cada fila';
  end if;
  if (select total_count from public.search_titles('villeneuve', p_limit => 1, p_offset => 3)) <> 4 then
    raise exception 'assert-10e: total_count en la última página';
  end if;
  if (select total_count from public.search_titles('villeneuve', p_genres => '{878}', p_limit => 1)) <> 2 then
    raise exception 'assert-10f: total_count debe respetar los filtros';
  end if;
  if exists (select 1 from public.search_titles('villeneuve', p_offset => 10)) then
    raise exception 'assert-10g: offset más allá del final debería dar 0 filas';
  end if;

  -- 11 · Créditos NULL no rompen la búsqueda por título.
  r := array(select tmdb_id from public.search_titles('creditos'));
  if r <> '{14}' then raise exception 'assert-11: creditos → %', r; end if;
end
$$;

-- 12 · Permisos: anon y authenticated pueden buscar; nadie escribe el catálogo.
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from public.search_titles('dune');
  if n <> 3 then raise exception 'assert-12a: anon ve % filas (esperado 3)', n; end if;
  reset role;
  set local role authenticated;
  select count(*) into n from public.search_titles('villeneuve');
  if n <> 4 then raise exception 'assert-12b: authenticated ve % filas (esperado 4)', n; end if;
  begin
    insert into public.catalog_titles (tmdb_id, media_type, title) values (999, 'movie', 'x');
    raise exception 'assert-12c: authenticated no debería poder insertar';
  exception when insufficient_privilege then
    null;
  end;
  reset role;
end
$$;

-- 13 · Los índices de búsqueda existen y se pueden usar (EXPLAIN con seqscan desactivado).
do $$
declare plan text; line text;
begin
  set local enable_seqscan = off;
  for line in explain select tmdb_id from public.catalog_titles
    where public.catalog_norm(title) like '%dune%' loop
    plan := coalesce(plan, '') || line || E'\n';
  end loop;
  if plan not like '%catalog_titles_title_norm_trgm_idx%' then
    raise exception 'assert-13a: el índice trigram de título no se usa:%', E'\n' || plan;
  end if;
  plan := null;
  for line in explain select tmdb_id from public.catalog_titles
    where public.catalog_credits_text(directors, cast_top) like '%villeneuve%' loop
    plan := coalesce(plan, '') || line || E'\n';
  end loop;
  if plan not like '%catalog_titles_credits_trgm_idx%' then
    raise exception 'assert-13b: el índice trigram de créditos no se usa:%', E'\n' || plan;
  end if;
end
$$;

select 'OK 0025: search_titles verificada (' || count(*) || ' filas sintéticas)' as resultado from public.catalog_titles;
