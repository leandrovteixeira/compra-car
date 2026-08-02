begin;

set local search_path = extensions, public, pg_catalog;

select no_plan();

select is(
  (
    select array_agg(enumlabel::text order by enumsortorder)
      from pg_enum
     where enumtypid = 'public.pricing_workflow_status'::regtype
  ),
  array['draft', 'needs_review', 'published', 'rejected', 'archived'],
  'pricing_workflow_status has the approved values in order'
);
select is(
  (
    select array_agg(enumlabel::text order by enumsortorder)
      from pg_enum
     where enumtypid = 'public.commercial_policy_type'::regtype
  ),
  array[
    'retail_bonus', 'invoice_discount', 'trade_in_bonus', 'loyalty_bonus', 'subsidized_financing', 'free_ipva',
    'free_insurance', 'free_wallbox', 'registration', 'other',
    'free_registration', 'free_maintenance', 'fuel_or_recharge_voucher'
  ],
  'commercial_policy_type has the approved values in order'
);
select is(
  (
    select array_agg(enumlabel::text order by enumsortorder)
      from pg_enum
     where enumtypid = 'public.commercial_policy_scope_type'::regtype
  ),
  array['model', 'product_set'],
  'commercial_policy_scope_type has the approved values in order'
);
select is(
  (
    select array_agg(enumlabel::text order by enumsortorder)
      from pg_enum
     where enumtypid = 'public.policy_calculation_method'::regtype
  ),
  array['fixed_amount', 'percentage_of_msrp', 'present_value_subsidy', 'manual_amount', 'proportional_ipva', 'discounted_promotional_cash_flow_difference', 'non_monetized'],
  'policy_calculation_method has the approved values in order'
);
select is(
  (
    select array_agg(enumlabel::text order by enumsortorder)
      from pg_enum
     where enumtypid = 'public.pricing_source_type'::regtype
  ),
  array['manual', 'legacy_backfill', 'ai_extraction', 'api_import'],
  'pricing_source_type has the approved values in order'
);

select is(
  (
    select array_agg(table_name::text order by table_name)
      from information_schema.tables
     where table_schema = 'public'
       and table_name in (
         'product_public_prices',
         'financial_parameter_sets',
         'commercial_offers',
         'commercial_policies',
         'commercial_offer_policies',
         'commercial_policy_applications',
         'commercial_policy_accumulators',
         'commercial_policy_accumulator_items',
         'commercial_policy_accumulator_values'
       )
       and table_type = 'BASE TABLE'
  ),
  array[
    'commercial_offer_policies',
    'commercial_offers',
    'commercial_policies',
    'commercial_policy_accumulator_items',
    'commercial_policy_accumulator_values',
    'commercial_policy_accumulators',
    'commercial_policy_applications',
    'financial_parameter_sets',
    'product_public_prices'
  ],
  'all nine Pricing V2 core tables exist in public'
);

