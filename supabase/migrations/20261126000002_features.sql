-- =============================================================================
-- Kandokids — funcionalidades configuráveis
--
-- Cada funcionalidade tem um modo por empresa:
--   off       → desativada
--   included  → ativa para todos os encarregados (incluída na mensalidade da empresa)
--   addon     → extra pago: só funciona para encarregados com subscrição ativa
--
-- O catálogo define que modos cada funcionalidade permite. A equipa Kandokids
-- pode bloquear uma funcionalidade para uma empresa (ex.: não incluída no plano).
-- =============================================================================

create type public.feature_category as enum ('tracking', 'safety', 'communication', 'operations', 'extra');
create type public.feature_mode     as enum ('off', 'included', 'addon');
create type public.addon_status     as enum ('pending_payment', 'active', 'cancelled', 'expired');

create table public.features (
  key                 text primary key,
  name_pt             text not null,
  description_pt      text not null,
  category            public.feature_category not null,
  allows_included     boolean not null default true,
  allows_addon        boolean not null default false,
  default_mode        public.feature_mode not null default 'included',
  suggested_price_kz  numeric(12, 2),
  sort_order          int not null default 0,
  check (default_mode <> 'included' or allows_included),
  check (default_mode <> 'addon' or allows_addon)
);

create table public.company_features (
  company_id          uuid not null references public.companies (id) on delete cascade,
  feature_key         text not null references public.features (key) on delete cascade,
  mode                public.feature_mode not null,
  addon_price_kz      numeric(12, 2) check (addon_price_kz is null or addon_price_kz >= 0),
  locked_by_platform  boolean not null default false,  -- só a Kandokids altera
  updated_by          uuid references public.profiles (id),
  updated_at          timestamptz not null default now(),
  primary key (company_id, feature_key),
  check (mode <> 'addon' or addon_price_kz is not null)
);

-- Extras comprados por encarregados (mensal).
create table public.guardian_addons (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  guardian_id        uuid not null references public.profiles (id) on delete cascade,
  feature_key        text not null references public.features (key),
  status             public.addon_status not null default 'pending_payment',
  starts_on          date,
  ends_on            date,
  amount_kz          numeric(12, 2) not null,
  payment_method     text,            -- 'multicaixa_express', 'referencia', 'transferencia', 'numerario'
  payment_reference  text,
  created_at         timestamptz not null default now(),
  check (status <> 'active' or (starts_on is not null and ends_on is not null and ends_on >= starts_on))
);
create index on public.guardian_addons (guardian_id, feature_key);
create index on public.guardian_addons (company_id, status);

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
insert into public.features
  (key, name_pt, description_pt, category, allows_included, allows_addon, default_mode, suggested_price_kz, sort_order)
