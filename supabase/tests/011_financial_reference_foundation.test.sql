begin;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select has_function(
  'public',
  'rollover_financial_parameter_set',
  array['bigint', 'bigint', 'uuid', 'integer', 'integer', 'uuid'],
  'financial parameter rollover RPC exists'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.rollover_financial_parameter_set(bigint,bigint,uuid,integer,integer,uuid)'::regprocedure),
  'rollover RPC is security definer'
);
select is(
  (select proconfig from pg_proc where oid = 'public.rollover_financial_parameter_set(bigint,bigint,uuid,integer,integer,uuid)'::regprocedure),
  array['search_path=""']::text[],
  'rollover RPC has an empty search_path'
);
select is(
  (select pg_get_userbyid(proowner) from pg_proc where oid = 'public.rollover_financial_parameter_set(bigint,bigint,uuid,integer,integer,uuid)'::regprocedure),
  'postgres',
  'rollover RPC is owned by postgres'
);
select ok(
  has_function_privilege('service_role', 'public.rollover_financial_parameter_set(bigint,bigint,uuid,integer,integer,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.rollover_financial_parameter_set(bigint,bigint,uuid,integer,integer,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.rollover_financial_parameter_set(bigint,bigint,uuid,integer,integer,uuid)', 'EXECUTE'),
  'only service_role can execute rollover directly'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.financial_parameter_sets'::regclass),
  'financial parameter sets retain RLS'
);
select ok(
  not has_table_privilege('anon', 'public.financial_parameter_sets', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.financial_parameter_sets', 'INSERT,UPDATE,DELETE'),
  'browser roles cannot mutate financial parameter sets'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('ac000000-0000-4000-8000-000000000001', 'financial-reference-admin@example.invalid', '{"full_name":"Financial Reference Admin"}'),
  ('ac000000-0000-4000-8000-000000000002', 'financial-reference-seller@example.invalid', '{"full_name":"Financial Reference Seller"}');
update public.profiles set role = 'admin', status = 'active', accepted_at = now()
 where id = 'ac000000-0000-4000-8000-000000000001';
update public.profiles set role = 'seller', status = 'active', accepted_at = now()
 where id = 'ac000000-0000-4000-8000-000000000002';

create temporary table protected_counts as
select
  (select count(*) from public.products) as products,
  (select count(*) from public.product_public_prices) as prices,
  (select count(*) from public.commercial_offers) as offers,
  (select count(*) from public.commercial_policies) as policies,
  (select count(*) from public.commercial_offer_policies) as memberships;

insert into public.financial_parameter_sets (
  id, version, name, effective_from, cdi_monthly_percentage,
  spread_monthly_percentage, source_type, source_reference, source_snapshot,
  created_by, updated_by
) values
  (
    99101, 99101, 'Manual reference V1', date '2026-07-01', 0.900000,
    0.300000, 'manual', 'staging-initial-manual',
    '{"environment":"staging","inputMethod":"manual"}',
    'ac000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001'
  ),
  (
    99102, 99102, 'Manual reference V2', date '2026-08-01', 1.000000,
    0.300000, 'manual', 'staging-manual-rollover',
    '{"environment":"staging","inputMethod":"manual"}',
    'ac000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001'
  ),
  (
    99103, 99103, 'Future API reference', date '2026-09-01', 1.100000,
    0.300000, 'api_import', 'future-provider-contract',
    '{"provider":"future","retrievedAt":"2026-08-31T12:00:00Z","referenceDate":"2026-09-01","rawValue":"1.10","normalizedValue":"0.011"}',
    'ac000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001'
  );

select is((select spread_monthly_percentage from public.financial_parameter_sets where id = 99101), 0.300000::numeric, 'monthly spread preserves 0.30 percent');
select is((select monthly_spread_rate from public.financial_parameter_sets where id = 99101), 0.003000000000::numeric, 'monthly spread derives decimal 0.003');
select is((select monthly_cdi_rate from public.financial_parameter_sets where id = 99101), 0.009000000000::numeric, 'manual CDI percentage derives its decimal rate');
select is((select monthly_reference_rate from public.financial_parameter_sets where id = 99101), 0.012000000000::numeric, 'reference rate is CDI plus spread');
select is((select methodology from public.financial_parameter_sets where id = 99101), 'effective_annual_cdi_plus_monthly_spread', 'canonical methodology is recorded');
select is((select source_type::text from public.financial_parameter_sets where id = 99103), 'api_import', 'future API source is already representable');
select is((select source_snapshot ->> 'normalizedValue' from public.financial_parameter_sets where id = 99103), '0.011', 'future provider metadata remains in source snapshot');
select throws_ok(
  $$insert into public.financial_parameter_sets (version, name, effective_from, cdi_monthly_percentage, spread_monthly_percentage, source_type) values (99104, 'Invalid MVP spread', date '2026-10-01', 1, 0.2, 'manual')$$,
  '23514', null,
  'MVP spread must remain exactly 0.30 percent'
);

select lives_ok(
  $$select public.publish_financial_parameter_set(99101, 'ac000000-0000-4000-8000-000000000001', 1, 'cc000000-0000-4000-8000-000000000001')$$,
  'initial manual reference publishes through the official lifecycle'
);
select is((select status::text from public.financial_parameter_sets where id = 99101), 'published', 'initial reference is published');
select is((select count(*) from public.pricing_audit_events where aggregate_type = 'financial_parameter_set' and aggregate_id = 99101 and action = 'publish'), 1::bigint, 'initial publication is audited');

select throws_ok(
  $$update public.financial_parameter_sets set cdi_monthly_percentage = 1.100000 where id = 99101$$,
  '55000',
  'published or archived financial_parameter_sets economic identity is immutable',
  'published CDI cannot be overwritten'
);
select throws_ok(
  $$select public.publish_financial_parameter_set(99102, 'ac000000-0000-4000-8000-000000000001', 1, 'cc000000-0000-4000-8000-000000000002')$$,
  '23P01',
  'published financial parameter set validity overlaps an existing reference',
  'overlapping current references cannot be published'
);
select throws_ok(
  $$select public.rollover_financial_parameter_set(99101, 99102, 'ac000000-0000-4000-8000-000000000002', 2, 1, 'cc000000-0000-4000-8000-000000000003')$$,
  '42501',
  'pricing authorization failed: actor is not an admin',
  'non-admin cannot perform rollover'
);

select lives_ok(
  $$select public.rollover_financial_parameter_set(99101, 99102, 'ac000000-0000-4000-8000-000000000001', 2, 1, 'cc000000-0000-4000-8000-000000000004')$$,
  'rollover atomically closes V1 and publishes V2'
);
select is((select valid_to from public.financial_parameter_sets where id = 99101), date '2026-07-31', 'V1 validity closes the day before V2');
select is((select status::text from public.financial_parameter_sets where id = 99101), 'published', 'V1 remains published historical truth');
select is((select status::text from public.financial_parameter_sets where id = 99102), 'published', 'V2 becomes the current published reference');
select is((select valid_to from public.financial_parameter_sets where id = 99102), null::date, 'V2 remains open-ended');
select is((select count(*) from public.pricing_audit_events where aggregate_type = 'financial_parameter_set' and aggregate_id = 99101 and action = 'update' and reason = 'financial parameter set temporal rollover'), 1::bigint, 'rollover closure is audited');
select is((select count(*) from public.pricing_audit_events where aggregate_type = 'financial_parameter_set' and aggregate_id = 99102 and action = 'publish'), 1::bigint, 'rollover publication is audited');

select throws_ok(
  $$select public.rollover_financial_parameter_set(99101, 99103, 'ac000000-0000-4000-8000-000000000001', 3, 1, 'cc000000-0000-4000-8000-000000000005')$$,
  '55000',
  'financial parameter rollover requires an open published current reference',
  'historical reference cannot be rolled over twice'
);
select throws_ok(
  $$insert into public.financial_parameter_sets (version, name, effective_from, cdi_monthly_percentage, spread_monthly_percentage, source_type) values (99102, 'Duplicate version', date '2026-10-01', 1, 0.3, 'manual')$$,
  '23505', null,
  'versions remain unique'
);
select ok(
  (select row(products, prices, offers, policies, memberships) from protected_counts)
  = row(
      (select count(*) from public.products),
      (select count(*) from public.product_public_prices),
      (select count(*) from public.commercial_offers),
      (select count(*) from public.commercial_policies),
      (select count(*) from public.commercial_offer_policies)
    ),
  'financial foundation does not mutate Products, Prices, Offers, Policies or memberships'
);

select * from finish();
rollback;
