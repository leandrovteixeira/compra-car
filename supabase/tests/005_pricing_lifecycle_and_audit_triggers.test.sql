begin;

set local search_path = extensions, public, pg_catalog;

select no_plan();

select is(
  (
    select array_agg(procedure.proname::text order by procedure.proname)
      from pg_proc as procedure
     where procedure.oid in (
       'public.prevent_pricing_audit_mutation()'::regprocedure,
       'public.prevent_published_pricing_delete()'::regprocedure,
       'public.prevent_published_pricing_identity_change()'::regprocedure,
       'public.set_pricing_updated_at()'::regprocedure
     )
  ),
  array[
    'prevent_pricing_audit_mutation',
    'prevent_published_pricing_delete',
    'prevent_published_pricing_identity_change',
    'set_pricing_updated_at'
  ],
  'all four pricing lifecycle trigger functions exist'
);

select ok(
  (
    select count(*) = 4
       and bool_and(not procedure.prosecdef)
       and bool_and(owner.rolname = 'postgres')
       and bool_and(array_to_string(procedure.proconfig, ',') = 'search_path=""')
      from pg_proc as procedure
      join pg_roles as owner on owner.oid = procedure.proowner
     where procedure.oid in (
       'public.prevent_pricing_audit_mutation()'::regprocedure,
       'public.prevent_published_pricing_delete()'::regprocedure,
       'public.prevent_published_pricing_identity_change()'::regprocedure,
       'public.set_pricing_updated_at()'::regprocedure
     )
  ),
  'pricing trigger functions are SECURITY INVOKER, postgres-owned and use an empty search_path'
);

select ok(
  (
    with functions(signature) as (
      values
        ('public.prevent_pricing_audit_mutation()'),
        ('public.prevent_published_pricing_delete()'),
        ('public.prevent_published_pricing_identity_change()'),
        ('public.set_pricing_updated_at()')
    ), roles(name) as (
      values ('anon'), ('authenticated'), ('service_role')
    )
    select bool_and(not has_function_privilege(roles.name, functions.signature, 'EXECUTE'))
      from functions cross join roles
  ),
  'anon, authenticated and service_role cannot execute trigger functions directly'
);

select is(
  (
    select count(*)
      from pg_trigger as trigger_record
      join pg_proc as procedure on procedure.oid = trigger_record.tgfoid
     where not trigger_record.tgisinternal
       and procedure.proname in (
         'prevent_pricing_audit_mutation',
         'prevent_published_pricing_delete',
         'prevent_published_pricing_identity_change',
         'set_pricing_updated_at'
       )
  ),
  23::bigint,
  'the four functions are attached through exactly 23 row triggers'
);

select is(
  (
    select count(*)
      from pg_trigger as trigger_record
      join pg_proc as procedure on procedure.oid = trigger_record.tgfoid
     where not trigger_record.tgisinternal
       and procedure.proname = 'set_pricing_updated_at'
  ),
  7::bigint,
  'updated_at and lock_version automation is limited to the seven approved tables'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '99999999-9999-4999-8999-999999999999',
  'pricing-lifecycle@example.invalid',
  '{"full_name":"Pricing Lifecycle"}'::jsonb
);

insert into public.products (
  id, brand, model, version, model_year, production_year, is_active, is_public
) values
  (2100000003, 'Sprint 9', 'Lifecycle', 'Fixture A', 2026, 2026, true, false),
  (2100000004, 'Sprint 9', 'Lifecycle', 'Fixture B', 2026, 2026, true, false);

insert into public.product_public_prices (
  id, product_id, amount, starts_on, status, source_type, updated_at
) values (
  95201, 2100000003, 100000, date '2026-07-01', 'draft', 'manual',
  now() - interval '1 day'
);

select is(
  (select lock_version from public.product_public_prices where id = 95201),
  1,
  'new lifecycle records start with lock_version 1'
);

update public.product_public_prices
   set amount = 101000,
       lock_version = 99
 where id = 95201;

select is(
  (select lock_version from public.product_public_prices where id = 95201),
  2,
  'an update increments lock_version by exactly one and ignores a caller-supplied value'
);
select is(
  (select updated_at from public.product_public_prices where id = 95201),
  now(),
  'an update resets updated_at to the transaction timestamp'
);

set local role service_role;
select lives_ok(
  $$update public.product_public_prices set amount = 102000 where id = 95201$$,
  'service_role updates invoke the trigger without direct EXECUTE privilege'
);
reset role;

select is(
  (select lock_version from public.product_public_prices where id = 95201),
  3,
  'the indirect service_role update also increments lock_version exactly once'
);

insert into public.product_public_prices (
  id, product_id, amount, starts_on, status, source_type,
  published_at, published_by
) values (
  95202, 2100000003, 110000, date '2026-08-01', 'published', 'manual',
  now(), '99999999-9999-4999-8999-999999999999'
);

