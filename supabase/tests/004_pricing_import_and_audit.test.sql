begin;

set local search_path = extensions, public, pg_catalog;

select no_plan();

select is(
  (select array_agg(enumlabel::text order by enumsortorder) from pg_enum where enumtypid = 'public.pricing_import_status'::regtype),
  array['uploaded', 'extracting', 'needs_review', 'ready', 'promoting', 'promoted', 'failed', 'rejected', 'archived'],
  'pricing_import_status has the approved values in order'
);
select is(
  (select array_agg(enumlabel::text order by enumsortorder) from pg_enum where enumtypid = 'public.pricing_import_row_status'::regtype),
  array['parsed', 'unmatched', 'needs_review', 'approved', 'rejected', 'promoted'],
  'pricing_import_row_status has the approved values in order'
);
select is(
  (select array_agg(enumlabel::text order by enumsortorder) from pg_enum where enumtypid = 'public.pricing_review_decision'::regtype),
  array['approve', 'reject', 'request_changes', 'match_product', 'classify'],
  'pricing_review_decision has the approved values in order'
);
select is(
  (select array_agg(enumlabel::text order by enumsortorder) from pg_enum where enumtypid = 'public.pricing_audit_action'::regtype),
  array['insert', 'update', 'publish', 'reject', 'archive', 'link', 'unlink', 'promote'],
  'pricing_audit_action has the approved values in order'
);

select is(
  (
    select array_agg(table_name::text order by table_name)
      from information_schema.tables
     where table_schema = 'public'
       and table_name in (
         'pricing_import_batches',
         'pricing_import_rows',
         'pricing_import_row_outputs',
         'pricing_import_row_reviews',
         'pricing_audit_events'
       )
       and table_type = 'BASE TABLE'
  ),
  array[
    'pricing_audit_events',
    'pricing_import_batches',
    'pricing_import_row_outputs',
    'pricing_import_row_reviews',
    'pricing_import_rows'
  ],
  'all five import, review and audit tables exist'
);

select is(
  (
    select array_agg(pg_get_serial_sequence('public.' || table_name, 'id') order by table_name)
      from (
        values
          ('pricing_audit_events'),
          ('pricing_import_batches'),
          ('pricing_import_row_outputs'),
          ('pricing_import_row_reviews'),
          ('pricing_import_rows')
      ) as identity_tables(table_name)
  ),
  array[
    'public.pricing_audit_events_id_seq',
    'public.pricing_import_batches_id_seq',
    'public.pricing_import_row_outputs_id_seq',
    'public.pricing_import_row_reviews_id_seq',
    'public.pricing_import_rows_id_seq'
  ],
  'all five identity sequences are linked to their tables'
);

