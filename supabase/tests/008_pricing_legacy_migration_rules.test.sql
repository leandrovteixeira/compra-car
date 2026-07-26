begin;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select has_table('public', 'commercial_offers');
select has_column('public', 'commercial_offers', 'product_id');
select has_column('public', 'commercial_offers', 'public_price_id');
select has_column('public', 'commercial_offers', 'legacy_source_id');
select has_column('public', 'commercial_offers', 'valid_from');
select has_column('public', 'commercial_offers', 'valid_to');
select has_column('public', 'commercial_offers', 'status');
select has_fk('public', 'commercial_offers', 'commercial_offers_product_id_fkey');
select has_fk('public', 'commercial_offers', 'commercial_offers_public_price_id_fkey');
select has_index('public', 'commercial_offers', 'commercial_offers_product_validity_idx');

select has_column('public', 'product_public_prices', 'price_type');
select has_column('public', 'product_public_prices', 'ends_on');
select has_column('public', 'product_public_prices', 'source_reference');
select has_column('public', 'commercial_policies', 'commercial_offer_id');
select has_column('public', 'commercial_policies', 'calculation_base_price_id');
select has_column('public', 'commercial_policies', 'customer_benefit_amount');
select has_column('public', 'commercial_policies', 'dealer_rebate_amount');
select has_column('public', 'commercial_policies', 'dealer_rebate_allocation_method');
select has_column('public', 'commercial_policies', 'dealer_rebate_allocation_base');
select has_column('public', 'commercial_policies', 'dealer_rebate_allocation_percentage');
select has_column('public', 'commercial_policies', 'dealer_rebate_rounding_residual');
select has_column('public', 'commercial_policies', 'legacy_policy_source');
select has_column('public', 'commercial_policies', 'legacy_offer_id');
select has_column('public', 'commercial_policies', 'legacy_source_column');
select has_column('public', 'commercial_policies', 'legacy_dealer_rebate_value');
select has_column('public', 'commercial_policies', 'fixed_amount');
select has_column('public', 'commercial_policies', 'percentage_rate');
select has_column('public', 'commercial_policies', 'voucher_type');
select has_column('public', 'commercial_policies', 'policy_parameters');
select has_fk('public', 'commercial_policies', 'commercial_policies_commercial_offer_id_fkey');
select has_fk('public', 'commercial_policies', 'commercial_policies_calculation_base_price_id_fkey');
select has_check('public', 'commercial_policies', 'commercial_policies_rebate_allocation_check');
select has_check('public', 'commercial_policies', 'commercial_policies_parameters_check');

select has_column('public', 'commercial_policy_accumulators', 'commercial_offer_id');
select has_column('public', 'commercial_policy_accumulators', 'relation_type');
select has_column('public', 'commercial_policy_accumulators', 'relation_origin');
select has_column('public', 'financial_parameter_sets', 'annual_cdi_rate');
select has_column('public', 'financial_parameter_sets', 'monthly_cdi_rate');
select has_column('public', 'financial_parameter_sets', 'monthly_spread_rate');
select has_column('public', 'financial_parameter_sets', 'monthly_reference_rate');
select has_function('public', 'validate_commercial_offer_publication', array[]::text[]);
select has_function('public', 'validate_legacy_policy_publication', array[]::text[]);

