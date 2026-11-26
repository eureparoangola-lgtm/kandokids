-- =============================================================================
-- Kandokids — extras vendidos pela Kandokids e painel da plataforma
--
-- 1. Os extras pagos (SMS, alertas de velocidade, …) são vendidos pela Kandokids
--    diretamente aos encarregados. As empresas não os veem nem os gerem.
--    Um encarregado paga uma vez e o extra vale para todos os filhos.
-- 2. A equipa Kandokids pode suspender/reativar empresas e mudar o plano.
-- 3. Definições da plataforma (instruções de pagamento, contacto).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extras da Kandokids
-- ---------------------------------------------------------------------------
alter table public.features rename column suggested_price_kz to addon_price_kz;
comment on column public.features.addon_price_kz is 'Preço mensal do extra, cobrado pela Kandokids ao encarregado.';

-- O preço passa a ser da plataforma (features.addon_price_kz).
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.company_features'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%addon_price_kz is not null%' loop
    execute format('alter table public.company_features drop constraint %I', c);
  end loop;
end $$;

create or replace function public.seed_company_features()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.company_features (company_id, feature_key, mode)
  select new.id, f.key, f.default_mode from public.features f
  on conflict do nothing;
  return new;
end;
$$;

-- Extras: só a Kandokids decide. A empresa só liga/desliga as funcionalidades base.
create or replace function public.validate_company_feature()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  f public.features;
begin
  select * into f from public.features where key = new.feature_key;

  if new.mode = 'included' and not f.allows_included then
    raise exception 'A funcionalidade "%" não pode ser incluída para todos; só como extra pago.', f.name_pt;
  end if;
  if new.mode = 'addon' and not f.allows_addon then
    raise exception 'A funcionalidade "%" não pode ser vendida como extra.', f.name_pt;
  end if;

  if auth.uid() is not null and not public.is_platform_admin() then
    -- A criação automática com os valores por omissão (registo de empresa) é permitida.
    if (tg_op = 'INSERT' and new.mode is distinct from f.default_mode)
       or (tg_op = 'UPDATE' and new.mode is distinct from old.mode
           and (new.mode = 'addon' or old.mode = 'addon' or f.default_mode = 'addon')) then
      raise exception 'Os extras pagos pelos encarregados são geridos pela Kandokids.';
    end if;
    if tg_op = 'UPDATE' and (old.locked_by_platform or new.locked_by_platform is distinct from old.locked_by_platform) then
      raise exception 'Esta funcionalidade é gerida pela Kandokids. Contacte o suporte.';
    end if;
  end if;

  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

-- Subscrições do encarregado (valem para todas as empresas dos filhos).
alter table public.guardian_addons alter column company_id drop not null;

drop policy "ver os meus extras" on public.guardian_addons;
drop policy "gestor gere extras" on public.guardian_addons;
create policy "ver os meus extras" on public.guardian_addons for select to authenticated
  using (guardian_id = auth.uid() or public.is_platform_admin());
