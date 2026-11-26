-- =============================================================================
-- Kandokids — regras de negócio (RPC)
-- Todas as ações da viatura passam por aqui: valida permissões, aplica as
-- funcionalidades ativas da empresa e gera notificações / SMS.
-- =============================================================================

alter table public.trip_students add column proximity_notified_at timestamptz;

create function public.luanda_today()
returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'Africa/Luanda')::date $$;

create function public.luanda_time_text(p_ts timestamptz)
returns text language sql stable set search_path = ''
as $$ select to_char(p_ts at time zone 'Africa/Luanda', 'HH24:MI') $$;

create function public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- ---------------------------------------------------------------------------
-- Notificações
-- Envia notificação na app a todos os encarregados do aluno.
--  p_feature        → só notifica quem tem esta funcionalidade (null = todos)
--  p_sms            → também envia SMS a quem tem o extra "sms_alerts"
--  p_extra_feature  → quem tem esta funcionalidade recebe também p_extra_data
-- ---------------------------------------------------------------------------
create function public.notify_guardians(
  p_student_id     uuid,
  p_type           text,
  p_title          text,
  p_body           text,
  p_data           jsonb default '{}',
  p_feature        text default null,
  p_sms            boolean default false,
  p_extra_feature  text default null,
  p_extra_data     jsonb default '{}'
)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_company uuid;
  g record;
  v_count int := 0;
begin
  select company_id into v_company from public.students where id = p_student_id;

  for g in
    select p.id, p.phone
    from public.student_guardians sg
    join public.profiles p on p.id = sg.guardian_id
    where sg.student_id = p_student_id
  loop
    if p_feature is not null and not public.guardian_has_feature(g.id, v_company, p_feature) then
      continue;
    end if;

    insert into public.notifications (recipient_id, company_id, type, title, body, data)
    values (
      g.id, v_company, p_type, p_title, p_body,
      p_data || jsonb_build_object('student_id', p_student_id)
             || case when p_extra_feature is not null
                      and public.guardian_has_feature(g.id, v_company, p_extra_feature)
                     then p_extra_data else '{}'::jsonb end);
    v_count := v_count + 1;

    if p_sms and g.phone is not null
       and public.guardian_has_feature(g.id, v_company, 'sms_alerts') then
      insert into public.sms_outbox (company_id, recipient_id, phone, body)
      values (v_company, g.id, g.phone, left('Kandokids: ' || p_body, 320));
    end if;
  end loop;

  return v_count;
end;
$$;

create function public.notify_managers(p_company_id uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}')
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (recipient_id, company_id, type, title, body, data)
  select id, p_company_id, p_type, p_title, p_body, p_data
  from public.profiles
  where company_id = p_company_id and role in ('company_admin', 'dispatcher');
$$;

-- ---------------------------------------------------------------------------
-- Auxiliares de autorização
-- ---------------------------------------------------------------------------
create function public.assert_can_operate_trip(p_trip_id uuid)
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
  return t;
end;
$$;

