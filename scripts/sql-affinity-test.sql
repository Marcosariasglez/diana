-- Diana · Prueba de la migración 0012 (afinidad de sala) contra Postgres LOCAL
-- (VERTICE-PLAN-2 C.4.4). Supone que ya se aplicaron: setup (stub auth.uid() +
-- roles), 0001 (schema), 0003 (RPC salas) y 0012 (afinidad). Si algún assert
-- falla, el guion termina con error (DO RAISE EXCEPTION).
\set ON_ERROR_STOP on

create or replace function public._assert(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if not cond then raise exception 'ASSERT FALLÓ: %', msg; end if;
end $$;
revoke all on function public._assert(boolean, text) from public, anon, authenticated;

-- Usuario de prueba (el «JWT» lo pone el GUC request.jwt.claim.sub).
insert into auth.users (id, email) values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'host@example.com'),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'guest@example.com')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- TEST 1 · create_room: 1 argumento (clientes ya desplegados) → intermedio;
--          2 argumentos → se guarda la afinidad; valor inválido → bad-input.
-- ---------------------------------------------------------------------------
do $$
declare
  v_code text;
  v_affinity text;
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-1111-1111-111111111111', false);

  v_code := public.create_room('Host');
  select affinity into v_affinity from public.rooms where code = v_code;
  perform public._assert(v_affinity = 'intermedio',
    '0012: create_room de 1 arg no crea intermedio: ' || coalesce(v_affinity, 'null'));

  v_code := public.create_room('Host E', 'express');
  select affinity into v_affinity from public.rooms where code = v_code;
  perform public._assert(v_affinity = 'express',
    '0012: create_room no guardó express: ' || coalesce(v_affinity, 'null'));

  v_code := public.create_room('Host C', 'cinefilo');
  select affinity into v_affinity from public.rooms where code = v_code;
  perform public._assert(v_affinity = 'cinefilo',
    '0012: create_room no guardó cinefilo: ' || coalesce(v_affinity, 'null'));

  begin
    perform public.create_room('Host X', 'turbo');
    perform public._assert(false, '0012: se aceptó una afinidad inválida');
  exception when raise_exception then
    perform public._assert(sqlerrm = 'bad-input',
      '0012: afinidad inválida no dio bad-input: ' || sqlerrm);
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- TEST 2 · confirm_mood por banco de la sala:
--   · sala exprés: con solo time+energy → OK; sin time → mood-incomplete.
--   · sala intermedia: exige las 4 fijas.
--   · sala cinéfilo: exige las 6 (time, energy, company, era, pace, platforms).
-- ---------------------------------------------------------------------------
do $$
declare
  v_code text;
  v_phase text;
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-1111-1111-111111111111', false);

  -- (a) Exprés: 2 respuestas bastan.
  v_code := public.create_room('E1', 'express');
  perform public.start_match(v_code);
  begin
    perform public.confirm_mood(v_code, '[]'::jsonb);
    perform public._assert(false, '0012: sala exprés se confirmó sin responder');
  exception when raise_exception then
    perform public._assert(sqlerrm = 'mood-incomplete',
      '0012: exprés sin time no dio mood-incomplete: ' || sqlerrm);
  end;
  perform public.set_mood_answer(v_code, 'time', 'h2');
  begin
    perform public.confirm_mood(v_code, '[]'::jsonb);
    perform public._assert(false, '0012: sala exprés se confirmó sin energy');
  exception when raise_exception then
    perform public._assert(sqlerrm = 'mood-incomplete',
      '0012: exprés sin energy no dio mood-incomplete: ' || sqlerrm);
  end;
  perform public.set_mood_answer(v_code, 'energy', 'calm');
  perform public.confirm_mood(v_code, '[]'::jsonb);
  select phase into v_phase from public.rooms where code = v_code;
  perform public._assert(v_phase = 'swipe', '0012: exprés con 2 respuestas no pasó a swipe: ' || v_phase);

  -- (b) Intermedia: exige las 4 fijas (comportamiento 0003 inalterado).
  v_code := public.create_room('I1');   -- 1 arg → intermedio
  perform public.start_match(v_code);
  perform public.set_mood_answer(v_code, 'time', 'h2');
  perform public.set_mood_answer(v_code, 'energy', 'calm');
  perform public.set_mood_answer(v_code, 'company', 'friends');
  begin
    perform public.confirm_mood(v_code, '[]'::jsonb);
    perform public._assert(false, '0012: intermedia se confirmó sin platforms');
  exception when raise_exception then
    perform public._assert(sqlerrm = 'mood-incomplete',
      '0012: intermedia sin platforms no dio mood-incomplete: ' || sqlerrm);
  end;
  perform public.set_mood_answer(v_code, 'platforms', 'netflix');
  perform public.confirm_mood(v_code, '[]'::jsonb);
  select phase into v_phase from public.rooms where code = v_code;
  perform public._assert(v_phase = 'swipe', '0012: intermedia con 4 respuestas no pasó a swipe: ' || v_phase);

  -- (c) Cinéfilo: exige las 6 (incluye era y pace, que la 0003 no admitía).
  v_code := public.create_room('C1', 'cinefilo');
  perform public.start_match(v_code);
  perform public.set_mood_answer(v_code, 'time', 'h2');
  perform public.set_mood_answer(v_code, 'energy', 'intense');
  perform public.set_mood_answer(v_code, 'company', 'friends');
  perform public.set_mood_answer(v_code, 'platforms', 'netflix');
  begin
    perform public.confirm_mood(v_code, '[]'::jsonb);
    perform public._assert(false, '0012: cinéfilo se confirmó sin era/pace');
  exception when raise_exception then
    perform public._assert(sqlerrm = 'mood-incomplete',
      '0012: cinéfilo sin era no dio mood-incomplete: ' || sqlerrm);
  end;
  perform public.set_mood_answer(v_code, 'era', 'classic');
  perform public.set_mood_answer(v_code, 'pace', 'fast');
  perform public.confirm_mood(v_code, '[]'::jsonb);
  select phase into v_phase from public.rooms where code = v_code;
  perform public._assert(v_phase = 'swipe', '0012: cinéfilo con 6 respuestas no pasó a swipe: ' || v_phase);
end
$$;

-- ---------------------------------------------------------------------------
-- TEST 3 · set_mood_answer: admite las 6 preguntas del banco completo (0012);
--          pregunta desconocida sigue dando bad-input.
-- ---------------------------------------------------------------------------
do $$
declare
  v_code text;
  v_ok boolean;
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-1111-1111-111111111111', false);
  v_code := public.create_room('S1', 'cinefilo');
  perform public.start_match(v_code);
  perform public.set_mood_answer(v_code, 'era', 'new');
  perform public.set_mood_answer(v_code, 'pace', 'slow');
  select (mood->'answers'->>'era') = 'new' and (mood->'answers'->>'pace') = 'slow'
    into v_ok
    from public.rooms where code = v_code;
  perform public._assert(v_ok, '0012: set_mood_answer no guardó era/pace');

  begin
    perform public.set_mood_answer(v_code, 'weather', 'sol');
    perform public._assert(false, '0012: set_mood_answer aceptó una pregunta desconocida');
  exception when raise_exception then
    perform public._assert(sqlerrm = 'bad-input',
      '0012: pregunta desconocida no dio bad-input: ' || sqlerrm);
  end;
end
$$;

select 'OK 0012: afinidad de sala (create_room p_affinity, confirm_mood por banco, set_mood_answer banco completo) verificada contra Postgres local' as resultado;
