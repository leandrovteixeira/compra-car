begin;

set local search_path = extensions, public, pg_catalog;

select no_plan();

create function pg_temp.pricing_test_snapshot(
  p_rule_code text,
  p_method text,
  p_actor_id uuid,
  p_input numeric,
  p_inputs jsonb,
  p_public_price jsonb,
  p_financial_parameter_set jsonb,
  p_formula text,
  p_unrounded numeric,
  p_monetary numeric
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'schemaVersion', '1',
    'ruleCode', p_rule_code,
    'ruleVersion', '1.0.0',
    'calculationMethod', p_method,
    'calculatedAt', '2026-07-25T18:00:00Z',
    'calculatedBy', p_actor_id::text,
    'currency', 'BRL',
    'inputMonetaryValue', case
      when p_input is null then 'null'::jsonb
      else to_jsonb(p_input::text)
    end,
    'inputs', p_inputs,
    'publicPrice', coalesce(p_public_price, 'null'::jsonb),
    'financialParameterSet', coalesce(p_financial_parameter_set, 'null'::jsonb),
    'formula', p_formula,
    'unroundedValue', p_unrounded::text,
    'rounding', jsonb_build_object('mode', 'HALF_UP', 'scale', 2),
    'monetaryValue', p_monetary::text,
    'assumptions', '[]'::jsonb
  )
$$;

select is(
  (
    select array_agg(enumlabel::text order by enumsortorder)
      from pg_enum
     where enumtypid = 'public.app_role'::regtype
  ),
  array['admin', 'seller'],
  'pricing authorization uses the physical admin and seller roles'
);
select is(
  (
    select array_agg(enumlabel::text order by enumsortorder)
      from pg_enum
     where enumtypid = 'public.user_status'::regtype
  ),
  array['pending', 'active', 'disabled'],
  'pricing authorization uses the physical pending, active and disabled statuses'
);

select ok(
  (
    select count(*) = 4
       and bool_and(procedure.prosecdef)
       and bool_and(owner.rolname = 'postgres')
       and bool_and(array_to_string(procedure.proconfig, ',') = 'search_path=""')
      from pg_proc as procedure
      join pg_roles as owner on owner.oid = procedure.proowner
     where procedure.oid in (
       'public.publish_product_public_price(bigint,uuid,integer,uuid)'::regprocedure,
       'public.publish_financial_parameter_set(bigint,uuid,integer,uuid)'::regprocedure,
       'public.publish_commercial_policy(bigint,uuid,integer,uuid)'::regprocedure,
       'public.publish_commercial_policy_accumulator(bigint,uuid,integer,uuid)'::regprocedure
     )
  ),
  'the four publication functions are postgres-owned SECURITY DEFINER with empty search_path'
);

select ok(
  (
    with functions(signature) as (
      values
        ('public.publish_product_public_price(bigint,uuid,integer,uuid)'),
        ('public.publish_financial_parameter_set(bigint,uuid,integer,uuid)'),
        ('public.publish_commercial_policy(bigint,uuid,integer,uuid)'),
        ('public.publish_commercial_policy_accumulator(bigint,uuid,integer,uuid)')
    )
    select bool_and(
      has_function_privilege('service_role', signature, 'EXECUTE')
      and not has_function_privilege('anon', signature, 'EXECUTE')
      and not has_function_privilege('authenticated', signature, 'EXECUTE')
    )
      from functions
  ),
  'only service_role can execute the four publication functions'
);

select ok(
  (
    with helpers(signature) as (
      values
        ('public.assert_active_pricing_admin(uuid)'),
        ('public.pricing_snapshot_decimal(jsonb,text[],text)'),
        ('public.insert_pricing_publish_audit(text,bigint,jsonb,jsonb,uuid,uuid)'),
        ('public.validate_commercial_policy_application(bigint,bigint,uuid)'),
        ('public.prevent_direct_pricing_publication()'),
        ('public.prevent_finalized_pricing_import_mutation()')
    )
    select bool_and(
      not has_function_privilege('service_role', signature, 'EXECUTE')
      and not has_function_privilege('anon', signature, 'EXECUTE')
      and not has_function_privilege('authenticated', signature, 'EXECUTE')
    )
      from helpers
  ),
  'internal helpers have no direct operational or browser EXECUTE privilege'
);

