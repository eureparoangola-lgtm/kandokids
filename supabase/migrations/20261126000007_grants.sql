-- =============================================================================
-- Kandokids — permissões explícitas da API
--
-- Projetos Supabase recentes não dão acesso automático às tabelas novas.
-- Os utilizadores autenticados recebem acesso às tabelas; quem vê o quê continua
-- a ser decidido pelas regras RLS (todas as tabelas têm RLS ativo).
-- Visitantes anónimos (anon) não recebem acesso a nada.
-- =============================================================================

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

-- Funções internas: nunca chamáveis diretamente pelas apps.
revoke execute on function public.notify_guardians(uuid, text, text, text, jsonb, text, boolean, text, jsonb) from public, anon, authenticated;
revoke execute on function public.notify_managers(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.assert_can_operate_trip(uuid) from public, anon, authenticated;
revoke execute on function public.on_vehicle_position() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.seed_company_features() from public, anon, authenticated;
revoke execute on function public.enforce_plan_limits() from public, anon, authenticated;
revoke execute on function public.learn_home_location() from public, anon, authenticated;
revoke execute on function public.validate_company_feature() from public, anon, authenticated;
revoke execute on function public.protect_profile_privileges() from public, anon, authenticated;
revoke execute on function public.on_absence_change() from public, anon, authenticated;
