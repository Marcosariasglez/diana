-- Diana 0022: añade columna primary_media_type a catalog_titles para diferenciar
-- películas, series, cortos y documentales (Problema 2 del plan fix-prioridades).
--
-- La columna permite incluir cortos y documentales en el catálogo (que hasta
-- ahora solo filtraba 'movie' y 'tv'). El valor por defecto es 'movie' para
-- compatibilidad con filas existentes.

alter table public.catalog_titles
  add column if not exists primary_media_type text
  default 'movie'
  check (primary_media_type in ('movie', 'tv', 'short', 'documentary'));

-- Para filas ya existentes, se puede rellamar con un backfill basado en la
-- sinopsis o metadatos, pero inicialmente 'movie' es suficientemente preciso
-- porque el catálogo solo tenia movies y series (media_type='tv' → 'tv').

-- Ajusta el default para series existentes: las filas con media_type='tv'
-- deberían tener primary_media_type='tv' también.
update public.catalog_titles
  set primary_media_type = 'tv'
  where primary_media_type = 'movie'
    and media_type = 'tv';
