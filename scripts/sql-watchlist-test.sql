-- Diana · Test LOCAL de la migración 0008 (watchlist) + 0005 (borrado)
-- (VERTICE-PLAN-2, D2-3). SOLO el contenedor de pruebas; NO se aplica en
-- producción. Cada assert lanza una excepción si cae (ON_ERROR_STOP está
-- activo en el runner).
--
-- Usuarios: A y B (uuids fijos), simulando el JWT con el GUC
-- request.jwt.claim.sub (mismo modelo que scripts/sql-recommend-test.sql).
\set ON_ERROR_STOP on

do $$
declare
  a uuid := '11111111-1111-1111-1111-111111111111';
  b uuid := '22222222-2222-2222-2222-222222222222';
  n int;
begin
  -- El trigger de 0001 crea la fila de profiles al insertar en auth.users.
  insert into auth.users (id, email) values (a, 'a@example.com'), (b, 'b@example.com');

  select count(*) into n from public.profiles where id = a;
  if n <> 1 then raise exception 'assert-0: el trigger no creó el perfil de A (filas: %)', n; end if;

  -- 1 · A añade dos títulos a su watchlist.
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  insert into public.watchlist (user_id, media_type, media_id, notes)
    values (a, 'movie', 1, 'Para la sala'), (a, 'tv', 7, '');
  select count(*) into n from public.watchlist where user_id = a;
  if n <> 2 then raise exception 'assert-1: A debería tener 2 filas (tiene %)', n; end if;

  -- 2 · B NO ve la watchlist de A (RLS using).
  perform set_config('request.jwt.claim.sub', b::text, true);
  select count(*) into n from public.watchlist where user_id = a;
  if n <> 0 then raise exception 'assert-2: B ve la watchlist de A (tiene %)', n; end if;
  select count(*) into n from public.watchlist;
  if n <> 0 then raise exception 'assert-2b: B ve filas ajenas en select sin filtro (%)', n; end if;

  -- 3 · B NO puede insertar en nombre de A (RLS with check viola → 42501).
  begin
    insert into public.watchlist (user_id, media_type, media_id) values (a, 'movie', 2);
    raise exception 'assert-3: B debería no poder insertar en nombre de A';
  exception when insufficient_privilege then
    null; -- policy violation: esperado
  end;
  select count(*) into n from public.watchlist where user_id = a and media_id = 2;
  if n <> 0 then raise exception 'assert-3b: B insertó en nombre de A (filas: %)', n; end if;

  -- 4 · B NO puede modificar ni borrar la fila de A: la RLS using la hace
  --    invisible a B, así que el UPDATE afecta 0 filas (get diagnostics).
  update public.watchlist set notes = 'hackeado' where user_id = a and media_id = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'assert-4: B modificó filas de A (filas: %)', n; end if;
  select count(*) into n from public.watchlist where user_id = a and notes = 'hackeado';
  if n <> 0 then raise exception 'assert-4b: B modificó la fila de A'; end if;
  delete from public.watchlist where user_id = a and media_id = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'assert-4b: B borró filas de A (filas: %)', n; end if;

  -- Verificación como service_role (B no puede ver las filas de A, así que
  -- la integridad solo se comprueba saltándose la RLS): 2 filas, intactas.
  -- Limpia el GUC (auth.uid() usa nullif(..., '') → NULL sin usuario).
  perform set_config('request.jwt.claim.sub', '', true);
  set local role service_role;
  select count(*) into n from public.watchlist where user_id = a;
  if n <> 2 then raise exception 'assert-4c: las filas de A no están intactas (filas: %)', n; end if;
  select count(*) into n from public.watchlist where user_id = a and notes = 'hackeado';
  if n <> 0 then raise exception 'assert-4d: B modificó la nota de A'; end if;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', b::text, true);

  -- 5 · anon NO ve nada (sin policy para anon).
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  set local role anon;
  select count(*) into n from public.watchlist;
  if n <> 0 then raise exception 'assert-5: anon ve la watchlist (%)', n; end if;

  -- 6 · PK (user, type, id): reañadir el mismo título no duplica (upsert).
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  insert into public.watchlist (user_id, media_type, media_id, notes)
    values (a, 'movie', 1, 'Actualizado')
    on conflict (user_id, media_type, media_id) do update set notes = excluded.notes;
  select count(*) into n from public.watchlist where user_id = a and media_type = 'movie' and media_id = 1;
  if n <> 1 then raise exception 'assert-6: upsert duplicó la fila (%)', n; end if;

  -- 7 · check de media_type: un tipo inválido no entra.
  begin
    insert into public.watchlist (user_id, media_type, media_id) values (a, 'serie', 1);
    raise exception 'assert-7: media_type inválido debería fallar el check';
  exception when check_violation then
    null; -- esperado
  end;

  -- 8 · delete_user_data (service_role, 0005) borra la watchlist de A (y su
  --    perfil), y NO toca la de B (B se crea con una fila para comparar).
  perform set_config('request.jwt.claim.sub', b::text, true);
  insert into public.watchlist (user_id, media_type, media_id) values (b, 'movie', 5);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role service_role;
  perform public.delete_user_data(a);
  reset role;

  select count(*) into n from public.watchlist where user_id = a;
  if n <> 0 then raise exception 'assert-8: delete_user_data no borró la watchlist de A (%)', n; end if;
  select count(*) into n from public.watchlist where user_id = b;
  if n <> 1 then raise exception 'assert-8b: delete_user_data borró datos de B (%)', n; end if;
  select count(*) into n from public.profiles where id = a;
  if n <> 0 then raise exception 'assert-8c: delete_user_data no borró el perfil de A'; end if;

  raise notice 'OK 0008/0005: watchlist RLS + borrado verificados contra Postgres local';
end $$;
