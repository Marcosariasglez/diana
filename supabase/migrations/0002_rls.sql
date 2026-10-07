-- Diana 0002: seguridad por filas (RLS). OBLIGATORIO: la clave anon es publica.
-- Regla: los clientes SOLO leen las tablas de salas; todas las escrituras de salas van por RPC (0003).

alter table public.profiles enable row level security;
alter table public.initial_ratings enable row level security;
alter table public.history_entries enable row level security;
alter table public.watched enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_decisions enable row level security;
alter table public.tmdb_cache enable row level security;   -- sin politicas: solo service role
alter table public.api_hits enable row level security;     -- sin politicas: solo service role

-- Datos propios del usuario.
create policy profiles_own on public.profiles
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy initial_ratings_own on public.initial_ratings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy history_entries_own on public.history_entries
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy watched_own on public.watched
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Salas: lectura solo para miembros. Sin politicas de insert/update/delete: todo por RPC.
create function public.is_room_member(p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.room_members
    where code = p_code and user_id = auth.uid()
  );
$$;
revoke all on function public.is_room_member(text) from public;
grant execute on function public.is_room_member(text) to authenticated;

create policy rooms_member_read on public.rooms
  for select to authenticated using (public.is_room_member(code));
create policy room_members_member_read on public.room_members
  for select to authenticated using (public.is_room_member(code));
create policy room_decisions_member_read on public.room_decisions
  for select to authenticated using (public.is_room_member(code));