create policy "plataforma gere extras" on public.guardian_addons for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create or replace function public.guardian_has_feature(p_guardian_id uuid, p_company_id uuid, p_feature_key text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case public.company_feature_mode(p_company_id, p_feature_key)
    when 'included' then true
    when 'addon' then exists (
      select 1 from public.guardian_addons ga
      where ga.guardian_id = p_guardian_id
        and ga.feature_key = p_feature_key
        and ga.status = 'active'
        and public.luanda_today() between ga.starts_on and ga.ends_on)
    else false
  end;
$$;

-- Extras disponíveis para mim (encarregado).
create function public.get_my_extras()
returns table (
  feature_key text, name_pt text, description_pt text, price_kz numeric,
  active boolean, status public.addon_status, ends_on date
)
language sql stable security definer set search_path = ''
as $$
  select f.key, f.name_pt, f.description_pt, f.addon_price_kz,
         exists (select 1 from public.guardian_addons a where a.guardian_id = auth.uid() and a.feature_key = f.key
                 and a.status = 'active' and public.luanda_today() between a.starts_on and a.ends_on),
         ga.status, ga.ends_on
  from public.features f
  left join lateral (
    select status, ends_on from public.guardian_addons
    where guardian_id = auth.uid() and feature_key = f.key
    order by created_at desc limit 1) ga on true
  where f.allows_addon
    and exists (select 1 from public.my_guardian_company_ids() c
                where public.company_feature_mode(c, f.key) = 'addon')
  order by f.sort_order
$$;

drop function public.get_my_features(uuid);
drop function public.request_addon(uuid, text, text);

create function public.request_addon(p_feature_key text, p_payment_method text default 'multicaixa_express')
returns public.guardian_addons
language plpgsql security definer set search_path = ''
as $$
declare
  f public.features;
  ga public.guardian_addons;
begin
  select * into f from public.features where key = p_feature_key;
  if not exists (select 1 from public.get_my_extras() e where e.feature_key = p_feature_key) then
    raise exception 'Este extra não está disponível.';
  end if;
  if exists (select 1 from public.get_my_extras() e where e.feature_key = p_feature_key and e.active) then
    raise exception 'Já tem este extra ativo.';
  end if;

  select * into ga from public.guardian_addons
  where guardian_id = auth.uid() and feature_key = p_feature_key and status = 'pending_payment';
  if found then
    return ga;
  end if;

  insert into public.guardian_addons (guardian_id, feature_key, amount_kz, payment_method)
  values (auth.uid(), p_feature_key, f.addon_price_kz, p_payment_method)
  returning * into ga;

  insert into public.notifications (recipient_id, type, title, body, data)
  select p.id, 'addon_requested', 'Novo pedido de extra',
         (select full_name from public.profiles where id = auth.uid()) || ' pediu "' || f.name_pt || '".',
         jsonb_build_object('addon_id', ga.id)
  from public.profiles p where p.role = 'platform_admin';
  return ga;
end;
$$;

create or replace function public.activate_addon(p_addon_id uuid, p_months int default 1, p_payment_reference text default null)
returns public.guardian_addons
language plpgsql security definer set search_path = ''
as $$
declare
  ga public.guardian_addons;
  v_start date;
begin
  if not public.is_platform_admin() then
    raise exception 'Sem permissão.';
  end if;
  select * into ga from public.guardian_addons where id = p_addon_id for update;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;
  if p_months not between 1 and 12 then
    raise exception 'Número de meses inválido.';
  end if;

  select greatest(public.luanda_today(), coalesce(max(ends_on) + 1, public.luanda_today())) into v_start
  from public.guardian_addons
  where guardian_id = ga.guardian_id and feature_key = ga.feature_key and status = 'active' and id <> ga.id;

  update public.guardian_addons
  set status = 'active', starts_on = v_start,
      ends_on = (v_start + make_interval(months => p_months))::date - 1,
      amount_kz = ga.amount_kz * p_months,
      payment_reference = coalesce(p_payment_reference, payment_reference)
  where id = ga.id
  returning * into ga;

  insert into public.notifications (recipient_id, type, title, body, data)
  values (ga.guardian_id, 'addon_activated', 'Extra ativado',
          '"' || (select name_pt from public.features where key = ga.feature_key)
            || '" está ativo até ' || to_char(ga.ends_on, 'DD/MM/YYYY') || '.',
          jsonb_build_object('addon_id', ga.id));
  return ga;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Empresas: suspensão e plano (equipa Kandokids)
-- ---------------------------------------------------------------------------
alter table public.companies
  add column suspended_reason text,
  add column suspended_at timestamptz;

create function public.company_is_active(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select license_status <> 'suspended' from public.companies where id = p_company_id), false) $$;

create or replace function public.assert_can_operate_trip(p_trip_id uuid)
returns public.trips
language plpgsql security definer set search_path = ''
as $$
declare
  t public.trips;
begin
  select * into t from public.trips where id = p_trip_id;
  if not found then
    raise exception 'Viagem não encontrada.';
  end if;
  if not (public.is_crew_of_trip(t.id) or public.is_manager_of(t.company_id)) then
    raise exception 'Sem permissão para operar esta viagem.';
  end if;
  if not public.company_is_active(t.company_id) then
    raise exception 'A conta da empresa está suspensa. Contacte a Kandokids.';
  end if;
  return t;
end;
$$;

create or replace function public.generate_trips(p_company_id uuid default null, p_date date default null)
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
      and public.company_is_active(company_id)
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

