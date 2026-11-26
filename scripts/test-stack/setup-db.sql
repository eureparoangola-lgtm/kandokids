-- Roles and schemas that the Supabase Postgres image normally provides.
-- Used by the end-to-end test stack (plain Postgres + GoTrue + PostgREST).
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role authenticator login noinherit password 'postgres'; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_auth_admin login createrole superuser password 'postgres'; exception when duplicate_object then null; end $$;
grant anon, authenticated, service_role to authenticator;
create schema auth authorization supabase_auth_admin;
create schema extensions;
grant usage on schema public, extensions, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter role supabase_auth_admin set search_path = auth;