select throws_ok(
  $$update public.product_public_prices set amount = 111000 where id = 95202$$,
  '55000',
  'published or archived product_public_prices economic identity is immutable',
  'published price rejects a material amount change'
);
select lives_ok(
  $$update public.product_public_prices set updated_by = '99999999-9999-4999-8999-999999999999' where id = 95202$$,
  'published price permits an intentional technical actor update'
);
select lives_ok(
  $$update public.product_public_prices set status = 'archived' where id = 95202$$,
  'published price permits a lifecycle-only transition to archived'
);
select throws_ok(
  $$update public.product_public_prices set status = 'draft' where id = 95202$$,
  '55000',
  'published or archived product_public_prices economic identity is immutable',
  'archived price cannot regress to a mutable lifecycle state'
);
select throws_ok(
  $$delete from public.product_public_prices where id = 95202$$,
  '55000',
  null,
  'archived price cannot be deleted'
);

insert into public.financial_parameter_sets (
  id, version, name, effective_from, cdi_monthly_percentage,
  spread_monthly_percentage, status, source_type, published_at, published_by
) values (
  95301, 95301, 'Lifecycle parameters', date '2026-07-01', 1, 1,
  'published', 'manual', now(), '99999999-9999-4999-8999-999999999999'
);
select throws_ok(
  $$update public.financial_parameter_sets set spread_monthly_percentage = 2 where id = 95301$$,
  '55000',
  'published or archived financial_parameter_sets economic identity is immutable',
  'published financial parameters reject a material rate change'
);

insert into public.commercial_policies (
  id, policy_type, scope_type, scope_snapshot, title, starts_on,
  calculation_method, status, source_type
) values (
  95401, 'other', 'product_set', '{}', 'Draft policy', date '2026-07-01',
  'manual_amount', 'draft', 'manual'
);
select lives_ok(
  $$update public.commercial_policies set title = 'Edited draft policy' where id = 95401$$,
  'draft policy permits material editing'
);

insert into public.commercial_policies (
  id, policy_type, scope_type, scope_snapshot, title, starts_on,
  calculation_method, status, source_type, published_at, published_by
) values (
  95402, 'retail_bonus', 'product_set', '{}', 'Published policy', date '2026-07-01',
  'fixed_amount', 'published', 'manual', now(),
  '99999999-9999-4999-8999-999999999999'
);
select throws_ok(
  $$update public.commercial_policies set title = 'Changed published policy' where id = 95402$$,
  '55000',
  'published or archived commercial_policies economic identity is immutable',
  'published policy rejects a material title change'
);

insert into public.commercial_policy_applications (
  id, policy_id, product_id, input_monetary_value, monetary_value,
  calculation_snapshot
) values (
  95502, 95402, 2100000003, 5000, 5000, '{"rule":"fixed"}'
);
select throws_ok(
  $$update public.commercial_policy_applications set monetary_value = 6000 where id = 95502$$,
  '55000',
  'application of a published or archived commercial policy is immutable',
  'application of a published policy rejects frozen monetary value changes'
);
select lives_ok(
  $$update public.commercial_policy_applications set updated_by = '99999999-9999-4999-8999-999999999999' where id = 95502$$,
  'application of a published policy permits a technical actor update'
);

insert into public.commercial_policy_accumulators (
  id, title, starts_on, status, source_type
) values (
  95601, 'Draft accumulator', date '2026-07-01', 'draft', 'manual'
);
select lives_ok(
  $$update public.commercial_policy_accumulators set title = 'Edited draft accumulator' where id = 95601$$,
  'draft accumulator permits material editing'
);

insert into public.commercial_policy_accumulators (
  id, title, starts_on, combination_fingerprint, status, source_type
) values (
  95602, 'Accumulator to publish', date '2026-07-01', 'fixture:95602', 'draft', 'manual'
);
insert into public.commercial_policy_accumulator_items (
  accumulator_id, policy_id, position
) values (95602, 95402, 1);
insert into public.commercial_policy_accumulator_values (
  id, accumulator_id, product_id, monetary_value, calculation_snapshot
) values (95603, 95602, 2100000003, 5000, '{"sum":[95502]}');
update public.commercial_policy_accumulators
   set status = 'published',
       published_at = now(),
       published_by = '99999999-9999-4999-8999-999999999999'
 where id = 95602;

select throws_ok(
  $$update public.commercial_policy_accumulators set title = 'Changed published accumulator' where id = 95602$$,
  '55000',
  'published or archived commercial_policy_accumulators economic identity is immutable',
  'published accumulator rejects a material header change'
);
select throws_ok(
  $$delete from public.commercial_policy_accumulators where id = 95602$$,
  '55000', null,
  'published accumulator cannot be deleted'
);

