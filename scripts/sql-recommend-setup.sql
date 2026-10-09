-- Diana · Setup del Postgres LOCAL para probar las migraciones (solo
-- contenedor de pruebas; NO es una migración del proyecto y NO se aplica en
-- producción). Crea el mínimo que Supabase aporta por sí mismo: esquema
-- `auth` con auth.users + auth.uid() (simulado con un GUC: el «JWT» lo pone
-- la conexión con options='-c request.jwt.claim.sub=<uuid>') y los roles
-- anon/authenticated/service_role que usan las migraciones.
\set ON_ERROR_STOP on

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- auth.uid(): en Supabase lee el JWT; aquí lee un GUC por sesión.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- En Supabase, service_role tiene BYPASSRLS (es como lo define su imagen):
    -- sin este atributo el stub no se comportaría igual que la clave de servicio.
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;

-- En Supabase, los privilegios por defecto dan DML a anon/authenticated en el
-- esquema public y la RLS es la puerta (mismo modelo que las migraciones de
-- este repo: policy sin `using` = sin acceso). Se reproduce aquí ANTES de
-- aplicar las migraciones para que las tablas creadas hereden los grants.
alter default privileges in schema public grant select, insert, update, delete on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
grant usage on schema auth to postgres, authenticated, service_role;
