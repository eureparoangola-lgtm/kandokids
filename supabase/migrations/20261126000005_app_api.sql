-- =============================================================================
-- Kandokids — API para a app móvel (encarregado e assistente)
-- Funções de leitura que devolvem tudo o que cada ecrã precisa numa só chamada.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Ausência marcada depois de a viagem estar criada/iniciada:
-- atualiza a lista da viatura e avisa a tripulação.
-- ---------------------------------------------------------------------------
create function public.on_absence_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  a public.absences := coalesce(new, old);
  r record;
begin
  for r in
    select ts.id, ts.status, t.id as trip_id, t.assistant_id, t.driver_id, t.company_id
    from public.trip_students ts join public.trips t on t.id = ts.trip_id
    where ts.student_id = a.student_id and t.service_date = a.service_date
      and (a.direction is null or t.direction = a.direction)
      and t.status in ('scheduled', 'in_progress')
  loop
    if tg_op = 'INSERT' and r.status = 'expected' then
      update public.trip_students set status = 'absent', updated_at = now() where id = r.id;
      insert into public.notifications (recipient_id, company_id, type, title, body, data)
      select p, r.company_id, 'student_absent', 'Ausência',
             public.first_name(a.student_id) || ' não vai hoje' || coalesce(' (' || a.reason || ')', '') || '.',
             jsonb_build_object('trip_id', r.trip_id, 'student_id', a.student_id)
      from unnest(array[r.assistant_id, r.driver_id]) p where p is not null;
    elsif tg_op = 'DELETE' and r.status = 'absent' then
      update public.trip_students set status = 'expected', updated_at = now() where id = r.id;
      insert into public.notifications (recipient_id, company_id, type, title, body, data)
      select p, r.company_id, 'student_absence_cancelled', 'Ausência anulada',
             public.first_name(a.student_id) || ' afinal vai hoje.',
             jsonb_build_object('trip_id', r.trip_id, 'student_id', a.student_id)
      from unnest(array[r.assistant_id, r.driver_id]) p where p is not null;
    end if;
  end loop;
  return null;
end;
$$;

create trigger absences_after_change
  after insert or delete on public.absences
  for each row execute function public.on_absence_change();

-- ---------------------------------------------------------------------------
-- Encarregado: os meus filhos, viagens de hoje e funcionalidades
-- ---------------------------------------------------------------------------
create function public.get_guardian_dashboard()
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

-- Última posição da viatura (mesmas regras de privacidade que vehicle_positions).
create function public.get_trip_live(p_trip_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when public.is_staff_of(t.company_id) or public.guardian_can_track_trip(t.id) then
    jsonb_build_object(
      'trip_id', t.id,
      'status', t.status,
      'position', (select jsonb_build_object('lat', vp.lat, 'lng', vp.lng, 'speed_kmh', vp.speed_kmh,
                                             'heading', vp.heading, 'recorded_at', vp.recorded_at)
                   from public.vehicle_positions vp where vp.trip_id = t.id
                   order by vp.recorded_at desc limit 1),
      'school', (select jsonb_build_object('name', sc.name, 'lat', sc.lat, 'lng', sc.lng)
                 from public.routes r join public.schools sc on sc.id = r.school_id where r.id = t.route_id))
  end
  from public.trips t where t.id = p_trip_id
$$;

-- ---------------------------------------------------------------------------
-- Assistente / motorista: viagens do dia e lista de passageiros
-- ---------------------------------------------------------------------------
create function public.get_crew_trips(p_date date default null)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'trip_id',        t.id,
    'direction',      t.direction,
    'status',         t.status,
    'route_name',     r.name,
    'scheduled_time', r.scheduled_time,
    'vehicle',        jsonb_build_object('id', v.id, 'plate', v.plate, 'nickname', v.nickname),
    'total',          (select count(*) from public.trip_students x where x.trip_id = t.id and x.status <> 'transferred'),
    'on_board',       (select count(*) from public.trip_students x where x.trip_id = t.id and x.status = 'on_board'),
    'delivered',      (select count(*) from public.trip_students x where x.trip_id = t.id and x.status = 'delivered'),
    'absent',         (select count(*) from public.trip_students x where x.trip_id = t.id and x.status = 'absent')
  ) order by (t.status = 'completed'), r.scheduled_time nulls last, t.direction), '[]'::jsonb)
  from public.trips t
  join public.vehicles v on v.id = t.vehicle_id
  left join public.routes r on r.id = t.route_id
  where t.service_date = coalesce(p_date, public.luanda_today())
    and t.status <> 'cancelled'
    and (t.assistant_id = auth.uid() or t.driver_id = auth.uid())
