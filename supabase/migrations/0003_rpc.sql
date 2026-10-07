-- Diana 0003: funciones RPC de salas. Los errores son mensajes cortos que el cliente traduce:
--   'not-authenticated' | 'not-found' | 'full' | 'not-host' | 'wrong-phase' | 'mood-incomplete'
--   | 'bad-deck' | 'bad-input' | 'not-member'
-- Todas son security definer y solo ejecutables por usuarios autenticados.

-- Auxiliar interna: devuelve la sala bloqueada si el usuario es anfitrion.
create function public._require_host(p_code text) returns public.rooms
language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  if auth.uid() is null then raise exception 'not-authenticated'; end if;
  select * into r from public.rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'not-found'; end if;
  if r.host_id <> auth.uid() then raise exception 'not-host'; end if;
  return r;
end $$;
revoke all on function public._require_host(text) from public, anon, authenticated;

create function public.create_room(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_uid uuid := auth.uid();
  v_code text;
  v_try int := 0;
begin
  if v_uid is null then raise exception 'not-authenticated'; end if;
  loop
    v_code := '';
    for i in 1..4 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where code = v_code);
    v_try := v_try + 1;
    if v_try > 20 then raise exception 'bad-input'; end if;
  end loop;
  insert into public.rooms (code, host_id) values (v_code, v_uid);
  insert into public.room_members (code, user_id, name, is_ready)
  values (v_code, v_uid, left(coalesce(nullif(trim(p_name), ''), 'Anfitrión'), 40), true);
  return v_code;
end $$;

create function public.join_room(p_code text, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(p_code));
  r public.rooms;
  v_count int;
begin
  if v_uid is null then raise exception 'not-authenticated'; end if;
  select * into r from public.rooms where code = v_code for update;
  if not found then raise exception 'not-found'; end if;
  if exists (select 1 from public.room_members where code = v_code and user_id = v_uid) then
    return;                                            -- ya es miembro: idempotente
  end if;
  if r.phase <> 'lobby' then raise exception 'not-found'; end if;   -- sala ya empezada
  select count(*) into v_count from public.room_members where code = v_code;
  if v_count >= 6 then raise exception 'full'; end if;
  insert into public.room_members (code, user_id, name, is_ready)
  values (v_code, v_uid, left(coalesce(nullif(trim(p_name), ''), 'Invitado'), 40), false);
end $$;

