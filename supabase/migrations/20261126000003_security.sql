-- =============================================================================
-- Kandokids — segurança (Row Level Security)
--
-- Princípios:
--  * Funcionários só veem dados da sua empresa.
--  * Encarregados só veem os seus filhos, e a localização da viatura apenas
--    enquanto a viagem do filho está ativa (privacidade).
--  * Ações sensíveis (recolha, entrega, PIN, transferências) passam por funções
--    RPC que aplicam as regras de negócio e as funcionalidades ativas.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Funções auxiliares (security definer evita recursão nas políticas)
-- ---------------------------------------------------------------------------
create function public.my_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

create function public.my_company_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select company_id from public.profiles where id = auth.uid() $$;

create function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select role = 'platform_admin' from public.profiles where id = auth.uid()), false) $$;

-- Qualquer funcionário da empresa (inclui assistentes e motoristas).
create function public.is_staff_of(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and company_id = p_company_id
      and role in ('company_admin', 'dispatcher', 'assistant', 'driver'))
$$;

-- Gestão operacional (rotas, viaturas, alunos).
create function public.is_manager_of(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and company_id = p_company_id
      and role in ('company_admin', 'dispatcher'))
$$;

-- Administração (funcionalidades, preços, funcionários).
create function public.is_admin_of(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and company_id = p_company_id and role = 'company_admin')
$$;

create function public.is_guardian_of(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.student_guardians
    where student_id = p_student_id and guardian_id = auth.uid())
$$;

-- Empresas onde o encarregado tem filhos.
create function public.my_guardian_company_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select distinct s.company_id
  from public.student_guardians sg
  join public.students s on s.id = sg.student_id
  where sg.guardian_id = auth.uid()
$$;

