-- 0025_search_titles.sql — Rediseño Explorar (P3): búsqueda unificada.
--
-- ESCRITA, NO DESPLEGADA: la aplica el dueño en Supabase > SQL Editor.
-- Requiere 0006 (catalog_titles, pg_trgm, unaccent) y 0024 (directors, cast_top).
--
-- Un único RPC para el buscador de Explorar: el texto se busca a la vez en
--   · título y título original (sin tildes ni mayúsculas, parcial mientras se escribe),
--   · full-text en español sobre el título (title_tsv, de 0006),
--   · directores y reparto principal (0024),
-- y se combina con los filtros de la pantalla (plataformas, géneros, década,
-- tipo) y el orden elegido. Sin texto no se usa: Explorar llama a browse.
--
-- Relevancia (siempre primero, el orden elegido solo desempata dentro de cada nivel):
--   0 título exacto · 1 empieza por el texto · 2 lo contiene · 3 full-text ·
--   4 director · 5 reparto
--
-- Si esta migración no está desplegada, el cliente degrada a la búsqueda
-- PostgREST por título (postgrest.repository.ts) y solo pierde director/actor.

-- Los operadores de pg_trgm y unaccent pueden estar en `public` o en `extensions`
-- según cómo se activaran (ver 0007): se ven los dos.
select set_config('search_path', 'public, extensions', false);

-- ---------------------------------------------------------------------------
-- Normalización: minúsculas y sin tildes. `unaccent` es STABLE, así que no se
-- puede usar en un índice; estos envoltorios son IMMUTABLE (el diccionario de
-- unaccent no cambia en la vida de la base).
-- ---------------------------------------------------------------------------
create or replace function public.catalog_norm(text)
returns text
language sql immutable parallel safe strict
set search_path = public, extensions
as $$
  select lower(unaccent($1))
$$;

-- Directores + reparto en un único texto normalizado (NULL → vacío: 0024 deja
-- las columnas nullables para degradar si la migración llega tarde).
create or replace function public.catalog_credits_text(directors text[], cast_top text[])
returns text
language sql immutable parallel safe
set search_path = public, extensions
as $$
  select lower(unaccent(
    coalesce(array_to_string(directors, ' | '), '') || ' | ' || coalesce(array_to_string(cast_top, ' | '), '')
  ))
$$;

