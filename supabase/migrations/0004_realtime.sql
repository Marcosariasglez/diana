-- Diana 0004: Realtime para salas. Las tres tablas emiten cambios (con RLS aplicada por suscriptor).
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.room_decisions;
