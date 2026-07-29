begin;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select has_table('public', 'commercial_offer_policies', 'junction table exists');
select has_column('public', 'commercial_policies', 'product_id', 'policy owns product_id');
select col_not_null('public', 'commercial_policies', 'product_id', 'policy product_id is mandatory');
select has_pk('public', 'commercial_offer_policies', 'commercial_offer_policies_pkey');
select has_fk('public', 'commercial_policies', 'commercial_policies_product_id_fkey');
select has_fk('public', 'commercial_offer_policies', 'commercial_offer_policies_offer_id_fkey');
select has_fk('public', 'commercial_offer_policies', 'commercial_offer_policies_policy_id_fkey');
select has_index('public', 'commercial_offer_policies', 'commercial_offer_policies_policy_offer_idx', 'reverse junction index exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.commercial_offer_policies'::regclass),
  'junction has RLS enabled'
);
select ok(
  has_table_privilege('service_role', 'public.commercial_offer_policies', 'SELECT')
  and not has_table_privilege('service_role', 'public.commercial_offer_policies', 'INSERT,UPDATE,DELETE'),
  'junction is read-only to service_role and mutates through audited RPCs'
);
select hasnt_column('public', 'commercial_policies', 'commercial_offer_id');
select ok(
  not exists (select 1 from public.commercial_policies where product_id is null),
  'V2 backfill postcondition leaves no policy without a product'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a9000000-0000-4000-8000-000000000001', 'pricing-v2@example.invalid', '{"full_name":"Pricing V2 Admin"}');
update public.profiles set role = 'admin', status = 'active', accepted_at = now()
 where id = 'a9000000-0000-4000-8000-000000000001';

insert into public.products (
  id, brand, model, version, model_year, production_year, is_active, is_public
) values
  (2120000001, 'V2', 'Product', 'A', 2026, 2026, true, false),
  (2120000002, 'V2', 'Product', 'B', 2026, 2026, true, false);

insert into public.product_public_prices (
  id, product_id, amount, starts_on, ends_on, price_type, status, source_type,
  published_at, published_by, source_reference
) values
  (209001, 2120000001, 200000, date '2026-07-01', null, 'msrp',
   'published', 'manual', now(), 'a9000000-0000-4000-8000-000000000001', 'v2-a'),
  (209002, 2120000002, 250000, date '2026-07-01', null, 'msrp',
   'published', 'manual', now(), 'a9000000-0000-4000-8000-000000000001', 'v2-b');

insert into public.commercial_offers (
  id, product_id, public_price_id, source_system, source_reference,
  valid_from, valid_to, status
) values
  (208001, 2120000001, 209001, 'manual', 'offer-a', date '2026-08-01', date '2026-08-31', 'draft'),
  (208002, 2120000001, 209001, 'manual', 'offer-b', date '2026-08-01', date '2026-08-31', 'draft'),
  (208003, 2120000001, 209001, 'manual', 'offer-c', date '2026-08-01', date '2026-08-31', 'draft'),
  (208004, 2120000002, 209002, 'manual', 'other-product', date '2026-08-01', date '2026-08-31', 'draft'),
  (208005, 2120000001, 209001, 'manual', 'audit-membership', date '2026-08-01', date '2026-08-31', 'draft'),
  (208006, 2120000001, 209001, 'manual', 'archived-reject', date '2026-08-01', date '2026-08-31', 'draft');

insert into public.commercial_policies (
  id, product_id, policy_type, scope_type, scope_snapshot, title, description,
  starts_on, ends_on, calculation_method, fixed_amount, customer_benefit_amount,
  status, source_type
) values
  (207001, 2120000001, 'retail_bonus', 'product_set', '{}', 'Rate benefit', null,
   date '2026-08-01', date '2026-08-31', 'fixed_amount', 12000, 12000, 'draft', 'manual'),
  (207002, 2120000001, 'trade_in_bonus', 'product_set', '{}', 'Trade-in', null,
   date '2026-07-01', null, 'fixed_amount', 10000, 10000, 'draft', 'manual'),
  (207003, 2120000001, 'free_insurance', 'product_set', '{}', 'Insurance', null,
   date '2026-07-01', null, 'percentage_of_msrp', null, 4000, 'draft', 'manual'),
  (207004, 2120000002, 'retail_bonus', 'product_set', '{}', 'Other product', null,
   date '2026-07-01', null, 'fixed_amount', 1000, 1000, 'draft', 'manual'),
  (207005, 2120000001, 'retail_bonus', 'product_set', '{}', 'Short validity', null,
   date '2026-08-02', date '2026-08-30', 'fixed_amount', 1000, 1000, 'draft', 'manual'),
  (207006, 2120000001, 'retail_bonus', 'product_set', '{}', 'Archived', null,
   date '2026-07-01', null, 'fixed_amount', 1000, 1000, 'archived', 'manual'),
  (207007, 2120000001, 'free_wallbox', 'product_set', '{}', 'Wallbox', null,
   date '2026-07-01', null, 'fixed_amount', null, null, 'draft', 'manual'),
  (207008, 2120000001, 'free_maintenance', 'product_set', '{}', 'Maintenance', null,
   date '2026-07-01', null, 'fixed_amount', null, null, 'draft', 'manual'),
  (207009, 2120000001, 'other', 'product_set', '{}', 'Other', 'Documented',
   date '2026-07-01', null, 'fixed_amount', null, null, 'draft', 'manual'),
  (207010, 2120000001, 'free_registration', 'product_set', '{}', 'Registration', null,
   date '2026-08-01', date '2026-08-31', 'percentage_of_msrp', null, 2000, 'draft', 'manual');

update public.commercial_policies
   set calculation_base_price_id = 209001, annual_rate = 0.02, coverage_years = 1
 where id = 207003;
update public.commercial_policies
   set calculation_base_price_id = 209001, percentage_rate = 0.01
 where id = 207010;

select lives_ok(
  $$insert into public.commercial_offer_policies values (208001, 207001), (208001, 207003), (208002, 207002), (208002, 207003), (208003, 207001), (208003, 207002)$$,
  'draft offers accept draft policies and one policy may belong to multiple offers'
);
select is(
  (select count(*) from public.commercial_offer_policies where commercial_policy_id = 207001),
  2::bigint,
  'one policy is reused by two offers without duplication'
);
select throws_ok(
  $$insert into public.commercial_offer_policies values (208001, 207001)$$,
  '23505', null, 'duplicate membership fails'
);
select throws_ok(
  $$insert into public.commercial_offer_policies values (208004, 207001)$$,
  '23514', 'commercial offer and policy must belong to the same product',
  'cross-product membership fails'
);
select throws_ok(
  $$insert into public.commercial_offer_policies values (208001, 207005)$$,
  '23514', 'commercial policy must cover the complete offer validity period',
  'incompatible validity fails'
);
select throws_ok(
  $$insert into public.commercial_offer_policies values (208006, 207006)$$,
  '23514', 'rejected or archived commercial policy cannot be added to an offer',
  'archived policy cannot enter a new offer'
);

select throws_ok(
  $$select public.publish_commercial_offer(208001, 'a9000000-0000-4000-8000-000000000001', 1, 'c9000000-0000-4000-8000-000000000001')$$,
  '23514', 'commercial offer requires published policies',
  'offer publication requires independently published policies'
);

select lives_ok(
  $$select public.publish_commercial_policy(207001, 'a9000000-0000-4000-8000-000000000001', 1, 'c9000000-0000-4000-8000-000000000011')$$,
  'retail policy publishes independently'
);
select lives_ok(
  $$select public.publish_commercial_policy(207002, 'a9000000-0000-4000-8000-000000000001', 1, 'c9000000-0000-4000-8000-000000000012')$$,
  'trade-in policy publishes independently'
);
select lives_ok(
  $$select public.publish_commercial_policy(207003, 'a9000000-0000-4000-8000-000000000001', 2, 'c9000000-0000-4000-8000-000000000013')$$,
  'insurance policy publishes independently'
);
select is(
  (select count(*) from public.commercial_policies where id in (207001,207002,207003) and status = 'published'),
  3::bigint,
  'three policies reached published before their offers'
);

select lives_ok(
  $$select public.publish_commercial_offer(208001, 'a9000000-0000-4000-8000-000000000001', 1, 'c9000000-0000-4000-8000-000000000021')$$,
  'offer publishes after all member policies are published'
);
select is((select status::text from public.commercial_offers where id = 208001), 'published', 'offer reaches published');
select is((select lock_version from public.commercial_offers where id = 208001), 2, 'offer publication increments lock exactly once');
select is(
  (select count(*) from public.commercial_policies where id in (207001,207003) and status = 'published'),
  2::bigint,
  'offer publication does not change policy lifecycle'
);
select throws_ok(
  $$delete from public.commercial_offer_policies where commercial_offer_id = 208001 and commercial_policy_id = 207001$$,
  '55000', 'memberships of published or archived commercial offers are immutable',
  'published offer membership cannot be removed'
);
select throws_ok(
  $$insert into public.commercial_offer_policies values (208001, 207002)$$,
  '55000', 'memberships of published or archived commercial offers are immutable',
  'published offer membership cannot be added'
);

select lives_ok(
  $$select public.link_commercial_offer_policy(208005, 207002, 'a9000000-0000-4000-8000-000000000001', 1, 'c9000000-0000-4000-8000-000000000031')$$,
  'audited link RPC creates a membership'
);
select is((select lock_version from public.commercial_offers where id = 208005), 2, 'link increments offer lock once');
select lives_ok(
  $$select public.unlink_commercial_offer_policy(208005, 207002, 'a9000000-0000-4000-8000-000000000001', 2, 'c9000000-0000-4000-8000-000000000032')$$,
  'audited unlink RPC removes a draft membership'
);
select is((select lock_version from public.commercial_offers where id = 208005), 3, 'unlink increments offer lock once');
select is(
  (select count(*) from public.pricing_audit_events where aggregate_type = 'commercial_offer' and aggregate_id = 208005 and action in ('link','unlink')),
  2::bigint,
  'link and unlink record audit events'
);

select throws_ok(
  $$select public.validate_commercial_policy_for_publication(207007)$$,
  '23514', 'published commercial policy requires a positive customer benefit amount',
  'wallbox requires a value'
);
select throws_ok(
  $$select public.validate_commercial_policy_for_publication(207008)$$,
  '23514', 'published commercial policy requires a positive customer benefit amount',
  'maintenance requires a value'
);
select throws_ok(
  $$select public.validate_commercial_policy_for_publication(207009)$$,
  '23514', 'published commercial policy requires a positive customer benefit amount',
  'other requires a value'
);
update public.commercial_policies set fixed_amount = 4000, customer_benefit_amount = 4000 where id = 207007;
update public.commercial_policies set fixed_amount = 3000, customer_benefit_amount = 3000 where id = 207008;
update public.commercial_policies set fixed_amount = 1000, customer_benefit_amount = 1000 where id = 207009;
select lives_ok($$select public.validate_commercial_policy_for_publication(207007)$$, 'monetized wallbox validates');
select lives_ok($$select public.validate_commercial_policy_for_publication(207008)$$, 'monetized maintenance validates');
select lives_ok($$select public.validate_commercial_policy_for_publication(207009)$$, 'monetized other validates');
select lives_ok($$select public.validate_commercial_policy_for_publication(207010)$$, 'registration validates at one percent');
update public.commercial_policies set customer_benefit_amount = 2001 where id = 207010;
select throws_ok(
  $$select public.validate_commercial_policy_for_publication(207010)$$,
  '23514', 'registration policy must equal one percent of its MSRP',
  'registration rejects a value other than one percent'
);

select lives_ok(
  $$insert into public.pricing_import_batches (source_type, idempotency_key, schema_version) values ('manual','pricing-v2:manual','2')$$,
  'manual persistent batch is accepted'
);
select lives_ok(
  $$insert into public.pricing_import_batches (source_type, idempotency_key, schema_version) values ('ai_extraction','pricing-v2:ai','2')$$,
  'existing AI import source remains accepted'
);

select throws_ok(
  $$update public.product_public_prices set ends_on = date '2026-09-30' where id = 209001$$,
  '55000', 'published or archived product public price V2 identity is immutable',
  'terminal price ends_on is immutable'
);
select throws_ok(
  $$update public.product_public_prices set source_reference = 'tampered' where id = 209001$$,
  '55000', 'published or archived product public price V2 identity is immutable',
  'terminal price source reference is immutable'
);
select throws_ok(
  $$update public.product_public_prices set price_type = 'other' where id = 209001$$,
  '55000', 'published or archived product public price V2 identity is immutable',
  'terminal price type is immutable'
);
select throws_ok(
  $$update public.product_public_prices set legacy_source_id = 1 where id = 209001$$,
  '55000', 'published or archived product public price V2 identity is immutable',
  'terminal price legacy source is immutable'
);

select is(
  (select count(*) from public.commercial_policy_applications where policy_id between 207001 and 207010),
  0::bigint,
  'Pricing V2 does not recreate legacy policy applications'
);

select * from finish();
rollback;