create or replace function public.get_guardian_dashboard()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(child order by child ->> 'full_name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'student_id',    s.id,
      'full_name',     s.full_name,
      'first_name',    split_part(s.full_name, ' ', 1),
      'grade',         s.grade,
      'photo_url',     s.photo_url,
      'home_lat',      s.home_lat,
      'home_lng',      s.home_lng,
      'school_name',   sc.name,
      'company_id',    c.id,
      'company_name',  c.name,
      'company_phone', c.phone,
      'company_suspended', c.license_status = 'suspended',
      'has_pin',       exists (select 1 from public.student_pickup_pins p where p.student_id = s.id),
      'absent_today',  exists (select 1 from public.absences a where a.student_id = s.id and a.service_date = public.luanda_today() and a.direction is null),
      'absent_tomorrow', exists (select 1 from public.absences a where a.student_id = s.id and a.service_date = public.luanda_today() + 1 and a.direction is null),
      'features', (
        select jsonb_object_agg(f.key, public.guardian_has_feature(auth.uid(), c.id, f.key))
        from public.features f),
      'trips', coalesce((
        select jsonb_agg(jsonb_build_object(
          'trip_id',         t.id,
          'trip_student_id', ts.id,
          'direction',       t.direction,
          'trip_status',     t.status,
          'status',          ts.status,
          'picked_up_at',    ts.picked_up_at,
          'delivered_at',    ts.delivered_at,
          'handed_to_name',  ts.handed_to_name,
          'handover_method', ts.handover_method,
          'started_at',      t.started_at,
          'ended_at',        t.ended_at,
          'scheduled_time',  r.scheduled_time,
          'can_track',       t.status = 'in_progress' and ts.status in ('expected', 'on_board')
                             and public.company_has_feature(c.id, 'live_tracking'),
          'vehicle', jsonb_build_object('id', v.id, 'plate', v.plate, 'nickname', v.nickname, 'color', v.color),
          'assistant', (select jsonb_build_object('full_name', p.full_name, 'phone', p.phone)
                        from public.profiles p where p.id = t.assistant_id)
        ) order by t.direction, t.started_at nulls last)
        from public.trip_students ts
        join public.trips t on t.id = ts.trip_id
        join public.vehicles v on v.id = t.vehicle_id
        left join public.routes r on r.id = t.route_id
        where ts.student_id = s.id and t.service_date = public.luanda_today()
          and ts.status <> 'transferred'), '[]'::jsonb)
    ) as child
    from public.students s
    join public.student_guardians sg on sg.student_id = s.id and sg.guardian_id = auth.uid()
    join public.companies c on c.id = s.company_id
    left join public.schools sc on sc.id = s.school_id
    where s.active
  ) x
$$;

create function public.platform_set_company_status(p_company_id uuid, p_suspend boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_suspend and coalesce(trim(p_reason), '') = '' then
    raise exception 'Indique o motivo da suspensão.';
  end if;
  update public.companies
  set license_status = case when p_suspend then 'suspended'::public.license_status else 'active'::public.license_status end,
      suspended_reason = case when p_suspend then trim(p_reason) end,
      suspended_at = case when p_suspend then now() end
  where id = p_company_id;
  if not found then
    raise exception 'Empresa não encontrada.';
  end if;

  insert into public.notifications (recipient_id, company_id, type, title, body)
  select p.id, p_company_id,
         case when p_suspend then 'company_suspended' else 'company_reactivated' end,
         case when p_suspend then 'Conta suspensa' else 'Conta reativada' end,
         case when p_suspend then 'A conta foi suspensa pela Kandokids: ' || trim(p_reason)
              else 'A sua conta Kandokids está novamente ativa.' end
  from public.profiles p where p.company_id = p_company_id and p.role in ('company_admin', 'dispatcher');
end;
$$;

create function public.platform_set_company_plan(p_company_id uuid, p_plan public.company_plan, p_expires_on date default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_plan = 'pro' and p_expires_on is null then
    raise exception 'Indique até quando o plano Pro está pago.';
  end if;
  update public.companies
  set plan = p_plan, license_expires_at = case when p_plan = 'pro' then p_expires_on end
  where id = p_company_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Painel da plataforma: números e listas
-- ---------------------------------------------------------------------------
create function public.platform_overview()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Sem permissão.';
  end if;
  return jsonb_build_object(
    'companies',           (select count(*) from public.companies),
    'companies_pro',       (select count(*) from public.companies where plan = 'pro' and license_status <> 'suspended'),
    'companies_free',      (select count(*) from public.companies where plan = 'free' and license_status <> 'suspended'),
    'companies_suspended', (select count(*) from public.companies where license_status = 'suspended'),
    'companies_new_30d',   (select count(*) from public.companies where created_at > now() - interval '30 days'),
    'guardians',           (select count(distinct guardian_id) from public.student_guardians),
    'guardians_active_7d', (select count(distinct sg.guardian_id) from public.student_guardians sg
                            join auth.users u on u.id = sg.guardian_id where u.last_sign_in_at > now() - interval '7 days'),
    'staff',               (select count(*) from public.profiles where role in ('company_admin', 'dispatcher', 'assistant', 'driver')),
    'students',            (select count(*) from public.students where active),
    'vehicles',            (select count(*) from public.vehicles where active),
    'trips_today',         (select count(*) from public.trips where service_date = public.luanda_today()),
    'trips_live',          (select count(*) from public.trips where status = 'in_progress'),
    'addons_active',       (select count(*) from public.guardian_addons where status = 'active' and public.luanda_today() between starts_on and ends_on),
    'addons_pending',      (select count(*) from public.guardian_addons where status = 'pending_payment'),
    'addons_monthly_kz',   (select coalesce(sum(f.addon_price_kz), 0) from public.guardian_addons a join public.features f on f.key = a.feature_key
                            where a.status = 'active' and public.luanda_today() between a.starts_on and a.ends_on),
    'pro_requests',        (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'created_at', n.created_at, 'company_id', n.company_id)
                                    order by n.created_at desc), '[]'::jsonb)
                            from public.notifications n where n.recipient_id = auth.uid() and n.type = 'pro_requested' and n.read_at is null)
  );
