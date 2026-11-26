-- Extra test data for the end-to-end tests (applied after supabase/seed.sql).
insert into public.guardian_addons (company_id, guardian_id, feature_key, amount_kz, payment_method) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000b1', 'sms_alerts', 1500, 'multicaixa_express'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000b2', 'speeding_alerts', 1000, 'referencia');
update public.trips set status = 'in_progress', started_at = now()
where id = '66666666-0000-0000-0000-000000000001';
