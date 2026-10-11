-- Diana 0014: el pase de features salta los «stubs» del catálogo.
--
-- Hallazgo (producción, 2026-10-11): catalog-sync había dejado ~6.000
-- «stubs» (title='' y year NULL y sin plataformas, ~15 % de los 39.616).
-- El backfill de features (anti-join `popularity desc`) los procesaba
-- PRIMERO (su popularity es la que traía TMDB, a veces la más alta) y
-- generaba embeddings de solo metadatos para títulos inexistentes:
--   1. Gastaba el presupuesto del backfill en filas inútiles (con 290
--      features hechas, 0 estaban en los top 2.000 del dump de evaluación).
--   2. Su texto de embedding era solo «Title. Year 0…» (sin trama) → señal
--      cero para el recomendador.
--
-- Fix: `features_candidates` y `features_remaining` solo cuentan títulos con
-- `title` no vacía (los que de verdad existen y pueden recomendarse). El
-- anti-join contra `catalog_features` se mantiene (reanudable + incremental).
--
-- MIGRACIÓN FORWARD (no reabrir 0011): mismas firmas, `create or replace`.

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
  where c.title is not null and c.title <> ''   -- sin stubs (ver cabecera)
    and not exists (
      select 1 from public.catalog_features f
      where f.tmdb_id = c.tmdb_id and f.media_type = c.media_type
    )
  order by c.popularity desc, c.media_type asc, c.tmdb_id asc
  limit greatest(coalesce(p_limit, 100), 1)
$$;

create or replace function public.features_remaining()
returns int
language sql stable
security invoker
set search_path = public
as $$
  select count(*)::int
  from public.catalog_titles c
  where c.title is not null and c.title <> ''
    and not exists (
      select 1 from public.catalog_features f
      where f.tmdb_id = c.tmdb_id and f.media_type = c.media_type
    )
$$;

-- Mismos permisos que 0011 (create or replace los conserva).
