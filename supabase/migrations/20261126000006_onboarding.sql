-- =============================================================================
-- Kandokids — planos, registo de empresas, convites de equipa, viagens diárias
--
-- Plano gratuito (para sempre): 1 viatura e até 15 alunos, todas as funcionalidades,
-- sem anúncios. Os extras pagos pelos encarregados funcionam em todos os planos.
-- Plano Pro: sem limites (licença anual ou mensalidade).
-- =============================================================================

create type public.company_plan as enum ('free', 'pro');

alter table public.companies
  add column plan public.company_plan not null default 'free',
  add column city text,
  add column created_by uuid references public.profiles (id);

-- Limites efetivos: Pro com licença válida = sem limites; caso contrário, plano gratuito.
create function public.company_limits(p_company_id uuid)
returns table (max_vehicles int, max_students int, is_pro boolean)
language sql stable security definer set search_path = ''
as $$
  select
    case when pro then null else 1 end,
    case when pro then null else 15 end,
    pro
  from (
    select c.plan = 'pro' and c.license_status in ('trial', 'active')
           and (c.license_expires_at is null or c.license_expires_at >= public.luanda_today()) as pro
    from public.companies c where c.id = p_company_id
  ) x
$$;

create function public.enforce_plan_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  l record;
  n int;
begin
  if not new.active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.active and old.company_id = new.company_id then
    return new;  -- já contava
  end if;
  select * into l from public.company_limits(new.company_id);

  if tg_table_name = 'vehicles' and l.max_vehicles is not null then
    select count(*) into n from public.vehicles where company_id = new.company_id and active and id <> new.id;
    if n >= l.max_vehicles then
      raise exception 'O plano gratuito inclui % viatura. Passe para o plano Pro para adicionar mais viaturas.', l.max_vehicles;
    end if;
  elsif tg_table_name = 'students' and l.max_students is not null then
    select count(*) into n from public.students where company_id = new.company_id and active and id <> new.id;
    if n >= l.max_students then
      raise exception 'O plano gratuito inclui até % alunos. Passe para o plano Pro para adicionar mais alunos.', l.max_students;
    end if;
  end if;
  return new;
end;
$$;

create trigger vehicles_plan_limits before insert or update of active, company_id on public.vehicles
  for each row execute function public.enforce_plan_limits();
create trigger students_plan_limits before insert or update of active, company_id on public.students
  for each row execute function public.enforce_plan_limits();

-- ---------------------------------------------------------------------------
-- Alterações de papel feitas por funções de confiança (registo, convites)
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or current_setting('kandokids.trusted_role_change', true) = 'on' then
    return new;
  end if;
  if new.role is distinct from old.role or new.company_id is distinct from old.company_id then
    if public.is_platform_admin() then
      return new;
    end if;
    if new.role = 'platform_admin'
       or not public.is_admin_of(old.company_id) and old.company_id is not null
       or new.company_id is not null and not public.is_admin_of(new.company_id) then
      raise exception 'Sem permissão para alterar o papel ou a empresa deste utilizador.';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Registo de uma empresa de transporte (self-service)
-- ---------------------------------------------------------------------------
create function public.register_company(p_name text, p_phone text, p_nif text default null, p_city text default 'Luanda')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me public.profiles;
  v_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    raise exception 'Inicie sessão para registar a empresa.';
  end if;
  if me.company_id is not null then
    raise exception 'Esta conta já pertence a uma empresa.';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' then
    raise exception 'Indique o nome e o telefone da empresa.';
  end if;

  insert into public.companies (name, phone, nif, city, plan, license_status, created_by, email)
  values (trim(p_name), trim(p_phone), nullif(trim(p_nif), ''), p_city, 'free', 'active', me.id,
          (select email from auth.users where id = me.id))
  returning id into v_id;

  perform set_config('kandokids.trusted_role_change', 'on', true);
  update public.profiles set role = 'company_admin', company_id = v_id where id = me.id;
  perform set_config('kandokids.trusted_role_change', 'off', true);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Convites para a equipa (assistentes, motoristas, operadores)
