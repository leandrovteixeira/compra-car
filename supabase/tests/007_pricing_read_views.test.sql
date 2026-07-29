begin;

set local search_path = extensions, public, pg_catalog;

select no_plan();

select has_view('public', 'vw_product_public_price_periods', 'historical price view exists');
select has_view('public', 'vw_current_product_public_prices', 'current price view exists');
select has_view(
  'public',
  'vw_published_commercial_policy_applications',
  'published policy application view exists'
);
select has_view(
  'public',
  'vw_published_commercial_policy_accumulators',
  'published accumulator view exists'
);
select has_view('public', 'vw_product_value_current_v2', 'compatibility v2 view exists');

select ok(
  (
    with expected(view_name) as (
      values
        ('vw_product_public_price_periods'),
        ('vw_current_product_public_prices'),
        ('vw_published_commercial_policy_applications'),
        ('vw_published_commercial_policy_accumulators'),
        ('vw_product_value_current_v2')
    )
    select count(*) = 5
       and bool_and(owner.rolname = 'postgres')
       and bool_and(view.reloptions @> array['security_invoker=true'])
      from expected
      join pg_namespace as namespace on namespace.nspname = 'public'
      join pg_class as view
        on view.relnamespace = namespace.oid
       and view.relname = expected.view_name
       and view.relkind = 'v'
      join pg_roles as owner on owner.oid = view.relowner
  ),
  'all pricing read views are postgres-owned security invokers'
);

select ok(
  (
    with expected(view_name) as (
      values
        ('vw_product_public_price_periods'),
        ('vw_current_product_public_prices'),
        ('vw_published_commercial_policy_applications'),
        ('vw_published_commercial_policy_accumulators'),
        ('vw_product_value_current_v2')
    )
    select bool_and(
      not has_table_privilege('public', 'public.' || view_name, 'SELECT')
      and not has_table_privilege('anon', 'public.' || view_name, 'SELECT')
      and not has_table_privilege('authenticated', 'public.' || view_name, 'SELECT')
      and has_table_privilege('service_role', 'public.' || view_name, 'SELECT')
      and not has_table_privilege('service_role', 'public.' || view_name, 'INSERT')
      and not has_table_privilege('service_role', 'public.' || view_name, 'UPDATE')
      and not has_table_privilege('service_role', 'public.' || view_name, 'DELETE')
      and not has_table_privilege('service_role', 'public.' || view_name, 'TRUNCATE')
      and not has_table_privilege('service_role', 'public.' || view_name, 'REFERENCES')
      and not has_table_privilege('service_role', 'public.' || view_name, 'TRIGGER')
    )
      from expected
  ),
  'browser roles have no view access and service_role has SELECT only'
);

select ok(
  not exists (
    with expected(view_name) as (
      values
        ('vw_product_public_price_periods'),
        ('vw_current_product_public_prices'),
        ('vw_published_commercial_policy_applications'),
        ('vw_published_commercial_policy_accumulators'),
        ('vw_product_value_current_v2')
    )
    select 1
      from expected
      join pg_namespace as namespace on namespace.nspname = 'public'
      join pg_class as view
        on view.relnamespace = namespace.oid
       and view.relname = expected.view_name
      cross join lateral aclexplode(view.relacl) as privilege
      left join pg_roles as grantee on grantee.oid = privilege.grantee
     where privilege.grantee = 0
        or grantee.rolname in ('anon', 'authenticated')
        or (
          grantee.rolname = 'service_role'
          and privilege.privilege_type <> 'SELECT'
        )
        or grantee.rolname not in ('postgres', 'service_role')
  ),
  'no inherited or residual ACL exists on pricing read views'
);

select is(
  (
    select array_agg(attribute.attname::text order by attribute.attnum)
      from pg_attribute as attribute
     where attribute.attrelid = 'public.vw_product_public_price_periods'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'id', 'product_id', 'amount', 'currency_code', 'starts_on',
    'next_starts_on', 'ends_on', 'published_at'
  ],
  'historical price periods expose the documented columns in order'
);

