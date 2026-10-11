-- Diana 0012: afinidad de la sala de grupo (VERTICE-PLAN-2, fase C).
--
-- La afinidad (Exprés/Intermedio/Cinéfilo) que el anfitrión elige en Mood
-- pasa a ser DATO DE LA SALA: `rooms.affinity`. Consecuencias:
--   1. `create_room` acepta `p_affinity` (con por defecto 'intermedio': las
--      llamadas antiguas de 1 argumento —clientes ya desplegados— siguen
--      funcionando y crean salas intermedio).
--   2. `set_mood_answer` admite las 6 preguntas del banco completo (las 2
--      extra —`era`, `pace`— solo las pide la afinidad cinéfilo).
--   3. `confirm_mood` valida el mood según el BANCO DE PREGUNTAS de la
--      afinidad de la sala (exprés: 2 · intermedio: 4 · cinéfilo: 6).
--      Con la 0003, una sala exprés sería irremediable: confirm_mood exigía
--      siempre las 4 fijas.
--
-- MIGRACIÓN FORWARD (no reabrir 0003): `create or replace` no sobreescribe
-- una firma distinta, así que `create_room` se borra y se re-crea. Los
-- permisos se re-vuelcan al final (mismo modelo que 0003: security definer,
-- solo `authenticated`).
--
-- Paridad con el cliente: los ids de afinidad y los bancos de preguntas
-- coinciden EXACTAMENTE con `src/features/mood/questions.ts`
-- (QUESTIONS_BY_COMPLEXITY: express/intermedio/cinefilo) y
-- `src/types/mood.ts` (type Complexity). Test de firma en
-- `src/services/supabase/room.repository.test.ts`.

alter table public.rooms
  add column if not exists affinity text not null default 'intermedio'
  check (affinity in ('express', 'intermedio', 'cinefilo'));

-- ---------------------------------------------------------------------------
-- create_room: + p_affinity (default 'intermedio' → compatibilidad con
-- clientes que llaman con 1 argumento).
-- ---------------------------------------------------------------------------
drop function if exists public.create_room(text);

create function public.create_room(p_name text, p_affinity text default 'intermedio')
returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_uid uuid := auth.uid();
  v_affinity text := coalesce(p_affinity, 'intermedio');
  v_code text;
  v_try int := 0;
begin
  if v_uid is null then raise exception 'not-authenticated'; end if;
  if v_affinity not in ('express', 'intermedio', 'cinefilo') then
    raise exception 'bad-input';
  end if;
  loop
    v_code := '';
    for i in 1..4 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where code = v_code);
    v_try := v_try + 1;
    if v_try > 20 then raise exception 'bad-input'; end if;
  end loop;
  insert into public.rooms (code, host_id, affinity) values (v_code, v_uid, v_affinity);
  insert into public.room_members (code, user_id, name, is_ready)
  values (v_code, v_uid, left(coalesce(nullif(trim(p_name), ''), 'Anfitrión'), 40), true);
  return v_code;
end $$;

-- ---------------------------------------------------------------------------
-- set_mood_answer: banco completo (6 preguntas). La afinidad de la sala no
-- limita qué se puede GUARDAR (el cliente solo muestra las preguntas de su
-- banco); confirm_mood es quien valida el conjunto exigido.
-- ---------------------------------------------------------------------------
create or replace function public.set_mood_answer(p_code text, p_question text, p_answer text)
returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  r := public._require_host(p_code);
  if r.phase <> 'mood' then raise exception 'wrong-phase'; end if;
  if p_question not in ('time', 'energy', 'company', 'era', 'pace', 'platforms') then
    raise exception 'bad-input';
  end if;
  if p_answer is null or length(trim(p_answer)) = 0 or length(p_answer) > 80 then
    raise exception 'bad-input';
  end if;
  update public.rooms
  set mood = jsonb_set(
    mood, '{answers}',
    coalesce(mood->'answers', '{}'::jsonb) || jsonb_build_object(p_question, p_answer)
  )
  where code = r.code;
end $$;

-- ---------------------------------------------------------------------------
-- confirm_mood: valida el mood según el banco de preguntas de la afinidad
-- de la SALA (mismo mapa que QUESTIONS_BY_COMPLEXITY del cliente).
-- ---------------------------------------------------------------------------
create or replace function public.confirm_mood(p_code text, p_deck jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms; v_questions text[]; q text;
begin
  r := public._require_host(p_code);
  if r.phase <> 'mood' then raise exception 'wrong-phase'; end if;
  v_questions := case r.affinity
    when 'express' then array['time', 'energy']::text[]
    when 'cinefilo' then array['time', 'energy', 'company', 'era', 'pace', 'platforms']::text[]
    else array['time', 'energy', 'company', 'platforms']::text[]
  end;
  foreach q in array v_questions loop
    if coalesce(r.mood->'answers'->>q, '') = '' then raise exception 'mood-incomplete'; end if;
  end loop;
  if jsonb_typeof(p_deck) <> 'array' or jsonb_array_length(p_deck) > 30 then raise exception 'bad-deck'; end if;
  update public.rooms
  set phase = 'swipe', deck = p_deck, mood = jsonb_set(mood, '{confirmed}', 'true'::jsonb)
  where code = r.code;
end $$;

-- Permisos: firma nueva de create_room (la de 1 arg ya no existe); el resto
-- mantiene la firma de 0003.
revoke all on function public.create_room(text, text) from public;
revoke all on function public.set_mood_answer(text, text, text) from public;
revoke all on function public.confirm_mood(text, jsonb) from public;

grant execute on function public.create_room(text, text) to authenticated;
grant execute on function public.set_mood_answer(text, text, text) to authenticated;
grant execute on function public.confirm_mood(text, jsonb) to authenticated;
