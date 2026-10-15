-- 0024_catalog_credits.sql — P16 (F5-2a): columnas de créditos en catalog_titles
--
-- Añade `directors` (text[]) y `cast_top` (text[], top 5 del reparto) a
-- catalog_titles. Ambas columnas permiten filtrar/buscar por director o actor
-- en la pantalla Explorar (P17).
--
-- Los valores se rellenan con el modo `credits` de catalog-backfill
-- (llama a TMDB /movie/{id}/credits y /tv/{id}/aggregate_credits).
--
-- Compatible con pg_trgm + GIN para búsquedas por nombre.

-- Columnas (default vacío, nullable para degradación si la migración llega tarde)
ALTER TABLE public.catalog_titles
  ADD COLUMN IF NOT EXISTS directors text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cast_top text[] DEFAULT '{}';

-- Comentarios
COMMENT ON COLUMN public.catalog_titles.directors IS
  'Nombres de directores (TMDB /movie/{id}/credits o /tv/{id}/aggregate_credits)';
COMMENT ON COLUMN public.catalog_titles.cast_top IS
  'Top 5 del reparto (cast.slice(0, 5) de TMDB credits)';

-- Índices GIN para búsquedas con =any() (intersección de arrays):
CREATE INDEX IF NOT EXISTS catalog_titles_directors_gin
  ON public.catalog_titles USING gin (directors);
CREATE INDEX IF NOT EXISTS catalog_titles_cast_top_gin
  ON public.catalog_titles USING gin (cast_top);

-- Si pg_trgm está disponible, también operador de texto parcial:
-- (no es obligatorio; las búsquedas exactas =any() ya son rápidas con GIN)