select is(
  (
    select array_agg(
      attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
        || ':' || attribute.attnotnull::text || ':' || attribute.attidentity::text
      order by attribute.attnum
    )
      from pg_attribute as attribute
     where attribute.attrelid = 'public.pricing_import_batches'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'id:bigint:true:d', 'source_type:pricing_source_type:true:',
    'idempotency_key:text:true:', 'original_file_name:text:false:',
    'storage_object_path:text:false:', 'content_sha256:character(64):false:',
    'campaign_reference:text:false:', 'valid_from:date:false:', 'valid_to:date:false:',
    'extractor_provider:text:false:', 'extractor_model:text:false:',
    'prompt_version:text:false:', 'schema_version:text:true:',
    'status:pricing_import_status:true:', 'metadata:jsonb:true:',
    'legacy_import_id:bigint:false:', 'created_at:timestamp with time zone:true:',
    'created_by:uuid:false:', 'updated_at:timestamp with time zone:true:',
    'updated_by:uuid:false:', 'reviewed_at:timestamp with time zone:false:',
    'reviewed_by:uuid:false:', 'promoted_at:timestamp with time zone:false:',
    'promoted_by:uuid:false:', 'lock_version:integer:true:'
  ],
  'pricing_import_batches columns match the target schema exactly'
);
select is(
  (
    select array_agg(
      attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
        || ':' || attribute.attnotnull::text || ':' || attribute.attidentity::text
      order by attribute.attnum
    )
      from pg_attribute as attribute
     where attribute.attrelid = 'public.pricing_import_rows'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'id:bigint:true:d', 'batch_id:bigint:true:', 'source_row_number:integer:true:',
    'source_page:integer:false:', 'legacy_source_table:text:false:',
    'legacy_source_id:bigint:false:', 'raw_text:text:false:', 'raw_payload:jsonb:true:',
    'normalized_payload:jsonb:true:', 'confidence_score:numeric(5,2):false:',
    'matched_product_id:integer:false:', 'status:pricing_import_row_status:true:',
    'issue_codes:text[]:true:', 'created_at:timestamp with time zone:true:',
    'created_by:uuid:false:', 'updated_at:timestamp with time zone:true:',
    'updated_by:uuid:false:', 'lock_version:integer:true:'
  ],
  'pricing_import_rows columns match the target schema exactly'
);
select is(
  (
    select array_agg(
      attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
        || ':' || attribute.attnotnull::text || ':' || attribute.attidentity::text
      order by attribute.attnum
    )
      from pg_attribute as attribute
     where attribute.attrelid = 'public.pricing_import_row_outputs'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'id:bigint:true:d', 'import_row_id:bigint:true:', 'public_price_id:bigint:false:',
    'policy_id:bigint:false:', 'accumulator_id:bigint:false:',
    'created_at:timestamp with time zone:true:', 'created_by:uuid:false:'
  ],
  'pricing_import_row_outputs columns match the target schema exactly'
);
select is(
  (
    select array_agg(
      attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
        || ':' || attribute.attnotnull::text || ':' || attribute.attidentity::text
      order by attribute.attnum
    )
      from pg_attribute as attribute
     where attribute.attrelid = 'public.pricing_import_row_reviews'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'id:bigint:true:d', 'import_row_id:bigint:true:',
    'decision:pricing_review_decision:true:',
    'previous_status:pricing_import_row_status:true:',
    'next_status:pricing_import_row_status:true:', 'notes:text:false:',
    'snapshot:jsonb:true:', 'reviewed_at:timestamp with time zone:true:',
    'reviewed_by:uuid:true:'
  ],
  'pricing_import_row_reviews columns match the target schema exactly'
);
select is(
  (
    select array_agg(
      attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
        || ':' || attribute.attnotnull::text || ':' || attribute.attidentity::text
      order by attribute.attnum
    )
      from pg_attribute as attribute
     where attribute.attrelid = 'public.pricing_audit_events'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'id:bigint:true:d', 'aggregate_type:text:true:', 'aggregate_id:bigint:true:',
    'action:pricing_audit_action:true:', 'before_snapshot:jsonb:false:',
    'after_snapshot:jsonb:false:', 'reason:text:false:', 'actor_id:uuid:false:',
    'occurred_at:timestamp with time zone:true:', 'correlation_id:uuid:true:'
  ],
  'pricing_audit_events columns match the target schema exactly'
);

select is(
  (
    select array_agg(constraint_record.conname::text order by constraint_record.conname)
      from pg_constraint as constraint_record
     where constraint_record.contype = 'p'
       and constraint_record.conrelid in (
         'public.pricing_import_batches'::regclass,
         'public.pricing_import_rows'::regclass,
         'public.pricing_import_row_outputs'::regclass,
         'public.pricing_import_row_reviews'::regclass,
         'public.pricing_audit_events'::regclass
       )
  ),
  array[
    'pricing_audit_events_pkey',
    'pricing_import_batches_pkey',
    'pricing_import_row_outputs_pkey',
    'pricing_import_row_reviews_pkey',
    'pricing_import_rows_pkey'
  ],
  'all five primary keys exist'
);

