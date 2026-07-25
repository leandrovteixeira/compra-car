begin;

set local search_path = extensions, public, pg_catalog;

select no_plan();

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
       'public.commercial_policy_accumulator_values'::regclass
     )
       and relation.relrowsecurity
  ),
  7::bigint,
  'RLS is enabled on all seven pricing core tables'
);

select ok(
  (
    with pricing_tables(name) as (
      values
        ('product_public_prices'),
        ('financial_parameter_sets'),
        ('commercial_policies'),
        ('commercial_policy_applications'),
        ('commercial_policy_accumulators'),
        ('commercial_policy_accumulator_items'),
        ('commercial_policy_accumulator_values')
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
    )
      from pricing_tables
  ),
  'anon has no privilege on any pricing core table'
);

select ok(
  (
    with pricing_tables(name) as (
      values
        ('product_public_prices'),
        ('financial_parameter_sets'),
        ('commercial_policies'),
        ('commercial_policy_applications'),
        ('commercial_policy_accumulators'),
        ('commercial_policy_accumulator_items'),
        ('commercial_policy_accumulator_values')
    )
    select bool_and(
      not has_table_privilege('authenticated', 'public.' || name, 'SELECT')
      and not has_table_privilege('authenticated', 'public.' || name, 'INSERT')
      and not has_table_privilege('authenticated', 'public.' || name, 'UPDATE')
      and not has_table_privilege('authenticated', 'public.' || name, 'DELETE')
      and not has_table_privilege('authenticated', 'public.' || name, 'TRUNCATE')
      and not has_table_privilege('authenticated', 'public.' || name, 'REFERENCES')
      and not has_table_privilege('authenticated', 'public.' || name, 'TRIGGER')
      and not has_table_privilege('authenticated', 'public.' || name, 'MAINTAIN')
    )
      from pricing_tables
  ),
  'authenticated has no privilege on any pricing core table'
);

select ok(
  not exists (
    select 1
      from pg_class as relation
      cross join lateral aclexplode(relation.relacl) as privilege
     where relation.oid in (
       'public.product_public_prices'::regclass,
       'public.financial_parameter_sets'::regclass,
       'public.commercial_policies'::regclass,
       'public.commercial_policy_applications'::regclass,
       'public.commercial_policy_accumulators'::regclass,
       'public.commercial_policy_accumulator_items'::regclass,
       'public.commercial_policy_accumulator_values'::regclass
     )
       and privilege.grantee = 0
  ),
  'PUBLIC has no direct ACL entry on pricing core tables'
);

select is(
  (
    select array_agg(pg_get_serial_sequence('public.' || table_name, 'id') order by table_name)
      from (
        values
          ('commercial_policies'),
          ('commercial_policy_accumulator_values'),
          ('commercial_policy_accumulators'),
          ('commercial_policy_applications'),
          ('financial_parameter_sets'),
          ('product_public_prices')
      ) as identity_tables(table_name)
  ),
  array[
    'public.commercial_policies_id_seq',
    'public.commercial_policy_accumulator_values_id_seq',
    'public.commercial_policy_accumulators_id_seq',
    'public.commercial_policy_applications_id_seq',
    'public.financial_parameter_sets_id_seq',
    'public.product_public_prices_id_seq'
  ],
  'the six documented identity sequences are linked to their tables'
);

select ok(
  (
    with pricing_sequences(name) as (
      values
        ('product_public_prices_id_seq'),
        ('financial_parameter_sets_id_seq'),
        ('commercial_policies_id_seq'),
        ('commercial_policy_applications_id_seq'),
        ('commercial_policy_accumulators_id_seq'),
        ('commercial_policy_accumulator_values_id_seq')
    )
    select bool_and(
      not has_sequence_privilege('anon', 'public.' || name, 'USAGE')
      and not has_sequence_privilege('anon', 'public.' || name, 'SELECT')
      and not has_sequence_privilege('anon', 'public.' || name, 'UPDATE')
    )
      from pricing_sequences
  ),
  'anon has no privilege on pricing identity sequences'
);