select throws_ok(
  $$update public.commercial_policy_accumulator_items set position = 2 where accumulator_id = 95602 and policy_id = 95402$$,
  '55000', null,
  'items of a published accumulator cannot be updated'
);
select throws_ok(
  $$delete from public.commercial_policy_accumulator_items where accumulator_id = 95602 and policy_id = 95402$$,
  '55000', null,
  'items of a published accumulator cannot be deleted'
);
select throws_ok(
  $$insert into public.commercial_policy_accumulator_items (accumulator_id, policy_id, position) values (95602, 95401, 2)$$,
  '55000', null,
  'items cannot be inserted into a published accumulator'
);
select throws_ok(
  $$update public.commercial_policy_accumulator_values set monetary_value = 6000 where id = 95603$$,
  '55000', null,
  'values of a published accumulator cannot be updated'
);
select throws_ok(
  $$delete from public.commercial_policy_accumulator_values where id = 95603$$,
  '55000', null,
  'values of a published accumulator cannot be deleted'
);
select throws_ok(
  $$insert into public.commercial_policy_accumulator_values (accumulator_id, product_id, monetary_value, calculation_snapshot) values (95602, 2100000004, 1, '{}')$$,
  '55000', null,
  'values cannot be inserted into a published accumulator'
);

insert into public.pricing_import_batches (
  id, source_type, idempotency_key, original_file_name, schema_version, status
) values
  (95801, 'api_import', 'lifecycle:draft', 'draft.json', '1', 'uploaded'),
  (95802, 'api_import', 'lifecycle:row-parent', 'row-parent.json', '1', 'uploaded'),
  (95803, 'api_import', 'lifecycle:promoted', 'promoted.json', '1', 'promoted');
select lives_ok(
  $$update public.pricing_import_batches set original_file_name = 'edited-draft.json' where id = 95801$$,
  'draft import batch permits source editing'
);
select throws_ok(
  $$update public.pricing_import_batches set original_file_name = 'edited-promoted.json' where id = 95803$$,
  '55000',
  'promoted or archived pricing_import_batches source identity is immutable',
  'promoted batch rejects source changes'
);
select lives_ok(
  $$update public.pricing_import_batches set status = 'archived' where id = 95803$$,
  'promoted batch permits a lifecycle-only transition to archived'
);
select throws_ok(
  $$update public.pricing_import_batches set status = 'ready' where id = 95803$$,
  '55000',
  'promoted or archived pricing_import_batches source identity is immutable',
  'archived batch cannot regress to a mutable lifecycle state'
);
select throws_ok(
  $$delete from public.pricing_import_batches where id = 95803$$,
  '55000', null,
  'promoted batch cannot be deleted'
);

insert into public.pricing_import_rows (
  id, batch_id, source_row_number, raw_payload, normalized_payload, status
) values (
  95902, 95802, 1, '{"raw":1}', '{"normalized":1}', 'promoted'
);
select throws_ok(
  $$update public.pricing_import_rows set raw_payload = '{"raw":2}' where id = 95902$$,
  '55000',
  'promoted pricing_import_rows content and classification are immutable',
  'promoted row rejects payload changes'
);
select throws_ok(
  $$update public.pricing_import_rows set status = 'rejected' where id = 95902$$,
  '55000',
  'promoted pricing_import_rows content and classification are immutable',
  'promoted row rejects classification status changes'
);
select throws_ok(
  $$delete from public.pricing_import_rows where id = 95902$$,
  '55000', null,
  'promoted row cannot be deleted'
);

insert into public.pricing_audit_events (
  id, aggregate_type, aggregate_id, action, after_snapshot, correlation_id
) values (
  96001, 'product_public_price', 95202, 'insert', '{}',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
select throws_ok(
  $$update public.pricing_audit_events set reason = 'tamper' where id = 96001$$,
  '55000',
  'pricing_audit_events is append-only; UPDATE and DELETE are not allowed',
  'audit event update is rejected even for the owner'
);
select throws_ok(
  $$delete from public.pricing_audit_events where id = 96001$$,
  '55000',
  'pricing_audit_events is append-only; UPDATE and DELETE are not allowed',
  'audit event delete is rejected even for the owner'
);

select is(
  (
    select count(*)
      from pg_class as relation
     where relation.oid in (
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
       and relation.relrowsecurity
  ),
  12::bigint,
  'RLS remains enabled on all Sprint 9 tables'
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
  'no browser RLS policies were introduced'
);

select ok(
  has_table_privilege('service_role', 'public.product_public_prices', 'SELECT,INSERT,UPDATE')
  and not has_table_privilege('service_role', 'public.product_public_prices', 'DELETE')
  and has_table_privilege('service_role', 'public.pricing_audit_events', 'SELECT,INSERT')
  and not has_table_privilege('service_role', 'public.pricing_audit_events', 'UPDATE,DELETE')
  and not has_table_privilege('anon', 'public.product_public_prices', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.pricing_import_batches', 'SELECT,INSERT,UPDATE,DELETE'),
  'existing table grants remain least-privilege'
);

select ok(
  position(
    'product_price_offers' in pg_get_viewdef('public.vw_product_value_current'::regclass, true)
  ) > 0
  and position(
    'product_public_prices' in pg_get_viewdef('public.vw_product_value_current'::regclass, true)
  ) = 0,
  'legacy vw_product_value_current remains unchanged'
);

select * from finish();

rollback;