$$;

create function public.get_trip_manifest(p_trip_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  t public.trips;
  v_result jsonb;
begin
  select * into t from public.trips where id = p_trip_id;
  if not found or not public.is_staff_of(t.company_id) then
    raise exception 'Sem permissão.';
  end if;

  select jsonb_build_object(
    'trip_id',     t.id,
    'direction',   t.direction,
    'status',      t.status,
    'started_at',  t.started_at,
    'ended_at',    t.ended_at,
    'route_name',  r.name,
    'vehicle',     jsonb_build_object('id', v.id, 'plate', v.plate, 'nickname', v.nickname),
    'school',      (select jsonb_build_object('name', sc.name, 'lat', sc.lat, 'lng', sc.lng) from public.schools sc where sc.id = r.school_id),
    'features', jsonb_build_object(
      'pickup_pin',          public.company_has_feature(t.company_id, 'pickup_pin'),
      'authorized_adults',   public.company_has_feature(t.company_id, 'authorized_adults'),
      'qr_checkin',          public.company_has_feature(t.company_id, 'qr_checkin'),
      'empty_vehicle_check', public.company_has_feature(t.company_id, 'empty_vehicle_check'),
      'sos_button',          public.company_has_feature(t.company_id, 'sos_button'),
      'incident_broadcast',  public.company_has_feature(t.company_id, 'incident_broadcast'),
      'dropoff_photo',       public.company_has_feature(t.company_id, 'dropoff_photo'),
      'vehicle_chat',        public.company_has_feature(t.company_id, 'vehicle_chat')),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'trip_student_id', ts.id,
        'student_id',      s.id,
        'full_name',       s.full_name,
        'grade',           s.grade,
        'photo_url',       s.photo_url,
        'home_address',    s.home_address,
        'home_lat',        s.home_lat,
        'home_lng',        s.home_lng,
        'medical_notes',   s.medical_notes,
        'status',          ts.status,
        'picked_up_at',    ts.picked_up_at,
        'delivered_at',    ts.delivered_at,
        'has_pin',         exists (select 1 from public.student_pickup_pins p where p.student_id = s.id),
        'guardians', (select coalesce(jsonb_agg(jsonb_build_object('full_name', p.full_name, 'phone', p.phone, 'relationship', sg.relationship)), '[]'::jsonb)
                      from public.student_guardians sg join public.profiles p on p.id = sg.guardian_id
                      where sg.student_id = s.id),
        'authorized_adults', (select coalesce(jsonb_agg(jsonb_build_object('id', aa.id, 'full_name', aa.full_name, 'relationship', aa.relationship, 'id_document', aa.id_document)), '[]'::jsonb)
                              from public.authorized_adults aa where aa.student_id = s.id and aa.active)
      ) order by ts.position, s.full_name)
      from public.trip_students ts join public.students s on s.id = ts.student_id
      where ts.trip_id = t.id and ts.status <> 'transferred'), '[]'::jsonb)
  ) into v_result
  from public.vehicles v
  left join public.routes r on r.id = t.route_id
  where v.id = t.vehicle_id;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mensagens: marcar como lidas
-- ---------------------------------------------------------------------------
create function public.mark_conversation_read(p_conversation_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.messages set read_at = now()
  where conversation_id = p_conversation_id and read_at is null and sender_id <> auth.uid()
    and public.can_access_conversation(p_conversation_id)
$$;

-- ---------------------------------------------------------------------------
-- Tempo real (Supabase Realtime). Ignorado onde a publicação não existe (testes).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.vehicle_positions, public.trip_students, public.messages, public.notifications, public.trips;
  end if;
end $$;
