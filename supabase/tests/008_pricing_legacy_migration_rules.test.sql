begin;
set local search_path = extensions, public, pg_catalog;
select no_plan();

-- The legacy migration remains replayable, while Pricing V2 supersedes its direct Offer FK.
select has_table('public', 'commercial_offers', 'legacy Offer table remains available');
select has_column('public', 'commercial_offers', 'product_id', 'Offer retains product_id');
select has_column('public', 'commercial_offers', 'public_price_id', 'Offer retains public_price_id');
select has_column('public', 'commercial_offers', 'legacy_source_id', 'Offer retains legacy_source_id');
select has_column('public', 'commercial_offers', 'valid_from', 'Offer retains valid_from');
select has_column('public', 'commercial_offers', 'valid_to', 'Offer retains valid_to');
select has_column('public', 'product_public_prices', 'price_type', 'Price retains price_type');
select has_column('public', 'product_public_prices', 'ends_on', 'Price retains ends_on');
select has_column('public', 'product_public_prices', 'source_reference', 'Price retains source_reference');
select has_column('public', 'commercial_policies', 'calculation_base_price_id', 'Policy retains base price');
select has_column('public', 'commercial_policies', 'customer_benefit_amount', 'Policy retains customer benefit');
select has_column('public', 'commercial_policies', 'dealer_rebate_amount', 'Policy retains dealer rebate');
select has_column('public', 'commercial_policies', 'fixed_amount', 'Policy retains fixed amount');
select has_column('public', 'commercial_policies', 'percentage_rate', 'Policy retains percentage rate');
select has_column('public', 'commercial_policies', 'voucher_type', 'Policy retains voucher type');
select has_column('public', 'commercial_policies', 'policy_parameters', 'Policy retains parameters');
select has_column('public', 'commercial_policy_accumulators', 'commercial_offer_id', 'Accumulator legacy link remains');
select has_column('public', 'commercial_policy_accumulators', 'relation_type', 'Accumulator retains relation type');
select has_column('public', 'commercial_policy_accumulators', 'relation_origin', 'Accumulator retains relation origin');
select has_column('public', 'financial_parameter_sets', 'monthly_reference_rate', 'Financial set retains reference rate');

select hasnt_column(
  'public',
  'commercial_policies',
  'commercial_offer_id',
  'Pricing V2 removes the superseded direct Offer FK from policies'
);
select hasnt_function(
  'public',
  'validate_legacy_policy_publication',
  array[]::text[],
  'Pricing V2 removes the direct-child publication validator'
);
select has_function(
  'public',
  'publish_commercial_offer',
  array['bigint', 'uuid', 'integer', 'uuid']
);
select has_function(
  'public',
  'publish_commercial_policy',
  array['bigint', 'uuid', 'integer', 'uuid']
);

select * from finish();
rollback;