select is(
  (
    select array_agg(
      attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
        || ':' || attribute.attnotnull::text || ':' || attribute.attidentity::text
      order by attribute.attnum
    )
      from pg_attribute as attribute
     where attribute.attrelid = 'public.product_public_prices'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'id:bigint:true:d', 'product_id:integer:true:', 'amount:numeric(14,2):true:',
    'currency_code:character(3):true:', 'starts_on:date:true:',
    'status:pricing_workflow_status:true:', 'source_type:pricing_source_type:true:',
    'source_import_row_id:bigint:false:', 'source_snapshot:jsonb:true:',
    'reviewed_at:timestamp with time zone:false:', 'reviewed_by:uuid:false:',
    'published_at:timestamp with time zone:false:', 'published_by:uuid:false:',
    'created_at:timestamp with time zone:true:', 'created_by:uuid:false:',
    'updated_at:timestamp with time zone:true:', 'updated_by:uuid:false:',
    'lock_version:integer:true:', 'price_type:text:false:', 'ends_on:date:false:',
    'source_reference:text:false:', 'legacy_source_id:bigint:false:'
  ],
  'product_public_prices columns match the target schema exactly'
);
select is(
  (
    select array_agg(
      attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
        || ':' || attribute.attnotnull::text || ':' || attribute.attidentity::text
      order by attribute.attnum
    )
      from pg_attribute as attribute
     where attribute.attrelid = 'public.financial_parameter_sets'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'id:bigint:true:d', 'version:integer:true:', 'name:text:true:',
    'effective_from:date:true:', 'cdi_monthly_percentage:numeric(9,6):true:',
    'spread_monthly_percentage:numeric(9,6):true:',
    'status:pricing_workflow_status:true:', 'source_type:pricing_source_type:true:',
    'source_reference:text:false:', 'source_snapshot:jsonb:true:', 'notes:text:false:',
    'published_at:timestamp with time zone:false:', 'published_by:uuid:false:',
    'created_at:timestamp with time zone:true:', 'created_by:uuid:false:',
    'updated_at:timestamp with time zone:true:', 'updated_by:uuid:false:',
    'lock_version:integer:true:', 'annual_cdi_rate:numeric(14,12):false:',
    'monthly_cdi_rate:numeric(14,12):false:', 'monthly_spread_rate:numeric(14,12):false:',
    'monthly_reference_rate:numeric(14,12):false:', 'methodology:text:false:',
    'valid_to:date:false:'
  ],
  'financial_parameter_sets columns match the target schema exactly'
);
select is(
  (
    select array_agg(
      attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
        || ':' || attribute.attnotnull::text || ':' || attribute.attidentity::text
      order by attribute.attnum
    )
      from pg_attribute as attribute
     where attribute.attrelid = 'public.commercial_policies'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'id:bigint:true:d', 'policy_type:commercial_policy_type:true:',
    'scope_type:commercial_policy_scope_type:true:', 'model_brand:text:false:',
    'model_name:text:false:', 'scope_snapshot:jsonb:true:', 'title:text:true:',
    'description:text:false:', 'starts_on:date:true:', 'ends_on:date:false:',
    'benefit_percentage:numeric(9,6):false:',
    'down_payment_percentage:numeric(9,6):false:', 'term_months:integer:false:',
    'customer_interest_rate_monthly:numeric(9,6):false:',
    'calculation_method:policy_calculation_method:true:',
    'financial_parameter_set_id:bigint:false:',
    'status:pricing_workflow_status:true:', 'source_type:pricing_source_type:true:',
    'source_import_row_id:bigint:false:', 'supersedes_policy_id:bigint:false:',
    'reviewed_at:timestamp with time zone:false:', 'reviewed_by:uuid:false:',
    'published_at:timestamp with time zone:false:', 'published_by:uuid:false:',
    'created_at:timestamp with time zone:true:', 'created_by:uuid:false:',
    'updated_at:timestamp with time zone:true:', 'updated_by:uuid:false:',
    'lock_version:integer:true:',
    'calculation_base_price_id:bigint:false:', 'customer_benefit_amount:numeric(14,2):false:',
    'dealer_rebate_amount:numeric(14,2):false:',
    'dealer_rebate_allocation_method:dealer_rebate_allocation_method:false:',
    'dealer_rebate_allocation_base:numeric(14,2):false:',
    'dealer_rebate_allocation_percentage:numeric(12,8):false:',
    'dealer_rebate_rounding_residual:numeric(14,8):false:',
    'legacy_policy_source:text:false:', 'legacy_offer_id:bigint:false:',
    'legacy_source_column:text:false:', 'legacy_dealer_rebate_value:numeric(14,2):false:',
    'fixed_amount:numeric(14,2):false:', 'percentage_rate:numeric(14,12):false:',
    'voucher_type:text:false:', 'policy_parameters:jsonb:false:',
    'annual_rate:numeric(14,12):false:',
    'coverage_years:numeric(6,2):false:', 'remaining_months:smallint:false:',
    'offer_month:smallint:false:', 'financed_principal:numeric(14,2):false:',
    'product_id:integer:true:'
  ],
  'commercial_policies columns match the target schema exactly'
);
select is(
  (
    select array_agg(
      attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
        || ':' || attribute.attnotnull::text || ':' || attribute.attidentity::text
      order by attribute.attnum
    )
      from pg_attribute as attribute
     where attribute.attrelid = 'public.commercial_policy_applications'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'id:bigint:true:d', 'policy_id:bigint:true:', 'product_id:integer:true:',
    'basis_public_price_id:bigint:false:', 'input_monetary_value:numeric(14,2):false:',
    'monetary_value:numeric(14,2):true:', 'currency_code:character(3):true:',
    'calculation_snapshot:jsonb:true:', 'created_at:timestamp with time zone:true:',
    'created_by:uuid:false:', 'updated_at:timestamp with time zone:true:',
    'updated_by:uuid:false:', 'lock_version:integer:true:'
  ],
  'commercial_policy_applications columns match the target schema exactly'
);
select is(
  (
    select array_agg(
      attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
        || ':' || attribute.attnotnull::text || ':' || attribute.attidentity::text
      order by attribute.attnum
    )
      from pg_attribute as attribute
     where attribute.attrelid = 'public.commercial_policy_accumulators'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'id:bigint:true:d', 'title:text:true:', 'description:text:false:',
    'starts_on:date:true:', 'ends_on:date:false:', 'combination_fingerprint:text:false:',
    'status:pricing_workflow_status:true:', 'source_type:pricing_source_type:true:',
    'source_import_row_id:bigint:false:', 'reviewed_at:timestamp with time zone:false:',
    'reviewed_by:uuid:false:', 'published_at:timestamp with time zone:false:',
    'published_by:uuid:false:', 'created_at:timestamp with time zone:true:',
    'created_by:uuid:false:', 'updated_at:timestamp with time zone:true:',
    'updated_by:uuid:false:', 'lock_version:integer:true:',
    'commercial_offer_id:bigint:false:', 'relation_type:text:false:', 'relation_origin:text:false:'
  ],
  'commercial_policy_accumulators columns match the target schema exactly'
);
select is(
  (
    select array_agg(
      attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
        || ':' || attribute.attnotnull::text || ':' || attribute.attidentity::text
      order by attribute.attnum
    )
      from pg_attribute as attribute
     where attribute.attrelid = 'public.commercial_policy_accumulator_items'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'accumulator_id:bigint:true:', 'policy_id:bigint:true:', 'position:smallint:true:',
    'created_at:timestamp with time zone:true:', 'created_by:uuid:false:'
  ],
  'commercial_policy_accumulator_items columns match the target schema exactly'
);
select is(
  (
    select array_agg(
      attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
        || ':' || attribute.attnotnull::text || ':' || attribute.attidentity::text
      order by attribute.attnum
    )
      from pg_attribute as attribute
     where attribute.attrelid = 'public.commercial_policy_accumulator_values'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  ),
  array[
    'id:bigint:true:d', 'accumulator_id:bigint:true:', 'product_id:integer:true:',
    'monetary_value:numeric(14,2):true:', 'currency_code:character(3):true:',
    'calculation_snapshot:jsonb:true:', 'created_at:timestamp with time zone:true:',
    'created_by:uuid:false:', 'updated_at:timestamp with time zone:true:',
    'updated_by:uuid:false:'
  ],
  'commercial_policy_accumulator_values columns match the target schema exactly'
);

