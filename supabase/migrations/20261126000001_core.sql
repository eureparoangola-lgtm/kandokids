-- =============================================================================
-- Kandokids — esquema principal
-- Transporte escolar: empresas, viaturas, alunos, encarregados, viagens.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.app_role as enum (
  'platform_admin',  -- equipa Kandokids
  'company_admin',   -- dono / gestor da empresa de transporte
  'dispatcher',      -- operador que gere rotas e viaturas no dia-a-dia
  'assistant',       -- vigilante/assistente dentro da viatura
  'driver',          -- motorista
  'guardian'         -- encarregado de educação
);

create type public.trip_direction  as enum ('to_school', 'to_home');
create type public.trip_status     as enum ('scheduled', 'in_progress', 'completed', 'cancelled');
create type public.boarding_status as enum ('expected', 'absent', 'on_board', 'delivered', 'no_show', 'transferred');
create type public.checkin_method  as enum ('manual', 'qr', 'nfc');
create type public.handover_method as enum ('pin', 'authorized_adult', 'guardian', 'school_staff', 'none');
create type public.license_status  as enum ('trial', 'active', 'suspended', 'expired');
create type public.incident_type   as enum ('delay', 'breakdown', 'accident', 'sos', 'speeding', 'route_change', 'other');

-- ---------------------------------------------------------------------------
-- Empresas de transporte (clientes da Kandokids)
-- ---------------------------------------------------------------------------
create table public.companies (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  nif                 text,
  phone               text,
  email               text,
  address             text,
  logo_url            text,
  -- Licenciamento: licença anual + mensalidade
  license_status      public.license_status not null default 'trial',
  license_expires_at  date,
  monthly_paid_until  date,
  -- Definições operacionais
  speed_limit_kmh     int  not null default 60  check (speed_limit_kmh between 20 and 140),
  proximity_minutes   int  not null default 5   check (proximity_minutes between 1 and 30),
  absence_cutoff      time not null default '06:00',
  timezone            text not null default 'Africa/Luanda',
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- Encarregados não pertencem a uma empresa: podem ter filhos em empresas diferentes.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  company_id  uuid references public.companies (id) on delete set null,
  role        public.app_role not null default 'guardian',
  full_name   text not null default '',
  phone       text,
  avatar_url  text,
  locale      text not null default 'pt-AO',
  push_token  text,
  created_at  timestamptz not null default now(),
  constraint staff_needs_company check (role in ('guardian', 'platform_admin') or company_id is not null)
);
create index on public.profiles (company_id);

-- Todo o novo registo é encarregado. Funcionários são promovidos pelo administrador
-- (nunca confiamos no papel enviado pelo cliente).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Escolas, viaturas, alunos
-- ---------------------------------------------------------------------------
create table public.schools (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null,
  address     text,
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now()
);
create index on public.schools (company_id);

create table public.vehicles (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  plate       text not null,               -- matrícula, ex.: LD-23-45-AB
  nickname    text,                        -- ex.: "Autocarro Azul"
  model       text,
  color       text,
  capacity    int not null default 15 check (capacity > 0),
  photo_url   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (company_id, plate)
);

create table public.students (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies (id) on delete cascade,
  school_id              uuid references public.schools (id) on delete set null,
  full_name              text not null,
  birth_date             date,
  grade                  text,              -- classe / turma
  photo_url              text,
  home_address           text,
  home_lat               double precision,
  home_lng               double precision,
  medical_notes          text,              -- alergias, medicação
  qr_token               text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  nfc_tag_id             text unique,
  active                 boolean not null default true,
  created_at             timestamptz not null default now()
);
create index on public.students (company_id);
create index on public.students (school_id);

-- PIN de entrega (bcrypt). Tabela sem políticas RLS: só acessível via funções
-- security definer — o hash nunca sai da base de dados.
create table public.student_pickup_pins (
  student_id  uuid primary key references public.students (id) on delete cascade,
  pin_hash    text not null,
  failed_attempts int not null default 0,
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now()
);

create table public.student_guardians (
  student_id    uuid not null references public.students (id) on delete cascade,
  guardian_id   uuid not null references public.profiles (id) on delete cascade,
  relationship  text,             -- mãe, pai, tio...
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  primary key (student_id, guardian_id)
);
create index on public.student_guardians (guardian_id);

-- Convite para ligar um encarregado a um aluno (enviado por SMS/WhatsApp pela empresa).
create table public.guardian_invites (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,
  phone        text not null,
  relationship text,
  code         text not null unique default upper(encode(extensions.gen_random_bytes(4), 'hex')),
  created_by   uuid references public.profiles (id),
  accepted_by  uuid references public.profiles (id),
  accepted_at  timestamptz,
  expires_at   timestamptz not null default now() + interval '14 days',
  created_at   timestamptz not null default now()
);

-- Adultos autorizados a receber a criança (além dos encarregados).
create table public.authorized_adults (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students (id) on delete cascade,
  full_name     text not null,
  phone         text,
  relationship  text,
  id_document   text,            -- nº do BI
  photo_url     text,
  active        boolean not null default true,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);
create index on public.authorized_adults (student_id);