select ok(
  (
    with pricing_sequences(name) as (
      values
        ('product_public_prices_id_seq'),
        ('financial_parameter_sets_id_seq'),
        ('commercial_policies_id_seq'),
        ('commercial_policy_applications_id_seq'),
        ('commercial_policy_accumulators_id_seq'),
        ('commercial_policy_accumulator_values_id_seq')
    )
    select bool_and(
      not has_sequence_privilege('authenticated', 'public.' || name, 'USAGE')
      and not has_sequence_privilege('authenticated', 'public.' || name, 'SELECT')
      and not has_sequence_privilege('authenticated', 'public.' || name, 'UPDATE')
    )
      from pricing_sequences
  ),
  'authenticated has no privilege on pricing identity sequences'
);

select ok(
  not exists (
    select 1
      from pg_class as relation
      cross join lateral aclexplode(relation.relacl) as privilege
     where relation.oid in (
       'public.product_public_prices_id_seq'::regclass,
       'public.financial_parameter_sets_id_seq'::regclass,
       'public.commercial_policies_id_seq'::regclass,
       'public.commercial_policy_applications_id_seq'::regclass,
       'public.commercial_policy_accumulators_id_seq'::regclass,
       'public.commercial_policy_accumulator_values_id_seq'::regclass
     )
       and privilege.grantee = 0
  ),
  'PUBLIC has no direct ACL entry on pricing identity sequences'
);

select ok(
  (
    with pricing_tables(name) as (
      values
        ('product_public_prices'),
        ('financial_parameter_sets'),
        ('commercial_policies'),
        ('commercial_policy_applications'),
        ('commercial_policy_accumulators'),
        ('commercial_policy_accumulator_items'),
        ('commercial_policy_accumulator_values')
    )
    select bool_and(
      has_table_privilege('service_role', 'public.' || name, 'SELECT')
      and has_table_privilege('service_role', 'public.' || name, 'INSERT')
      and has_table_privilege('service_role', 'public.' || name, 'UPDATE')
    )
      from pricing_tables
  ),
  'service_role has SELECT, INSERT and UPDATE on every pricing core table'
);

select ok(
  (
    with pricing_tables(name) as (
      values
        ('product_public_prices'),
        ('financial_parameter_sets'),
        ('commercial_policies'),
        ('commercial_policy_applications'),
        ('commercial_policy_accumulators'),
        ('commercial_policy_accumulator_items'),
        ('commercial_policy_accumulator_values')
    )
    select bool_and(
      not has_table_privilege('service_role', 'public.' || name, 'DELETE')
      and not has_table_privilege('service_role', 'public.' || name, 'TRUNCATE')
      and not has_table_privilege('service_role', 'public.' || name, 'REFERENCES')
      and not has_table_privilege('service_role', 'public.' || name, 'TRIGGER')
      and not has_table_privilege('service_role', 'public.' || name, 'MAINTAIN')
    )
      from pricing_tables
  ),
  'service_role has no DELETE, TRUNCATE, REFERENCES, TRIGGER or MAINTAIN on pricing core tables'
);

select ok(
  (
    with pricing_sequences(name) as (
      values
        ('product_public_prices_id_seq'),
        ('financial_parameter_sets_id_seq'),
        ('commercial_policies_id_seq'),
        ('commercial_policy_applications_id_seq'),
        ('commercial_policy_accumulators_id_seq'),
        ('commercial_policy_accumulator_values_id_seq')
    )
    select bool_and(
      has_sequence_privilege('service_role', 'public.' || name, 'USAGE')
      and has_sequence_privilege('service_role', 'public.' || name, 'SELECT')
      and not has_sequence_privilege('service_role', 'public.' || name, 'UPDATE')
    )
      from pricing_sequences
  ),
  'service_role has only USAGE and SELECT on pricing identity sequences'
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
       'public.commercial_policy_accumulator_values'::regclass
     )
  ),
  0::bigint,
  'no policy exists on pricing core tables'
);