-- Texto del usuario → patrón seguro para LIKE: normalizado y con \ % _ escapados,
-- para que «100%» o «a_b» se busquen literalmente.
create or replace function public.catalog_like_escape(text)
returns text
language sql immutable parallel safe strict
set search_path = public, extensions
as $$
  select replace(replace(replace(lower(unaccent(btrim($1))), '\', '\\'), '%', '\%'), '_', '\_')
$$;

-- Índices trigram sobre los textos normalizados (aceleran LIKE '%…%').
create index if not exists catalog_titles_title_norm_trgm_idx
  on public.catalog_titles using gin (public.catalog_norm(title) gin_trgm_ops);
create index if not exists catalog_titles_otitle_norm_trgm_idx
  on public.catalog_titles using gin (public.catalog_norm(original_title) gin_trgm_ops);
create index if not exists catalog_titles_credits_trgm_idx
  on public.catalog_titles using gin (public.catalog_credits_text(directors, cast_top) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- search_titles
--   p_query      texto libre (vacío → sin resultados)
--   p_platforms  ids de providers.ts; el título debe estar en ALGUNA, en cualquier modalidad
--   p_genres     ids TMDB; el título debe tener AL MENOS UNO
--   p_decade     1990 → [1990, 1999]
--   p_type       'movie' | 'tv' (| 'short' | 'documentary')
--   p_sort       'popularity' (defecto) | 'vote' | 'year' | 'title'
--   p_offset     filas a saltar (cursor de paginación); negativo → 0
--   p_limit      tamaño de página, acotado a [1, 100]
-- Arrays NULL o vacíos = sin filtro. Las filas sin título nunca se devuelven.
-- Devuelve las mismas columnas que el cliente lee de catalog_titles (COLUMNS)
-- más `total_count`: nº de títulos que cumplen el filtro ANTES de paginar (el
-- mismo en todas las filas). Con p_limit = 1 sirve como «contar» sin bajar datos.
-- ---------------------------------------------------------------------------
create or replace function public.search_titles(
  p_query text,
  p_platforms text[] default null,
  p_genres int[] default null,
  p_decade int default null,
  p_type text default null,
  p_sort text default 'popularity',
  p_offset int default 0,
  p_limit int default 20
)
returns table (
  tmdb_id int,
  media_type text,
  title text,
  original_title text,
  year int,
  overview text,
  genre_ids int[],
  vote_average numeric,
  vote_count int,
  popularity double precision,
  runtime int,
  poster_path text,
  backdrop_path text,
  original_language text,
  platforms_flatrate text[],
  platforms_rent text[],
  platforms_buy text[],
  total_count bigint
)
language sql stable
security invoker
set search_path = public, extensions
as $$
  select c.tmdb_id, c.media_type, c.title, c.original_title, c.year, c.overview, c.genre_ids,
         c.vote_average, c.vote_count, c.popularity, c.runtime, c.poster_path, c.backdrop_path,
         c.original_language, c.platforms_flatrate, c.platforms_rent, c.platforms_buy,
         count(*) over () as total_count
  from public.catalog_titles c
  where public.catalog_norm(btrim(coalesce(p_query, ''))) <> ''
    and c.title <> ''
    and (
      public.catalog_norm(c.title) like '%' || public.catalog_like_escape(p_query) || '%'
      or public.catalog_norm(c.original_title) like '%' || public.catalog_like_escape(p_query) || '%'
      or public.catalog_credits_text(c.directors, c.cast_top) like '%' || public.catalog_like_escape(p_query) || '%'
      or c.title_tsv @@ websearch_to_tsquery('spanish', p_query)
    )
    and (p_type is null or c.media_type = p_type)
    and (p_genres is null or cardinality(p_genres) = 0 or c.genre_ids && p_genres)
    and (p_decade is null or c.year between (p_decade / 10) * 10 and (p_decade / 10) * 10 + 9)
    and (
      p_platforms is null or cardinality(p_platforms) = 0
      or c.platforms_flatrate && p_platforms
      or c.platforms_rent && p_platforms
      or c.platforms_buy && p_platforms
    )
  order by
    case
      when public.catalog_norm(c.title) = public.catalog_norm(btrim(p_query))
        or public.catalog_norm(c.original_title) = public.catalog_norm(btrim(p_query)) then 0
      when public.catalog_norm(c.title) like public.catalog_like_escape(p_query) || '%'
        or public.catalog_norm(c.original_title) like public.catalog_like_escape(p_query) || '%' then 1
      when public.catalog_norm(c.title) like '%' || public.catalog_like_escape(p_query) || '%'
        or public.catalog_norm(c.original_title) like '%' || public.catalog_like_escape(p_query) || '%' then 2
      when c.title_tsv @@ websearch_to_tsquery('spanish', p_query) then 3
      when public.catalog_norm(coalesce(array_to_string(c.directors, ' | '), ''))
        like '%' || public.catalog_like_escape(p_query) || '%' then 4
      else 5
    end,
    case when p_sort = 'vote' then c.vote_average end desc nulls last,
    case when p_sort = 'vote' then c.vote_count end desc nulls last,
    case when p_sort = 'year' then c.year end desc nulls last,
    case when p_sort = 'title' then c.title end asc,
    c.popularity desc,
    c.media_type asc,
    c.tmdb_id asc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
$$;

comment on function public.search_titles(text, text[], int[], int, text, text, int, int) is
  'Búsqueda unificada de Explorar: título, título original, full-text, director y reparto, con filtros de plataforma/género/década/tipo y orden. Rediseño Inicio/Explorar P3.';

-- Solo la usa la app (anon antes de iniciar sesión, authenticated después).
revoke all on function public.search_titles(text, text[], int[], int, text, text, int, int) from public;
grant execute on function public.search_titles(text, text[], int[], int, text, text, int, int) to anon, authenticated;