create function public.student_company_id(p_student_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$ select company_id from public.students where id = p_student_id $$;

create function public.trip_company_id(p_trip_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$ select company_id from public.trips where id = p_trip_id $$;

-- Encarregado com um filho nesta viagem (qualquer estado)?
create function public.guardian_has_child_on_trip(p_trip_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.trip_students ts
    join public.student_guardians sg on sg.student_id = ts.student_id
    where ts.trip_id = p_trip_id and sg.guardian_id = auth.uid())
$$;

-- Privacidade: o encarregado só vê a viatura enquanto a viagem está em curso
-- e o filho ainda está à espera ou a bordo.
create function public.guardian_can_track_trip(p_trip_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.trips t
    join public.trip_students ts on ts.trip_id = t.id
    join public.student_guardians sg on sg.student_id = ts.student_id
    where t.id = p_trip_id
      and t.status = 'in_progress'
      and ts.status in ('expected', 'on_board')
      and sg.guardian_id = auth.uid()
      and public.company_has_feature(t.company_id, 'live_tracking'))
$$;

-- O utilizador está escalado nesta viagem (assistente ou motorista)?
create function public.is_crew_of_trip(p_trip_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.trips
    where id = p_trip_id and (assistant_id = auth.uid() or driver_id = auth.uid()))
$$;

-- ---------------------------------------------------------------------------
-- Proteção do papel/empresa no perfil
-- ---------------------------------------------------------------------------
create function public.protect_profile_privileges()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then  -- service role / backend
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

create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- ---------------------------------------------------------------------------
-- Ativar RLS em todas as tabelas
-- ---------------------------------------------------------------------------
alter table public.companies           enable row level security;
alter table public.profiles            enable row level security;
alter table public.schools             enable row level security;
alter table public.vehicles            enable row level security;
alter table public.students            enable row level security;
alter table public.student_pickup_pins enable row level security;  -- sem políticas
alter table public.student_guardians   enable row level security;
alter table public.guardian_invites    enable row level security;
alter table public.authorized_adults   enable row level security;
alter table public.routes              enable row level security;
alter table public.route_stops         enable row level security;
alter table public.trips               enable row level security;
alter table public.trip_students       enable row level security;
alter table public.student_transfers   enable row level security;
alter table public.vehicle_positions   enable row level security;
alter table public.absences            enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.incidents           enable row level security;
alter table public.trip_feedback       enable row level security;
alter table public.notifications       enable row level security;
alter table public.sms_outbox          enable row level security;
alter table public.features            enable row level security;
alter table public.company_features    enable row level security;
alter table public.guardian_addons     enable row level security;

-- ---------------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------------
-- Empresas
create policy "ver empresa" on public.companies for select to authenticated
  using (public.is_staff_of(id) or id in (select public.my_guardian_company_ids()));
create policy "admin edita empresa" on public.companies for update to authenticated
  using (public.is_admin_of(id)) with check (public.is_admin_of(id));
create policy "plataforma cria empresa" on public.companies for insert to authenticated
  with check (public.is_platform_admin());
create policy "plataforma apaga empresa" on public.companies for delete to authenticated
  using (public.is_platform_admin());

-- Perfis
create policy "ver perfis" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_platform_admin()
    -- funcionários veem colegas
    or (company_id is not null and public.is_staff_of(company_id))
    -- funcionários veem encarregados dos seus alunos
    or exists (
      select 1 from public.student_guardians sg join public.students s on s.id = sg.student_id
      where sg.guardian_id = profiles.id and public.is_staff_of(s.company_id))
    -- encarregados veem a equipa (nome/telefone do assistente) da empresa dos filhos
    or (company_id in (select public.my_guardian_company_ids()) and role in ('assistant', 'driver', 'dispatcher', 'company_admin'))
  );
create policy "editar o próprio perfil" on public.profiles for update to authenticated
  using (id = auth.uid() or (company_id is not null and public.is_admin_of(company_id)))
  with check (id = auth.uid() or (company_id is not null and public.is_admin_of(company_id)));

-- Escolas e viaturas
create policy "ver escolas" on public.schools for select to authenticated
  using (public.is_staff_of(company_id) or company_id in (select public.my_guardian_company_ids()));
create policy "gerir escolas" on public.schools for all to authenticated
  using (public.is_manager_of(company_id)) with check (public.is_manager_of(company_id));

create policy "ver viaturas" on public.vehicles for select to authenticated
  using (public.is_staff_of(company_id) or company_id in (select public.my_guardian_company_ids()));
create policy "gerir viaturas" on public.vehicles for all to authenticated
  using (public.is_manager_of(company_id)) with check (public.is_manager_of(company_id));

-- Alunos
create policy "ver alunos" on public.students for select to authenticated
  using (public.is_staff_of(company_id) or public.is_guardian_of(id));
create policy "gerir alunos" on public.students for all to authenticated
  using (public.is_manager_of(company_id)) with check (public.is_manager_of(company_id));

-- Encarregados ↔ alunos
create policy "ver ligações" on public.student_guardians for select to authenticated
  using (guardian_id = auth.uid()
         or public.is_guardian_of(student_id)
         or public.is_staff_of(public.student_company_id(student_id)));
create policy "gerir ligações" on public.student_guardians for all to authenticated
  using (public.is_manager_of(public.student_company_id(student_id)))
  with check (public.is_manager_of(public.student_company_id(student_id)));
create policy "encarregado remove-se" on public.student_guardians for delete to authenticated
  using (guardian_id = auth.uid());

create policy "gerir convites" on public.guardian_invites for all to authenticated
  using (public.is_manager_of(company_id)) with check (public.is_manager_of(company_id));

-- Adultos autorizados
create policy "ver adultos autorizados" on public.authorized_adults for select to authenticated
  using (public.is_guardian_of(student_id) or public.is_staff_of(public.student_company_id(student_id)));
create policy "encarregado gere adultos autorizados" on public.authorized_adults for all to authenticated
  using (public.is_guardian_of(student_id))
  with check (public.is_guardian_of(student_id)
              and public.company_has_feature(public.student_company_id(student_id), 'authorized_adults'));
create policy "gestor gere adultos autorizados" on public.authorized_adults for all to authenticated
  using (public.is_manager_of(public.student_company_id(student_id)))
  with check (public.is_manager_of(public.student_company_id(student_id)));

-- Rotas
create policy "ver rotas" on public.routes for select to authenticated
  using (public.is_staff_of(company_id));
create policy "gerir rotas" on public.routes for all to authenticated
  using (public.is_manager_of(company_id)) with check (public.is_manager_of(company_id));

create policy "ver paragens" on public.route_stops for select to authenticated
  using (exists (select 1 from public.routes r where r.id = route_id and public.is_staff_of(r.company_id)));
create policy "gerir paragens" on public.route_stops for all to authenticated
  using (exists (select 1 from public.routes r where r.id = route_id and public.is_manager_of(r.company_id)))
  with check (exists (select 1 from public.routes r where r.id = route_id and public.is_manager_of(r.company_id)));

-- Viagens
create policy "ver viagens" on public.trips for select to authenticated
  using (public.is_staff_of(company_id) or public.guardian_has_child_on_trip(id));
create policy "gerir viagens" on public.trips for all to authenticated
  using (public.is_manager_of(company_id)) with check (public.is_manager_of(company_id));

create policy "ver passageiros" on public.trip_students for select to authenticated
  using (public.is_staff_of(public.trip_company_id(trip_id)) or public.is_guardian_of(student_id));
create policy "gerir passageiros" on public.trip_students for all to authenticated
  using (public.is_manager_of(public.trip_company_id(trip_id)))
  with check (public.is_manager_of(public.trip_company_id(trip_id)));

create policy "ver transferências" on public.student_transfers for select to authenticated
  using (public.is_staff_of(public.student_company_id(student_id)) or public.is_guardian_of(student_id));

-- Posições GPS
create policy "tripulação envia posição" on public.vehicle_positions for insert to authenticated
  with check (
    public.is_crew_of_trip(trip_id)
    and exists (select 1 from public.trips t
                where t.id = trip_id and t.vehicle_id = vehicle_positions.vehicle_id and t.status = 'in_progress'));
create policy "ver posições" on public.vehicle_positions for select to authenticated
  using (public.is_staff_of(public.trip_company_id(trip_id)) or public.guardian_can_track_trip(trip_id));

-- Ausências ("vai / não vai")
create policy "ver ausências" on public.absences for select to authenticated
  using (public.is_guardian_of(student_id) or public.is_staff_of(public.student_company_id(student_id)));
create policy "encarregado marca ausência" on public.absences for insert to authenticated
  with check (
    public.is_guardian_of(student_id)
    and created_by = auth.uid()
    and service_date >= (now() at time zone 'Africa/Luanda')::date
    and public.company_has_feature(public.student_company_id(student_id), 'absence_toggle'));
create policy "encarregado anula ausência" on public.absences for delete to authenticated
  using (public.is_guardian_of(student_id) and service_date >= (now() at time zone 'Africa/Luanda')::date);
create policy "gestor gere ausências" on public.absences for all to authenticated
  using (public.is_manager_of(public.student_company_id(student_id)))
  with check (public.is_manager_of(public.student_company_id(student_id)));

-- Conversas e mensagens
create policy "ver conversas" on public.conversations for select to authenticated
  using (public.is_staff_of(company_id) or public.is_guardian_of(student_id));

create function public.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (public.is_staff_of(c.company_id) or public.is_guardian_of(c.student_id)))
$$;