-- ---------------------------------------------------------------------------
create table public.staff_invites (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  role         public.app_role not null check (role in ('company_admin', 'dispatcher', 'assistant', 'driver')),
  full_name    text not null,
  phone        text,
  code         text not null unique default upper(encode(extensions.gen_random_bytes(4), 'hex')),
  created_by   uuid references public.profiles (id),
  accepted_by  uuid references public.profiles (id),
  accepted_at  timestamptz,
  expires_at   timestamptz not null default now() + interval '14 days',
  created_at   timestamptz not null default now()
);
alter table public.staff_invites enable row level security;
create policy "admin gere convites de equipa" on public.staff_invites for all to authenticated
  using (public.is_admin_of(company_id)) with check (public.is_admin_of(company_id) and created_by = auth.uid());

-- Um único código serve para encarregados e para a equipa.
create function public.accept_invite(p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text := upper(trim(p_code));
  inv public.staff_invites;
  me public.profiles;
begin
  if exists (select 1 from public.guardian_invites where code = v_code) then
    return jsonb_build_object('kind', 'guardian', 'student_id', public.accept_guardian_invite(v_code));
  end if;

  select * into inv from public.staff_invites
  where code = v_code and accepted_at is null and expires_at > now() for update;
  if not found then
    raise exception 'Código inválido ou expirado.';
  end if;
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    raise exception 'Inicie sessão para aceitar o convite.';
  end if;
  if me.company_id is not null and me.company_id <> inv.company_id then
    raise exception 'Esta conta já pertence a outra empresa.';
  end if;

  perform set_config('kandokids.trusted_role_change', 'on', true);
  update public.profiles
  set role = inv.role, company_id = inv.company_id,
      full_name = case when full_name = '' then inv.full_name else full_name end,
      phone = coalesce(phone, inv.phone)
  where id = me.id;
  perform set_config('kandokids.trusted_role_change', 'off', true);

  update public.staff_invites set accepted_by = me.id, accepted_at = now() where id = inv.id;
  return jsonb_build_object('kind', 'staff', 'company_id', inv.company_id, 'role', inv.role);
end;
$$;

-- ---------------------------------------------------------------------------
-- Importação de alunos (Excel/CSV) com convite para cada encarregado
-- p_rows: [{full_name, grade, school_name, home_address, guardian_name, guardian_phone, relationship}]
-- ---------------------------------------------------------------------------
create function public.import_students(p_company_id uuid, p_rows jsonb, p_route_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb;
  v_school uuid;
  v_student uuid;
  v_code text;
  v_pos int;
  v_out jsonb := '[]'::jsonb;
begin
  if not public.is_manager_of(p_company_id) then
    raise exception 'Sem permissão.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'O ficheiro não tem alunos.';
  end if;
  if p_route_id is not null and not exists (select 1 from public.routes where id = p_route_id and company_id = p_company_id) then
    raise exception 'Rota inválida.';
  end if;
  select coalesce(max(position), 0) into v_pos from public.route_stops where route_id = p_route_id;

  for r in select * from jsonb_array_elements(p_rows) loop
    if coalesce(trim(r ->> 'full_name'), '') = '' then
      continue;
    end if;

    v_school := null;
    if coalesce(trim(r ->> 'school_name'), '') <> '' then
      select id into v_school from public.schools
      where company_id = p_company_id and lower(name) = lower(trim(r ->> 'school_name'));
      if v_school is null then
        insert into public.schools (company_id, name) values (p_company_id, trim(r ->> 'school_name')) returning id into v_school;
      end if;
    end if;

    insert into public.students (company_id, school_id, full_name, grade, home_address)
    values (p_company_id, v_school, trim(r ->> 'full_name'), nullif(trim(r ->> 'grade'), ''), nullif(trim(r ->> 'home_address'), ''))
    returning id into v_student;

    if p_route_id is not null then
      v_pos := v_pos + 1;
      insert into public.route_stops (route_id, student_id, position) values (p_route_id, v_student, v_pos);
    end if;

    v_code := null;
    if coalesce(trim(r ->> 'guardian_phone'), '') <> '' then
      insert into public.guardian_invites (company_id, student_id, phone, relationship, created_by)
      values (p_company_id, v_student, regexp_replace(r ->> 'guardian_phone', '[^0-9+]', '', 'g'),
              nullif(trim(r ->> 'relationship'), ''), auth.uid())
      returning code into v_code;
    end if;

    v_out := v_out || jsonb_build_object(
      'student_id', v_student, 'full_name', trim(r ->> 'full_name'),
      'guardian_name', r ->> 'guardian_name', 'guardian_phone', r ->> 'guardian_phone', 'invite_code', v_code);
  end loop;

  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Viagens diárias geradas a partir das rotas
-- ---------------------------------------------------------------------------
create unique index trips_route_date_unique on public.trips (route_id, service_date) where route_id is not null;

create function public.generate_trips(p_company_id uuid default null, p_date date default null)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_date date := coalesce(p_date, public.luanda_today());
  r public.routes;
  v_trip uuid;
  v_count int := 0;
begin
  if auth.uid() is not null and not (
       public.is_platform_admin() or (p_company_id is not null and public.is_manager_of(p_company_id))) then
    raise exception 'Sem permissão.';
  end if;

  for r in
    select * from public.routes
    where active and default_vehicle_id is not null
      and (p_company_id is null or company_id = p_company_id)
      and extract(isodow from v_date)::int = any (weekdays)
  loop
    insert into public.trips (company_id, route_id, vehicle_id, assistant_id, driver_id, direction, service_date)
    values (r.company_id, r.id, r.default_vehicle_id, r.default_assistant_id, r.default_driver_id, r.direction, v_date)
    on conflict (route_id, service_date) where route_id is not null do nothing
    returning id into v_trip;

    if v_trip is not null then
      insert into public.trip_students (trip_id, student_id, position, status)
      select v_trip, rs.student_id, rs.position,
             case when exists (select 1 from public.absences a
                               where a.student_id = rs.student_id and a.service_date = v_date
                                 and (a.direction is null or a.direction = r.direction))
                  then 'absent'::public.boarding_status else 'expected'::public.boarding_status end
      from public.route_stops rs join public.students s on s.id = rs.student_id
      where rs.route_id = r.id and s.active;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Todos os dias às 05:00 de Luanda (04:00 UTC), quando o pg_cron existe (Supabase).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('kandokids-generate-trips', '0 4 * * *', 'select public.generate_trips()');
  end if;
exception when others then
  raise notice 'pg_cron indisponível (%): ative-o no Supabase e agende public.generate_trips().', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Morada aprendida: a primeira recolha com GPS guarda a localização de casa
-- (usada no aviso de aproximação e no mapa).
-- ---------------------------------------------------------------------------
create function public.learn_home_location()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'on_board' and old.status is distinct from 'on_board'
     and new.pickup_lat is not null and new.pickup_lng is not null
     and (select direction from public.trips where id = new.trip_id) = 'to_school' then
    update public.students set home_lat = new.pickup_lat, home_lng = new.pickup_lng
    where id = new.student_id and home_lat is null;
  end if;
  return new;
end;
$$;

create trigger trip_students_learn_home after update of status on public.trip_students
  for each row execute function public.learn_home_location();

revoke execute on function public.enforce_plan_limits() from public, anon, authenticated;
revoke execute on function public.learn_home_location() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pedido de plano Pro (avisa a equipa Kandokids)
-- ---------------------------------------------------------------------------
create function public.request_pro_plan(p_message text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  c public.companies;
begin
  select * into c from public.companies where id = public.my_company_id();
  if c.id is null or not public.is_admin_of(c.id) then
    raise exception 'Sem permissão.';
  end if;
  insert into public.notifications (recipient_id, company_id, type, title, body, data)
  select p.id, c.id, 'pro_requested', 'Pedido de plano Pro',
         c.name || ' (' || coalesce(c.phone, 'sem telefone') || ') quer o plano Pro.' || coalesce(' ' || p_message, ''),
         jsonb_build_object('company_id', c.id)
  from public.profiles p where p.role = 'platform_admin';
end;
$$;