select is(
  (
    with expected(name, source_table, target_table, delete_action) as (
      values
        ('pricing_import_batches_created_by_fkey', 'pricing_import_batches', 'profiles', 'n'),
        ('pricing_import_batches_updated_by_fkey', 'pricing_import_batches', 'profiles', 'n'),
        ('pricing_import_batches_reviewed_by_fkey', 'pricing_import_batches', 'profiles', 'n'),
        ('pricing_import_batches_promoted_by_fkey', 'pricing_import_batches', 'profiles', 'n'),
        ('pricing_import_rows_batch_id_fkey', 'pricing_import_rows', 'pricing_import_batches', 'c'),
        ('pricing_import_rows_matched_product_id_fkey', 'pricing_import_rows', 'products', 'r'),
        ('pricing_import_rows_created_by_fkey', 'pricing_import_rows', 'profiles', 'n'),
        ('pricing_import_rows_updated_by_fkey', 'pricing_import_rows', 'profiles', 'n'),
        ('pricing_import_row_outputs_import_row_id_fkey', 'pricing_import_row_outputs', 'pricing_import_rows', 'r'),
        ('pricing_import_row_outputs_public_price_id_fkey', 'pricing_import_row_outputs', 'product_public_prices', 'r'),
        ('pricing_import_row_outputs_policy_id_fkey', 'pricing_import_row_outputs', 'commercial_policies', 'r'),
        ('pricing_import_row_outputs_accumulator_id_fkey', 'pricing_import_row_outputs', 'commercial_policy_accumulators', 'r'),
        ('pricing_import_row_outputs_created_by_fkey', 'pricing_import_row_outputs', 'profiles', 'n'),
        ('pricing_import_row_reviews_import_row_id_fkey', 'pricing_import_row_reviews', 'pricing_import_rows', 'r'),
        ('pricing_import_row_reviews_reviewed_by_fkey', 'pricing_import_row_reviews', 'profiles', 'r'),
        ('pricing_audit_events_actor_id_fkey', 'pricing_audit_events', 'profiles', 'n')
    )
    select count(*)
      from expected
      join pg_constraint as constraint_record
        on constraint_record.conname = expected.name
       and constraint_record.contype = 'f'
       and constraint_record.conrelid = ('public.' || expected.source_table)::regclass
       and constraint_record.confrelid = ('public.' || expected.target_table)::regclass
       and constraint_record.confdeltype::text = expected.delete_action
  ),
  16::bigint,
  'all 16 import and audit foreign keys have the expected target and delete action'
);

select is(
  (
    select array_agg(constraint_record.conname::text order by constraint_record.conname)
      from pg_constraint as constraint_record
     where constraint_record.contype = 'u'
       and constraint_record.conrelid in (
         'public.pricing_import_batches'::regclass,
         'public.pricing_import_rows'::regclass,
         'public.pricing_import_row_outputs'::regclass,
         'public.pricing_import_row_reviews'::regclass,
         'public.pricing_audit_events'::regclass
       )
  ),
  array[
    'pricing_import_batches_idempotency_key_key',
    'pricing_import_rows_batch_source_row_key'
  ],
  'documented non-partial unique constraints exist'
);

select is(
  (
    select array_agg(index_relation.relname::text order by index_relation.relname)
      from pg_class as index_relation
      join pg_index as index_record on index_record.indexrelid = index_relation.oid
     where index_relation.relname in (
       'pricing_import_batches_legacy_import_id_key',
       'pricing_import_rows_legacy_source_key',
       'pricing_import_row_outputs_import_public_price_key',
       'pricing_import_row_outputs_import_policy_key',
       'pricing_import_row_outputs_import_accumulator_key'
     )
       and index_record.indisunique
       and index_record.indpred is not null
  ),
  array[
    'pricing_import_batches_legacy_import_id_key',
    'pricing_import_row_outputs_import_accumulator_key',
    'pricing_import_row_outputs_import_policy_key',
    'pricing_import_row_outputs_import_public_price_key',
    'pricing_import_rows_legacy_source_key'
  ],
  'all five documented partial unique indexes exist'
);

select is(
  (
    select array_agg(constraint_record.conname::text order by constraint_record.conname)
      from pg_constraint as constraint_record
     where constraint_record.contype = 'c'
       and constraint_record.conrelid in (
         'public.pricing_import_batches'::regclass,
         'public.pricing_import_rows'::regclass,
         'public.pricing_import_row_outputs'::regclass,
         'public.pricing_import_row_reviews'::regclass,
         'public.pricing_audit_events'::regclass
       )
  ),
  array[
    'pricing_audit_events_aggregate_type_check',
    'pricing_audit_events_reason_check',
    'pricing_audit_events_snapshot_check',
    'pricing_import_batches_content_sha256_check',
    'pricing_import_batches_dates_check',
    'pricing_import_batches_idempotency_key_check',
    'pricing_import_batches_lock_version_check',
    'pricing_import_batches_schema_version_check',
    'pricing_import_batches_source_type_check',
    'pricing_import_row_outputs_exactly_one_check',
    'pricing_import_row_reviews_notes_check',
    'pricing_import_rows_confidence_score_check',
    'pricing_import_rows_legacy_source_table_check',
    'pricing_import_rows_lock_version_check',
    'pricing_import_rows_source_page_check',
    'pricing_import_rows_source_row_number_check'
  ],
  'all 16 documented local checks exist'
);

