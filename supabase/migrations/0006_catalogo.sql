-- Diana 0006: catálogo completo de España (VERTICE-PLAN-2, D2-1.2).
-- ESCRITA, NO DESPLEGADA: la aplica el dueño en Supabase > SQL Editor (o con
-- `supabase db push` tras `supabase migration repair`).
--
-- Requiere extensiones activadas (Supabase > Database > Extensions, paso 2 del
-- dueño): pg_trgm, unaccent. (vector llega en 0008 para el recomendador.)
-- Los `create extension if not exists` son idempotentes: si el dueño ya las
-- activó en la UI, no pasa nada; si el SQL Editor no tiene permiso para crear
-- extensiones, que se active solo en la UI y se repita esta migración.
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ---------------------------------------------------------------------------
-- catalog_titles: uno por título de TMDB presente en España.
-- Lo escribe SOLO la Edge Function catalog-sync (service_role); el cliente solo
-- lee (RLS). Los `platforms_*` guardan los ids ESTABLES de Diana
-- (src/constants/providers.ts), no ids de TMDB: la app ya los entiende.
-- ---------------------------------------------------------------------------
create table public.catalog_titles (
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null default '',
  original_title text not null default '',
  year int,                                              -- año de estreno/emisión (para décadas)
  overview text not null default '',
  genre_ids int[] not null default '{}',
  vote_average numeric(3, 1) not null default 0,
  vote_count int not null default 0,
  popularity double precision not null default 0,
  runtime int,                                           -- minutos (null en series: se toma episode_run_time)
  poster_path text,
  backdrop_path text,
  original_language text,
  platforms_flatrate text[] not null default '{}',       -- suscripción (ids de providers.ts)
  platforms_rent text[] not null default '{}',
  platforms_buy text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (media_type, tmdb_id)
);

-- Índices de consulta del cliente (browse):
--  - disponibilidad en una plataforma: «cs.» (contained-by) sobre los arrays
--  - género: «cs.» sobre genre_ids
--  - década: rango sobre year
--  - orden: popularity / vote_average / año
create index catalog_titles_flatrate_gin on public.catalog_titles using gin (platforms_flatrate);
create index catalog_titles_rent_gin on public.catalog_titles using gin (platforms_rent);
create index catalog_titles_buy_gin on public.catalog_titles using gin (platforms_buy);
create index catalog_titles_genres_gin on public.catalog_titles using gin (genre_ids);
create index catalog_titles_year_idx on public.catalog_titles (year);
create index catalog_titles_popularity_idx on public.catalog_titles (popularity desc);
create index catalog_titles_vote_idx on public.catalog_titles (vote_average desc, vote_count desc);

-- Búsqueda: full-text en español (tsvector generado) + trigramas para fuzzy.
-- PostgREST permite filtrar la columna tsvector con
--   title_tsv=websearch_query:'termino'
-- y sobre title con  title=%termino  (pg_trgm) sin RPC.
alter table public.catalog_titles
  add column title_tsv tsvector
  generated always as (to_tsvector('spanish', coalesce(title, ''))) stored;

create index catalog_titles_tsv_idx on public.catalog_titles using gin (title_tsv);
create index catalog_titles_title_trgm_idx on public.catalog_titles using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- catalog_sync_state: progreso de la sincronización, una fila por
-- (proveedor, tipo, monetización). Hace la sync REANUDABLE: cada ejecución
-- procesa un presupuesto de páginas/tiempo y continúa desde last_page.
-- Lo escribe SOLO la Edge Function (service_role); el cliente no lo ve.
-- ---------------------------------------------------------------------------
create table public.catalog_sync_state (
  provider text not null,                                 -- id de providers.ts
  media_type text not null check (media_type in ('movie', 'tv')),
  monetization text not null default 'flatrate'
    check (monetization in ('flatrate', 'rent', 'buy')),
  range_key text not null default '',                     -- ventana «AAAA-AAAA» (o 'delta'); '' = todo
  last_page int not null default 0,
  last_total int,                                         -- total_results de TMDB (para verify-catalog)
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'error')),
  last_error text,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (provider, media_type, monetization, range_key)
);

-- ---------------------------------------------------------------------------
-- RLS: el catálogo es PÚBLICO (solo lectura) para anon y authenticated.
-- Sin escritura desde el cliente: solo service_role (la Edge Function) escribe,
-- y service_role ignora RLS por diseño de Supabase.
-- ---------------------------------------------------------------------------
alter table public.catalog_titles enable row level security;

create policy "catalog_titles public read (anon)"
  on public.catalog_titles for select to anon using (true);

create policy "catalog_titles public read (authenticated)"
  on public.catalog_titles for select to authenticated using (true);

grant select on public.catalog_titles to anon, authenticated;
revoke insert, update, delete on public.catalog_titles from anon, authenticated, public;

-- catalog_sync_state: invisible para el cliente (sin políticas = denegado),
-- sin privilegios Postgres para los roles de app.
alter table public.catalog_sync_state enable row level security;
revoke all on public.catalog_sync_state from anon, authenticated, public;
