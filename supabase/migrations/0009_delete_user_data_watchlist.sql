-- Diana 0009: delete_user_data con el borrado de «Quiero ver» (VERTICE-PLAN-2, D2-3).
--
-- MIGRACIÓN FORWARD (no editar 0005): en las bases donde 0005 ya se aplicó,
-- la función sigue teniendo el cuerpo ANTIGUO (sin el borrado de watchlist)
-- y el borrado local de una cuenta (delete-account con everywhere=false)
-- dejaba filas huérfanas en public.watchlist (el cascade de auth.users no
-- se ejecuta: solo se toca con everywhere=true). Se re-crea la función con
-- `create or replace`: idempotente y seguro sobre ambas versiones.
--
-- Mismo cuerpo que el 0005 editado (para despliegues nuevos donde 0005 aún
-- no se había aplicado), con los mismos permisos: security definer +
-- REVOKE a todos (solo se invoca con service_role desde la Edge Function).

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