select ok(
  not exists (
    select 1
      from pg_class as relation
      cross join lateral aclexplode(relation.relacl) as privilege
     where relation.oid in (
       'public.product_public_prices'::regclass,
       'public.financial_parameter_sets'::regclass,
       'public.commercial_policies'::regclass,
       'public.commercial_policy_applications'::regclass,
       'public.commercial_policy_accumulators'::regclass,
       'public.commercial_policy_accumulator_items'::regclass,
       'public.commercial_policy_accumulator_values'::regclass,
       'public.product_public_prices_id_seq'::regclass,
       'public.financial_parameter_sets_id_seq'::regclass,
       'public.commercial_policies_id_seq'::regclass,
       'public.commercial_policy_applications_id_seq'::regclass,
       'public.commercial_policy_accumulators_id_seq'::regclass,
       'public.commercial_policy_accumulator_values_id_seq'::regclass
     )
       and privilege.grantee in (
         0,
         (select oid from pg_roles where rolname = 'anon'),
         (select oid from pg_roles where rolname = 'authenticated')
       )
  ),
  'PUBLIC, anon and authenticated have no residual ACL entries on pricing core objects'
);

select ok(
  not exists (
    select 1
      from (
        select
          relation.oid,
          relation.relkind,
          privilege.grantee,
          count(distinct privilege.privilege_type) as privilege_count
        from pg_class as relation
        cross join lateral aclexplode(relation.relacl) as privilege
        where relation.oid in (
          'public.product_public_prices'::regclass,
          'public.financial_parameter_sets'::regclass,
          'public.commercial_policies'::regclass,
          'public.commercial_policy_applications'::regclass,
          'public.commercial_policy_accumulators'::regclass,
          'public.commercial_policy_accumulator_items'::regclass,
          'public.commercial_policy_accumulator_values'::regclass,
          'public.product_public_prices_id_seq'::regclass,
          'public.financial_parameter_sets_id_seq'::regclass,
          'public.commercial_policies_id_seq'::regclass,
          'public.commercial_policy_applications_id_seq'::regclass,
          'public.commercial_policy_accumulators_id_seq'::regclass,
          'public.commercial_policy_accumulator_values_id_seq'::regclass
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
  'no non-owner role received ALL privileges on a pricing core object'
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
  'baseline default ALL privileges remain globally unchanged for tables and sequences'
);

select ok(
  (
    select count(*) = 13 and bool_and(owner.rolname = 'postgres')
      from pg_class as relation
      join pg_roles as owner on owner.oid = relation.relowner
     where relation.oid in (
       'public.product_public_prices'::regclass,
       'public.financial_parameter_sets'::regclass,
       'public.commercial_policies'::regclass,
       'public.commercial_policy_applications'::regclass,
       'public.commercial_policy_accumulators'::regclass,
       'public.commercial_policy_accumulator_items'::regclass,
       'public.commercial_policy_accumulator_values'::regclass,
       'public.product_public_prices_id_seq'::regclass,
       'public.financial_parameter_sets_id_seq'::regclass,
       'public.commercial_policies_id_seq'::regclass,
       'public.commercial_policy_applications_id_seq'::regclass,
       'public.commercial_policy_accumulators_id_seq'::regclass,
       'public.commercial_policy_accumulator_values_id_seq'::regclass
     )
  ),
  'pricing core table and sequence ownership remains unchanged'
);

select ok(
  has_table_privilege('anon', 'public.product_price_offers', 'SELECT')
  and has_table_privilege('authenticated', 'public.product_price_offers', 'SELECT')
  and position(
    'product_price_offers' in pg_get_viewdef('public.vw_product_value_current'::regclass, true)
  ) > 0
  and position(
    'product_public_prices' in pg_get_viewdef('public.vw_product_value_current'::regclass, true)
  ) = 0,
  'legacy pricing privileges and vw_product_value_current remain unchanged'
);

select * from finish();

rollback;
