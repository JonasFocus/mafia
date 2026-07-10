-- Minimal Supabase-compatibility shim so the app's migrations apply verbatim
-- to a vanilla Postgres 16. auth.uid() reads a session GUC we set per
-- simulated player ("set_config('request.jwt.claim.sub', <uuid>, false)").
create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  is_anonymous boolean not null default true,
  created_at timestamptz not null default clock_timestamp()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Supabase roles. authenticated/anon are NOLOGIN; tests use SET ROLE.
do $$ begin
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

grant usage on schema public to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;

create publication supabase_realtime;

-- supabase_migrations bookkeeping table (referenced by workflow, not migrations,
-- but harmless to have).
create schema if not exists supabase_migrations;