select is(
  (
    select count(*)
      from pg_class as index_relation
      join pg_index as index_record on index_record.indexrelid = index_relation.oid
     where index_record.indrelid in (
       'public.pricing_import_batches'::regclass,
       'public.pricing_import_rows'::regclass,
       'public.pricing_import_row_outputs'::regclass,
       'public.pricing_import_row_reviews'::regclass,
       'public.pricing_audit_events'::regclass
     )
       and not index_record.indisprimary
       and not index_record.indisunique
  ),
  14::bigint,
  'all 14 documented non-unique indexes exist'
);

select is(
  (
    select count(*)
      from pg_constraint as constraint_record
     join pg_attribute as attribute
       on attribute.attrelid = constraint_record.conrelid
      and attribute.attnum = any (constraint_record.conkey)
     where constraint_record.contype = 'f'
       and constraint_record.confrelid = 'public.pricing_import_rows'::regclass
       and constraint_record.confdeltype = 'r'
       and attribute.attname = 'source_import_row_id'
       and constraint_record.conrelid in (
         'public.product_public_prices'::regclass,
         'public.commercial_policies'::regclass,
         'public.commercial_policy_accumulators'::regclass
       )
  ),
  3::bigint,
  'all three deferred source_import_row_id foreign keys now exist with RESTRICT'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '77777777-7777-4777-8777-777777777777',
  'pricing-reviewer@example.invalid',
  '{"full_name":"Pricing Reviewer"}'::jsonb
);
insert into public.products (
  id, brand, model, version, model_year, production_year, is_active, is_public
) values (
  2100000002, 'Sprint 9', 'Import fixture', 'Structural test', 2026, 2026, true, false
);
insert into public.pricing_import_batches (
  id, source_type, idempotency_key, schema_version
) values (
  94001, 'legacy_backfill', 'test:batch:1', '1'
);
insert into public.pricing_import_rows (
  id, batch_id, source_row_number, legacy_source_table, legacy_source_id,
  matched_product_id
) values (
  94101, 94001, 1, 'product_price_offers', 1, 2100000002
);