create policy "ver mensagens" on public.messages for select to authenticated
  using (public.can_access_conversation(conversation_id));
create policy "enviar mensagens" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.can_access_conversation(conversation_id)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and public.company_has_feature(c.company_id, 'vehicle_chat')
        and (messages.voice_url is null or public.company_has_feature(c.company_id, 'voice_notes'))));

-- Incidentes
create policy "ver incidentes" on public.incidents for select to authenticated
  using (
    public.is_staff_of(company_id)
    or (trip_id is not null and public.guardian_has_child_on_trip(trip_id)
        and (type = 'sos' or public.company_has_feature(company_id, 'incident_broadcast'))));
create policy "tripulação cria incidentes" on public.incidents for insert to authenticated
  with check (
    public.is_staff_of(company_id)
    and created_by = auth.uid()
    and (type <> 'sos' or public.company_has_feature(company_id, 'sos_button'))
    and (type = 'sos' or public.company_has_feature(company_id, 'incident_broadcast') or public.is_manager_of(company_id)));
create policy "gestor resolve incidentes" on public.incidents for update to authenticated
  using (public.is_manager_of(company_id)) with check (public.is_manager_of(company_id));

-- Avaliações
create policy "ver avaliações" on public.trip_feedback for select to authenticated
  using (guardian_id = auth.uid() or public.is_staff_of(public.trip_company_id(trip_id)));
create policy "encarregado avalia" on public.trip_feedback for insert to authenticated
  with check (
    guardian_id = auth.uid()
    and public.guardian_has_child_on_trip(trip_id)
    and public.company_has_feature(public.trip_company_id(trip_id), 'trip_feedback'));

-- Notificações
create policy "ver as minhas notificações" on public.notifications for select to authenticated
  using (recipient_id = auth.uid());
create policy "marcar como lida" on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- SMS (apenas leitura para a gestão; o envio é feito pelo backend)
create policy "gestor vê SMS" on public.sms_outbox for select to authenticated
  using (company_id is not null and public.is_manager_of(company_id));

-- Funcionalidades
create policy "catálogo é público" on public.features for select to authenticated using (true);
create policy "plataforma gere catálogo" on public.features for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "ver funcionalidades da empresa" on public.company_features for select to authenticated
  using (public.is_staff_of(company_id) or company_id in (select public.my_guardian_company_ids()));
create policy "admin altera funcionalidades" on public.company_features for update to authenticated
  using (public.is_admin_of(company_id)) with check (public.is_admin_of(company_id));
create policy "plataforma gere funcionalidades" on public.company_features for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Extras pagos pelos encarregados
create policy "ver os meus extras" on public.guardian_addons for select to authenticated
  using (guardian_id = auth.uid() or public.is_manager_of(company_id));
create policy "gestor gere extras" on public.guardian_addons for all to authenticated
  using (public.is_admin_of(company_id)) with check (public.is_admin_of(company_id));