end;
$$;

create function public.platform_companies()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Sem permissão.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'phone', c.phone, 'email', c.email, 'nif', c.nif, 'city', c.city,
      'plan', c.plan, 'license_status', c.license_status, 'license_expires_at', c.license_expires_at,
      'suspended_reason', c.suspended_reason, 'created_at', c.created_at,
      'vehicles', (select count(*) from public.vehicles v where v.company_id = c.id and v.active),
      'students', (select count(*) from public.students s where s.company_id = c.id and s.active),
      'guardians', (select count(distinct sg.guardian_id) from public.student_guardians sg join public.students s on s.id = sg.student_id where s.company_id = c.id),
      'staff', (select count(*) from public.profiles p where p.company_id = c.id),
      'trips_7d', (select count(*) from public.trips t where t.company_id = c.id and t.status = 'completed' and t.service_date > public.luanda_today() - 7),
      'last_activity', (select max(u.last_sign_in_at) from public.profiles p join auth.users u on u.id = p.id where p.company_id = c.id),
      'admin', (select jsonb_build_object('full_name', p.full_name, 'phone', p.phone, 'email', u.email)
                from public.profiles p join auth.users u on u.id = p.id
                where p.company_id = c.id and p.role = 'company_admin' order by p.created_at limit 1)
    ) order by c.created_at desc)
    from public.companies c), '[]'::jsonb);
end;
$$;

create function public.platform_guardians(p_search text default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Sem permissão.';
  end if;
  return coalesce((
    select jsonb_agg(x order by x ->> 'created_at' desc) from (
      select jsonb_build_object(
        'id', p.id, 'full_name', p.full_name, 'phone', p.phone, 'email', u.email,
        'created_at', p.created_at, 'last_sign_in_at', u.last_sign_in_at,
        'children', (select jsonb_agg(jsonb_build_object('name', s.full_name, 'company', c.name))
                     from public.student_guardians sg join public.students s on s.id = sg.student_id
                     join public.companies c on c.id = s.company_id where sg.guardian_id = p.id),
        'extras', (select coalesce(jsonb_agg(f.name_pt), '[]'::jsonb) from public.guardian_addons a join public.features f on f.key = a.feature_key
                   where a.guardian_id = p.id and a.status = 'active' and public.luanda_today() between a.starts_on and a.ends_on)
      ) as x
      from public.profiles p join auth.users u on u.id = p.id
      where p.role = 'guardian'
        and exists (select 1 from public.student_guardians sg where sg.guardian_id = p.id)
        and (p_search is null or p.full_name ilike '%' || p_search || '%' or p.phone ilike '%' || p_search || '%' or u.email ilike '%' || p_search || '%')
      limit 500
    ) q), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Definições da plataforma
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
create policy "todos leem as definições" on public.platform_settings for select to authenticated using (true);
create policy "plataforma altera definições" on public.platform_settings for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select, insert, update, delete on public.platform_settings to authenticated;

insert into public.platform_settings (key, value) values
  ('payment_instructions', 'Faça o pagamento por Multicaixa Express e envie o comprovativo à equipa Kandokids. O extra é ativado assim que o pagamento for confirmado.'),
  ('support_phone', ''),
  ('support_whatsapp', '');

-- Permissões: só as funções novas destinadas às apps (nunca "todas", para não reabrir as internas).
revoke execute on function public.get_my_extras(), public.request_addon(text, text), public.company_is_active(uuid),
  public.platform_set_company_status(uuid, boolean, text), public.platform_set_company_plan(uuid, public.company_plan, date),
  public.platform_overview(), public.platform_companies(), public.platform_guardians(text) from public, anon;
grant execute on function public.get_my_extras(), public.request_addon(text, text), public.company_is_active(uuid),
  public.platform_set_company_status(uuid, boolean, text), public.platform_set_company_plan(uuid, public.company_plan, date),
  public.platform_overview(), public.platform_companies(), public.platform_guardians(text) to authenticated, service_role;