values
  -- Localização
  ('live_tracking',      'Localização em tempo real',      'Os encarregados veem no mapa a viatura onde está o filho, enquanto a criança está a ser recolhida ou vai a bordo.', 'tracking', true, false, 'included', null, 10),
  ('proximity_alert',    'Aviso de aproximação',           'Notificação quando a viatura está a poucos minutos de casa, para a criança estar pronta à porta.', 'tracking', true, true, 'included', 500, 20),
  ('extended_history',   'Histórico de viagens (12 meses)','Repetição do percurso no mapa e histórico completo de recolhas e entregas dos últimos 12 meses (sem este extra: 7 dias).', 'tracking', true, true, 'addon', 1000, 30),

  -- Segurança
  ('pickup_pin',         'PIN de entrega',                 'Na viagem para casa, a criança só é entregue a quem disser o PIN de 4 dígitos definido pelo encarregado.', 'safety', true, false, 'off', null, 40),
  ('authorized_adults',  'Adultos autorizados',            'Lista de pessoas (com foto e BI) autorizadas a receber a criança, além dos encarregados.', 'safety', true, false, 'included', null, 50),
  ('empty_vehicle_check','Verificação de viatura vazia',   'A viagem só termina depois de o assistente confirmar que nenhuma criança ficou dentro da viatura.', 'safety', true, false, 'included', null, 60),
  ('sos_button',         'Botão SOS',                      'O assistente pode emitir um alerta de emergência com a localização para a empresa e os encarregados.', 'safety', true, false, 'included', null, 70),
  ('speeding_alerts',    'Alertas de excesso de velocidade','O encarregado recebe um alerta se a viatura do filho ultrapassar o limite de velocidade definido pela empresa.', 'safety', true, true, 'addon', 1000, 80),
  ('dropoff_photo',      'Foto na entrega',                'O assistente tira uma foto no momento da entrega em casa ou na escola, enviada ao encarregado.', 'safety', true, true, 'addon', 1000, 90),

  -- Comunicação
  ('vehicle_chat',       'Mensagens com a viatura',        'Os encarregados enviam mensagens diretamente para a viatura do filho.', 'communication', true, false, 'included', null, 100),
  ('voice_notes',        'Notas de voz',                   'Envio de mensagens de voz no chat com a viatura.', 'communication', true, false, 'included', null, 110),
  ('incident_broadcast', 'Avisos de incidentes',           'O assistente avisa todos os encarregados da viatura de atrasos, avarias ou mudanças de rota.', 'communication', true, false, 'included', null, 120),
  ('sms_alerts',         'SMS na recolha e na chegada',    'SMS quando a criança é recolhida e quando chega à escola ou a casa. Funciona sem internet.', 'communication', true, true, 'addon', 1500, 130),
  ('family_sharing',     'Partilha familiar',              'Até 5 familiares podem acompanhar a criança (sem este extra: 2 encarregados por criança).', 'communication', true, true, 'addon', 1000, 140),
  ('monthly_report',     'Relatório mensal',               'Relatório mensal em PDF com presenças, faltas, horários de recolha e entrega.', 'communication', true, true, 'addon', 500, 150),

  -- Operações
  ('absence_toggle',     'Marcar ausência',                'O encarregado indica se a criança vai ou não à escola; a lista de recolha atualiza automaticamente.', 'operations', true, false, 'included', null, 160),
  ('qr_checkin',         'Cartão QR / NFC',                'Registo de entrada e saída lendo o cartão QR ou etiqueta NFC na mochila da criança.', 'operations', true, false, 'included', null, 170),
  ('route_optimization', 'Otimização de rota',             'A ordem de recolha é recalculada com base nas ausências do dia.', 'operations', true, false, 'included', null, 180),
  ('trip_feedback',      'Avaliação das viagens',          'Os encarregados podem avaliar cada viagem de 1 a 5 estrelas.', 'operations', true, false, 'included', null, 190);

-- ---------------------------------------------------------------------------
-- Validação: o modo escolhido tem de ser permitido pelo catálogo, e
-- funcionalidades bloqueadas pela plataforma não podem ser alteradas pela empresa.
-- ---------------------------------------------------------------------------
create function public.validate_company_feature()
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

  if tg_op = 'UPDATE'
     and (old.locked_by_platform or new.locked_by_platform is distinct from old.locked_by_platform)
     and not public.is_platform_admin() then
    raise exception 'Esta funcionalidade é gerida pela Kandokids. Contacte o suporte.';
  end if;

  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

-- (is_platform_admin é definida em 0003; o corpo plpgsql só é resolvido em execução.)
create trigger company_features_validate
  before insert or update on public.company_features
  for each row execute function public.validate_company_feature();

-- Nova empresa → recebe todas as funcionalidades no modo por omissão.
create function public.seed_company_features()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.company_features (company_id, feature_key, mode, addon_price_kz)
  select new.id, f.key, f.default_mode, f.suggested_price_kz
  from public.features f
  on conflict do nothing;
  return new;
end;
$$;

create trigger companies_seed_features
  after insert on public.companies
  for each row execute function public.seed_company_features();

-- ---------------------------------------------------------------------------
-- Consultas de funcionalidades (usadas pelas regras, RPCs e apps)
-- ---------------------------------------------------------------------------
create function public.company_feature_mode(p_company_id uuid, p_feature_key text)
returns public.feature_mode
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select cf.mode from public.company_features cf
      where cf.company_id = p_company_id and cf.feature_key = p_feature_key),
    (select f.default_mode from public.features f where f.key = p_feature_key),
    'off'::public.feature_mode
  );
$$;

-- A empresa tem a funcionalidade ligada (incluída ou como extra)?
create function public.company_has_feature(p_company_id uuid, p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.company_feature_mode(p_company_id, p_feature_key) <> 'off';
$$;

-- Este encarregado pode usar a funcionalidade nesta empresa?
create function public.guardian_has_feature(p_guardian_id uuid, p_company_id uuid, p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.company_feature_mode(p_company_id, p_feature_key)
    when 'included' then true
    when 'addon' then exists (
      select 1 from public.guardian_addons ga
      where ga.guardian_id = p_guardian_id
        and ga.company_id  = p_company_id
        and ga.feature_key = p_feature_key
        and ga.status = 'active'
        and current_date between ga.starts_on and ga.ends_on)
    else false
  end;
$$;