select has_function(
  'public',
  'publish_commercial_offer',
  array['bigint', 'uuid', 'integer', 'uuid']
);
select function_returns(
  'public',
  'publish_commercial_offer',
  array['bigint', 'uuid', 'integer', 'uuid'],
  'commercial_offers'
);
select ok(
  (
    select procedure.prosecdef and owner.rolname = 'postgres'
       and array_to_string(procedure.proconfig, ',') = 'search_path=""'
      from pg_proc as procedure
      join pg_roles as owner on owner.oid = procedure.proowner
     where procedure.oid = 'public.publish_commercial_offer(bigint,uuid,integer,uuid)'::regprocedure
  ),
  'offer publication is a postgres-owned SECURITY DEFINER function with an empty search_path'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a8000000-0000-4000-8000-000000000001', 'offer-admin@example.invalid', '{"full_name":"Offer Admin"}');
update public.profiles set role = 'admin', status = 'active', accepted_at = now()
 where id = 'a8000000-0000-4000-8000-000000000001';

insert into public.products (
  id, brand, model, version, model_year, production_year, is_active, is_public
) values
  (2800000101, 'Offer Brand', 'Offer Model', 'Version A', 2026, 2026, true, false),
  (2800000102, 'Offer Brand', 'Offer Model', 'Version B', 2026, 2026, true, false);

insert into public.product_public_prices (
  id, product_id, amount, starts_on, status, source_type, published_at, published_by,
  price_type, ends_on, source_reference
) values
  (98001, 2800000101, 100000, date '2026-01-01', 'published', 'manual', now(), 'a8000000-0000-4000-8000-000000000001', 'msrp', null, 'test-published'),
  (98002, 2800000101, 100000, date '2026-02-01', 'draft', 'manual', null, null, 'msrp', null, 'test-draft'),
  (98003, 2800000101, 100000, date '2026-03-01', 'archived', 'manual', null, null, 'msrp', null, 'test-archived'),
  (98004, 2800000102, 100000, date '2026-01-01', 'published', 'manual', now(), 'a8000000-0000-4000-8000-000000000001', 'msrp', null, 'test-other-product'),
  (98005, 2800000101, 0, date '2026-04-01', 'draft', 'manual', null, null, 'msrp', null, 'test-zero');

insert into public.financial_parameter_sets (
  id, version, name, effective_from, cdi_monthly_percentage,
  spread_monthly_percentage, status, source_type, published_at, published_by,
  annual_cdi_rate, monthly_cdi_rate, monthly_spread_rate, monthly_reference_rate, methodology
) values (
  98501, 8001, 'Offer publication test rate', date '2026-01-01', 1, 0.1,
  'published', 'manual', now(), 'a8000000-0000-4000-8000-000000000001',
  0.12, 0.009, 0.001, 0.01, 'effective_annual_cdi_plus_monthly_spread'
);

insert into public.commercial_offers (
  id, product_id, public_price_id, source_system, source_reference, valid_from, valid_to
) values
  (88001, 2800000101, 98001, 'pgtap', 'valid-retail', date '2026-01-01', date '2026-01-31'),
  (88002, 2800000101, 98002, 'pgtap', 'draft-price', date '2026-02-01', date '2026-02-28'),
  (88003, 2800000101, 98003, 'pgtap', 'archived-price', date '2026-03-01', date '2026-03-31'),
  (88004, 2800000101, 98004, 'pgtap', 'other-product', date '2026-01-01', date '2026-01-31'),
  (88005, 2800000101, 98005, 'pgtap', 'zero-price', date '2026-04-01', date '2026-04-30'),
  (88006, 2800000101, 98001, 'pgtap', 'unallocated', date '2026-01-01', date '2026-01-31'),
  (88007, 2800000101, 98001, 'pgtap', 'draft-delete', date '2026-01-01', date '2026-01-31'),
  (88008, 2800000101, 98001, 'pgtap', 'archived-delete', date '2026-01-01', date '2026-01-31');
update public.commercial_offers
   set blocking_issues = '["UNALLOCATED_LEGACY_DEALER_REBATE"]'::jsonb
 where id = 88006;
update public.commercial_offers set status = 'archived' where id = 88008;

insert into public.commercial_policies (
  id, policy_type, scope_type, scope_snapshot, title, starts_on, calculation_method,
  status, source_type, commercial_offer_id, calculation_base_price_id,
  customer_benefit_amount, fixed_amount, legacy_policy_source, policy_parameters
) values
  (89001, 'retail_bonus', 'product_set', '{}', 'Retail', date '2026-01-01', 'fixed_amount', 'draft', 'manual', 88001, 98001, 1000, 1000, 'retail_bonus', '{}'),
  (89002, 'trade_in_bonus', 'product_set', '{}', 'Trade-in', date '2026-01-01', 'fixed_amount', 'draft', 'manual', 88001, 98001, 1000, 1000, 'trade_in_bonus', '{}'),
  (89003, 'free_wallbox', 'product_set', '{}', 'Wallbox', date '2026-01-01', 'fixed_amount', 'draft', 'manual', 88001, 98001, 4000, 4000, null, '{}'),
  (89004, 'free_registration', 'product_set', '{}', 'Registration', date '2026-01-01', 'percentage_of_msrp', 'draft', 'manual', 88001, 98001, 1000, null, null, '{}'),
  (89005, 'free_maintenance', 'product_set', '{}', 'Maintenance', date '2026-01-01', 'non_monetized', 'draft', 'manual', 88001, 98001, null, null, null, '{"maintenance_count":1}'),
  (89006, 'fuel_or_recharge_voucher', 'product_set', '{}', 'Voucher', date '2026-01-01', 'fixed_amount', 'draft', 'manual', 88001, 98001, 500, 500, null, '{}'),
  (89007, 'other', 'product_set', '{}', 'Legacy other', date '2026-01-01', 'fixed_amount', 'draft', 'manual', 88001, 98001, 250, 250, 'others_bonus', '{}'),
  (89008, 'subsidized_financing', 'product_set', '{}', 'Financing', date '2026-01-01', 'discounted_promotional_cash_flow_difference', 'draft', 'manual', 88001, 98001, 5000, null, 'subsidized_rate_monthly', '{}'),
  (89009, 'free_insurance', 'product_set', '{}', 'Insurance', date '2026-01-01', 'percentage_of_msrp', 'draft', 'manual', 88001, 98001, 3000, null, 'insurance_years', '{}'),
  (89010, 'free_ipva', 'product_set', '{}', 'IPVA', date '2026-01-01', 'proportional_ipva', 'draft', 'manual', 88001, 98001, 4000, null, 'ipva_included', '{}'),
  (89011, 'other', 'product_set', '{}', 'New other', date '2026-02-01', 'fixed_amount', 'draft', 'manual', 88002, null, 250, 250, null, '{}'),
  (89012, 'retail_bonus', 'product_set', '{}', 'Unlinked', date '2026-01-01', 'fixed_amount', 'draft', 'manual', null, null, 100, 100, null, '{}');
update public.commercial_policies set percentage_rate = 0.01 where id = 89004;
update public.commercial_policies set voucher_type = 'fuel' where id = 89006;
update public.commercial_policies
   set term_months = 24, customer_interest_rate_monthly = 0,
       down_payment_percentage = 40, financed_principal = 60000,
       financial_parameter_set_id = 98501,
       customer_benefit_amount = round(60000 - 2500 * (1 - power(1.01, -24)) / 0.01, 2)
 where id = 89008;
update public.commercial_policies set annual_rate = 0.03, coverage_years = 1 where id = 89009;
update public.commercial_policies set annual_rate = 0.04, offer_month = 1, remaining_months = 12 where id = 89010;

select lives_ok(
  $$select public.validate_commercial_policy_for_offer(89001, 88001)$$,
  'a valid retail policy passes offer validation'
);
select lives_ok(
  $$select public.validate_commercial_policy_for_offer(89002, 88001)$$,
  'a valid trade-in policy passes offer validation'
);
select lives_ok(
  $$select public.validate_commercial_policy_for_offer(89003, 88001)$$,
  'a fixed R$ 4,000 wallbox passes offer validation'
);
select lives_ok(
  $$select public.validate_commercial_policy_for_offer(89004, 88001)$$,
  'a one-percent registration benefit passes offer validation'
);
select lives_ok(
  $$select public.validate_commercial_policy_for_offer(89005, 88001)$$,
  'non-monetized maintenance with positive coverage passes offer validation'
);
select lives_ok(
  $$select public.validate_commercial_policy_for_offer(89006, 88001)$$,
  'a nominal voucher with an explicit valid type passes offer validation'
);
select lives_ok(
  $$select public.validate_commercial_policy_for_offer(89007, 88001)$$,
  'legacy others_bonus remains valid without a description'
);
select lives_ok(
  $$select public.validate_commercial_policy_for_offer(89008, 88001)$$,
  'a structurally valid subsidized financing policy passes offer validation'
);
select lives_ok(
  $$select public.validate_commercial_policy_for_offer(89009, 88001)$$,
  'a valid insurance policy passes offer validation'
);
select lives_ok(
  $$select public.validate_commercial_policy_for_offer(89010, 88001)$$,
  'a valid proportional IPVA policy passes offer validation'
);
select throws_ok(
  $$select public.validate_commercial_policy_for_offer(89011, 88002)$$,
  '23514', 'other policy is not publishable', 'a new other policy requires a description'
);
update public.commercial_policies set description = 'Documented new benefit' where id = 89011;
select lives_ok(
  $$select public.validate_commercial_policy_for_offer(89011, 88002)$$,
  'a new other policy with a non-empty description is valid'
);

update public.commercial_policies set voucher_type = null where id = 89006;
select throws_ok(
  $$select public.validate_commercial_policy_for_offer(89006, 88001)$$,
  '23514', 'voucher policy is not publishable', 'voucher_type NULL blocks publication'
);
update public.commercial_policies set voucher_type = 'fuel' where id = 89006;
select throws_ok(
  $$update public.commercial_policies set voucher_type = 'invalid' where id = 89006$$,
  '23514', null, 'an invalid voucher_type is rejected by the draft constraint'
);

update public.commercial_policies set policy_parameters = '{}', description = '   ' where id = 89005;
select throws_ok(
  $$select public.validate_commercial_policy_for_offer(89005, 88001)$$,
  '23514', null, 'maintenance without a description or positive coverage is rejected'
);
update public.commercial_policies set policy_parameters = '{"coverage_months":12}', description = null where id = 89005;
select lives_ok(
  $$select public.validate_commercial_policy_for_offer(89005, 88001)$$,
  'positive integer maintenance coverage is accepted'
);
update public.commercial_policies set policy_parameters = '{"coverage_km":"10000"}' where id = 89005;
select throws_ok(
  $$select public.validate_commercial_policy_for_offer(89005, 88001)$$,
  '23514', null, 'textual maintenance coverage is rejected'
);
update public.commercial_policies set policy_parameters = '{"coverage_km":10000}' where id = 89005;
update public.commercial_policies set customer_benefit_amount = 1 where id = 89005;
select throws_ok(
  $$select public.validate_commercial_policy_for_offer(89005, 88001)$$,
  '23514', null, 'maintenance with a monetary benefit is rejected'
);
update public.commercial_policies set customer_benefit_amount = null, calculation_method = 'fixed_amount' where id = 89005;
select throws_ok(
  $$select public.validate_commercial_policy_for_offer(89005, 88001)$$,
  '23514', null, 'maintenance with a monetized calculation method is rejected'
);
update public.commercial_policies set calculation_method = 'non_monetized' where id = 89005;

select throws_ok(
  $$update public.commercial_policies set dealer_rebate_amount = 1, dealer_rebate_allocation_method = null where id = 89003$$,
  '23514', null, 'rebate on wallbox is rejected'
);
select throws_ok(
  $$update public.commercial_policies set dealer_rebate_amount = null, dealer_rebate_allocation_method = 'explicit_legacy_component' where id = 89001$$,
  '23514', null, 'rebate method without amount is rejected'
);
select throws_ok(
  $$update public.commercial_policies set dealer_rebate_amount = 1, dealer_rebate_allocation_method = null where id = 89001$$,
  '23514', null, 'rebate amount without method is rejected'
);
select throws_ok(
  $$update public.commercial_policies set dealer_rebate_amount = 0, dealer_rebate_allocation_method = null where id = 89001$$,
  '23514', null, 'zero is not a representation of absent rebate'
);
select throws_ok(
  $$update public.commercial_policies set dealer_rebate_amount = 1, dealer_rebate_allocation_method = 'explicit_legacy_component' where id = 89004$$,
  '23514', null, 'rebate on registration is rejected'
);
select throws_ok(
  $$update public.commercial_policies set dealer_rebate_amount = 1, dealer_rebate_allocation_method = 'explicit_legacy_component' where id = 89005$$,
  '23514', null, 'rebate on maintenance is rejected'
);
select throws_ok(
  $$update public.commercial_policies set dealer_rebate_amount = 1, dealer_rebate_allocation_method = 'explicit_legacy_component' where id = 89006$$,
  '23514', null, 'rebate on voucher is rejected'
);
select throws_ok(
  $$update public.commercial_policies set dealer_rebate_amount = 1, dealer_rebate_allocation_method = 'explicit_legacy_component' where id = 89007$$,
  '23514', null, 'rebate on other is rejected'
);
select throws_ok(
  $$update public.commercial_policies set dealer_rebate_amount = 1, dealer_rebate_allocation_method = 'explicit_legacy_component' where id = 89010$$,
  '23514', null, 'rebate on IPVA is rejected'
);
select throws_ok(
  $$update public.commercial_policies set dealer_rebate_amount = 1, dealer_rebate_allocation_method = 'explicit_legacy_component' where id = 89009$$,
  '23514', null, 'rebate on insurance is rejected'
);

select throws_ok(
  $$select public.assert_commercial_offer_publishable(88002)$$,
  '23514', null, 'a draft price blocks offer publication'
);
select throws_ok(
  $$select public.assert_commercial_offer_publishable(88003)$$,
  '23514', null, 'an archived price blocks offer publication'
);
select throws_ok(
  $$select public.assert_commercial_offer_publishable(88004)$$,
  '23514', null, 'a price from another product blocks offer publication'
);
select throws_ok(
  $$select public.assert_commercial_offer_publishable(88005)$$,
  '23514', null, 'a non-positive price blocks offer publication'
);
select throws_ok(
  $$select public.assert_commercial_offer_publishable(88006)$$,
  '23514', 'commercial offer has blocking issues', 'unallocated rebate blocks publication'
);

set local role service_role;
select throws_ok(
  $$update public.commercial_policies set status = 'published', published_at = now(), published_by = 'a8000000-0000-4000-8000-000000000001' where id = 89012$$,
  '42501', null, 'a service role cannot directly publish an unlinked policy'
);
select throws_ok(
  $$update public.commercial_policies set status = 'published', published_at = now(), published_by = 'a8000000-0000-4000-8000-000000000001' where id = 89001$$,
  '42501', null, 'a linked policy cannot be published separately from its offer'
);
select throws_ok(
  $$update public.commercial_offers set status = 'published', published_at = now(), published_by = 'a8000000-0000-4000-8000-000000000001' where id = 88001$$,
  '42501', 'commercial offer publication requires publish_commercial_offer',
  'direct draft-to-published UPDATE is blocked'
);
select lives_ok(
  $$select public.publish_commercial_offer(88001, 'a8000000-0000-4000-8000-000000000001', 1, 'c8000000-0000-4000-8000-000000000001')$$,
  'the official function publishes a valid offer atomically'
);
reset role;

select is((select status::text from public.commercial_offers where id = 88001), 'published', 'official publication changes offer status');
select is((select count(*) from public.commercial_policy_applications where policy_id between 89001 and 89010), 0::bigint, 'offer publication does not depend on or create legacy applications');
select is((select count(*) from public.commercial_policies where id between 89001 and 89010 and status = 'published'), 10::bigint, 'official publication publishes every linked draft policy');
select is((select count(*) from public.pricing_audit_events where aggregate_type = 'commercial_offer' and aggregate_id = 88001), 1::bigint, 'official publication records one offer audit event');

select lives_ok($$delete from public.commercial_offers where id = 88007$$, 'a draft offer may be deleted');
select throws_ok($$delete from public.commercial_offers where id = 88001$$, '55000', 'published or archived commercial offers cannot be deleted', 'a published offer cannot be deleted');
select throws_ok($$delete from public.commercial_offers where id = 88008$$, '55000', 'published or archived commercial offers cannot be deleted', 'an archived offer cannot be deleted');
select throws_ok($$update public.commercial_offers set status = 'draft' where id = 88001$$, '55000', null, 'a published offer cannot return to draft');
select throws_ok($$update public.commercial_offers set status = 'draft' where id = 88008$$, '55000', null, 'an archived offer remains terminal');

select * from finish();
rollback;
