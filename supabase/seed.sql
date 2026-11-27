-- =============================================================================
-- Kandokids — dados de demonstração (Luanda)
-- Palavra-passe de todos os utilizadores: kandokids123
-- =============================================================================

-- Utilizadores ----------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email,
       extensions.crypt('kandokids123', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.name, 'phone', u.phone), now(), now(), '', '', '', ''
from (values
  ('00000000-0000-0000-0000-000000000001', 'plataforma@kandokids.ao', 'Equipa Kandokids',  '+244900000001'),
  ('00000000-0000-0000-0000-0000000000a1', 'admin@kianda.ao',        'Domingas Sebastião', '+244923000001'),
  ('00000000-0000-0000-0000-0000000000a2', 'teresa@kianda.ao',       'Teresa Manuel',      '+244923000002'),
  ('00000000-0000-0000-0000-0000000000a3', 'manuel@kianda.ao',       'Manuel Kiala',       '+244923000003'),
  ('00000000-0000-0000-0000-0000000000a4', 'esperanca@kianda.ao',    'Esperança Lopes',    '+244923000004'),
  ('00000000-0000-0000-0000-0000000000b1', 'joana@exemplo.ao',       'Joana Neto',         '+244931000001'),
  ('00000000-0000-0000-0000-0000000000b2', 'paulo@exemplo.ao',       'Paulo Domingos',     '+244931000002'),
  ('00000000-0000-0000-0000-0000000000b3', 'rosa@exemplo.ao',        'Rosa Domingos',      '+244931000003')
) as u(id, email, name, phone);

-- Rosa criou a conta com um código e confirmou o email: o convite fica pendente até ao primeiro login.
update auth.users set raw_user_meta_data = raw_user_meta_data || '{"pending_invite":"DEMOPEND"}'
where id = '00000000-0000-0000-0000-0000000000b3';

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id, id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users;

-- Empresa ---------------------------------------------------------------------
insert into public.companies (id, name, nif, phone, email, address, plan, license_status, license_expires_at, monthly_paid_until)
values ('11111111-1111-1111-1111-111111111111', 'Kianda Transportes Escolares', '5417000000',
        '+244923000000', 'geral@kianda.ao', 'Talatona, Luanda', 'pro', 'active',
        current_date + 300, current_date + 20);

update public.profiles set role = 'platform_admin' where id = '00000000-0000-0000-0000-000000000001';
update public.profiles set company_id = '11111111-1111-1111-1111-111111111111', role = r.role::public.app_role
from (values ('00000000-0000-0000-0000-0000000000a1', 'company_admin'),
             ('00000000-0000-0000-0000-0000000000a2', 'assistant'),
             ('00000000-0000-0000-0000-0000000000a3', 'driver'),
             ('00000000-0000-0000-0000-0000000000a4', 'assistant')) as r(id, role)
where profiles.id = r.id::uuid;

-- Escola, viaturas, alunos -----------------------------------------------------
insert into public.schools (id, company_id, name, address, lat, lng) values
  ('22222222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Colégio Esperança', 'Talatona, Luanda', -8.9170, 13.1840);

insert into public.vehicles (id, company_id, plate, nickname, model, color, capacity) values
  ('33333333-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'LD-23-45-AB', 'Autocarro Azul', 'Toyota Coaster', 'Azul', 25),
  ('33333333-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'LD-67-89-CD', 'Carrinha Branca', 'Toyota Hiace', 'Branca', 14);

insert into public.students (id, company_id, school_id, full_name, grade, home_address, home_lat, home_lng, qr_token) values
  ('44444444-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000001', 'Ana Neto',        '3ª classe', 'Kilamba, Bloco Q',   -8.9960, 13.2700, 'demo-ana'),
  ('44444444-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000001', 'Miguel Neto',     '5ª classe', 'Kilamba, Bloco Q',   -8.9960, 13.2700, 'demo-miguel'),
  ('44444444-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000001', 'Rita Domingos',   '2ª classe', 'Camama, Rua 5',      -8.9550, 13.2400, 'demo-rita'),
  ('44444444-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000001', 'Kiame Domingos',  '6ª classe', 'Camama, Rua 5',      -8.9550, 13.2400, 'demo-kiame');

insert into public.student_guardians (student_id, guardian_id, relationship, is_primary) values
  ('44444444-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'Mãe', true),
  ('44444444-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'Mãe', true),
  ('44444444-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b2', 'Pai', true),
  ('44444444-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000b2', 'Pai', true);

-- Rotas -----------------------------------------------------------------------
insert into public.routes (id, company_id, school_id, name, direction, scheduled_time, default_vehicle_id, default_assistant_id, default_driver_id) values
  ('55555555-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000001', 'Kilamba → Colégio (manhã)', 'to_school', '06:30', '33333333-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3'),
  ('55555555-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000001', 'Colégio → Kilamba (tarde)', 'to_home',   '12:45', '33333333-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3'),
  ('55555555-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000001', 'Camama → Colégio (manhã)',  'to_school', '06:40', '33333333-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a4', null);

insert into public.route_stops (route_id, student_id, position) values
  ('55555555-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 1),
  ('55555555-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000002', 2),
  ('55555555-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000003', 3),
  ('55555555-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000001', 1),
  ('55555555-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000002', 2),
  ('55555555-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000003', 3),
  ('55555555-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000004', 1);

-- Viagens de hoje ---------------------------------------------------------------
insert into public.trips (id, company_id, route_id, vehicle_id, assistant_id, driver_id, direction, service_date) values
  ('66666666-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '55555555-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3', 'to_school', public.luanda_today()),
  ('66666666-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '55555555-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a4', null, 'to_school', public.luanda_today()),
  ('66666666-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '55555555-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3', 'to_home', public.luanda_today());

insert into public.trip_students (trip_id, student_id, position)
select r.trip_id::uuid, rs.student_id, rs.position
from (values ('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001'),
             ('66666666-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000003'),
             ('66666666-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000002')) r(trip_id, route_id)
join public.route_stops rs on rs.route_id = r.route_id::uuid;

-- Convites de demonstração (códigos fixos para testar o registo na app)
insert into public.guardian_invites (company_id, student_id, phone, relationship, code) values
  ('11111111-1111-1111-1111-111111111111', '44444444-0000-0000-0000-000000000004', '+244931000009', 'Mãe', 'DEMOPAIS'),
  ('11111111-1111-1111-1111-111111111111', '44444444-0000-0000-0000-000000000003', '+244931000003', 'Mãe', 'DEMOPEND');
insert into public.staff_invites (company_id, role, full_name, phone, code) values
  ('11111111-1111-1111-1111-111111111111', 'assistant', 'Nova Assistente', '+244923000009', 'DEMOEQUI');