select is(
  (
    select array_agg(constraint_record.conname::text order by constraint_record.conname)
      from pg_constraint as constraint_record
     where constraint_record.contype = 'p'
       and constraint_record.conrelid in (
         'public.product_public_prices'::regclass,
         'public.financial_parameter_sets'::regclass,
         'public.commercial_offers'::regclass,
         'public.commercial_policies'::regclass,
         'public.commercial_offer_policies'::regclass,
         'public.commercial_policy_applications'::regclass,
         'public.commercial_policy_accumulators'::regclass,
         'public.commercial_policy_accumulator_items'::regclass,
         'public.commercial_policy_accumulator_values'::regclass
       )
  ),
  array[
    'commercial_offer_policies_pkey',
    'commercial_offers_pkey',
    'commercial_policies_pkey',
    'commercial_policy_accumulator_items_pkey',
    'commercial_policy_accumulator_values_pkey',
    'commercial_policy_accumulators_pkey',
    'commercial_policy_applications_pkey',
    'financial_parameter_sets_pkey',
    'product_public_prices_pkey'
  ],
  'all pricing core primary keys exist with the documented names'
);
select is(
  (
    with expected(name, source_table, target_table, delete_action) as (
      values
        ('product_public_prices_product_id_fkey', 'product_public_prices', 'products', 'r'),
        ('product_public_prices_reviewed_by_fkey', 'product_public_prices', 'profiles', 'n'),
        ('product_public_prices_published_by_fkey', 'product_public_prices', 'profiles', 'n'),
        ('product_public_prices_created_by_fkey', 'product_public_prices', 'profiles', 'n'),
        ('product_public_prices_updated_by_fkey', 'product_public_prices', 'profiles', 'n'),
        ('product_public_prices_source_import_row_id_fkey', 'product_public_prices', 'pricing_import_rows', 'r'),
        ('financial_parameter_sets_published_by_fkey', 'financial_parameter_sets', 'profiles', 'n'),
        ('financial_parameter_sets_created_by_fkey', 'financial_parameter_sets', 'profiles', 'n'),
        ('financial_parameter_sets_updated_by_fkey', 'financial_parameter_sets', 'profiles', 'n'),
        ('commercial_offers_product_id_fkey', 'commercial_offers', 'products', 'r'),
        ('commercial_offers_public_price_id_fkey', 'commercial_offers', 'product_public_prices', 'r'),
        ('commercial_policies_product_id_fkey', 'commercial_policies', 'products', 'r'),
        ('commercial_policies_financial_parameter_set_id_fkey', 'commercial_policies', 'financial_parameter_sets', 'r'),
        ('commercial_policies_supersedes_policy_id_fkey', 'commercial_policies', 'commercial_policies', 'r'),
        ('commercial_policies_reviewed_by_fkey', 'commercial_policies', 'profiles', 'n'),
        ('commercial_policies_published_by_fkey', 'commercial_policies', 'profiles', 'n'),
        ('commercial_policies_created_by_fkey', 'commercial_policies', 'profiles', 'n'),
        ('commercial_policies_updated_by_fkey', 'commercial_policies', 'profiles', 'n'),
        ('commercial_policies_source_import_row_id_fkey', 'commercial_policies', 'pricing_import_rows', 'r'),
        ('commercial_offer_policies_offer_id_fkey', 'commercial_offer_policies', 'commercial_offers', 'c'),
        ('commercial_offer_policies_policy_id_fkey', 'commercial_offer_policies', 'commercial_policies', 'r'),
        ('commercial_offer_policies_created_by_fkey', 'commercial_offer_policies', 'profiles', 'n'),
        ('commercial_policy_applications_policy_id_fkey', 'commercial_policy_applications', 'commercial_policies', 'c'),
        ('commercial_policy_applications_product_id_fkey', 'commercial_policy_applications', 'products', 'r'),
        ('commercial_policy_applications_basis_public_price_id_fkey', 'commercial_policy_applications', 'product_public_prices', 'r'),
        ('commercial_policy_applications_created_by_fkey', 'commercial_policy_applications', 'profiles', 'n'),
        ('commercial_policy_applications_updated_by_fkey', 'commercial_policy_applications', 'profiles', 'n'),
        ('commercial_policy_accumulators_reviewed_by_fkey', 'commercial_policy_accumulators', 'profiles', 'n'),
        ('commercial_policy_accumulators_published_by_fkey', 'commercial_policy_accumulators', 'profiles', 'n'),
        ('commercial_policy_accumulators_created_by_fkey', 'commercial_policy_accumulators', 'profiles', 'n'),
        ('commercial_policy_accumulators_updated_by_fkey', 'commercial_policy_accumulators', 'profiles', 'n'),
        ('commercial_policy_accumulators_source_import_row_id_fkey', 'commercial_policy_accumulators', 'pricing_import_rows', 'r'),
        ('commercial_policy_accumulator_items_accumulator_id_fkey', 'commercial_policy_accumulator_items', 'commercial_policy_accumulators', 'c'),
        ('commercial_policy_accumulator_items_policy_id_fkey', 'commercial_policy_accumulator_items', 'commercial_policies', 'r'),
        ('commercial_policy_accumulator_items_created_by_fkey', 'commercial_policy_accumulator_items', 'profiles', 'n'),
        ('commercial_policy_accumulator_values_accumulator_id_fkey', 'commercial_policy_accumulator_values', 'commercial_policy_accumulators', 'c'),
        ('commercial_policy_accumulator_values_product_id_fkey', 'commercial_policy_accumulator_values', 'products', 'r'),
        ('commercial_policy_accumulator_values_created_by_fkey', 'commercial_policy_accumulator_values', 'profiles', 'n'),
        ('commercial_policy_accumulator_values_updated_by_fkey', 'commercial_policy_accumulator_values', 'profiles', 'n')
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
  39::bigint,
  'all 39 approved foreign keys have the expected target and delete action'
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
  'all three source_import_row_id columns now reference pricing_import_rows with RESTRICT'
);
select is(
  (
    select array_agg(constraint_record.conname::text order by constraint_record.conname)
      from pg_constraint as constraint_record
     where constraint_record.contype = 'u'
       and constraint_record.conrelid in (
         'public.product_public_prices'::regclass,
         'public.financial_parameter_sets'::regclass,
         'public.commercial_policy_applications'::regclass,
         'public.commercial_policy_accumulators'::regclass,
         'public.commercial_policy_accumulator_items'::regclass,
         'public.commercial_policy_accumulator_values'::regclass
       )
  ),
  array[
    'commercial_policy_accumulator_items_accumulator_position_key',
    'commercial_policy_accumulator_values_accumulator_product_key',
    'commercial_policy_accumulators_combination_fingerprint_key',
    'commercial_policy_applications_policy_product_key',
    'financial_parameter_sets_version_key',
    'product_public_prices_product_starts_on_key'
  ],
  'all documented unique constraints exist'
);
select is(
  (
    select count(*)
      from pg_class as index_relation
     join pg_index as index_record on index_record.indexrelid = index_relation.oid
     where index_record.indrelid in (
         'public.product_public_prices'::regclass,
         'public.financial_parameter_sets'::regclass,
         'public.commercial_policies'::regclass,
         'public.commercial_policy_applications'::regclass,
         'public.commercial_policy_accumulators'::regclass,
         'public.commercial_policy_accumulator_items'::regclass,
         'public.commercial_policy_accumulator_values'::regclass
       )
       and not index_record.indisprimary
       and not index_record.indisunique
  ),
  21::bigint,
  'all 21 documented non-unique indexes exist'
);

insert into public.products (
  id, brand, model, version, model_year, production_year, is_active, is_public
) values (
  2100000001, 'Sprint 9', 'Fixture', 'Structural test', 2026, 2026, true, false
);

select lives_ok(
  $$
    insert into public.product_public_prices (
      id, product_id, amount, starts_on, status, source_type
    ) values (91001, 2100000001, 0, date '2026-07-01', 'draft', 'manual')
  $$,
  'zero public price is accepted in draft'
);
select throws_ok(
  $$
    insert into public.product_public_prices (
      id, product_id, amount, starts_on, status, source_type,
      published_at, published_by
    ) values (
      91002, 2100000001, 0, date '2026-08-01', 'published', 'manual',
      now(), '11111111-1111-4111-8111-111111111111'
    )
  $$,
  '23514',
  null,
  'zero public price is rejected in published'
);
select throws_ok(
  $$
    insert into public.product_public_prices (
      id, product_id, amount, starts_on, status, source_type
    ) values (91003, 2100000001, -0.01, date '2026-09-01', 'draft', 'manual')
  $$,
  '23514',
  null,
  'negative public price is rejected'
);
select throws_ok(
  $$
    insert into public.product_public_prices (
      id, product_id, amount, starts_on, status, source_type
    ) values (91004, 2100000001, 1, date '2026-07-01', 'draft', 'manual')
  $$,
  '23505',
  null,
  'a product cannot have two prices with the same starts_on date'
);

select lives_ok(
  $$
    insert into public.commercial_policies (
      id, product_id, policy_type, scope_type, model_brand, model_name, scope_snapshot,
      title, starts_on, calculation_method, source_type
    ) values (
      92001, 2100000001, 'retail_bonus', 'model', 'Marca', 'Modelo', '{}',
      'Política de modelo', date '2026-07-01', 'fixed_amount', 'manual'
    )
  $$,
  'model scope accepts non-empty brand and model'
);
select lives_ok(
  $$
    insert into public.commercial_policies (
      id, product_id, policy_type, scope_type, scope_snapshot, title, starts_on,
      calculation_method, source_type
    ) values (
      92002, 2100000001, 'other', 'product_set', '{}', 'Política por produtos',
      date '2026-07-01', 'manual_amount', 'manual'
    )
  $$,
  'product_set scope accepts null model fields'
);
select throws_ok(
  $$
    insert into public.commercial_policies (
      product_id, policy_type, scope_type, model_brand, model_name, scope_snapshot,
      title, starts_on, calculation_method, source_type
    ) values (
      2100000001, 'retail_bonus', 'model', ' ', 'Modelo', '{}', 'Escopo inválido',
      date '2026-07-01', 'fixed_amount', 'manual'
    )
  $$,
  '23514',
  null,
  'model scope rejects blank brand'
);
select throws_ok(
  $$
    insert into public.commercial_policies (
      product_id, policy_type, scope_type, model_brand, model_name, scope_snapshot,
      title, starts_on, calculation_method, source_type
    ) values (
      2100000001, 'retail_bonus', 'product_set', 'Marca', null, '{}', 'Escopo inválido',
      date '2026-07-01', 'fixed_amount', 'manual'
    )
  $$,
  '23514',
  null,
  'product_set scope rejects model fields'
);
select throws_ok(
  $$
    insert into public.commercial_policies (
      product_id, policy_type, scope_type, scope_snapshot, title, starts_on, ends_on,
      calculation_method, source_type
    ) values (
      2100000001, 'retail_bonus', 'product_set', '{}', 'Datas inválidas',
      date '2026-08-01', date '2026-07-31', 'fixed_amount', 'manual'
    )
  $$,
  '23514',
  null,
  'commercial policy rejects ends_on before starts_on'
);
select throws_ok(
  $$
    insert into public.commercial_policies (
      product_id, policy_type, scope_type, scope_snapshot, title, starts_on,
      benefit_percentage, calculation_method, source_type
    ) values (
      2100000001, 'free_ipva', 'product_set', '{}', 'Percentual inválido',
      date '2026-07-01', 100.000001, 'percentage_of_msrp', 'manual'
    )
  $$,
  '23514',
  null,
  'commercial policy rejects percentage above 100'
);

select throws_ok(
  $$
    insert into public.commercial_policy_applications (
      policy_id, product_id, input_monetary_value, monetary_value, calculation_snapshot
    ) values (92001, 2100000001, -0.01, 1, '{}')
  $$,
  '23514',
  null,
  'policy application rejects a negative input amount'
);
select throws_ok(
  $$
    insert into public.commercial_policy_applications (
      policy_id, product_id, monetary_value, calculation_snapshot
    ) values (92001, 2100000001, -0.01, '{}')
  $$,
  '23514',
  null,
  'policy application rejects a negative frozen monetary value'
);

insert into public.commercial_policy_accumulators (
  id, title, starts_on, source_type
) values (
  93001, 'Acumulador estrutural', date '2026-07-01', 'manual'
);
select throws_ok(
  $$
    insert into public.commercial_policy_accumulator_items (
      accumulator_id, policy_id, position
    ) values (93001, 92001, 0)
  $$,
  '23514',
  null,
  'accumulator item rejects a non-positive position'
);
select throws_ok(
  $$
    insert into public.commercial_policy_accumulator_values (
      accumulator_id, product_id, monetary_value, calculation_snapshot
    ) values (93001, 2100000001, -0.01, '{}')
  $$,
  '23514',
  null,
  'accumulator value rejects a negative amount'
);
select throws_ok(
  $$
    insert into public.commercial_policy_accumulators (
      title, starts_on, status, source_type, published_at, published_by
    ) values (
      'Publicado sem fingerprint', date '2026-07-01', 'published', 'manual',
      now(), '11111111-1111-4111-8111-111111111111'
    )
  $$,
  '23514',
  null,
  'published accumulator requires a combination fingerprint'
);

select ok(
  (
    select bool_and(relation.relrowsecurity)
      from pg_class as relation
     where relation.oid in (
       'public.product_public_prices'::regclass,
       'public.financial_parameter_sets'::regclass,
       'public.commercial_offers'::regclass,
       'public.commercial_policies'::regclass,
       'public.commercial_offer_policies'::regclass,
       'public.commercial_policy_applications'::regclass,
       'public.commercial_policy_accumulators'::regclass,
       'public.commercial_policy_accumulator_items'::regclass,
       'public.commercial_policy_accumulator_values'::regclass
     )
  ),
  'RLS is enabled for all pricing core tables by the security migration'
);
select is(
  (
    select count(*)
      from pg_trigger as trigger_record
     where not trigger_record.tgisinternal
       and trigger_record.tgrelid in (
         'public.product_public_prices'::regclass,
         'public.financial_parameter_sets'::regclass,
         'public.commercial_policies'::regclass,
         'public.commercial_policy_applications'::regclass,
         'public.commercial_policy_accumulators'::regclass,
         'public.commercial_policy_accumulator_items'::regclass,
         'public.commercial_policy_accumulator_values'::regclass
       )
  ),
  26::bigint,
  'the lifecycle, publication and policy rollover migrations attach the expected 26 triggers'
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
  'no pricing RLS policies were introduced in the structural migration'
);

select is(
  (
    select array_agg(column_name::text order by ordinal_position)
      from information_schema.columns
     where table_schema = 'public' and table_name = 'products'
  ),
  array[
    'id', 'brand', 'model', 'version', 'renavam_reference', 'model_year',
    'production_year', 'is_active', 'created_at', 'updated_at', 'segment', 'is_public'
  ],
  'legacy products columns remain unchanged'
);
select is(
  (
    select array_agg(column_name::text order by ordinal_position)
      from information_schema.columns
     where table_schema = 'public' and table_name = 'product_price_offers'
  ),
  array[
    'id', 'product_id', 'offer_month', 'public_price', 'retail_bonus',
    'retail_rebate', 'trade_in_bonus', 'trade_in_rebate',
    'subsidized_rate_monthly', 'down_payment_percent', 'installments', 'rate_rebate',
    'insurance_years', 'ipva_included', 'others_bonus', 'total_customer_benefit',
    'total_dealer_rebate', 'notes', 'is_active', 'created_at', 'updated_at'
  ],
  'legacy product_price_offers columns remain unchanged'
);
select ok(
  position(
    'product_price_offers' in pg_get_viewdef('public.vw_product_value_current'::regclass, true)
  ) > 0
  and position(
    'product_public_prices' in pg_get_viewdef('public.vw_product_value_current'::regclass, true)
  ) = 0,
  'legacy vw_product_value_current still reads only product_price_offers'
);

select * from finish();

rollback;
