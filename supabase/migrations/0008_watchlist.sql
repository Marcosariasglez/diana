-- Diana 0008: «Quiero ver» (VERTICE-PLAN-2, D2-3).
-- Lista personal de títulos por ver: alta/baja desde la ficha y las tarjetas.
--
-- Diseño:
--   - Solo lo mínimo del plan (usuario, tipo, id, fecha, notas): el título,
--     año y plataformas se resuelven en el cliente contra catalog_titles
--     (cambia con cada sincronización; duplicarlo aquí solo crearía
--     desincronización).
--   - PK (user_id, media_type, media_id): un título por usuario; reañadir tras
--     quitar usa upsert on conflict (la fila se reescribe con el nuevo added_at).
--   - RLS «solo lo tuyo» (mismo patrón que watched/history_entries, 0002):
--     for all to authenticated, user_id = auth.uid() en using y with check.
--     No hay lectura para anon (no es catálogo público).
--   - El borrado del usuario lo cubre delete_user_data (0005, ampliada):
--     `delete from public.watchlist where user_id = ...`.
--
-- Sin desplegar: como 0006/0007, se aplica a mano en el SQL Editor.

create table public.watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  media_id int not null,
  notes text not null default '',
  added_at timestamptz not null default now(),
  primary key (user_id, media_type, media_id)
);

create index watchlist_user_added_idx on public.watchlist (user_id, added_at desc);

alter table public.watchlist enable row level security;

create policy watchlist_own on public.watchlist
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