select is(
  (
    select array_agg(format_type(attribute.atttypid, attribute.atttypmod) order by attribute.attnum)
      from pg_attribute as attribute
     where attribute.attrelid = 'public.vw_product_public_price_periods'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'bigint', 'integer', 'numeric(14,2)', 'character(3)', 'date', 'date', 'date',
    'timestamp with time zone'
  ],
  'historical price period column types are stable'
);

select is(
  (
    select array_agg(attribute.attname::text order by attribute.attnum)
      from pg_attribute as attribute
     where attribute.attrelid = 'public.vw_current_product_public_prices'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'id', 'product_id', 'amount', 'currency_code', 'starts_on',
    'next_starts_on', 'ends_on', 'published_at'
  ],
  'current prices expose the server-side read contract in order'
);

select is(
  (
    select array_agg(attribute.attname::text order by attribute.attnum)
      from pg_attribute as attribute
     where attribute.attrelid = 'public.vw_published_commercial_policy_applications'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'policy_id', 'policy_type', 'scope_type', 'title', 'description', 'starts_on',
    'ends_on', 'product_id', 'monetary_value', 'currency_code', 'calculation_method',
    'basis_public_price_id'
  ],
  'published policy applications expose only the documented contract'
);

select is(
  (
    select array_agg(attribute.attname::text order by attribute.attnum)
      from pg_attribute as attribute
     where attribute.attrelid = 'public.vw_published_commercial_policy_accumulators'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'accumulator_id', 'title', 'description', 'starts_on', 'ends_on',
    'combination_fingerprint', 'product_id', 'monetary_value', 'currency_code',
    'member_policy_ids'
  ],
  'published accumulators expose only the documented contract'
);

select is(
  (
    select array_agg(format_type(attribute.atttypid, attribute.atttypmod) order by attribute.attnum)
      from pg_attribute as attribute
     where attribute.attrelid = 'public.vw_product_value_current_v2'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'integer', 'text', 'character varying(100)', 'character varying(150)',
    'character varying(150)', 'smallint', 'numeric(14,2)', 'numeric'
  ],
  'compatibility v2 preserves the exact legacy column types and typmods'
);