create function public.vehicle_label(p_vehicle_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$ select coalesce(nickname || ' (' || plate || ')', plate) from public.vehicles where id = p_vehicle_id $$;

create function public.first_name(p_student_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$ select split_part(full_name, ' ', 1) from public.students where id = p_student_id $$;

-- ---------------------------------------------------------------------------
-- Encarregado: PIN de entrega e convites
-- ---------------------------------------------------------------------------
create function public.set_pickup_pin(p_student_id uuid, p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_guardian_of(p_student_id) then
    raise exception 'Apenas o encarregado pode definir o PIN.';
  end if;
  if not public.company_has_feature(public.student_company_id(p_student_id), 'pickup_pin') then
    raise exception 'O PIN de entrega não está ativo nesta empresa.';
  end if;
  if p_pin !~ '^\d{4}$' then
    raise exception 'O PIN deve ter 4 dígitos.';
  end if;

  insert into public.student_pickup_pins (student_id, pin_hash, failed_attempts, updated_by, updated_at)
  values (p_student_id, extensions.crypt(p_pin, extensions.gen_salt('bf')), 0, auth.uid(), now())
  on conflict (student_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0,
        updated_by = excluded.updated_by, updated_at = now();

  perform public.notify_guardians(p_student_id, 'pin_changed', 'PIN de entrega alterado',
    'O PIN de entrega de ' || public.first_name(p_student_id) || ' foi alterado.');
end;
$$;

create function public.has_pickup_pin(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (public.is_guardian_of(p_student_id) or public.is_staff_of(public.student_company_id(p_student_id)))
     and exists (select 1 from public.student_pickup_pins where student_id = p_student_id)
$$;

create function public.accept_guardian_invite(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.guardian_invites;
  v_limit int := 2;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'Inicie sessão para aceitar o convite.';
  end if;

  select * into inv from public.guardian_invites
  where code = upper(trim(p_code)) and accepted_at is null and expires_at > now()
  for update;
  if not found then
    raise exception 'Código inválido ou expirado.';
  end if;

  -- Partilha familiar: até 5 encarregados se a funcionalidade estiver incluída
  -- ou se algum encarregado da criança tiver o extra.
  if public.company_feature_mode(inv.company_id, 'family_sharing') = 'included'
     or exists (select 1 from public.student_guardians sg
                where sg.student_id = inv.student_id
                  and public.guardian_has_feature(sg.guardian_id, inv.company_id, 'family_sharing')) then
    v_limit := 5;
  end if;

  select count(*) into v_count from public.student_guardians where student_id = inv.student_id;
  if v_count >= v_limit then
    raise exception 'Esta criança já tem % encarregados ligados. Ative a "Partilha familiar" para adicionar mais.', v_limit;
  end if;

  insert into public.student_guardians (student_id, guardian_id, relationship, is_primary)
  values (inv.student_id, auth.uid(), inv.relationship, v_count = 0)
  on conflict do nothing;

  update public.guardian_invites set accepted_by = auth.uid(), accepted_at = now() where id = inv.id;
  return inv.student_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Viagem: iniciar
-- ---------------------------------------------------------------------------
create function public.start_trip(p_trip_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  t public.trips;
  ts record;
begin
  t := public.assert_can_operate_trip(p_trip_id);
  if t.status <> 'scheduled' then
    raise exception 'Esta viagem já foi iniciada ou terminada.';
  end if;

  update public.trips set status = 'in_progress', started_at = now() where id = t.id;

  -- Aplicar ausências marcadas pelos encarregados.
  update public.trip_students s set status = 'absent', updated_at = now()
  where s.trip_id = t.id and s.status = 'expected'
    and exists (select 1 from public.absences a
                where a.student_id = s.student_id and a.service_date = t.service_date
                  and (a.direction is null or a.direction = t.direction));

  for ts in select student_id from public.trip_students where trip_id = t.id and status = 'expected' loop
    perform public.notify_guardians(ts.student_id, 'trip_started',
      'Viagem iniciada',
      case t.direction
        when 'to_school' then 'A viatura ' || public.vehicle_label(t.vehicle_id) || ' iniciou a recolha. Acompanhe no mapa.'
        else 'A viatura ' || public.vehicle_label(t.vehicle_id) || ' vai sair da escola em breve.'
      end,
      jsonb_build_object('trip_id', t.id, 'vehicle_id', t.vehicle_id));
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recolha (entrada na viatura)
-- ---------------------------------------------------------------------------
create function public.record_pickup(
  p_trip_student_id uuid,
  p_method public.checkin_method default 'manual',
  p_lat double precision default null,
  p_lng double precision default null
)
returns public.trip_students
language plpgsql security definer set search_path = ''
as $$
declare
  ts public.trip_students;
  t public.trips;
  v_name text;
  v_time text;
begin
  select * into ts from public.trip_students where id = p_trip_student_id for update;
  if not found then
    raise exception 'Registo não encontrado.';
  end if;
  t := public.assert_can_operate_trip(ts.trip_id);

  if t.status <> 'in_progress' then
    raise exception 'Inicie a viagem antes de registar recolhas.';
  end if;
  if ts.status not in ('expected', 'absent', 'no_show') then
    raise exception 'Esta criança já foi registada (%).', ts.status;
  end if;
  if p_method in ('qr', 'nfc') and not public.company_has_feature(t.company_id, 'qr_checkin') then
    raise exception 'O registo por cartão QR/NFC não está ativo.';
  end if;

  update public.trip_students
  set status = 'on_board', checkin_method = p_method, picked_up_at = now(),
      pickup_lat = p_lat, pickup_lng = p_lng, updated_at = now()
  where id = ts.id
  returning * into ts;

  v_name := public.first_name(ts.student_id);
  v_time := public.luanda_time_text(ts.picked_up_at);

  perform public.notify_guardians(ts.student_id, 'picked_up',
    v_name || ' está na viatura',
    case t.direction
      when 'to_school' then v_name || ' foi recolhido(a) às ' || v_time || ' na viatura ' || public.vehicle_label(t.vehicle_id) || '.'
      else v_name || ' entrou na viatura ' || public.vehicle_label(t.vehicle_id) || ' à saída da escola às ' || v_time || '.'
    end,
    jsonb_build_object('trip_id', t.id, 'vehicle_id', t.vehicle_id),
    p_sms => true);

  return ts;
end;
$$;

-- Leitura do cartão QR / etiqueta NFC: identifica a criança e confirma que é desta viatura.
create function public.checkin_by_token(
  p_trip_id uuid,
  p_token text,
  p_lat double precision default null,
  p_lng double precision default null
)
returns public.trip_students
language plpgsql security definer set search_path = ''
as $$
declare
  t public.trips;
  v_student public.students;
  v_ts_id uuid;
  v_method public.checkin_method;
  v_other text;
begin
  t := public.assert_can_operate_trip(p_trip_id);

  select * into v_student from public.students
  where company_id = t.company_id and (qr_token = p_token or nfc_tag_id = p_token);
  if not found then
    raise exception 'Cartão não reconhecido.';
  end if;
  v_method := case when v_student.qr_token = p_token then 'qr' else 'nfc' end;

  select id into v_ts_id from public.trip_students where trip_id = t.id and student_id = v_student.id;
  if v_ts_id is null then
    -- Ajuda a evitar que a criança entre na viatura errada.
    select public.vehicle_label(t2.vehicle_id) into v_other
    from public.trip_students ts2 join public.trips t2 on t2.id = ts2.trip_id
    where ts2.student_id = v_student.id and t2.service_date = t.service_date
      and t2.direction = t.direction and ts2.status <> 'transferred'
    limit 1;
    raise exception '% não pertence a esta viatura.%', v_student.full_name,
      coalesce(' Deve ir na viatura ' || v_other || '.', '');
  end if;

  return public.record_pickup(v_ts_id, v_method, p_lat, p_lng);
end;
$$;

create function public.mark_no_show(p_trip_student_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  ts public.trip_students;
  t public.trips;
begin
  select * into ts from public.trip_students where id = p_trip_student_id for update;
  t := public.assert_can_operate_trip(ts.trip_id);
  if ts.status <> 'expected' then
    raise exception 'Só é possível marcar falta a crianças em espera.';
  end if;
  update public.trip_students set status = 'no_show', updated_at = now() where id = ts.id;
  perform public.notify_guardians(ts.student_id, 'no_show',
    public.first_name(ts.student_id) || ' não foi recolhido(a)',
    'A viatura ' || public.vehicle_label(t.vehicle_id) || ' passou e ' || public.first_name(ts.student_id)
      || ' não apareceu. Contacte a viatura se precisar.',
    jsonb_build_object('trip_id', t.id), p_sms => true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Entrega (saída da viatura) — com PIN / adulto autorizado
-- ---------------------------------------------------------------------------
create function public.record_dropoff(
  p_trip_student_id     uuid,
  p_method              public.handover_method default null,
  p_pin                 text default null,
  p_authorized_adult_id uuid default null,
  p_handed_to_name      text default null,
  p_photo_url           text default null,
  p_lat                 double precision default null,
  p_lng                 double precision default null
)
returns public.trip_students
language plpgsql security definer set search_path = ''
as $$
declare
  ts public.trip_students;
  t public.trips;
  v_method public.handover_method;
  v_pin public.student_pickup_pins;
  v_adult public.authorized_adults;
  v_handed_to text := p_handed_to_name;
  v_name text;
  v_time text;
  v_body text;
begin
  select * into ts from public.trip_students where id = p_trip_student_id for update;
  if not found then
    raise exception 'Registo não encontrado.';
  end if;
  t := public.assert_can_operate_trip(ts.trip_id);

  if ts.status <> 'on_board' then
    raise exception 'Esta criança não está a bordo.';
  end if;

  if t.direction = 'to_school' then
    v_method := coalesce(p_method, 'school_staff');
  else
    v_method := coalesce(p_method, 'guardian');

    if v_method = 'pin' then
      if not public.company_has_feature(t.company_id, 'pickup_pin') then
        raise exception 'O PIN de entrega não está ativo.';
      end if;
      select * into v_pin from public.student_pickup_pins where student_id = ts.student_id for update;
      if not found then
        raise exception 'O encarregado ainda não definiu um PIN.';
      end if;
      if v_pin.failed_attempts >= 5 then
        raise exception 'PIN bloqueado após 5 tentativas erradas. O encarregado deve definir um novo PIN.';
      end if;
      if p_pin is null or extensions.crypt(p_pin, v_pin.pin_hash) <> v_pin.pin_hash then
        update public.student_pickup_pins set failed_attempts = failed_attempts + 1 where student_id = ts.student_id;
        if v_pin.failed_attempts + 1 >= 3 then
          perform public.notify_guardians(ts.student_id, 'pin_failed', 'Tentativa de PIN errado',
            'Foram introduzidos PINs errados na entrega de ' || public.first_name(ts.student_id) || '.',
            jsonb_build_object('trip_id', t.id), p_sms => true);
        end if;
        -- O raise anularia a contagem acima; devolvemos o erro via resultado.
        return null;
      end if;
      update public.student_pickup_pins set failed_attempts = 0 where student_id = ts.student_id;

    elsif v_method = 'authorized_adult' then
      select * into v_adult from public.authorized_adults
      where id = p_authorized_adult_id and student_id = ts.student_id and active;
      if not found then
        raise exception 'Esta pessoa não está autorizada a receber a criança.';
      end if;
      v_handed_to := v_adult.full_name;

    elsif public.company_has_feature(t.company_id, 'pickup_pin')
          and exists (select 1 from public.student_pickup_pins where student_id = ts.student_id) then
      -- PIN ativo e definido: a entrega tem de ser com PIN ou adulto autorizado.
      raise exception 'Esta criança só pode ser entregue com o PIN ou a um adulto autorizado.';
    end if;
  end if;

  update public.trip_students
  set status = 'delivered', delivered_at = now(), delivered_lat = p_lat, delivered_lng = p_lng,
      handover_method = v_method, handed_to_name = v_handed_to,
      authorized_adult_id = v_adult.id,
      handover_photo_url = case when public.company_has_feature(t.company_id, 'dropoff_photo') then p_photo_url end,
      updated_at = now()
  where id = ts.id
  returning * into ts;

  v_name := public.first_name(ts.student_id);
  v_time := public.luanda_time_text(ts.delivered_at);
  v_body := case t.direction
    when 'to_school' then v_name || ' chegou à escola às ' || v_time || '.'
    else v_name || ' foi entregue em casa às ' || v_time
         || coalesce(' a ' || v_handed_to, '')
         || case v_method when 'pin' then ' (PIN confirmado)' else '' end || '.'
  end;

  perform public.notify_guardians(ts.student_id, 'delivered',
    case t.direction when 'to_school' then v_name || ' chegou à escola' else v_name || ' chegou a casa' end,
    v_body,
    jsonb_build_object('trip_id', t.id),
    p_sms => true,
    p_extra_feature => 'dropoff_photo',
    p_extra_data => jsonb_build_object('photo_url', ts.handover_photo_url));

  return ts;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mudança de viatura
-- ---------------------------------------------------------------------------
create function public.transfer_student(p_trip_student_id uuid, p_to_trip_id uuid, p_reason text default null)
returns public.trip_students
language plpgsql security definer set search_path = ''
as $$
declare
  ts public.trip_students;
  t_from public.trips;
  t_to public.trips;
  v_new public.trip_students;
begin
  select * into ts from public.trip_students where id = p_trip_student_id for update;
  if not found then
    raise exception 'Registo não encontrado.';
  end if;
  select * into t_from from public.trips where id = ts.trip_id;
  select * into t_to from public.trips where id = p_to_trip_id;

  if not public.is_manager_of(t_from.company_id) then
    raise exception 'Apenas a gestão pode mudar crianças de viatura.';
  end if;
  if t_to.id is null or t_to.company_id <> t_from.company_id then
    raise exception 'Viagem de destino inválida.';
  end if;
  if t_to.status in ('completed', 'cancelled') or t_to.direction <> t_from.direction then
    raise exception 'A viagem de destino já terminou ou vai noutro sentido.';
  end if;
  if ts.status in ('delivered', 'transferred') then
    raise exception 'Esta criança já não está nesta viagem.';
  end if;

  insert into public.trip_students (trip_id, student_id, status, position, checkin_method, picked_up_at, pickup_lat, pickup_lng)
  values (t_to.id, ts.student_id, ts.status,
          coalesce((select max(position) + 1 from public.trip_students where trip_id = t_to.id), 0),
          ts.checkin_method, ts.picked_up_at, ts.pickup_lat, ts.pickup_lng)
  on conflict (trip_id, student_id) do update set status = excluded.status, updated_at = now()
  returning * into v_new;

  update public.trip_students set status = 'transferred', transferred_to = v_new.id, updated_at = now()
  where id = ts.id;

  insert into public.student_transfers (student_id, from_trip_id, to_trip_id, reason, created_by)
  values (ts.student_id, t_from.id, t_to.id, p_reason, auth.uid());

  perform public.notify_guardians(ts.student_id, 'vehicle_changed',
    public.first_name(ts.student_id) || ' mudou de viatura',
    public.first_name(ts.student_id) || ' passou para a viatura ' || public.vehicle_label(t_to.vehicle_id)
      || coalesce(' — ' || p_reason, '') || '.',
    jsonb_build_object('trip_id', t_to.id, 'vehicle_id', t_to.vehicle_id, 'from_vehicle_id', t_from.vehicle_id),
    p_sms => true);

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Terminar viagem — verificação de viatura vazia
-- ---------------------------------------------------------------------------
create function public.end_trip(p_trip_id uuid, p_confirm_empty boolean default false)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  t public.trips;
  v_on_board text;
begin
  t := public.assert_can_operate_trip(p_trip_id);
  if t.status <> 'in_progress' then
    raise exception 'Esta viagem não está em curso.';
  end if;

  select string_agg(s.full_name, ', ' order by ts.position) into v_on_board
  from public.trip_students ts join public.students s on s.id = ts.student_id
  where ts.trip_id = t.id and ts.status = 'on_board';

  if public.company_has_feature(t.company_id, 'empty_vehicle_check') then
    if v_on_board is not null then
      perform public.notify_managers(t.company_id, 'child_left_on_board', 'ALERTA: criança a bordo',
        'Tentativa de terminar a viagem da viatura ' || public.vehicle_label(t.vehicle_id)
          || ' com crianças a bordo: ' || v_on_board,
        jsonb_build_object('trip_id', t.id));
      raise exception 'Ainda há crianças a bordo: %. Registe a entrega antes de terminar.', v_on_board;
    end if;
    if not p_confirm_empty then
      raise exception 'Confirme que verificou todos os bancos e que a viatura está vazia.';
    end if;
  end if;

  update public.trip_students set status = 'no_show', updated_at = now()
  where trip_id = t.id and status = 'expected';

  update public.trips
  set status = 'completed', ended_at = now(),
      empty_check_confirmed_at = case when p_confirm_empty then now() end,
      empty_check_confirmed_by = case when p_confirm_empty then auth.uid() end
  where id = t.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Incidentes e SOS
-- ---------------------------------------------------------------------------
create function public.report_incident(
  p_trip_id uuid,
  p_type public.incident_type,
  p_message text default null,
  p_lat double precision default null,
  p_lng double precision default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  t public.trips;
  v_id uuid;
  ts record;
  v_title text;
begin
  t := public.assert_can_operate_trip(p_trip_id);

  if p_type = 'sos' and not public.company_has_feature(t.company_id, 'sos_button') then
    raise exception 'O botão SOS não está ativo.';
  end if;

  insert into public.incidents (company_id, trip_id, vehicle_id, type, message, lat, lng, created_by)
  values (t.company_id, t.id, t.vehicle_id, p_type, p_message, p_lat, p_lng, auth.uid())
  returning id into v_id;

  v_title := case p_type
    when 'sos' then 'EMERGÊNCIA na viatura'
    when 'delay' then 'Atraso na viatura'
    when 'breakdown' then 'Avaria na viatura'
    when 'accident' then 'Acidente na viatura'
    when 'route_change' then 'Mudança de rota'
    else 'Aviso da viatura' end;

  perform public.notify_managers(t.company_id, 'incident_' || p_type, v_title,
    public.vehicle_label(t.vehicle_id) || coalesce(': ' || p_message, ''),
    jsonb_build_object('trip_id', t.id, 'incident_id', v_id, 'lat', p_lat, 'lng', p_lng));

  if p_type = 'sos' or public.company_has_feature(t.company_id, 'incident_broadcast') then
    for ts in select student_id from public.trip_students
              where trip_id = t.id and status in ('expected', 'on_board') loop
      perform public.notify_guardians(ts.student_id, 'incident_' || p_type, v_title,
        public.vehicle_label(t.vehicle_id) || coalesce(': ' || p_message, ''),
        jsonb_build_object('trip_id', t.id, 'incident_id', v_id),
        p_sms => p_type in ('sos', 'accident', 'breakdown'));
    end loop;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Posições GPS: excesso de velocidade e aviso de aproximação
-- ---------------------------------------------------------------------------
create function public.on_vehicle_position()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  t public.trips;
  c public.companies;
  ts record;
  v_radius_m double precision;
  v_target_lat double precision;
  v_target_lng double precision;
begin
  select * into t from public.trips where id = new.trip_id;
  select * into c from public.companies where id = t.company_id;

  -- Excesso de velocidade (no máximo um alerta a cada 5 minutos por viagem)
  if new.speed_kmh is not null and new.speed_kmh > c.speed_limit_kmh
     and not exists (select 1 from public.incidents
                     where trip_id = t.id and type = 'speeding' and created_at > now() - interval '5 minutes') then
    insert into public.incidents (company_id, trip_id, vehicle_id, type, message, lat, lng, speed_kmh)
    values (c.id, t.id, t.vehicle_id, 'speeding',
            round(new.speed_kmh) || ' km/h (limite ' || c.speed_limit_kmh || ' km/h)', new.lat, new.lng, new.speed_kmh);

    perform public.notify_managers(c.id, 'speeding', 'Excesso de velocidade',
      public.vehicle_label(t.vehicle_id) || ' a ' || round(new.speed_kmh) || ' km/h (limite ' || c.speed_limit_kmh || ').',
      jsonb_build_object('trip_id', t.id, 'lat', new.lat, 'lng', new.lng));

    for ts in select student_id from public.trip_students where trip_id = t.id and status = 'on_board' loop
      perform public.notify_guardians(ts.student_id, 'speeding', 'Excesso de velocidade',
        'A viatura de ' || public.first_name(ts.student_id) || ' circulou a ' || round(new.speed_kmh)
          || ' km/h (limite ' || c.speed_limit_kmh || ' km/h). A empresa foi notificada.',
        jsonb_build_object('trip_id', t.id),
        p_feature => 'speeding_alerts');
    end loop;
  end if;

  -- Aviso de aproximação: raio ≈ minutos × 400 m (≈ 24 km/h em trânsito urbano)
  if public.company_has_feature(c.id, 'proximity_alert') then
    v_radius_m := c.proximity_minutes * 400;
    for ts in
      select x.id, x.student_id, s.home_lat, s.home_lng
      from public.trip_students x join public.students s on s.id = x.student_id
      where x.trip_id = t.id and x.proximity_notified_at is null
        and s.home_lat is not null
        and x.status = case t.direction when 'to_school' then 'expected'::public.boarding_status
                                        else 'on_board'::public.boarding_status end
    loop
      if public.distance_m(new.lat, new.lng, ts.home_lat, ts.home_lng) <= v_radius_m then
        update public.trip_students set proximity_notified_at = now() where id = ts.id;
        perform public.notify_guardians(ts.student_id, 'proximity', 'A viatura está a chegar',
          case t.direction
            when 'to_school' then 'A viatura está a cerca de ' || c.proximity_minutes || ' min. Prepare ' || public.first_name(ts.student_id) || ' à porta.'
            else public.first_name(ts.student_id) || ' chega a casa em cerca de ' || c.proximity_minutes || ' min.'
          end,
          jsonb_build_object('trip_id', t.id),
          p_feature => 'proximity_alert');
      end if;
    end loop;
  end if;

  return new;
end;
$$;

create trigger vehicle_positions_after_insert
  after insert on public.vehicle_positions
  for each row execute function public.on_vehicle_position();

-- ---------------------------------------------------------------------------
-- Conversa com a viatura do filho
-- ---------------------------------------------------------------------------
create function public.open_vehicle_conversation(p_student_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_company uuid := public.student_company_id(p_student_id);
  v_vehicle uuid;
  v_id uuid;
begin
  if not (public.is_guardian_of(p_student_id) or public.is_staff_of(v_company)) then
    raise exception 'Sem permissão.';
  end if;
  if not public.company_has_feature(v_company, 'vehicle_chat') then
    raise exception 'As mensagens com a viatura não estão ativas.';
  end if;

  -- Viatura atual: viagem de hoje (em curso primeiro), senão a viatura da rota.
  select t.vehicle_id into v_vehicle
  from public.trip_students ts join public.trips t on t.id = ts.trip_id
  where ts.student_id = p_student_id and t.service_date = public.luanda_today()
    and ts.status <> 'transferred'
  order by (t.status = 'in_progress') desc, t.started_at desc nulls last
  limit 1;

  if v_vehicle is null then
    select r.default_vehicle_id into v_vehicle
    from public.route_stops rs join public.routes r on r.id = rs.route_id
    where rs.student_id = p_student_id and r.active and r.default_vehicle_id is not null
    limit 1;
  end if;
  if v_vehicle is null then
    raise exception 'Esta criança ainda não tem viatura atribuída.';
  end if;

  insert into public.conversations (company_id, vehicle_id, student_id)
  values (v_company, v_vehicle, p_student_id)
  on conflict (vehicle_id, student_id) do update set vehicle_id = excluded.vehicle_id
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funcionalidades para a app do encarregado
-- ---------------------------------------------------------------------------
create function public.get_my_features(p_company_id uuid)
returns table (
  feature_key     text,
  name_pt         text,
  description_pt  text,
  category        public.feature_category,
  mode            public.feature_mode,
  enabled         boolean,     -- pode usar agora
  addon_price_kz  numeric,
  addon_status    public.addon_status,
  addon_ends_on   date
)
language sql stable security definer set search_path = ''
as $$
  select f.key, f.name_pt, f.description_pt, f.category,
         public.company_feature_mode(p_company_id, f.key),
         public.guardian_has_feature(auth.uid(), p_company_id, f.key),
         case when cf.mode = 'addon' then cf.addon_price_kz end,
         ga.status, ga.ends_on
  from public.features f
  left join public.company_features cf on cf.company_id = p_company_id and cf.feature_key = f.key
  left join lateral (
    select status, ends_on from public.guardian_addons
    where guardian_id = auth.uid() and company_id = p_company_id and feature_key = f.key
    order by created_at desc limit 1) ga on true
  where (p_company_id in (select public.my_guardian_company_ids()) or public.is_staff_of(p_company_id))
    and public.company_feature_mode(p_company_id, f.key) <> 'off'
  order by f.sort_order
$$;

-- Encarregado pede um extra (fica pendente até a empresa confirmar o pagamento).
create function public.request_addon(p_company_id uuid, p_feature_key text, p_payment_method text default 'multicaixa_express')
returns public.guardian_addons
language plpgsql security definer set search_path = ''
as $$
declare
  cf public.company_features;
  ga public.guardian_addons;
begin
  if p_company_id not in (select public.my_guardian_company_ids()) then
    raise exception 'Sem permissão.';
  end if;
  select * into cf from public.company_features where company_id = p_company_id and feature_key = p_feature_key;
  if cf.mode is distinct from 'addon' then
    raise exception 'Esta funcionalidade não está disponível como extra.';
  end if;
  if public.guardian_has_feature(auth.uid(), p_company_id, p_feature_key) then
    raise exception 'Já tem este extra ativo.';
  end if;

  select * into ga from public.guardian_addons
  where guardian_id = auth.uid() and company_id = p_company_id
    and feature_key = p_feature_key and status = 'pending_payment';
  if found then
    return ga;
  end if;

  insert into public.guardian_addons (company_id, guardian_id, feature_key, amount_kz, payment_method)
  values (p_company_id, auth.uid(), p_feature_key, cf.addon_price_kz, p_payment_method)
  returning * into ga;

  perform public.notify_managers(p_company_id, 'addon_requested', 'Novo pedido de extra',
    (select full_name from public.profiles where id = auth.uid()) || ' pediu o extra "'
      || (select name_pt from public.features where key = p_feature_key) || '".',
    jsonb_build_object('addon_id', ga.id));
  return ga;
end;
$$;

-- Empresa confirma o pagamento e ativa o extra por N meses.
create function public.activate_addon(p_addon_id uuid, p_months int default 1, p_payment_reference text default null)
returns public.guardian_addons
language plpgsql security definer set search_path = ''
as $$
declare
  ga public.guardian_addons;
  v_start date;
begin
  select * into ga from public.guardian_addons where id = p_addon_id for update;
  if not found or not public.is_admin_of(ga.company_id) then
    raise exception 'Sem permissão.';
  end if;
  if p_months not between 1 and 12 then
    raise exception 'Número de meses inválido.';
  end if;

  -- Renovação: começa no dia seguinte ao fim do extra atual, se ainda estiver ativo.
  select greatest(public.luanda_today(), coalesce(max(ends_on) + 1, public.luanda_today())) into v_start
  from public.guardian_addons
  where guardian_id = ga.guardian_id and company_id = ga.company_id
    and feature_key = ga.feature_key and status = 'active' and id <> ga.id;

  update public.guardian_addons
  set status = 'active', starts_on = v_start,
      ends_on = (v_start + make_interval(months => p_months))::date - 1,
      amount_kz = ga.amount_kz * p_months,
      payment_reference = coalesce(p_payment_reference, payment_reference)
  where id = ga.id
  returning * into ga;

  insert into public.notifications (recipient_id, company_id, type, title, body, data)
  values (ga.guardian_id, ga.company_id, 'addon_activated', 'Extra ativado',
          '"' || (select name_pt from public.features where key = ga.feature_key)
            || '" está ativo até ' || to_char(ga.ends_on, 'DD/MM/YYYY') || '.',
          jsonb_build_object('addon_id', ga.id));
  return ga;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões de execução
-- Funções internas não podem ser chamadas diretamente pelas apps.
-- ---------------------------------------------------------------------------
revoke execute on function public.notify_guardians(uuid, text, text, text, jsonb, text, boolean, text, jsonb) from public, anon, authenticated;
revoke execute on function public.notify_managers(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.assert_can_operate_trip(uuid) from public, anon, authenticated;
revoke execute on function public.on_vehicle_position() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.seed_company_features() from public, anon, authenticated;
