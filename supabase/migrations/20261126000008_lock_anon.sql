-- =============================================================================
-- Kandokids — visitantes anónimos não podem chamar funções da base de dados.
-- (Por omissão o PostgreSQL dá EXECUTE a todos; as funções já devolviam vazio sem
-- sessão, mas assim nem chegam a correr.)
-- =============================================================================
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Repor as funções internas como não chamáveis (o grant acima abrange todas).
revoke execute on function public.notify_guardians(uuid, text, text, text, jsonb, text, boolean, text, jsonb) from authenticated;
revoke execute on function public.notify_managers(uuid, text, text, text, jsonb) from authenticated;
revoke execute on function public.assert_can_operate_trip(uuid) from authenticated;
revoke execute on function public.on_vehicle_position() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.seed_company_features() from authenticated;
revoke execute on function public.enforce_plan_limits() from authenticated;
revoke execute on function public.learn_home_location() from authenticated;
revoke execute on function public.validate_company_feature() from authenticated;
revoke execute on function public.protect_profile_privileges() from authenticated;
revoke execute on function public.on_absence_change() from authenticated;
