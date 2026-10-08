-- Diana 0005: borrado de datos de Diana (VERTICE Q2).
-- Borra SOLO los datos de la app Diana del usuario de `p_target_user_id`, en
-- orden de dependencias (FK cascade haría el trabajo de las hijas, pero se
-- explicita para que quede claro y no dependa del esquema).
-- La identidad de Supabase Auth (auth.users) NO se toca: la borra la Edge
-- Function `delete-account` con service_role solo cuando recibe
-- { everywhere: true }.
--
-- Seguridad: security definer (necesita borrar filas de tablas con RLS),
-- pero REVOKE a todo el mundo: solo se llama con service_role desde la
-- Edge Function (allí se valida el JWT del usuario). Ni anon ni
-- authenticated pueden invocar este RPC.

create or replace function public.delete_user_data(p_target_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_target_user_id is null then
    raise exception 'bad-input';
  end if;

  -- Orden por dependencias (hijas primero).
  delete from public.room_decisions
    where code in (select code from public.room_members where user_id = p_target_user_id);

  delete from public.room_members where user_id = p_target_user_id;

  -- Salas huérfanas: si ya no queda ningún miembro, se borra la sala.
  delete from public.rooms
    where not exists (select 1 from public.room_members m where m.code = public.rooms.code);

  delete from public.watched where user_id = p_target_user_id;
  delete from public.history_entries where user_id = p_target_user_id;
  delete from public.initial_ratings where user_id = p_target_user_id;
  delete from public.profiles where id = p_target_user_id;
end $$;

revoke execute on function public.delete_user_data(uuid) from public, anon, authenticated;
