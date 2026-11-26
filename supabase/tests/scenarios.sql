-- =============================================================================
-- Kandokids — testes de cenário (correr com tests/run.sh)
-- Cada bloco atua como um utilizador real, com RLS ativo.
-- =============================================================================
\set ON_ERROR_STOP 1
\set QUIET 1

\set plataforma '00000000-0000-0000-0000-000000000001'
\set admin      '00000000-0000-0000-0000-0000000000a1'
\set teresa     '00000000-0000-0000-0000-0000000000a2'
\set esperanca  '00000000-0000-0000-0000-0000000000a4'
\set joana      '00000000-0000-0000-0000-0000000000b1'
\set paulo      '00000000-0000-0000-0000-0000000000b2'
\set empresa    '11111111-1111-1111-1111-111111111111'
\set viagem1    '66666666-0000-0000-0000-000000000001'
\set viagem2    '66666666-0000-0000-0000-000000000002'
\set viagem3    '66666666-0000-0000-0000-000000000003'
\set ana        '44444444-0000-0000-0000-000000000001'
\set miguel     '44444444-0000-0000-0000-000000000002'
\set rita       '44444444-0000-0000-0000-000000000003'

-- Auxiliares de teste
create function public._expect_error(p_sql text, p_pattern text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FALHOU: esperava erro "%" em: %', p_pattern, p_sql;
exception when others then
  if sqlerrm like 'FALHOU:%' then raise; end if;
  if sqlerrm not ilike p_pattern then
    raise exception 'FALHOU: erro diferente. Esperado "%", obtido "%"', p_pattern, sqlerrm;
  end if;
end $$;
grant execute on function public._expect_error(text, text) to authenticated;

create function public._ts(p_trip uuid, p_student uuid) returns uuid
language sql security definer as $$ select id from public.trip_students where trip_id = p_trip and student_id = p_student $$;
grant execute on function public._ts(uuid, uuid) to authenticated;

create function public._ok(p_msg text) returns void language plpgsql as $$
begin raise notice '  ✔ %', p_msg; end $$;
grant execute on function public._ok(text) to authenticated;
set client_min_messages = notice;

-- -----------------------------------------------------------------------------
\echo '1. Encarregados só veem os seus filhos'
select set_config('request.jwt.claim.sub', :'joana', false); set role authenticated;
do $$ begin
  assert (select count(*) from public.students) = 2, 'Joana devia ver 2 alunos';
  assert not exists (select 1 from public.students where full_name like 'Rita%'), 'Joana não pode ver a Rita';
  assert (select count(*) from public.sms_outbox) = 0;
  assert (select count(*) from public.guardian_invites) = 0;
  perform public._ok('Joana vê apenas Ana e Miguel');
end $$;
reset role;

-- -----------------------------------------------------------------------------
\echo '2. Painel: ativar/desativar funcionalidades'
select set_config('request.jwt.claim.sub', :'admin', false); set role authenticated;
update public.company_features set mode = 'included' where company_id = :'empresa' and feature_key = 'pickup_pin';
do $$ begin
  assert public.company_has_feature('11111111-1111-1111-1111-111111111111', 'pickup_pin'), 'PIN devia estar ativo';
  perform public._ok('Admin ativou o PIN de entrega');
  perform public._expect_error($q$update public.company_features set mode = 'addon', addon_price_kz = 500
     where company_id = '11111111-1111-1111-1111-111111111111' and feature_key = 'live_tracking'$q$, '%não pode ser vendida como extra%');
  perform public._ok('Localização não pode ser vendida como extra (regra do catálogo)');
end $$;
update public.company_features set addon_price_kz = 2000 where company_id = :'empresa' and feature_key = 'sms_alerts';
reset role;

select set_config('request.jwt.claim.sub', :'teresa', false); set role authenticated;
do $$ declare n int; begin
  update public.company_features set mode = 'off' where feature_key = 'sos_button';
  get diagnostics n = row_count;
  assert n = 0, 'Assistente não pode alterar funcionalidades';
  perform public._ok('Assistente não consegue alterar funcionalidades');
end $$;
reset role;

-- Bloqueio pela plataforma
select set_config('request.jwt.claim.sub', :'plataforma', false); set role authenticated;
update public.company_features set locked_by_platform = true where company_id = :'empresa' and feature_key = 'monthly_report';
reset role;
select set_config('request.jwt.claim.sub', :'admin', false); set role authenticated;
do $$ begin
  perform public._expect_error($q$update public.company_features set mode = 'off'
     where company_id = '11111111-1111-1111-1111-111111111111' and feature_key = 'monthly_report'$q$, '%gerida pela Kandokids%');
  perform public._ok('Funcionalidade bloqueada pela Kandokids não pode ser alterada pela empresa');
end $$;
reset role;

-- -----------------------------------------------------------------------------
\echo '3. Escalada de privilégios bloqueada'
select set_config('request.jwt.claim.sub', :'joana', false); set role authenticated;
do $$ begin
  perform public._expect_error($q$update public.profiles set role = 'platform_admin' where id = auth.uid()$q$, '%Sem permissão%');
  perform public._expect_error($q$update public.profiles set role = 'company_admin', company_id = '11111111-1111-1111-1111-111111111111' where id = auth.uid()$q$, '%Sem permissão%');
  perform public._ok('Encarregado não se pode promover');
end $$;
reset role;

-- -----------------------------------------------------------------------------
\echo '4. Extras pagos: SMS'
select set_config('request.jwt.claim.sub', :'joana', false); set role authenticated;
select public.request_addon(:'empresa', 'sms_alerts');
do $$ begin
  assert (select enabled from public.get_my_features('11111111-1111-1111-1111-111111111111') where feature_key = 'sms_alerts') = false;
  assert (select addon_price_kz from public.get_my_features('11111111-1111-1111-1111-111111111111') where feature_key = 'sms_alerts') = 2000;
  perform public._ok('Joana pediu SMS (2000 Kz, pendente)');
end $$;
reset role;
select set_config('request.jwt.claim.sub', :'admin', false); set role authenticated;
select public.activate_addon((select id from public.guardian_addons where feature_key = 'sms_alerts'), 3, 'MCX-998877');
do $$ begin
  assert public.guardian_has_feature('00000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'sms_alerts');
  assert not public.guardian_has_feature('00000000-0000-0000-0000-0000000000b2', '11111111-1111-1111-1111-111111111111', 'sms_alerts');
  assert (select amount_kz from public.guardian_addons where feature_key = 'sms_alerts') = 6000;
  perform public._ok('Pagamento confirmado: SMS ativo 3 meses para a Joana (6000 Kz); Paulo não tem');
end $$;
-- Paulo tem o extra de alertas de velocidade
insert into public.guardian_addons (company_id, guardian_id, feature_key, status, starts_on, ends_on, amount_kz)
values (:'empresa', :'paulo', 'speeding_alerts', 'active', current_date, current_date + 30, 1000);
reset role;

-- -----------------------------------------------------------------------------
\echo '5. "Não vai hoje" + início da viagem'
select set_config('request.jwt.claim.sub', :'joana', false); set role authenticated;
insert into public.absences (student_id, service_date, direction, reason, created_by)
values (:'miguel', public.luanda_today(), 'to_school', 'Consulta médica', auth.uid());
do $$ begin
  perform public._expect_error($q$insert into public.absences (student_id, service_date, created_by)
     values ('44444444-0000-0000-0000-000000000003', public.luanda_today(), auth.uid())$q$, '%row-level security%');
  perform public._ok('Joana marcou ausência do Miguel; não consegue marcar a Rita');
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'teresa', false); set role authenticated;
select public.start_trip(:'viagem1');
do $$ begin
  assert (select status from public.trip_students where id = public._ts('66666666-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000002')) = 'absent';
  perform public._ok('Viagem iniciada; Miguel marcado ausente automaticamente');
end $$;
reset role;

-- -----------------------------------------------------------------------------
\echo '6. Localização: privacidade'
select set_config('request.jwt.claim.sub', :'teresa', false); set role authenticated;
insert into public.vehicle_positions (trip_id, vehicle_id, lat, lng, speed_kmh)
values (:'viagem1', '33333333-0000-0000-0000-000000000001', -8.9700, 13.2600, 40);
reset role;
select set_config('request.jwt.claim.sub', :'joana', false); set role authenticated;
do $$ begin
  assert (select count(*) from public.vehicle_positions) = 1, 'Joana devia ver a viatura';
  perform public._ok('Joana vê a viatura da Ana em tempo real');
end $$;
reset role;
select set_config('request.jwt.claim.sub', :'esperanca', false); set role authenticated;
do $$ begin
  perform public._expect_error($q$insert into public.vehicle_positions (trip_id, vehicle_id, lat, lng)
     values ('66666666-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 0, 0)$q$, '%row-level security%');
  perform public._ok('Assistente de outra viatura não pode enviar posições desta viagem');
end $$;
reset role;

-- -----------------------------------------------------------------------------
\echo '7. Aviso de aproximação'
select set_config('request.jwt.claim.sub', :'teresa', false); set role authenticated;
insert into public.vehicle_positions (trip_id, vehicle_id, lat, lng, speed_kmh)
values (:'viagem1', '33333333-0000-0000-0000-000000000001', -8.9900, 13.2690, 35);  -- ~700 m da casa da Ana
reset role;
do $$ begin
  assert exists (select 1 from public.notifications where type = 'proximity' and recipient_id = '00000000-0000-0000-0000-0000000000b1');
  assert not exists (select 1 from public.notifications where type = 'proximity' and recipient_id = '00000000-0000-0000-0000-0000000000b2');
  perform public._ok('Joana recebeu "a viatura está a chegar"; Paulo ainda não');
end $$;

-- -----------------------------------------------------------------------------
\echo '8. Recolha: QR, notificações e SMS'
select set_config('request.jwt.claim.sub', :'teresa', false); set role authenticated;
select public.checkin_by_token(:'viagem1', 'demo-ana', -8.996, 13.270);
do $$ begin
  perform public._expect_error($q$select public.checkin_by_token('66666666-0000-0000-0000-000000000001', 'demo-kiame')$q$, '%Deve ir na viatura Carrinha Branca%');
  perform public._ok('QR da Ana aceite; QR do Kiame recusado (viatura errada) com indicação da viatura certa');
end $$;
select public.record_pickup(public._ts(:'viagem1', :'rita'), 'manual', -8.955, 13.240);
reset role;
do $$ begin
  assert (select count(*) from public.sms_outbox where recipient_id = '00000000-0000-0000-0000-0000000000b1') = 1, 'Joana (extra SMS) devia ter 1 SMS';
  assert (select count(*) from public.sms_outbox where recipient_id = '00000000-0000-0000-0000-0000000000b2') = 0, 'Paulo (sem extra) não recebe SMS';
  assert exists (select 1 from public.notifications where type = 'picked_up' and recipient_id = '00000000-0000-0000-0000-0000000000b2');
  perform public._ok('Notificação na app para ambos; SMS só para quem pagou o extra');
end $$;
select public._ok('SMS → ' || phone || ': ' || body) from public.sms_outbox;

-- -----------------------------------------------------------------------------
\echo '9. Excesso de velocidade'
select set_config('request.jwt.claim.sub', :'teresa', false); set role authenticated;
insert into public.vehicle_positions (trip_id, vehicle_id, lat, lng, speed_kmh)
values (:'viagem1', '33333333-0000-0000-0000-000000000001', -8.96, 13.25, 92);
insert into public.vehicle_positions (trip_id, vehicle_id, lat, lng, speed_kmh)
values (:'viagem1', '33333333-0000-0000-0000-000000000001', -8.95, 13.24, 95);
reset role;
do $$ begin
  assert (select count(*) from public.incidents where type = 'speeding') = 1, 'Um incidente (limite de 5 min)';
  assert exists (select 1 from public.notifications where type = 'speeding' and recipient_id = '00000000-0000-0000-0000-0000000000b2');
  assert not exists (select 1 from public.notifications where type = 'speeding' and recipient_id = '00000000-0000-0000-0000-0000000000b1');
  assert exists (select 1 from public.notifications where type = 'speeding' and recipient_id = '00000000-0000-0000-0000-0000000000a1');
  perform public._ok('Paulo (extra) e a gestão alertados; Joana (sem extra) não');
end $$;

-- -----------------------------------------------------------------------------
\echo '10. Mudança de viatura'
select set_config('request.jwt.claim.sub', :'teresa', false); set role authenticated;
do $$ begin
  perform public._expect_error($q$select public.transfer_student(public._ts('66666666-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000003'), '66666666-0000-0000-0000-000000000002')$q$, '%Apenas a gestão%');
end $$;
reset role;
select set_config('request.jwt.claim.sub', :'admin', false); set role authenticated;
select public.start_trip(:'viagem2');
select public.transfer_student(public._ts(:'viagem1', :'rita'), :'viagem2', 'Autocarro Azul com avaria');
do $$ begin
  assert (select status from public.trip_students where id = public._ts('66666666-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000003')) = 'on_board';
  assert (select status from public.trip_students where id = public._ts('66666666-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000003')) = 'transferred';
  perform public._ok('Rita passou para a Carrinha Branca, continua a bordo');
end $$;
reset role;
select public._ok('Notificação → Paulo: ' || body) from public.notifications where type = 'vehicle_changed';

-- -----------------------------------------------------------------------------
\echo '11. Terminar viagem com criança a bordo'
select set_config('request.jwt.claim.sub', :'teresa', false); set role authenticated;
do $$ begin
  perform public._expect_error($q$select public.end_trip('66666666-0000-0000-0000-000000000001', true)$q$, '%Ainda há crianças a bordo: Ana Neto%');
  perform public._ok('Bloqueado: a Ana ainda está a bordo');
end $$;
select public.record_dropoff(public._ts(:'viagem1', :'ana'));
do $$ begin
  perform public._expect_error($q$select public.end_trip('66666666-0000-0000-0000-000000000001', false)$q$, '%Confirme que verificou%');
end $$;
select public.end_trip(:'viagem1', true);
do $$ begin perform public._ok('Ana entregue na escola; viagem terminada após confirmar viatura vazia'); end $$;
reset role;

-- -----------------------------------------------------------------------------
\echo '12. Entrega em casa com PIN'
select set_config('request.jwt.claim.sub', :'joana', false); set role authenticated;
select public.set_pickup_pin(:'ana', '4821');
do $$ begin
  perform public._expect_error($q$select public.set_pickup_pin('44444444-0000-0000-0000-000000000003', '1111')$q$, '%Apenas o encarregado%');
  assert public.has_pickup_pin('44444444-0000-0000-0000-000000000001');
  assert (select count(*) from public.student_pickup_pins) = 0, 'Hash do PIN nunca visível';
  perform public._ok('Joana definiu o PIN da Ana; o hash não é visível para ninguém');
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'teresa', false); set role authenticated;
select public.start_trip(:'viagem3');
select public.record_pickup(public._ts(:'viagem3', :'ana'));
do $$ declare r public.trip_students; begin
  perform public._expect_error($q$select public.record_dropoff(public._ts('66666666-0000-0000-0000-000000000003','44444444-0000-0000-0000-000000000001'), 'guardian', p_handed_to_name => 'Alguém')$q$, '%só pode ser entregue com o PIN%');
  r := public.record_dropoff(public._ts('66666666-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000001'), 'pin', '0000');
  assert r.id is null, 'PIN errado devolve null';
  r := public.record_dropoff(public._ts('66666666-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000001'), 'pin', '4821', p_handed_to_name => 'Avó Luísa');
  assert r.status = 'delivered' and r.handover_method = 'pin';
  perform public._ok('PIN errado recusado; PIN certo → entregue');
end $$;
reset role;
select public._ok('Notificação → Joana: ' || body) from public.notifications
where recipient_id = :'joana' and type = 'delivered' order by created_at desc limit 1;

-- -----------------------------------------------------------------------------
\echo '13. Mensagens com a viatura'
select set_config('request.jwt.claim.sub', :'joana', false); set role authenticated;
select public.open_vehicle_conversation(:'ana') as conversa \gset
insert into public.messages (conversation_id, sender_id, body)
values (:'conversa', auth.uid(), 'Bom dia! Hoje a Ana sai mais cedo, às 12h.');
reset role;
select set_config('request.jwt.claim.sub', :'admin', false); set role authenticated;
update public.company_features set mode = 'off' where company_id = :'empresa' and feature_key = 'vehicle_chat';
reset role;
select set_config('request.jwt.claim.sub', :'joana', false); set role authenticated;
do $$ begin
  perform public._expect_error($q$select public.open_vehicle_conversation('44444444-0000-0000-0000-000000000001')$q$, '%não estão ativas%');
  perform public._ok('Mensagem enviada; após o admin desligar o chat, deixa de ser possível');
end $$;
reset role;

\echo ''
\echo 'Todos os testes passaram ✔'