create function public.set_ready(p_code text, p_ready boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not-authenticated'; end if;
  update public.room_members set is_ready = p_ready
  where code = upper(trim(p_code)) and user_id = auth.uid();
  if not found then raise exception 'not-member'; end if;
end $$;

create function public.leave_room(p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(p_code));
begin
  if v_uid is null then raise exception 'not-authenticated'; end if;
  delete from public.room_decisions where code = v_code and user_id = v_uid;
  delete from public.room_members where code = v_code and user_id = v_uid;
  if not exists (select 1 from public.room_members where code = v_code) then
    delete from public.rooms where code = v_code;
  elsif (select host_id from public.rooms where code = v_code) = v_uid then
    update public.rooms
    set host_id = (select user_id from public.room_members where code = v_code order by joined_at limit 1)
    where code = v_code;
  end if;
end $$;

create function public.start_match(p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  r := public._require_host(p_code);
  if r.phase <> 'lobby' then raise exception 'wrong-phase'; end if;
  delete from public.room_decisions where code = r.code;
  update public.rooms
  set phase = 'mood', mood = '{"answers":{},"confirmed":false}', deck = '[]'
  where code = r.code;
end $$;

create function public.set_mood_answer(p_code text, p_question text, p_answer text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  r := public._require_host(p_code);
  if r.phase <> 'mood' then raise exception 'wrong-phase'; end if;
  if p_question not in ('time', 'energy', 'company', 'platforms') then raise exception 'bad-input'; end if;
  if p_answer is null or length(trim(p_answer)) = 0 or length(p_answer) > 80 then raise exception 'bad-input'; end if;
  update public.rooms
  set mood = jsonb_set(
    mood, '{answers}',
    coalesce(mood->'answers', '{}'::jsonb) || jsonb_build_object(p_question, p_answer)
  )
  where code = r.code;
end $$;

-- El anfitrion calcula el mazo en su cliente y lo fija aqui: todos los miembros ven las mismas cartas.
create function public.confirm_mood(p_code text, p_deck jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms; q text;
begin
  r := public._require_host(p_code);
  if r.phase <> 'mood' then raise exception 'wrong-phase'; end if;
  foreach q in array array['time', 'energy', 'company', 'platforms'] loop
    if coalesce(r.mood->'answers'->>q, '') = '' then raise exception 'mood-incomplete'; end if;
  end loop;
  if jsonb_typeof(p_deck) <> 'array' or jsonb_array_length(p_deck) > 30 then raise exception 'bad-deck'; end if;
  update public.rooms
  set phase = 'swipe', deck = p_deck, mood = jsonb_set(mood, '{confirmed}', 'true'::jsonb)
  where code = r.code;
end $$;

create function public.submit_decision(p_code text, p_key text, p_decision text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(p_code));
  v_phase text;
begin
  if v_uid is null then raise exception 'not-authenticated'; end if;
  if not exists (select 1 from public.room_members where code = v_code and user_id = v_uid) then
    raise exception 'not-member';
  end if;
  select phase into v_phase from public.rooms where code = v_code;
  if v_phase <> 'swipe' then raise exception 'wrong-phase'; end if;
  if p_decision not in ('like', 'skip') or p_key !~ '^(movie|tv):[0-9]+$' then raise exception 'bad-input'; end if;
  insert into public.room_decisions (code, user_id, key, decision)
  values (v_code, v_uid, p_key, p_decision)
  on conflict (code, user_id, key) do update set decision = excluded.decision;
end $$;

create function public.back_to_lobby(p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  r := public._require_host(p_code);
  delete from public.room_decisions where code = r.code;
  update public.rooms
  set phase = 'lobby', mood = '{"answers":{},"confirmed":false}', deck = '[]'
  where code = r.code;
end $$;

-- Union de claves vistas de los miembros (sin exponer notas ni historiales individuales).
create function public.group_seen_keys(p_code text) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare v_code text := upper(trim(p_code)); v_keys text[];
begin
  if auth.uid() is null then raise exception 'not-authenticated'; end if;
  if not exists (select 1 from public.room_members where code = v_code and user_id = auth.uid()) then
    raise exception 'not-member';
  end if;
  select coalesce(array_agg(distinct k), '{}') into v_keys from (
    select h.key as k from public.history_entries h
      join public.room_members m on m.user_id = h.user_id and m.code = v_code
    union
    select w.key from public.watched w
      join public.room_members m on m.user_id = w.user_id and m.code = v_code
    union
    select 'movie:' || i.media_id::text from public.initial_ratings i
      join public.room_members m on m.user_id = i.user_id and m.code = v_code
      where i.value in ('like', 'skip')
  ) s;
  return v_keys;
end $$;

-- Limite de tasa de la Edge Function: devuelve cuantas peticiones lleva el usuario este minuto.
create function public.bump_api_hits(p_user uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  insert into public.api_hits (user_id, bucket, n)
  values (p_user, date_trunc('minute', now()), 1)
  on conflict (user_id, bucket) do update set n = public.api_hits.n + 1
  returning n into v_n;
  delete from public.api_hits where bucket < now() - interval '1 hour';
  return v_n;
end $$;

-- Permisos: solo usuarios autenticados llaman a las RPC de salas; bump_api_hits solo service role.
revoke all on function public.create_room(text) from public;
revoke all on function public.join_room(text, text) from public;
revoke all on function public.set_ready(text, boolean) from public;
revoke all on function public.leave_room(text) from public;
revoke all on function public.start_match(text) from public;
revoke all on function public.set_mood_answer(text, text, text) from public;
revoke all on function public.confirm_mood(text, jsonb) from public;
revoke all on function public.submit_decision(text, text, text) from public;
revoke all on function public.back_to_lobby(text) from public;
revoke all on function public.group_seen_keys(text) from public;
revoke all on function public.bump_api_hits(uuid) from public, anon, authenticated;

grant execute on function public.create_room(text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.set_ready(text, boolean) to authenticated;
grant execute on function public.leave_room(text) to authenticated;
grant execute on function public.start_match(text) to authenticated;
grant execute on function public.set_mood_answer(text, text, text) to authenticated;
grant execute on function public.confirm_mood(text, jsonb) to authenticated;
grant execute on function public.submit_decision(text, text, text) to authenticated;
grant execute on function public.back_to_lobby(text) to authenticated;
grant execute on function public.group_seen_keys(text) to authenticated;
grant execute on function public.bump_api_hits(uuid) to service_role;
