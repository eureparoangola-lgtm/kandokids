-- =============================================================================
-- Kandokids — mensagens sempre disponíveis (não só no dia da viagem)
-- O encarregado pode escrever à viatura do filho a qualquer momento (ex.: domingo
-- à noite: "amanhã não vai"); a tripulação é notificada de cada mensagem nova.
-- =============================================================================

-- Viatura atual do aluno: viagem de hoje (em curso primeiro), senão a viatura da rota.
create function public.student_chat_vehicle(p_student_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('id', v.id, 'plate', v.plate, 'nickname', v.nickname)
  from public.vehicles v
  where v.id = coalesce(
    (select t.vehicle_id from public.trip_students ts join public.trips t on t.id = ts.trip_id
     where ts.student_id = p_student_id and t.service_date = public.luanda_today() and ts.status <> 'transferred'
     order by (t.status = 'in_progress') desc, t.started_at desc nulls last limit 1),
    (select r.default_vehicle_id from public.route_stops rs join public.routes r on r.id = rs.route_id
     where rs.student_id = p_student_id and r.active and r.default_vehicle_id is not null
     order by (r.direction = 'to_school') desc limit 1))
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
      -- Viatura para as mensagens: a da viagem de hoje (em curso primeiro) ou a da rota do aluno.
      'chat_vehicle', public.student_chat_vehicle(s.id),
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

-- Tripulação de uma viatura: quem está na viagem de hoje ou é assistente/motorista da rota.
create function public.vehicle_crew_ids(p_vehicle_id uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select p from (
    select unnest(array[t.assistant_id, t.driver_id]) p from public.trips t
    where t.vehicle_id = p_vehicle_id and t.service_date = public.luanda_today()
    union
    select unnest(array[r.default_assistant_id, r.default_driver_id]) from public.routes r
    where r.default_vehicle_id = p_vehicle_id and r.active
  ) x where p is not null
$$;

-- Notificação de cada mensagem nova para o outro lado da conversa.
create function public.on_message_created()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  c public.conversations;
  v_sender public.profiles;
  v_preview text;
begin
  select * into c from public.conversations where id = new.conversation_id;
  select * into v_sender from public.profiles where id = new.sender_id;
  v_preview := left(coalesce(new.body, '🎤 Mensagem de voz'), 140);

  if v_sender.role = 'guardian' then
    insert into public.notifications (recipient_id, company_id, type, title, body, data)
    select crew, c.company_id, 'message', 'Mensagem sobre ' || public.first_name(c.student_id),
           v_sender.full_name || ': ' || v_preview,
           jsonb_build_object('conversation_id', c.id, 'student_id', c.student_id)
    from public.vehicle_crew_ids(c.vehicle_id) crew;
  else
    insert into public.notifications (recipient_id, company_id, type, title, body, data)
    select sg.guardian_id, c.company_id, 'message', 'Mensagem da viatura',
           v_sender.full_name || ': ' || v_preview,
           jsonb_build_object('conversation_id', c.id, 'student_id', c.student_id)
    from public.student_guardians sg
    where sg.student_id = c.student_id and sg.guardian_id <> new.sender_id;
  end if;
  return new;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_created();

revoke execute on function public.on_message_created(), public.vehicle_crew_ids(uuid) from public, anon, authenticated;
revoke execute on function public.student_chat_vehicle(uuid) from public, anon;
grant execute on function public.student_chat_vehicle(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Ausências: uma só notificação por pessoa (antes: uma por viagem do dia,
-- ex.: ida e regresso com a mesma assistente → duas notificações iguais).
-- ---------------------------------------------------------------------------
create or replace function public.on_absence_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  a public.absences := coalesce(new, old);
  v_from public.boarding_status := case when tg_op = 'INSERT' then 'expected' else 'absent' end;
  v_to   public.boarding_status := case when tg_op = 'INSERT' then 'absent' else 'expected' end;
  v_trips uuid[];
begin
  with changed as (
    update public.trip_students ts set status = v_to, updated_at = now()
    from public.trips t
    where t.id = ts.trip_id and ts.student_id = a.student_id and ts.status = v_from
      and t.service_date = a.service_date and (a.direction is null or t.direction = a.direction)
      and t.status in ('scheduled', 'in_progress')
    returning t.id
  )
  select array_agg(id) into v_trips from changed;

  if v_trips is null then
    return null;
  end if;

  insert into public.notifications (recipient_id, company_id, type, title, body, data)
  select distinct on (p) p, t.company_id,
         case when tg_op = 'INSERT' then 'student_absent' else 'student_absence_cancelled' end,
         case when tg_op = 'INSERT' then 'Ausência' else 'Ausência anulada' end,
         case when tg_op = 'INSERT'
              then public.first_name(a.student_id) || ' não vai hoje' || coalesce(' (' || a.reason || ')', '') || '.'
              else public.first_name(a.student_id) || ' afinal vai hoje.' end,
         jsonb_build_object('student_id', a.student_id, 'trip_ids', to_jsonb(v_trips))
  from public.trips t, unnest(array[t.assistant_id, t.driver_id]) p
  where t.id = any (v_trips) and p is not null;
  return null;
end;
$$;