select ok(
  not exists (
    select 1
      from pg_proc as procedure
      cross join lateral aclexplode(
        coalesce(procedure.proacl, acldefault('f', procedure.proowner))
      ) as privilege
     where procedure.oid in (
       'public.publish_product_public_price(bigint,uuid,integer,uuid)'::regprocedure,
       'public.publish_financial_parameter_set(bigint,uuid,integer,uuid)'::regprocedure,
       'public.publish_commercial_policy(bigint,uuid,integer,uuid)'::regprocedure,
       'public.publish_commercial_policy_accumulator(bigint,uuid,integer,uuid)'::regprocedure,
       'public.assert_active_pricing_admin(uuid)'::regprocedure,
       'public.pricing_snapshot_decimal(jsonb,text[],text)'::regprocedure,
       'public.insert_pricing_publish_audit(text,bigint,jsonb,jsonb,uuid,uuid)'::regprocedure,
       'public.validate_commercial_policy_application(bigint,bigint,uuid)'::regprocedure,
       'public.prevent_direct_pricing_publication()'::regprocedure,
       'public.prevent_finalized_pricing_import_mutation()'::regprocedure
     )
       and privilege.grantee in (
         0,
         (select oid from pg_roles where rolname = 'anon'),
         (select oid from pg_roles where rolname = 'authenticated')
       )
  ),
  'no inherited PUBLIC or browser function ACL remains'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-4000-8000-000000000001', 'active-admin@example.invalid', '{"full_name":"Active Admin"}'),
  ('a1000000-0000-4000-8000-000000000002', 'pending-admin@example.invalid', '{"full_name":"Pending Admin"}'),
  ('a1000000-0000-4000-8000-000000000003', 'active-seller@example.invalid', '{"full_name":"Active Seller"}');

update public.profiles
   set role = 'admin', status = 'active', accepted_at = now()
 where id = 'a1000000-0000-4000-8000-000000000001';
update public.profiles
   set role = 'admin', status = 'pending'
 where id = 'a1000000-0000-4000-8000-000000000002';
update public.profiles
   set role = 'seller', status = 'active', accepted_at = now()
 where id = 'a1000000-0000-4000-8000-000000000003';

insert into public.products (
  id, brand, model, version, model_year, production_year, is_active, is_public
) values
  (2100000101, 'Scope Brand', 'Scope Model', 'Version A', 2026, 2026, true, false),
  (2100000102, 'Scope Brand', 'Scope Model', 'Version B', 2026, 2026, true, false),
  (2100000103, 'Other Brand', 'Other Model', 'Version C', 2026, 2026, true, false);

insert into public.product_public_prices (
  id, product_id, amount, starts_on, source_type
) values
  (97001, 2100000101, 100000, date '2026-07-01', 'manual'),
  (97002, 2100000102, 120000, date '2026-07-01', 'manual'),
  (97003, 2100000103, 90000, date '2026-07-01', 'manual'),
  (97004, 2100000101, 0, date '2026-08-01', 'manual'),
  (97005, 2100000101, 105000, date '2026-09-01', 'manual');

select throws_ok(
  $$select public.publish_product_public_price(97005, 'b1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000001')$$,
  '42501',
  'pricing authorization failed: actor does not exist',
  'a missing actor cannot publish'
);
select throws_ok(
  $$select public.publish_product_public_price(97005, 'a1000000-0000-4000-8000-000000000002', 1, 'c1000000-0000-4000-8000-000000000002')$$,
  '42501',
  'pricing authorization failed: actor is not active',
  'a pending admin cannot publish'
);
select throws_ok(
  $$select public.publish_product_public_price(97005, 'a1000000-0000-4000-8000-000000000003', 1, 'c1000000-0000-4000-8000-000000000003')$$,
  '42501',
  'pricing authorization failed: actor is not an admin',
  'an active seller cannot publish'
);
select throws_ok(
  $$select public.publish_product_public_price(97005, 'a1000000-0000-4000-8000-000000000001', 99, 'c1000000-0000-4000-8000-000000000004')$$,
  '40001',
  'pricing publication failed: stale product public price lock_version',
  'a stale lock_version cannot publish'
);
select throws_ok(
  $$select public.publish_product_public_price(97004, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000005')$$,
  '23514',
  null,
  'a zero price cannot publish'
);
select is(
  (select status::text from public.product_public_prices where id = 97004),
  'draft',
  'a failed publication leaves the zero price in draft'
);
select is(
  (select count(*) from public.pricing_audit_events where aggregate_id = 97004),
  0::bigint,
  'a failed price publication leaves no audit event'
);

set local role service_role;
select throws_ok(
  $$update public.product_public_prices set status = 'published', published_at = now(), published_by = 'a1000000-0000-4000-8000-000000000001' where id = 97005$$,
  '42501',
  'pricing publication failed: terminal transition requires a publication function',
  'service_role cannot publish by direct table update'
);
select lives_ok(
  $$select public.publish_product_public_price(97001, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000011')$$,
  'active admin publication succeeds through the service_role RPC'
);
reset role;

select is(
  (select status::text from public.product_public_prices where id = 97001),
  'published',
  'a positive price is published'
);
select ok(
  (
    select reviewed_at is not null and reviewed_by = 'a1000000-0000-4000-8000-000000000001'
       and published_at is not null and published_by = 'a1000000-0000-4000-8000-000000000001'
       and lock_version = 2
      from public.product_public_prices
     where id = 97001
  ),
  'price publication fills human lifecycle fields and increments lock_version once'
);
select is(
  (select count(*) from public.pricing_audit_events where aggregate_type = 'product_public_price' and aggregate_id = 97001 and action = 'publish'),
  1::bigint,
  'price publication creates one audit event'
);
select throws_ok(
  $$select public.publish_product_public_price(97001, 'a1000000-0000-4000-8000-000000000001', 2, 'c1000000-0000-4000-8000-000000000012')$$,
  '55000',
  null,
  'repeated price publication is rejected'
);

select public.publish_product_public_price(
  97002, 'a1000000-0000-4000-8000-000000000001', 1,
  'c1000000-0000-4000-8000-000000000013'
);
select public.publish_product_public_price(
  97003, 'a1000000-0000-4000-8000-000000000001', 1,
  'c1000000-0000-4000-8000-000000000014'
);

insert into public.financial_parameter_sets (
  id, version, name, effective_from, cdi_monthly_percentage,
  spread_monthly_percentage, source_type, source_snapshot
) values
  (97101, 1, 'Synthetic parameters', date '2026-07-01', 0.900000, 0.200000, 'manual', '{}'),
  (97102, 2, 'Invalid snapshot', date '2026-07-01', 0.500000, 0.100000, 'manual', '[]'),
  (97104, 4, 'Draft parameters', date '2026-07-01', 0.700000, 0.100000, 'manual', '{}');

select throws_ok(
  $$insert into public.financial_parameter_sets (version, name, effective_from, cdi_monthly_percentage, spread_monthly_percentage, source_type) values (3, 'Invalid rate', date '2026-07-01', 100.000001, 0, 'manual')$$,
  '23514', null,
  'financial parameter rates outside physical limits are rejected'
);
select throws_ok(
  $$select public.publish_financial_parameter_set(97102, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000021')$$,
  '23514', null,
  'a non-object parameter source snapshot cannot publish'
);
select lives_ok(
  $$select public.publish_financial_parameter_set(97101, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000022')$$,
  'a valid synthetic parameter set publishes'
);
select is(
  (select status::text from public.financial_parameter_sets where id = 97101),
  'published',
  'the financial parameter set reaches published'
);
select is(
  (select count(*) from public.pricing_audit_events where aggregate_type = 'financial_parameter_set' and aggregate_id = 97101 and action = 'publish'),
  1::bigint,
  'parameter publication creates one audit event'
);
select throws_ok(
  $$insert into public.financial_parameter_sets (version, name, effective_from, cdi_monthly_percentage, spread_monthly_percentage, source_type) values (1, 'Duplicate version', date '2026-08-01', 0, 0, 'manual')$$,
  '23505', null,
  'the physical unique constraint rejects a duplicate parameter version'
);

insert into public.commercial_policies (
  id, policy_type, scope_type, model_brand, model_name, scope_snapshot,
  title, description, starts_on, ends_on, benefit_percentage,
  down_payment_percentage, term_months, customer_interest_rate_monthly,
  calculation_method, financial_parameter_set_id, source_type
) values
  (97201, 'retail_bonus', 'model', 'Scope Brand', 'Scope Model', '{"schemaVersion":"1","productIds":[2100000101,2100000102]}', 'Retail bonus', null, date '2026-07-01', null, null, null, null, null, 'fixed_amount', null, 'manual'),
  (97202, 'trade_in_bonus', 'product_set', null, null, '{"schemaVersion":"1","productIds":[2100000101]}', 'Trade-in bonus', 'Eligible used vehicle', date '2026-07-01', date '2026-12-31', null, null, null, null, 'fixed_amount', null, 'manual'),
  (97203, 'subsidized_financing', 'product_set', null, null, '{"schemaVersion":"1","productIds":[2100000101]}', 'Synthetic financing', 'Synthetic test only', date '2026-07-01', null, null, 50, 24, 0, 'present_value_subsidy', 97101, 'manual'),
  (97204, 'free_ipva', 'product_set', null, null, '{"schemaVersion":"1","productIds":[2100000101]}', 'Free IPVA', 'Explicit synthetic percentage', date '2026-07-01', null, 4, null, null, null, 'percentage_of_msrp', null, 'manual'),
  (97205, 'free_insurance', 'product_set', null, null, '{"schemaVersion":"1","productIds":[2100000101]}', 'Free insurance', 'Eighteen months', date '2026-07-01', null, 3, null, 18, null, 'percentage_of_msrp', null, 'manual'),
  (97206, 'free_wallbox', 'product_set', null, null, '{"schemaVersion":"1","productIds":[2100000101]}', 'Free wallbox', 'Editable approved premise', date '2026-07-01', null, null, null, null, null, 'fixed_amount', null, 'manual'),
  (97207, 'registration', 'product_set', null, null, '{"schemaVersion":"1","productIds":[2100000101]}', 'Registration', 'Explicit synthetic percentage', date '2026-07-01', null, 1, null, null, null, 'percentage_of_msrp', null, 'manual'),
  (97208, 'other', 'product_set', null, null, '{"schemaVersion":"1","productIds":[2100000101]}', 'Other benefit', 'Manual economic estimate', date '2026-07-01', null, null, null, null, null, 'manual_amount', null, 'manual');

insert into public.commercial_policy_applications (
  id, policy_id, product_id, basis_public_price_id, input_monetary_value,
  monetary_value, calculation_snapshot
) values
  (97301, 97201, 2100000101, null, 1000, 1000, pg_temp.pricing_test_snapshot('retail_bonus', 'fixed_amount', 'a1000000-0000-4000-8000-000000000001', 1000, '{}', null, null, 'input_monetary_value', 1000, 1000)),
  (97302, 97201, 2100000102, null, 1100, 1100, pg_temp.pricing_test_snapshot('retail_bonus', 'fixed_amount', 'a1000000-0000-4000-8000-000000000001', 1100, '{}', null, null, 'input_monetary_value', 1100, 1100)),
  (97303, 97202, 2100000101, null, 1500, 1500, pg_temp.pricing_test_snapshot('trade_in_bonus', 'fixed_amount', 'a1000000-0000-4000-8000-000000000001', 1500, '{}', null, null, 'input_monetary_value', 1500, 1500)),
  (97306, 97206, 2100000101, null, 3750, 3750, pg_temp.pricing_test_snapshot('free_wallbox', 'fixed_amount', 'a1000000-0000-4000-8000-000000000001', 3750, '{}', null, null, 'input_monetary_value', 3750, 3750)),
  (97308, 97208, 2100000101, null, 2500, 2500, pg_temp.pricing_test_snapshot('other', 'manual_amount', 'a1000000-0000-4000-8000-000000000001', 2500, '{}', null, null, 'input_monetary_value', 2500, 2500));

insert into public.commercial_policy_applications (
  id, policy_id, product_id, basis_public_price_id, input_monetary_value,
  monetary_value, calculation_snapshot
) values
  (97304, 97204, 2100000101, 97001, null, 4000, pg_temp.pricing_test_snapshot('free_ipva', 'percentage_of_msrp', 'a1000000-0000-4000-8000-000000000001', null, '{"benefitPercentage":"4.000000"}', '{"id":97001,"amount":"100000.00","startsOn":"2026-07-01"}', null, 'MSRP * percentage / 100', 4000, 4000)),
  (97305, 97205, 2100000101, 97001, null, 4500, pg_temp.pricing_test_snapshot('free_insurance', 'percentage_of_msrp', 'a1000000-0000-4000-8000-000000000001', null, '{"benefitPercentage":"3.000000","termMonths":"18"}', '{"id":97001,"amount":"100000.00","startsOn":"2026-07-01"}', null, 'MSRP * percentage / 100 * term_months / 12', 4500, 4500)),
  (97307, 97207, 2100000101, 97001, null, 1000, pg_temp.pricing_test_snapshot('registration', 'percentage_of_msrp', 'a1000000-0000-4000-8000-000000000001', null, '{"benefitPercentage":"1.000000"}', '{"id":97001,"amount":"100000.00","startsOn":"2026-07-01"}', null, 'MSRP * percentage / 100', 1000, 1000));

with finance as (
  select 50000::numeric as principal,
         (50000::numeric / 24) as payment,
         0.011::numeric as reference_rate,
         (50000::numeric / 24)
           * (1 - power(1.011::numeric, -24)) / 0.011::numeric as present_value
), result as (
  select *, principal - present_value as unrounded from finance
)
insert into public.commercial_policy_applications (
  id, policy_id, product_id, basis_public_price_id, input_monetary_value,
  monetary_value, calculation_snapshot
)
select
  97309, 97203, 2100000101, 97001, null, round(unrounded, 2),
  pg_temp.pricing_test_snapshot(
    'subsidized_financing',
    'present_value_subsidy',
    'a1000000-0000-4000-8000-000000000001',
    null,
    jsonb_build_object(
      'downPaymentPercentage', '50.000000',
      'termMonths', '24',
      'customerInterestRateMonthly', '0.000000',
      'financedPrincipal', principal::text,
      'customerPayment', payment::text,
      'referenceRateMonthly', reference_rate::text,
      'customerPresentValue', present_value::text
    ),
    '{"id":97001,"amount":"100000.00","startsOn":"2026-07-01"}',
    '{"id":97101,"version":"1","cdiMonthlyPercentage":"0.900000","spreadMonthlyPercentage":"0.200000"}',
    'financed_principal - present_value_customer_payments',
    unrounded,
    round(unrounded, 2)
  )
from result;

select lives_ok(
  $$select public.publish_commercial_policy(97201, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000031')$$,
  'retail_bonus publishes with an exact model scope snapshot'
);
select lives_ok(
  $$select public.publish_commercial_policy(97202, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000032')$$,
  'trade_in_bonus publishes'
);
select lives_ok(
  $$select public.publish_commercial_policy(97203, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000033')$$,
  'subsidized_financing publishes with synthetic decimal present value inputs'
);
select lives_ok(
  $$select public.publish_commercial_policy(97204, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000034')$$,
  'free_ipva publishes'
);
select lives_ok(
  $$select public.publish_commercial_policy(97205, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000035')$$,
  'free_insurance publishes proportionally for eighteen months'
);
select lives_ok(
  $$select public.publish_commercial_policy(97206, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000036')$$,
  'free_wallbox publishes without a hardcoded premise'
);
select lives_ok(
  $$select public.publish_commercial_policy(97207, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000037')$$,
  'registration publishes'
);
select lives_ok(
  $$select public.publish_commercial_policy(97208, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000038')$$,
  'other publishes with manual_amount and non-empty description'
);
select is(
  (select count(*) from public.commercial_policies where id between 97201 and 97208 and status = 'published'),
  8::bigint,
  'all eight initial policy types publish through the explicit function'
);
select is(
  (select count(*) from public.pricing_audit_events where aggregate_type = 'commercial_policy' and aggregate_id between 97201 and 97208 and action = 'publish'),
  8::bigint,
  'each published policy creates exactly one audit event'
);
select is(
  (select monetary_value from public.commercial_policy_applications where id = 97309),
  6265.40::numeric,
  'financing uses the documented high-precision decimal formula and HALF_UP result'
);

insert into public.commercial_policies (
  id, policy_type, scope_type, scope_snapshot, title, description,
  starts_on, benefit_percentage, calculation_method, source_type
) values (
  97209, 'registration', 'product_set',
  '{"schemaVersion":"1","productIds":[2100000101]}',
  'Half-up boundary', 'Synthetic half-cent boundary', date '2026-07-01',
  0.000005, 'percentage_of_msrp', 'manual'
);
insert into public.commercial_policy_applications (
  id, policy_id, product_id, basis_public_price_id, monetary_value,
  calculation_snapshot
) values (
  97310, 97209, 2100000101, 97001, 0.01,
  pg_temp.pricing_test_snapshot(
    'registration', 'percentage_of_msrp',
    'a1000000-0000-4000-8000-000000000001', null,
    '{"benefitPercentage":"0.000005"}',
    '{"id":97001,"amount":"100000.00","startsOn":"2026-07-01"}',
    null, 'MSRP * percentage / 100', 0.005, 0.01
  )
);
select lives_ok(
  $$select public.publish_commercial_policy(97209, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000039')$$,
  'a positive half-cent boundary policy publishes'
);
select is(
  (select monetary_value from public.commercial_policy_applications where id = 97310),
  0.01::numeric,
  'numeric HALF_UP rounds an exact positive half cent away from zero'
);

insert into public.commercial_policies (
  id, policy_type, scope_type, scope_snapshot, title, description, starts_on,
  benefit_percentage, down_payment_percentage, term_months,
  customer_interest_rate_monthly, calculation_method,
  financial_parameter_set_id, source_type
) values
  (97801, 'retail_bonus', 'product_set', '{"schemaVersion":"1","productIds":[2100000101]}', 'Wrong method', null, date '2026-07-01', null, null, null, null, 'manual_amount', null, 'manual'),
  (97802, 'retail_bonus', 'product_set', '{"schemaVersion":"1","productIds":[2100000101]}', 'Empty snapshot', null, date '2026-07-01', null, null, null, null, 'fixed_amount', null, 'manual'),
  (97803, 'retail_bonus', 'product_set', '{"schemaVersion":"1","productIds":[2100000101]}', 'Zero value', null, date '2026-07-01', null, null, null, null, 'fixed_amount', null, 'manual'),
  (97804, 'free_ipva', 'product_set', '{"schemaVersion":"1","productIds":[2100000101]}', 'Wrong product price', 'Invalid basis', date '2026-07-01', 4, null, null, null, 'percentage_of_msrp', null, 'manual'),
  (97805, 'free_ipva', 'product_set', '{"schemaVersion":"1","productIds":[2100000101]}', 'Draft basis', 'Invalid basis', date '2026-07-01', 4, null, null, null, 'percentage_of_msrp', null, 'manual'),
  (97806, 'subsidized_financing', 'product_set', '{"schemaVersion":"1","productIds":[2100000101]}', 'Draft parameter', 'Invalid parameter', date '2026-07-01', null, 50, 24, 0, 'present_value_subsidy', 97104, 'manual'),
  (97807, 'free_ipva', 'product_set', '{"schemaVersion":"1","productIds":[2100000101]}', 'Wrong formula', 'Invalid formula', date '2026-07-01', 4, null, null, null, 'percentage_of_msrp', null, 'manual');

insert into public.commercial_policy_applications (
  id, policy_id, product_id, basis_public_price_id, input_monetary_value,
  monetary_value, calculation_snapshot
) values
  (97901, 97801, 2100000101, null, 1000, 1000, pg_temp.pricing_test_snapshot('retail_bonus', 'manual_amount', 'a1000000-0000-4000-8000-000000000001', 1000, '{}', null, null, 'input_monetary_value', 1000, 1000)),
  (97902, 97802, 2100000101, null, 1000, 1000, '{}'),
  (97903, 97803, 2100000101, null, 0, 0, pg_temp.pricing_test_snapshot('retail_bonus', 'fixed_amount', 'a1000000-0000-4000-8000-000000000001', 0, '{}', null, null, 'input_monetary_value', 0, 0)),
  (97904, 97804, 2100000101, 97002, null, 4800, pg_temp.pricing_test_snapshot('free_ipva', 'percentage_of_msrp', 'a1000000-0000-4000-8000-000000000001', null, '{"benefitPercentage":"4.000000"}', '{"id":97002,"amount":"120000.00","startsOn":"2026-07-01"}', null, 'MSRP * percentage / 100', 4800, 4800)),
  (97905, 97805, 2100000101, 97005, null, 4200, pg_temp.pricing_test_snapshot('free_ipva', 'percentage_of_msrp', 'a1000000-0000-4000-8000-000000000001', null, '{"benefitPercentage":"4.000000"}', '{"id":97005,"amount":"105000.00","startsOn":"2026-09-01"}', null, 'MSRP * percentage / 100', 4200, 4200)),
  (97906, 97806, 2100000101, 97001, null, 1, pg_temp.pricing_test_snapshot('subsidized_financing', 'present_value_subsidy', 'a1000000-0000-4000-8000-000000000001', null, '{"downPaymentPercentage":"50.000000","termMonths":"24","customerInterestRateMonthly":"0.000000"}', '{"id":97001,"amount":"100000.00","startsOn":"2026-07-01"}', '{"id":97104,"version":"4","cdiMonthlyPercentage":"0.700000","spreadMonthlyPercentage":"0.100000"}', 'financed_principal - present_value_customer_payments', 1, 1)),
  (97907, 97807, 2100000101, 97001, null, 4000, pg_temp.pricing_test_snapshot('free_ipva', 'percentage_of_msrp', 'a1000000-0000-4000-8000-000000000001', null, '{"benefitPercentage":"4.000000"}', '{"id":97001,"amount":"100000.00","startsOn":"2026-07-01"}', null, 'wrong formula', 4000, 4000));

select throws_ok($$select public.publish_commercial_policy(97801, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000041')$$, '23514', null, 'an invalid type and calculation method combination is rejected');
select throws_ok($$select public.publish_commercial_policy(97802, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000042')$$, '23514', null, 'an empty application snapshot is rejected');
select throws_ok($$select public.publish_commercial_policy(97803, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000043')$$, '23514', null, 'a zero monetary policy value is rejected');
select throws_ok($$select public.publish_commercial_policy(97804, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000044')$$, '23514', null, 'a basis price from another product is rejected');
select throws_ok($$select public.publish_commercial_policy(97805, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000045')$$, '23514', null, 'a non-published basis price is rejected');
select throws_ok($$select public.publish_commercial_policy(97806, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000046')$$, '23514', null, 'financing without a published parameter set is rejected');
select throws_ok($$select public.publish_commercial_policy(97807, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000047')$$, '23514', null, 'a divergent snapshot formula is rejected');
select is(
  (select count(*) from public.commercial_policies where id between 97801 and 97807 and status = 'published'),
  0::bigint,
  'failed policy validations do not partially publish headers'
);
select is(
  (select count(*) from public.pricing_audit_events where aggregate_type = 'commercial_policy' and aggregate_id between 97801 and 97807),
  0::bigint,
  'failed policy validations create no audit events'
);

insert into public.commercial_policy_accumulators (
  id, title, starts_on, ends_on, source_type
) values
  (97401, 'Too few members', date '2026-07-01', date '2026-12-31', 'manual'),
  (97402, 'Unpublished member', date '2026-07-01', date '2026-12-31', 'manual'),
  (97403, 'Invalid period', date '2027-01-01', date '2027-01-31', 'manual'),
  (97404, 'Valid accumulator', date '2026-07-01', date '2026-12-31', 'manual'),
  (97405, 'Duplicate accumulator', date '2026-07-01', date '2026-12-31', 'manual');

insert into public.commercial_policy_accumulator_items (accumulator_id, policy_id, position) values
  (97401, 97201, 1),
  (97402, 97201, 1), (97402, 97801, 2),
  (97403, 97201, 1), (97403, 97202, 2),
  (97404, 97201, 1), (97404, 97202, 2),
  (97405, 97202, 1), (97405, 97201, 2);

select throws_ok($$select public.publish_commercial_policy_accumulator(97401, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000051')$$, '23514', null, 'an accumulator with fewer than two members is rejected');
select throws_ok($$select public.publish_commercial_policy_accumulator(97402, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000052')$$, '23514', null, 'an accumulator with an unpublished member is rejected');
select throws_ok($$select public.publish_commercial_policy_accumulator(97403, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000053')$$, '23514', null, 'an accumulator outside the member period intersection is rejected');
select lives_ok($$select public.publish_commercial_policy_accumulator(97404, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000054')$$, 'a valid accumulator is materialized and published atomically');
select is((select combination_fingerprint from public.commercial_policy_accumulators where id = 97404), 'policy_ids:97201,97202', 'the canonical fingerprint is deterministic and ID-sorted');
select is((select monetary_value from public.commercial_policy_accumulator_values where accumulator_id = 97404 and product_id = 2100000101), 2500.00::numeric, 'accumulator value sums frozen member values in numeric');
select is((select count(*) from public.commercial_policy_accumulator_values where accumulator_id = 97404 and product_id = 2100000102), 0::bigint, 'a product absent from one member is not materialized');
select is((select count(*) from public.pricing_audit_events where aggregate_type = 'commercial_policy_accumulator' and aggregate_id = 97404 and action = 'publish'), 1::bigint, 'accumulator publication creates one audit event');

insert into public.commercial_policy_accumulator_values (
  accumulator_id, product_id, monetary_value, calculation_snapshot
) values (97405, 2100000101, 1, '{"preexisting":true}');
select throws_ok($$select public.publish_commercial_policy_accumulator(97405, 'a1000000-0000-4000-8000-000000000001', 1, 'c1000000-0000-4000-8000-000000000055')$$, '23505', null, 'a duplicate published policy combination is rejected');
select is((select monetary_value from public.commercial_policy_accumulator_values where accumulator_id = 97405 and product_id = 2100000101), 1.00::numeric, 'a failed accumulator publication leaves no partial materialization');

insert into public.pricing_import_batches (
  id, source_type, idempotency_key, schema_version, status
) values
  (97501, 'api_import', 'validation:active', '1', 'uploaded'),
  (97502, 'api_import', 'validation:promoted', '1', 'promoted'),
  (97503, 'api_import', 'validation:later-promoted', '1', 'uploaded');
insert into public.pricing_import_rows (
  id, batch_id, source_row_number, status
) values
  (97601, 97501, 1, 'parsed'),
  (97602, 97503, 1, 'parsed');
insert into public.pricing_import_row_outputs (id, import_row_id, public_price_id)
values (97701, 97601, 97001);
insert into public.pricing_import_row_reviews (
  id, import_row_id, decision, previous_status, next_status, snapshot, reviewed_by
) values (
  97702, 97601, 'approve', 'parsed', 'approved', '{}',
  'a1000000-0000-4000-8000-000000000001'
);
update public.pricing_import_rows set status = 'promoted' where id = 97601;
update public.pricing_import_batches set status = 'promoted' where id = 97503;

select throws_ok($$insert into public.pricing_import_rows (batch_id, source_row_number) values (97502, 1)$$, '55000', null, 'a row cannot be added to a promoted batch');
select throws_ok($$update public.pricing_import_rows set raw_payload = '{"changed":true}' where id = 97602$$, '55000', null, 'a row of a promoted batch cannot be updated');
select throws_ok($$delete from public.pricing_import_rows where id = 97602$$, '55000', null, 'a row of a promoted batch cannot be deleted');
select throws_ok($$update public.pricing_import_row_outputs set public_price_id = 97002 where id = 97701$$, '55000', null, 'an output of a promoted row cannot be updated');
select throws_ok($$delete from public.pricing_import_row_outputs where id = 97701$$, '55000', null, 'an output of a promoted row cannot be deleted');
select throws_ok($$insert into public.pricing_import_row_outputs (import_row_id, policy_id) values (97601, 97201)$$, '55000', null, 'an output cannot be added to a promoted row');
select throws_ok($$update public.pricing_import_row_reviews set snapshot = '{"changed":true}' where id = 97702$$, '55000', null, 'a review cannot be updated');
select throws_ok($$delete from public.pricing_import_row_reviews where id = 97702$$, '55000', null, 'a review cannot be deleted');
select throws_ok($$insert into public.pricing_import_row_reviews (import_row_id, decision, previous_status, next_status, snapshot, reviewed_by) values (97601, 'classify', 'promoted', 'promoted', '{}', 'a1000000-0000-4000-8000-000000000001')$$, '55000', null, 'a promoted row cannot receive a new review');
select is((select status::text from public.pricing_import_rows where id = 97601), 'promoted', 'the migration does not automatically promote import rows');
select is((select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like '%promote%pricing%'), 0::bigint, 'no automatic pricing promotion function was introduced');

select is(
  (
    select count(*)
      from pg_trigger as trigger_record
     where not trigger_record.tgisinternal
       and trigger_record.tgrelid in (
         'public.product_public_prices'::regclass,
         'public.financial_parameter_sets'::regclass,
         'public.commercial_policies'::regclass,
         'public.commercial_policy_accumulators'::regclass
       )
       and trigger_record.tgfoid = 'public.prevent_direct_pricing_publication()'::regprocedure
  ),
  4::bigint,
  'all four publishable aggregates require their publication function'
);
select is(
  (
    select count(*)
      from pg_trigger as trigger_record
     where not trigger_record.tgisinternal
       and trigger_record.tgfoid = 'public.prevent_finalized_pricing_import_mutation()'::regprocedure
  ),
  3::bigint,
  'the import hardening helper protects rows, outputs and reviews'
);
select is(
  (
    select count(*)
      from pg_policy
     where polrelid in (
       'public.product_public_prices'::regclass,
       'public.financial_parameter_sets'::regclass,
       'public.commercial_policies'::regclass,
       'public.commercial_policy_applications'::regclass,
       'public.commercial_policy_accumulators'::regclass,
       'public.commercial_policy_accumulator_items'::regclass,
       'public.commercial_policy_accumulator_values'::regclass,
       'public.pricing_import_batches'::regclass,
       'public.pricing_import_rows'::regclass,
       'public.pricing_import_row_outputs'::regclass,
       'public.pricing_import_row_reviews'::regclass,
       'public.pricing_audit_events'::regclass
     )
  ),
  0::bigint,
  'no browser policy was introduced'
);
select ok(
  has_table_privilege('service_role', 'public.product_public_prices', 'SELECT,INSERT,UPDATE')
  and not has_table_privilege('service_role', 'public.product_public_prices', 'DELETE')
  and not has_table_privilege('anon', 'public.product_public_prices', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.commercial_policies', 'SELECT,INSERT,UPDATE,DELETE'),
  'existing least-privilege table grants remain intact'
);
select throws_ok(
  $$update public.pricing_audit_events set reason = 'tamper' where aggregate_type = 'product_public_price' and aggregate_id = 97001$$,
  '55000', null,
  'pricing audit remains append-only'
);
select ok(
  position('product_price_offers' in pg_get_viewdef('public.vw_product_value_current'::regclass, true)) > 0
  and position('product_public_prices' in pg_get_viewdef('public.vw_product_value_current'::regclass, true)) = 0,
  'legacy vw_product_value_current remains intact'
);

select * from finish();

rollback;
