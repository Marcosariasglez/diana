-- 0026_catalog_credits_checked.sql — marca de «créditos ya consultados».
--
-- ESCRITA, NO DESPLEGADA: la aplica el dueño en Supabase > SQL Editor.
-- Requiere 0024 (directors, cast_top).
--
-- El modo `credits` de catalog-backfill rellena directors/cast_top desde TMDB.
-- Antes elegía las filas con `directors` vacío, pero hay títulos que nunca
-- tendrán director en TMDB (series, cortos…): se re-consultaban en cada
-- llamada y el relleno no avanzaba. Esta columna recuerda que el título ya se
-- consultó (haya devuelto créditos o no); NULL = pendiente.
alter table public.catalog_titles
  add column if not exists credits_checked_at timestamptz;

comment on column public.catalog_titles.credits_checked_at is
  'Cuándo se consultaron los créditos de TMDB (catalog-backfill, modo credits). NULL = pendiente.';

-- Lo que ya tiene créditos no hace falta volver a pedirlo.
update public.catalog_titles
set credits_checked_at = now()
where credits_checked_at is null
  and (cardinality(directors) > 0 or cardinality(cast_top) > 0);

-- La cola de pendientes es lo único que se consulta por esta columna.
create index if not exists catalog_titles_credits_pending_idx
  on public.catalog_titles (media_type, tmdb_id)
  where credits_checked_at is null;
