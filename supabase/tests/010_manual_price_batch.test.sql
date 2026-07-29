begin;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select has_function(
  'public',
  'create_manual_price_batch',
  array['jsonb', 'uuid', 'uuid'],
  'manual batch RPC exists'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.create_manual_price_batch(jsonb,uuid,uuid)'::regprocedure),
  'manual batch RPC is security definer'
);
select is(
  (select proconfig from pg_proc where oid = 'public.create_manual_price_batch(jsonb,uuid,uuid)'::regprocedure),
  array['search_path=""']::text[],
  'manual batch RPC has an empty search_path'
);
select ok(
  has_function_privilege('service_role', 'public.create_manual_price_batch(jsonb,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.create_manual_price_batch(jsonb,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.create_manual_price_batch(jsonb,uuid,uuid)', 'EXECUTE'),
  'only service_role can execute the manual batch RPC'
);
select is(
  (select pg_get_userbyid(proowner) from pg_proc where oid = 'public.create_manual_price_batch(jsonb,uuid,uuid)'::regprocedure),
  'postgres',
  'manual batch RPC is owned by postgres'
);
select ok(
  (select bool_and(relrowsecurity)
     from pg_class
    where oid in (
      'public.pricing_import_batches'::regclass,
      'public.pricing_import_rows'::regclass,
      'public.pricing_import_row_outputs'::regclass,
      'public.product_public_prices'::regclass,
      'public.pricing_audit_events'::regclass
    )),
  'RLS remains enabled on every persistent table used by the RPC'
);
select ok(
  not has_table_privilege('anon', 'public.pricing_import_batches', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.pricing_import_batches', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'public.product_public_prices', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.product_public_prices', 'INSERT,UPDATE,DELETE'),
  'browser roles cannot write batches or prices directly'
);
select throws_ok(
  $$insert into public.pricing_import_batches (source_type, idempotency_key, schema_version) values ('unprotected_source', 'invalid-source', '1')$$,
  '22P02',
  null,
  'pricing_source_type enum rejects unsupported source values'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('ab000000-0000-4000-8000-000000000001', 'manual-batch-admin@example.invalid', '{"full_name":"Manual Batch Admin"}'),
  ('ab000000-0000-4000-8000-000000000002', 'manual-batch-seller@example.invalid', '{"full_name":"Manual Batch Seller"}');
update public.profiles set role = 'admin', status = 'active', accepted_at = now()
 where id = 'ab000000-0000-4000-8000-000000000001';
update public.profiles set role = 'seller', status = 'active', accepted_at = now()
 where id = 'ab000000-0000-4000-8000-000000000002';

insert into public.products (
  id, brand, model, version, model_year, production_year, is_active, is_public
) values
  (2130000001, 'Batch', 'Active', 'Public', 2026, 2026, true, true),
  (2130000002, 'Batch', 'Inactive', 'Private', 2025, 2024, false, false),
  (2130000003, 'Batch', 'Atomic', 'Conflict', 2026, 2026, true, false);

create temporary table manual_batch_result (payload jsonb);
insert into manual_batch_result
select public.create_manual_price_batch(
  '[
    {"clientRowId":"row-a","productId":"2130000001","amount":"200000.00","startsOn":"2026-09-01","endsOn":null},
    {"clientRowId":"row-b","productId":"2130000002","amount":"175500.25","startsOn":"2026-10-01","endsOn":"2026-12-31"}
  ]'::jsonb,
  'ab000000-0000-4000-8000-000000000001',
  'cb000000-0000-4000-8000-000000000001'
);

select is((select (payload ->> 'createdCount')::integer from manual_batch_result), 2, 'RPC reports two created prices');
select is((select jsonb_array_length(payload -> 'rows') from manual_batch_result), 2, 'RPC maps both client rows');
select is((select jsonb_array_length(payload -> 'priceIds') from manual_batch_result), 2, 'RPC returns both price identifiers');
select is(
  (select count(*) from public.pricing_import_batches where id = (select (payload ->> 'batchId')::bigint from manual_batch_result)
    and source_type = 'manual' and status = 'promoted' and promoted_by = 'ab000000-0000-4000-8000-000000000001'),
  1::bigint,
  'persistent manual batch reaches promoted'
);
select is(
  (select count(*) from public.pricing_import_rows where batch_id = (select (payload ->> 'batchId')::bigint from manual_batch_result)
    and status = 'promoted' and matched_product_id in (2130000001, 2130000002)),
  2::bigint,
  'every source row is normalized, matched and promoted'
);
select is(
  (select count(*)
     from public.product_public_prices as price
     join public.pricing_import_rows as import_row on import_row.id = price.source_import_row_id
    where import_row.batch_id = (select (payload ->> 'batchId')::bigint from manual_batch_result)
      and price.status = 'draft' and price.source_type = 'manual'
      and price.currency_code = 'BRL' and price.price_type = 'msrp'),
  2::bigint,
  'batch creates only manual BRL MSRP drafts with provenance'
);
select is(
  (select count(*)
     from public.pricing_import_row_outputs as output
     join public.pricing_import_rows as import_row on import_row.id = output.import_row_id
    where import_row.batch_id = (select (payload ->> 'batchId')::bigint from manual_batch_result)
      and output.public_price_id is not null),
  2::bigint,
  'every import row has exactly one public-price output'
);
select is(
  (select count(*) from public.pricing_audit_events
    where correlation_id = 'cb000000-0000-4000-8000-000000000001'
      and ((aggregate_type = 'product_public_price' and action = 'insert')
        or (aggregate_type = 'pricing_import_batch' and action = 'promote'))),
  3::bigint,
  'one batch promotion and two price insertions are audited with one correlation'
);
select is((select count(*) from public.commercial_policies where product_id in (2130000001, 2130000002)), 0::bigint, 'manual price batch creates no policies');
select is((select count(*) from public.commercial_offers where product_id in (2130000001, 2130000002)), 0::bigint, 'manual price batch creates no offers');