select is(
  (
    select array_agg(attribute.attname::text order by attribute.attnum)
      from pg_attribute as attribute
     where attribute.attrelid = 'public.vw_product_value_current_v2'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  (
    select array_agg(attribute.attname::text order by attribute.attnum)
      from pg_attribute as attribute
     where attribute.attrelid = 'public.vw_product_value_current'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  'compatibility v2 preserves legacy column names and order'
);

select ok(
  not exists (
    select 1
      from information_schema.columns as column_definition
     where column_definition.table_schema = 'public'
       and column_definition.table_name in (
         'vw_published_commercial_policy_applications',
         'vw_published_commercial_policy_accumulators'
       )
       and column_definition.column_name in (
         'calculation_snapshot', 'scope_snapshot', 'source_snapshot', 'created_by',
         'updated_by', 'reviewed_by', 'published_by', 'raw_text', 'raw_payload',
         'financial_parameter_set_id'
       )
  ),
  'sanitized policy views expose no snapshots, actors, imports or financial internals'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  'a2000000-0000-4000-8000-000000000001',
  'pricing-read-admin@example.invalid',
  '{"full_name":"Pricing Read Admin"}'
);

update public.profiles
   set role = 'admin', status = 'active', accepted_at = now()
 where id = 'a2000000-0000-4000-8000-000000000001';

insert into public.products (
  id, brand, model, version, model_year, production_year, is_active, is_public
) values
  (2110000201, 'Read Brand', 'Current Model', 'A', 2026, 2026, true, false),
  (2110000202, 'Read Brand', 'Future Model', 'B', 2026, 2026, true, false),
  (2110000203, 'Read Brand', 'Transition Model', 'C', 2026, 2026, true, false),
  (2110000204, 'Read Brand', 'Draft Model', 'D', 2026, 2026, true, false),
  (2110000205, 'Read Brand', 'Review Model', 'E', 2026, 2026, true, false),
  (2110000206, 'Read Brand', 'Archived Model', 'F', 2026, 2026, true, false),
  (2110000207, 'Read Brand', 'No Price Model', 'G', 2026, 2026, true, false);

insert into public.product_public_prices (
  id, product_id, amount, starts_on, status, source_type, published_at, published_by
) values
  (98001, 2110000201, 100000, current_date - 10, 'published', 'manual', now(),
    'a2000000-0000-4000-8000-000000000001'),
  (98002, 2110000201, 110000, current_date + 5, 'published', 'manual', now(),
    'a2000000-0000-4000-8000-000000000001'),
  (98003, 2110000202, 120000, current_date + 1, 'published', 'manual', now(),
    'a2000000-0000-4000-8000-000000000001'),
  (98004, 2110000203, 130000, current_date - 10, 'published', 'manual', now(),
    'a2000000-0000-4000-8000-000000000001'),
  (98005, 2110000203, 135000, current_date, 'published', 'manual', now(),
    'a2000000-0000-4000-8000-000000000001'),
  (98006, 2110000204, 0, current_date - 1, 'draft', 'manual', null, null),
  (98007, 2110000205, 140000, current_date - 1, 'needs_review', 'manual', null, null),
  (98008, 2110000206, 150000, current_date - 1, 'archived', 'manual', null, null);

select is(
  (select amount from public.vw_current_product_public_prices where product_id = 2110000201),
  100000::numeric,
  'current price is present while its successor remains future'
);

select is(
  (
    select ends_on
      from public.vw_product_public_price_periods
     where id = 98001
  ),
  current_date + 4,
  'a published price period ends one day before its successor'
);

select is(
  (
    select amount
      from public.vw_current_product_public_prices
     where product_id = 2110000203
  ),
  135000::numeric,
  'the new period becomes current exactly on starts_on'
);

select is(
  (
    select ends_on
      from public.vw_product_public_price_periods
     where id = 98004
  ),
  current_date - 1,
  'the preceding period ends on the day before the transition'
);

select is(
  (
    select ends_on
      from public.vw_product_public_price_periods
     where id = 98005
  ),
  null::date,
  'the last published period has no derived end date'
);

select is(
  (
    select count(*)::integer
      from public.vw_current_product_public_prices
     where product_id in (2110000202, 2110000204, 2110000205, 2110000206, 2110000207)
  ),
  0,
  'future-only, zero draft, needs_review, archived and absent prices yield no current row'
);

select ok(
  not exists (
    select 1
      from public.vw_product_public_price_periods
     where id in (98006, 98007, 98008)
  ),
  'historical periods include published rows only'
);

select ok(
  not exists (
    select 1
      from public.vw_current_product_public_prices
     group by product_id
    having count(*) > 1
  ),
  'the current price contract returns at most one row per product'
);

insert into public.commercial_policies (
  id, product_id, policy_type, scope_type, scope_snapshot, title, description, starts_on, ends_on,
  calculation_method, status, source_type, published_at, published_by
) values
  (99101, 2110000201, 'retail_bonus', 'product_set', '{}', 'Current policy', 'Current description',
    current_date - 5, current_date + 5, 'fixed_amount', 'published', 'manual', now(),
    'a2000000-0000-4000-8000-000000000001'),
  (99102, 2110000201, 'retail_bonus', 'product_set', '{}', 'Future policy', 'Future description',
    current_date + 1, null, 'fixed_amount', 'published', 'manual', now(),
    'a2000000-0000-4000-8000-000000000001'),
  (99103, 2110000201, 'retail_bonus', 'product_set', '{}', 'Expired policy', 'Expired description',
    current_date - 10, current_date - 1, 'fixed_amount', 'published', 'manual', now(),
    'a2000000-0000-4000-8000-000000000001'),
  (99104, 2110000201, 'retail_bonus', 'product_set', '{}', 'Draft policy', 'Draft description',
    current_date - 1, null, 'fixed_amount', 'draft', 'manual', null, null),
  (99105, 2110000201, 'trade_in_bonus', 'product_set', '{}', 'Second current policy',
    'Second description', current_date - 5, current_date + 5, 'fixed_amount',
    'published', 'manual', now(), 'a2000000-0000-4000-8000-000000000001'),
  (99106, 2110000201, 'other', 'product_set', '{}', 'Isolated policy', 'Isolated description',
    current_date - 5, current_date + 5, 'manual_amount', 'published', 'manual', now(),
    'a2000000-0000-4000-8000-000000000001');

insert into public.commercial_policy_applications (
  id, policy_id, product_id, input_monetary_value, monetary_value, calculation_snapshot
) values
  (99301, 99101, 2110000201, 100, 100, '{}'),
  (99302, 99102, 2110000201, 200, 200, '{}'),
  (99303, 99103, 2110000201, 300, 300, '{}'),
  (99304, 99104, 2110000201, 400, 400, '{}'),
  (99305, 99105, 2110000201, 500, 500, '{}'),
  (99306, 99106, 2110000201, 50, 50, '{}');

select is(
  (
    select array_agg(policy_id order by policy_id)
      from public.vw_published_commercial_policy_applications
     where product_id = 2110000201
  ),
  array[99101, 99105, 99106]::bigint[],
  'only current published policy applications are exposed'
);

select is(
  (
    select count(*)::integer
      from public.vw_published_commercial_policy_applications
     where policy_id in (99102, 99103, 99104)
  ),
  0,
  'future, expired and draft policies are absent'
);

insert into public.commercial_policy_accumulators (
  id, title, description, starts_on, ends_on, combination_fingerprint, status,
  source_type, published_at, published_by
) values
  (99201, 'Materialized combination', 'Only approved members', current_date - 2,
    current_date + 2, 'policy_ids:99101,99105', 'draft', 'manual', null, null),
  (99202, 'Future combination', 'Future', current_date + 1, null,
    'policy_ids:99101,99106', 'draft', 'manual', null, null),
  (99203, 'Draft combination', 'Draft', current_date - 1, null, null, 'draft',
    'manual', null, null);

insert into public.commercial_policy_accumulator_items (
  accumulator_id, policy_id, position
) values
  (99201, 99105, 1),
  (99201, 99101, 2),
  (99202, 99106, 1),
  (99202, 99101, 2),
  (99203, 99105, 1),
  (99203, 99101, 2);

insert into public.commercial_policy_accumulator_values (
  id, accumulator_id, product_id, monetary_value, calculation_snapshot
) values
  (99401, 99201, 2110000201, 777.77, '{}'),
  (99402, 99202, 2110000201, 888.88, '{}'),
  (99403, 99203, 2110000201, 999.99, '{}');

update public.commercial_policy_accumulators
   set status = 'published',
       published_at = now(),
       published_by = 'a2000000-0000-4000-8000-000000000001'
 where id in (99201, 99202);

select is(
  (
    select monetary_value
      from public.vw_published_commercial_policy_accumulators
     where accumulator_id = 99201
       and product_id = 2110000201
  ),
  777.77::numeric,
  'accumulator read uses the frozen materialized value without recalculation'
);

select is(
  (
    select member_policy_ids
      from public.vw_published_commercial_policy_accumulators
     where accumulator_id = 99201
       and product_id = 2110000201
  ),
  array[99101, 99105]::bigint[],
  'accumulator member policy ids are deterministic regardless of item position'
);

select is(
  (
    select count(*)::integer
      from public.vw_published_commercial_policy_accumulators
     where accumulator_id in (99202, 99203)
  ),
  0,
  'future and draft accumulators are absent'
);

select ok(
  not exists (
    select 1
      from public.vw_published_commercial_policy_accumulators
     where monetary_value in (50, 600)
  ),
  'isolated policies are never summed or added to combinations automatically'
);

select ok(
  position(
    'vw_current_product_public_prices'
    in pg_get_viewdef('public.vw_product_value_current_v2'::regclass, true)
  ) > 0
  and position(
    'product_price_offers'
    in pg_get_viewdef('public.vw_product_value_current_v2'::regclass, true)
  ) = 0,
  'compatibility v2 replaces only the legacy public price source'
);

select is(
  md5(pg_get_viewdef('public.vw_product_value_current'::regclass, true)),
  'f6b5493ea69d298c92be7a07fa55e39c',
  'the legacy value view definition remains byte-for-byte unchanged'
);

select ok(
  to_regclass('public.product_price_offers') is not null
  and to_regclass('public.vw_product_value_current') is not null
  and to_regclass('public.products') is not null
  and to_regclass('public.product_specs') is not null
  and to_regclass('public.specs') is not null,
  'legacy pricing and perceived-value objects remain present'
);

select * from finish();

rollback;
