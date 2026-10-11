-- Diana 0011: RPCs de candidatos para el pase de features (VERTICE-PLAN-2, fase A).
-- NO reabre la 0007: añade solo funciones de SOLO LECTURA sobre
-- catalog_titles/catalog_features (ambas públicas con RLS de lectura para
-- authenticated). La Edge Function `catalog-features` las llama con service_role
-- (que ignora RLS); se dejan también ejecutables por authenticated para
-- comprobaciones locales.
--
-- features_candidates(p_limit): el ANTI-JOIN que hace el backfill REANUDABLE e
-- INCREMENTAL (A.3): los títulos sin feature, ordenados por popularity desc
-- (el feed gana calidad desde el primer lote; los títulos nuevos del delta
-- diario entran solos en la siguiente pasada, y los que quedaron en error se
-- reintentan).
-- features_remaining(): nº de títulos pendientes (lo usa la bomba para saber
-- cuándo parar: remaining = 0 → catálogo completo).

create or replace function public.features_candidates(p_limit int default 100)
returns table (
  tmdb_id int,
  media_type text,
  title text,
  original_title text,
  overview text,
  year int,
  original_language text,
  runtime int,
  genre_ids int[],
  popularity double precision
)
language sql stable
security invoker
set search_path = public
as $$
  select
    c.tmdb_id,
    c.media_type,
    c.title,
    c.original_title,
    c.overview,
    c.year,
    c.original_language,
    c.runtime,
    c.genre_ids,
    c.popularity
  from public.catalog_titles c
  where not exists (
    select 1 from public.catalog_features f
    where f.tmdb_id = c.tmdb_id and f.media_type = c.media_type
  )
  order by c.popularity desc, c.media_type asc, c.tmdb_id asc
  limit greatest(coalesce(p_limit, 100), 1)
$$;
revoke all on function public.features_candidates(int) from public, anon;
grant execute on function public.features_candidates(int) to authenticated;

create or replace function public.features_remaining()
returns int
language sql stable
security invoker
set search_path = public
as $$
  select count(*)::int
  from public.catalog_titles c
  where not exists (
    select 1 from public.catalog_features f
    where f.tmdb_id = c.tmdb_id and f.media_type = c.media_type
  )
$$;
revoke all on function public.features_remaining() from public, anon;
grant execute on function public.features_remaining() to authenticated;