select throws_ok(
  $$insert into public.pricing_import_batches (source_type, idempotency_key, schema_version) values ('manual', 'test:manual', '1')$$,
  '23514',
  null,
  'manual source type is rejected for import batches'
);
select lives_ok(
  $$insert into public.pricing_import_batches (id, source_type, idempotency_key, content_sha256, schema_version) values (94002, 'api_import', 'test:hash:valid', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', '1')$$,
  'a 64-character hexadecimal SHA-256 is accepted'
);
select throws_ok(
  $$insert into public.pricing_import_batches (source_type, idempotency_key, content_sha256, schema_version) values ('api_import', 'test:hash:invalid', 'not-a-valid-sha256', '1')$$,
  '23514',
  null,
  'an invalid SHA-256 is rejected'
);
select throws_ok(
  $$insert into public.pricing_import_batches (source_type, idempotency_key, schema_version, valid_from, valid_to) values ('api_import', 'test:dates', '1', date '2026-08-01', date '2026-07-31')$$,
  '23514',
  null,
  'valid_to before valid_from is rejected'
);
select throws_ok(
  $$insert into public.pricing_import_rows (batch_id, source_row_number, legacy_source_table) values (94001, 2, 'unknown_table')$$,
  '23514',
  null,
  'legacy_source_table rejects values outside the allowlist'
);
select lives_ok(
  $$insert into public.pricing_import_rows (id, batch_id, source_row_number, legacy_source_table, legacy_source_id) values (94102, 94001, 2, 'price_offer_import_rows', 2)$$,
  'legacy_source_table accepts an approved value'
);
select throws_ok(
  $$insert into public.pricing_import_rows (batch_id, source_row_number, source_page) values (94001, 3, 0)$$,
  '23514',
  null,
  'source_page must be positive when present'
);
select throws_ok(
  $$insert into public.pricing_import_rows (batch_id, source_row_number, confidence_score) values (94001, 3, 100.01)$$,
  '23514',
  null,
  'confidence_score above 100 is rejected'
);

insert into public.product_public_prices (
  id, product_id, amount, starts_on, source_type, source_import_row_id
) values (
  94201, 2100000002, 100000, date '2026-07-01', 'legacy_backfill', 94101
);
select throws_ok(
  $$insert into public.pricing_import_row_outputs (import_row_id) values (94101)$$,
  '23514',
  null,
  'an import row output requires one target'
);
select throws_ok(
  $$insert into public.pricing_import_row_outputs (import_row_id, public_price_id, policy_id) values (94101, 94201, 999999)$$,
  '23514',
  null,
  'an import row output rejects more than one target'
);
select lives_ok(
  $$insert into public.pricing_import_row_outputs (import_row_id, public_price_id) values (94101, 94201)$$,
  'an import row output accepts exactly one target'
);

select throws_ok(
  $$insert into public.pricing_import_row_reviews (import_row_id, decision, previous_status, next_status, snapshot, reviewed_by) values (94101, 'reject', 'parsed', 'rejected', '{}', '77777777-7777-4777-8777-777777777777')$$,
  '23514',
  null,
  'reject review requires notes'
);
select throws_ok(
  $$insert into public.pricing_import_row_reviews (import_row_id, decision, previous_status, next_status, notes, snapshot, reviewed_by) values (94101, 'request_changes', 'parsed', 'needs_review', '   ', '{}', '77777777-7777-4777-8777-777777777777')$$,
  '23514',
  null,
  'request_changes review rejects blank notes'
);
select lives_ok(
  $$insert into public.pricing_import_row_reviews (import_row_id, decision, previous_status, next_status, snapshot, reviewed_by) values (94101, 'approve', 'parsed', 'approved', '{}', '77777777-7777-4777-8777-777777777777')$$,
  'approve review does not require notes'
);

select throws_ok(
  $$insert into public.pricing_audit_events (aggregate_type, aggregate_id, action, correlation_id) values ('pricing_import_row', 94101, 'insert', '88888888-8888-4888-8888-888888888888')$$,
  '23514',
  null,
  'audit event requires at least one snapshot'
);
select throws_ok(
  $$insert into public.pricing_audit_events (aggregate_type, aggregate_id, action, after_snapshot, correlation_id) values ('pricing_import_row', 94101, 'reject', '{}', '88888888-8888-4888-8888-888888888888')$$,
  '23514',
  null,
  'reject audit event requires a reason'
);
select throws_ok(
  $$insert into public.pricing_audit_events (aggregate_type, aggregate_id, action, before_snapshot, after_snapshot, correlation_id) values ('pricing_import_row', 94101, 'update', '{}', '{}', '88888888-8888-4888-8888-888888888888')$$,
  '23514',
  null,
  'update correction audit event requires a reason'
);
select lives_ok(
  $$insert into public.pricing_audit_events (aggregate_type, aggregate_id, action, after_snapshot, correlation_id) values ('pricing_import_row', 94101, 'insert', '{}', '88888888-8888-4888-8888-888888888888')$$,
  'audit event accepts one snapshot'
);
select throws_ok(
  $$insert into public.pricing_audit_events (aggregate_type, aggregate_id, action, after_snapshot, correlation_id) values ('unknown', 94101, 'insert', '{}', '88888888-8888-4888-8888-888888888888')$$,
  '23514',
  null,
  'audit aggregate_type rejects values outside the allowlist'
);

select is(
  (
    select count(*)
      from pg_class as relation
     where relation.oid in (
       'public.pricing_import_batches'::regclass,
       'public.pricing_import_rows'::regclass,
       'public.pricing_import_row_outputs'::regclass,
       'public.pricing_import_row_reviews'::regclass,
       'public.pricing_audit_events'::regclass
     )
       and relation.relrowsecurity
  ),
  5::bigint,
  'RLS is enabled on all five new tables'
);
select is(
  (
    select count(*)
      from pg_policy
     where polrelid in (
       'public.pricing_import_batches'::regclass,
       'public.pricing_import_rows'::regclass,
       'public.pricing_import_row_outputs'::regclass,
       'public.pricing_import_row_reviews'::regclass,
       'public.pricing_audit_events'::regclass
     )
  ),
  0::bigint,
  'no policy exists on import or audit tables'
);

select ok(
  (
    with protected_tables(name) as (
      values
        ('pricing_import_batches'),
        ('pricing_import_rows'),
        ('pricing_import_row_outputs'),
        ('pricing_import_row_reviews'),
        ('pricing_audit_events')
    )
    select bool_and(
      not has_table_privilege('anon', 'public.' || name, 'SELECT')
      and not has_table_privilege('anon', 'public.' || name, 'INSERT')
      and not has_table_privilege('anon', 'public.' || name, 'UPDATE')
      and not has_table_privilege('anon', 'public.' || name, 'DELETE')
      and not has_table_privilege('anon', 'public.' || name, 'TRUNCATE')
      and not has_table_privilege('anon', 'public.' || name, 'REFERENCES')
      and not has_table_privilege('anon', 'public.' || name, 'TRIGGER')
      and not has_table_privilege('anon', 'public.' || name, 'MAINTAIN')
      and not has_table_privilege('authenticated', 'public.' || name, 'SELECT')
      and not has_table_privilege('authenticated', 'public.' || name, 'INSERT')
      and not has_table_privilege('authenticated', 'public.' || name, 'UPDATE')
      and not has_table_privilege('authenticated', 'public.' || name, 'DELETE')
      and not has_table_privilege('authenticated', 'public.' || name, 'TRUNCATE')
      and not has_table_privilege('authenticated', 'public.' || name, 'REFERENCES')
      and not has_table_privilege('authenticated', 'public.' || name, 'TRIGGER')
      and not has_table_privilege('authenticated', 'public.' || name, 'MAINTAIN')
    )
      from protected_tables
  ),
  'anon and authenticated have no privileges on import or audit tables'
);

select ok(
  (
    with operational_tables(name) as (
      values
        ('pricing_import_batches'),
        ('pricing_import_rows'),
        ('pricing_import_row_outputs'),
        ('pricing_import_row_reviews')
    )
    select bool_and(
      has_table_privilege('service_role', 'public.' || name, 'SELECT')
      and has_table_privilege('service_role', 'public.' || name, 'INSERT')
      and has_table_privilege('service_role', 'public.' || name, 'UPDATE')
      and not has_table_privilege('service_role', 'public.' || name, 'DELETE')
      and not has_table_privilege('service_role', 'public.' || name, 'TRUNCATE')
      and not has_table_privilege('service_role', 'public.' || name, 'REFERENCES')
      and not has_table_privilege('service_role', 'public.' || name, 'TRIGGER')
      and not has_table_privilege('service_role', 'public.' || name, 'MAINTAIN')
    )
      from operational_tables
  ),
  'service_role has only SELECT, INSERT and UPDATE on operational import tables'
);
select ok(
  has_table_privilege('service_role', 'public.pricing_audit_events', 'SELECT')
  and has_table_privilege('service_role', 'public.pricing_audit_events', 'INSERT')
  and not has_table_privilege('service_role', 'public.pricing_audit_events', 'UPDATE')
  and not has_table_privilege('service_role', 'public.pricing_audit_events', 'DELETE')
  and not has_table_privilege('service_role', 'public.pricing_audit_events', 'TRUNCATE')
  and not has_table_privilege('service_role', 'public.pricing_audit_events', 'REFERENCES')
  and not has_table_privilege('service_role', 'public.pricing_audit_events', 'TRIGGER')
  and not has_table_privilege('service_role', 'public.pricing_audit_events', 'MAINTAIN'),
  'pricing_audit_events is append-only for service_role by grants'
);

select ok(
  (
    with protected_sequences(name) as (
      values
        ('pricing_import_batches_id_seq'),
        ('pricing_import_rows_id_seq'),
        ('pricing_import_row_outputs_id_seq'),
        ('pricing_import_row_reviews_id_seq'),
        ('pricing_audit_events_id_seq')
    )
    select bool_and(
      not has_sequence_privilege('anon', 'public.' || name, 'USAGE')
      and not has_sequence_privilege('anon', 'public.' || name, 'SELECT')
      and not has_sequence_privilege('anon', 'public.' || name, 'UPDATE')
      and not has_sequence_privilege('authenticated', 'public.' || name, 'USAGE')
      and not has_sequence_privilege('authenticated', 'public.' || name, 'SELECT')
      and not has_sequence_privilege('authenticated', 'public.' || name, 'UPDATE')
      and has_sequence_privilege('service_role', 'public.' || name, 'USAGE')
      and has_sequence_privilege('service_role', 'public.' || name, 'SELECT')
      and not has_sequence_privilege('service_role', 'public.' || name, 'UPDATE')
    )
      from protected_sequences
  ),
  'identity sequences expose only USAGE and SELECT to service_role'
);

select ok(
  not exists (
    select 1
      from pg_class as relation
      cross join lateral aclexplode(relation.relacl) as privilege
     where relation.oid in (
       'public.pricing_import_batches'::regclass,
       'public.pricing_import_rows'::regclass,
       'public.pricing_import_row_outputs'::regclass,
       'public.pricing_import_row_reviews'::regclass,
       'public.pricing_audit_events'::regclass,
       'public.pricing_import_batches_id_seq'::regclass,
       'public.pricing_import_rows_id_seq'::regclass,
       'public.pricing_import_row_outputs_id_seq'::regclass,
       'public.pricing_import_row_reviews_id_seq'::regclass,
       'public.pricing_audit_events_id_seq'::regclass
     )
       and privilege.grantee in (
         0,
         (select oid from pg_roles where rolname = 'anon'),
         (select oid from pg_roles where rolname = 'authenticated')
       )
  ),
  'PUBLIC, anon and authenticated have no residual ACL entries'
);

select ok(
  not exists (
    select 1
      from (
        select
          relation.relkind,
          privilege.grantee,
          count(distinct privilege.privilege_type) as privilege_count
        from pg_class as relation
        cross join lateral aclexplode(relation.relacl) as privilege
        where relation.oid in (
          'public.pricing_import_batches'::regclass,
          'public.pricing_import_rows'::regclass,
          'public.pricing_import_row_outputs'::regclass,
          'public.pricing_import_row_reviews'::regclass,
          'public.pricing_audit_events'::regclass,
          'public.pricing_import_batches_id_seq'::regclass,
          'public.pricing_import_rows_id_seq'::regclass,
          'public.pricing_import_row_outputs_id_seq'::regclass,
          'public.pricing_import_row_reviews_id_seq'::regclass,
          'public.pricing_audit_events_id_seq'::regclass
        )
          and privilege.grantee in (
            0,
            (select oid from pg_roles where rolname = 'anon'),
            (select oid from pg_roles where rolname = 'authenticated'),
            (select oid from pg_roles where rolname = 'service_role')
          )
        group by relation.oid, relation.relkind, privilege.grantee
      ) as grants_by_object
     where privilege_count = case when relkind = 'S' then 3 else 8 end
  ),
  'no non-owner role received ALL privileges on an import or audit object'
);

select is(
  (
    select count(*)
      from (
        select
          default_acl.defaclobjtype,
          grantee.rolname,
          count(distinct privilege.privilege_type) as privilege_count
        from pg_default_acl as default_acl
        join pg_roles as owner on owner.oid = default_acl.defaclrole
        join pg_namespace as namespace on namespace.oid = default_acl.defaclnamespace
        cross join lateral aclexplode(default_acl.defaclacl) as privilege
        join pg_roles as grantee on grantee.oid = privilege.grantee
        where owner.rolname = 'postgres'
          and namespace.nspname = 'public'
          and default_acl.defaclobjtype in ('r', 'S')
          and grantee.rolname in ('anon', 'authenticated', 'service_role')
        group by default_acl.defaclobjtype, grantee.rolname
      ) as inherited_defaults
     where privilege_count = case when defaclobjtype = 'S' then 3 else 8 end
  ),
  6::bigint,
  'global baseline default privileges remain unchanged'
);

select ok(
  has_table_privilege('anon', 'public.price_offer_imports', 'SELECT')
  and has_table_privilege('authenticated', 'public.price_offer_import_rows', 'SELECT')
  and has_table_privilege('anon', 'public.price_offers_staging', 'SELECT')
  and position(
    'product_price_offers' in pg_get_viewdef('public.vw_product_value_current'::regclass, true)
  ) > 0
  and position(
    'product_public_prices' in pg_get_viewdef('public.vw_product_value_current'::regclass, true)
  ) = 0,
  'legacy import objects and vw_product_value_current remain unchanged'
);

select * from finish();

rollback;
