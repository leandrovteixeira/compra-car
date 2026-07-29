-- STAGING ONLY: exercises the complete manual-batch RPC and intentionally raises at the end.
-- PostgreSQL rolls the complete statement back, so no artificial batch, price or audit row persists.
do $staging_manual_batch_validation$
declare
  actor_id_value uuid;
  product_id_value integer;
  starts_on_value date;
  correlation_id_value uuid := 'c9b00000-0000-4000-8000-000000000009';
  result_value jsonb;
  batch_id_value bigint;
  price_id_value bigint;
  batches_before bigint;
  rows_before bigint;
  outputs_before bigint;
  prices_before bigint;
  audit_before bigint;
  policies_before bigint;
  offers_before bigint;
begin
  select profile.id into strict actor_id_value
    from public.profiles as profile
   where profile.role = 'admin' and profile.status = 'active'
   order by profile.id
   limit 1;

  select product.id into strict product_id_value
    from public.products as product
   order by product.id
   limit 1;

  select candidate.day::date into strict starts_on_value
    from pg_catalog.generate_series(
      date '2099-01-01',
      date '2099-12-31',
      interval '1 day'
    ) as candidate(day)
   where not exists (
     select 1
       from public.product_public_prices as price
      where price.product_id = product_id_value
        and price.starts_on = candidate.day::date
   )
   order by candidate.day
   limit 1;

  select count(*) into batches_before from public.pricing_import_batches;
  select count(*) into rows_before from public.pricing_import_rows;
  select count(*) into outputs_before from public.pricing_import_row_outputs;
  select count(*) into prices_before from public.product_public_prices;
  select count(*) into audit_before from public.pricing_audit_events;
  select count(*) into policies_before from public.commercial_policies;
  select count(*) into offers_before from public.commercial_offers;

  result_value := public.create_manual_price_batch(
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'clientRowId', 'staging-reversible-row',
        'productId', product_id_value::text,
        'amount', '1.23',
        'startsOn', starts_on_value::text,
        'endsOn', null
      )
    ),
    actor_id_value,
    correlation_id_value
  );
  batch_id_value := (result_value ->> 'batchId')::bigint;
  price_id_value := (result_value -> 'priceIds' ->> 0)::bigint;

  if (result_value ->> 'createdCount')::integer <> 1
     or pg_catalog.jsonb_array_length(result_value -> 'rows') <> 1 then
    raise exception 'STAGING_VALIDATION_FAILED: unexpected RPC result';
  end if;
  if (select count(*) from public.pricing_import_batches) <> batches_before + 1
     or (select count(*) from public.pricing_import_rows) <> rows_before + 1
     or (select count(*) from public.pricing_import_row_outputs) <> outputs_before + 1
     or (select count(*) from public.product_public_prices) <> prices_before + 1
     or (select count(*) from public.pricing_audit_events) <> audit_before + 2 then
    raise exception 'STAGING_VALIDATION_FAILED: inconsistent atomic counts';
  end if;
  if not exists (
    select 1
      from public.pricing_import_batches as batch
      join public.pricing_import_rows as import_row on import_row.batch_id = batch.id
      join public.pricing_import_row_outputs as output on output.import_row_id = import_row.id
      join public.product_public_prices as price on price.id = output.public_price_id
     where batch.id = batch_id_value
       and batch.source_type = 'manual'
       and batch.status = 'promoted'
       and import_row.status = 'promoted'
       and price.id = price_id_value
       and price.status = 'draft'
       and price.amount = 1.23
       and price.source_type = 'manual'
       and price.source_import_row_id = import_row.id
  ) then
    raise exception 'STAGING_VALIDATION_FAILED: provenance or lifecycle mismatch';
  end if;
  if (select count(*) from public.commercial_policies) <> policies_before
     or (select count(*) from public.commercial_offers) <> offers_before then
    raise exception 'STAGING_VALIDATION_FAILED: policy or offer was changed';
  end if;
  if (select count(*) from public.pricing_audit_events where correlation_id = correlation_id_value) <> 2 then
    raise exception 'STAGING_VALIDATION_FAILED: audit correlation mismatch';
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'EXPECTED_ROLLBACK: STAGING_MANUAL_PRICE_BATCH_VALIDATED';
end;
$staging_manual_batch_validation$;