-- ---------------------------------------------------------------------------
-- Rotas (modelo) e viagens (instância diária)
-- ---------------------------------------------------------------------------
create table public.routes (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,
  school_id             uuid references public.schools (id) on delete set null,
  name                  text not null,
  direction             public.trip_direction not null,
  scheduled_time        time,
  weekdays              int[] not null default '{1,2,3,4,5}',  -- ISO: 1 = segunda
  default_vehicle_id    uuid references public.vehicles (id) on delete set null,
  default_assistant_id  uuid references public.profiles (id) on delete set null,
  default_driver_id     uuid references public.profiles (id) on delete set null,
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);
create index on public.routes (company_id);

create table public.route_stops (
  route_id    uuid not null references public.routes (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  position    int not null default 0,
  primary key (route_id, student_id)
);
create index on public.route_stops (student_id);

create table public.trips (
  id                         uuid primary key default gen_random_uuid(),
  company_id                 uuid not null references public.companies (id) on delete cascade,
  route_id                   uuid references public.routes (id) on delete set null,
  vehicle_id                 uuid not null references public.vehicles (id),
  assistant_id               uuid references public.profiles (id),
  driver_id                  uuid references public.profiles (id),
  direction                  public.trip_direction not null,
  service_date               date not null default current_date,
  status                     public.trip_status not null default 'scheduled',
  started_at                 timestamptz,
  ended_at                   timestamptz,
  empty_check_confirmed_at   timestamptz,
  empty_check_confirmed_by   uuid references public.profiles (id),
  created_at                 timestamptz not null default now()
);
create index on public.trips (company_id, service_date);
create index on public.trips (vehicle_id, service_date);

create table public.trip_students (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references public.trips (id) on delete cascade,
  student_id          uuid not null references public.students (id) on delete cascade,
  status              public.boarding_status not null default 'expected',
  position            int not null default 0,
  checkin_method      public.checkin_method,
  picked_up_at        timestamptz,
  pickup_lat          double precision,
  pickup_lng          double precision,
  delivered_at        timestamptz,
  delivered_lat       double precision,
  delivered_lng       double precision,
  handover_method     public.handover_method,
  handed_to_name      text,
  authorized_adult_id uuid references public.authorized_adults (id),
  handover_photo_url  text,
  transferred_to      uuid references public.trip_students (id),
  updated_at          timestamptz not null default now(),
  unique (trip_id, student_id)
);
create index on public.trip_students (student_id);

-- Histórico de mudanças de viatura (ex.: avaria, reorganização).
create table public.student_transfers (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students (id) on delete cascade,
  from_trip_id  uuid not null references public.trips (id) on delete cascade,
  to_trip_id    uuid not null references public.trips (id) on delete cascade,
  reason        text,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);

-- Posições GPS enviadas pelo telemóvel/tablet da viatura.
create table public.vehicle_positions (
  id           bigint generated always as identity primary key,
  trip_id      uuid not null references public.trips (id) on delete cascade,
  vehicle_id   uuid not null references public.vehicles (id) on delete cascade,
  lat          double precision not null,
  lng          double precision not null,
  speed_kmh    real,
  heading      real,
  accuracy_m   real,
  recorded_at  timestamptz not null default now()
);
create index on public.vehicle_positions (trip_id, recorded_at desc);

-- "Vai / não vai à escola hoje"
create table public.absences (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students (id) on delete cascade,
  service_date  date not null,
  direction     public.trip_direction,   -- null = ida e volta
  reason        text,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  unique nulls not distinct (student_id, service_date, direction)
);

-- ---------------------------------------------------------------------------
-- Comunicação
-- ---------------------------------------------------------------------------
-- Uma conversa por (viatura, aluno): o encarregado fala com a viatura do filho.
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  vehicle_id  uuid not null references public.vehicles (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (vehicle_id, student_id)
);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid not null references public.profiles (id) on delete cascade,
  body             text,
  voice_url        text,
  quick_reply_key  text,     -- ex.: 'running_late', 'child_sick'
  created_at       timestamptz not null default now(),
  read_at          timestamptz,
  check (body is not null or voice_url is not null)
);
create index on public.messages (conversation_id, created_at);

create table public.incidents (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  trip_id     uuid references public.trips (id) on delete cascade,
  vehicle_id  uuid references public.vehicles (id) on delete cascade,
  type        public.incident_type not null,
  message     text,
  lat         double precision,
  lng         double precision,
  speed_kmh   real,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id)
);
create index on public.incidents (company_id, created_at desc);

create table public.trip_feedback (
  trip_id      uuid not null references public.trips (id) on delete cascade,
  guardian_id  uuid not null references public.profiles (id) on delete cascade,
  rating       int not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now(),
  primary key (trip_id, guardian_id)
);

-- Notificações na app (push é entregue por uma Edge Function a partir desta tabela).
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  company_id    uuid references public.companies (id) on delete cascade,
  type          text not null,
  title         text not null,
  body          text not null,
  data          jsonb not null default '{}',
  pushed_at     timestamptz,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index on public.notifications (recipient_id, created_at desc);

-- Fila de SMS (processada por uma Edge Function ligada a um fornecedor angolano).
create table public.sms_outbox (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references public.companies (id) on delete cascade,
  recipient_id  uuid references public.profiles (id) on delete set null,
  phone         text not null,
  body          text not null check (char_length(body) <= 320),
  status        text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_ref  text,
  error         text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index on public.sms_outbox (status, created_at) where status = 'pending';
