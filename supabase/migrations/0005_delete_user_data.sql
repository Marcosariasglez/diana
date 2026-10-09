-- Diana 0005: borrado de datos de Diana (VERTICE Q2).
-- Borra SOLO los datos de la app Diana del usuario de `p_target_user_id`, en
-- orden de dependencias (FK cascade haría el trabajo de las hijas, pero se
-- explicita para que quede claro y no dependa del esquema).
-- El alcance de las salas está RESTRINGIDO a las salas en las que participaba
-- este usuario (miembro o anfitrión): nunca se borran salas huérfanas de
-- otras personas.
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
declare
  -- Salas en las que participa el usuario (miembro o anfitrión), calculadas
  -- ANTES de borrar sus filas de room_members: delimitan todo el borrado.
  v_room_codes text[];
begin
  if p_target_user_id is null then
    raise exception 'bad-input';
  end if;

  select array_agg(distinct s.code) into v_room_codes
    from (
      select code from public.room_members where user_id = p_target_user_id
      union
      select code from public.rooms where host_id = p_target_user_id
    ) s;

  -- Orden por dependencias (hijas primero), solo en SUS salas.
  delete from public.room_decisions
    where code = any(coalesce(v_room_codes, '{}'));

  delete from public.room_members where user_id = p_target_user_id;

  -- Salas huérfanas: solo de SUS salas, y solo si ya no queda ningún miembro.
  delete from public.rooms
    where code = any(coalesce(v_room_codes, '{}'))
      and not exists (select 1 from public.room_members m where m.code = public.rooms.code);

  delete from public.watched where user_id = p_target_user_id;
  delete from public.history_entries where user_id = p_target_user_id;
  delete from public.initial_ratings where user_id = p_target_user_id;

  -- D2-3: «Quiero ver» (tabla de la migración 0008). Si 0008 aún no se
  -- aplicó (orden de despliegue a mano del dueño), no debe fallar el resto
  -- del borrado: se ignora solo la tabla inexistente.
  begin
    delete from public.watchlist where user_id = p_target_user_id;
  exception when undefined_table then
    null;
  end;

  delete from public.profiles where id = p_target_user_id;
end $$;

revoke execute on function public.delete_user_data(uuid) from public, anon, authenticated;