select throws_ok(
  $$select public.create_manual_price_batch(
    '[{"clientRowId":"existing-conflict","productId":"2130000001","amount":"201000.00","startsOn":"2026-09-01","endsOn":null}]'::jsonb,
    'ab000000-0000-4000-8000-000000000001',
    'cb000000-0000-4000-8000-000000000006')$$,
  '23505',
  'a public price already exists for product and start date',
  'existing product/start conflict rejects the complete batch'
);
select is((select count(*) from public.pricing_import_batches where idempotency_key = 'manual-price-batch:cb000000-0000-4000-8000-000000000006'), 0::bigint, 'existing-price conflict leaves no batch record');

select throws_ok(
  $$select public.create_manual_price_batch(
    '[{"clientRowId":"seller","productId":"2130000003","amount":"100.00","startsOn":"2027-01-01","endsOn":null}]'::jsonb,
    'ab000000-0000-4000-8000-000000000002',
    'cb000000-0000-4000-8000-000000000002')$$,
  '42501',
  'pricing authorization failed: actor is not an admin',
  'active seller cannot create a manual batch'
);
select is((select count(*) from public.pricing_import_batches where idempotency_key = 'manual-price-batch:cb000000-0000-4000-8000-000000000002'), 0::bigint, 'unauthorized call writes nothing');

select throws_ok(
  $$select public.create_manual_price_batch(
    '[
      {"clientRowId":"valid","productId":"2130000003","amount":"100.00","startsOn":"2027-01-01","endsOn":null},
      {"clientRowId":"invalid","productId":"999999999","amount":"200.00","startsOn":"2027-02-01","endsOn":null}
    ]'::jsonb,
    'ab000000-0000-4000-8000-000000000001',
    'cb000000-0000-4000-8000-000000000003')$$,
  '23503',
  'manual price batch row 2 references an unknown product',
  'one invalid row rejects the complete batch'
);
select is((select count(*) from public.product_public_prices where product_id = 2130000003), 0::bigint, 'failed mixed batch is atomic');
select is((select count(*) from public.pricing_import_batches where idempotency_key = 'manual-price-batch:cb000000-0000-4000-8000-000000000003'), 0::bigint, 'failed mixed batch leaves no provenance record');

select throws_ok(
  $$select public.create_manual_price_batch(
    '[{"clientRowId":"zero","productId":"2130000003","amount":"0.00","startsOn":"2027-02-01","endsOn":null}]'::jsonb,
    'ab000000-0000-4000-8000-000000000001',
    'cb000000-0000-4000-8000-000000000007')$$,
  '22023',
  'manual price batch row 1 has invalid canonical amount',
  'zero amount is rejected by the database boundary'
);
select throws_ok(
  $$select public.create_manual_price_batch(
    '[{"clientRowId":"period","productId":"2130000003","amount":"1.00","startsOn":"2027-03-02","endsOn":"2027-03-01"}]'::jsonb,
    'ab000000-0000-4000-8000-000000000001',
    'cb000000-0000-4000-8000-000000000008')$$,
  '22023',
  'manual price batch row 1 has an invalid period',
  'invalid validity period is rejected by the database boundary'
);

select throws_ok(
  $$select public.create_manual_price_batch(
    '[
      {"clientRowId":"duplicate-a","productId":"2130000003","amount":"100.00","startsOn":"2027-03-01","endsOn":null},
      {"clientRowId":"duplicate-b","productId":"2130000003","amount":"101.00","startsOn":"2027-03-01","endsOn":null}
    ]'::jsonb,
    'ab000000-0000-4000-8000-000000000001',
    'cb000000-0000-4000-8000-000000000004')$$,
  '23505',
  'manual price batch contains duplicate product and start date',
  'duplicate product/start within a batch is rejected before writes'
);

select throws_ok(
  $$select public.create_manual_price_batch(
    (select jsonb_agg(jsonb_build_object(
      'clientRowId', 'row-' || value,
      'productId', '2130000003',
      'amount', '100.00',
      'startsOn', to_char(date '2030-01-01' + value, 'YYYY-MM-DD'),
      'endsOn', null
    )) from generate_series(0, 100) as series(value)),
    'ab000000-0000-4000-8000-000000000001',
    'cb000000-0000-4000-8000-000000000005')$$,
  '22023',
  'manual price batch requires between 1 and 100 rows',
  'database independently enforces the 100-row limit'
);

select * from finish();
rollback;
