-- Creates an administrative, persistent and atomic manual price batch.
-- The function validates the complete payload before its first write and deliberately
-- creates only import provenance plus draft public prices. It does not publish or
-- create commercial policies/offers.

create function public.create_manual_price_batch(
  p_rows jsonb,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_payload jsonb;
  row_number integer := 0;
  row_count integer;
  client_row_id text;
  product_id_text text;
  product_id_value integer;
  amount_text text;
  amount_value numeric(14,2);
  starts_on_text text;
  starts_on_value date;
  ends_on_text text;
  ends_on_value date;
  batch_id_value bigint;
  import_row_id_value bigint;
  price_id_value bigint;
  result_rows jsonb := '[]'::jsonb;
  result_price_ids jsonb := '[]'::jsonb;
begin
  perform public.assert_active_pricing_admin(p_actor_id);

  if p_correlation_id is null then
    raise exception using errcode = '22004', message = 'manual price batch requires correlation_id';
  end if;
  if p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = '22023', message = 'manual price batch rows must be a JSON array';
  end if;

  row_count := pg_catalog.jsonb_array_length(p_rows);
  if row_count < 1 or row_count > 100 then
    raise exception using errcode = '22023', message = 'manual price batch requires between 1 and 100 rows';
  end if;

  -- Validate every row before acquiring identities or writing persistent records.
  for row_payload in select value from pg_catalog.jsonb_array_elements(p_rows)
  loop
    row_number := row_number + 1;
    if pg_catalog.jsonb_typeof(row_payload) <> 'object' then
      raise exception using errcode = '22023', message = pg_catalog.format('manual price batch row %s must be an object', row_number);
    end if;
    if exists (
      select 1
        from pg_catalog.jsonb_object_keys(row_payload) as supplied(key)
       where supplied.key not in ('clientRowId', 'productId', 'amount', 'startsOn', 'endsOn')
    ) then
      raise exception using errcode = '22023', message = pg_catalog.format('manual price batch row %s has unsupported fields', row_number);
    end if;
    if pg_catalog.jsonb_typeof(row_payload -> 'clientRowId') <> 'string'
       or pg_catalog.jsonb_typeof(row_payload -> 'productId') <> 'string'
       or pg_catalog.jsonb_typeof(row_payload -> 'amount') <> 'string'
       or pg_catalog.jsonb_typeof(row_payload -> 'startsOn') <> 'string'
       or (
         row_payload ? 'endsOn'
         and row_payload -> 'endsOn' <> 'null'::jsonb
         and pg_catalog.jsonb_typeof(row_payload -> 'endsOn') <> 'string'
       ) then
      raise exception using errcode = '22023', message = pg_catalog.format('manual price batch row %s has invalid field types', row_number);
    end if;

    client_row_id := pg_catalog.btrim(row_payload ->> 'clientRowId');
    product_id_text := pg_catalog.btrim(row_payload ->> 'productId');
    amount_text := pg_catalog.btrim(row_payload ->> 'amount');
    starts_on_text := pg_catalog.btrim(row_payload ->> 'startsOn');
    ends_on_text := nullif(pg_catalog.btrim(row_payload ->> 'endsOn'), '');

    if client_row_id is null or client_row_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$' then
      raise exception using errcode = '22023', message = pg_catalog.format('manual price batch row %s has invalid clientRowId', row_number);
    end if;
    if product_id_text !~ '^[1-9][0-9]{0,9}$'
       or product_id_text::numeric > 2147483647 then
      raise exception using errcode = '22023', message = pg_catalog.format('manual price batch row %s has invalid productId', row_number);
    end if;
    product_id_value := product_id_text::integer;
    if not exists (select 1 from public.products as product where product.id = product_id_value) then
      raise exception using errcode = '23503', message = pg_catalog.format('manual price batch row %s references an unknown product', row_number);
    end if;
    if amount_text !~ '^(0|[1-9][0-9]{0,11})\.[0-9]{2}$'
       or amount_text::numeric <= 0
       or amount_text::numeric > 999999999999.99 then
      raise exception using errcode = '22023', message = pg_catalog.format('manual price batch row %s has invalid canonical amount', row_number);
    end if;
    if starts_on_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or pg_catalog.to_char(pg_catalog.to_date(starts_on_text, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> starts_on_text then
      raise exception using errcode = '22023', message = pg_catalog.format('manual price batch row %s has invalid startsOn', row_number);
    end if;
    starts_on_value := starts_on_text::date;
    if ends_on_text is not null then
      if ends_on_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         or pg_catalog.to_char(pg_catalog.to_date(ends_on_text, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> ends_on_text then
        raise exception using errcode = '22023', message = pg_catalog.format('manual price batch row %s has invalid endsOn', row_number);
      end if;
      ends_on_value := ends_on_text::date;
      if ends_on_value < starts_on_value then
        raise exception using errcode = '22023', message = pg_catalog.format('manual price batch row %s has an invalid period', row_number);
      end if;
    end if;
  end loop;

  if exists (
    select 1
      from pg_catalog.jsonb_array_elements(p_rows) as candidate(value)
     group by candidate.value ->> 'clientRowId'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'manual price batch clientRowId values must be unique';
  end if;
  if exists (
    select 1
      from pg_catalog.jsonb_array_elements(p_rows) as candidate(value)
     group by candidate.value ->> 'productId', candidate.value ->> 'startsOn'
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'manual price batch contains duplicate product and start date',
      detail = (
        select pg_catalog.jsonb_agg(candidate.value ->> 'clientRowId')::text
          from pg_catalog.jsonb_array_elements(p_rows) as candidate(value)
         where (candidate.value ->> 'productId', candidate.value ->> 'startsOn') in (
           select duplicate.value ->> 'productId', duplicate.value ->> 'startsOn'
             from pg_catalog.jsonb_array_elements(p_rows) as duplicate(value)
            group by duplicate.value ->> 'productId', duplicate.value ->> 'startsOn'
           having count(*) > 1
         )
      );
  end if;
  if exists (
    select 1
      from pg_catalog.jsonb_array_elements(p_rows) as candidate(value)
      join public.product_public_prices as price
        on price.product_id = (candidate.value ->> 'productId')::integer
       and price.starts_on = (candidate.value ->> 'startsOn')::date
  ) then
    raise exception using
      errcode = '23505',
      message = 'a public price already exists for product and start date',
      detail = (
        select pg_catalog.jsonb_agg(candidate.value ->> 'clientRowId')::text
          from pg_catalog.jsonb_array_elements(p_rows) as candidate(value)
          join public.product_public_prices as price
            on price.product_id = (candidate.value ->> 'productId')::integer
           and price.starts_on = (candidate.value ->> 'startsOn')::date
      );
  end if;

  -- Keep referenced Products stable until the transaction has completed.
  perform product.id
    from public.products as product
   where product.id in (
     select (candidate.value ->> 'productId')::integer
       from pg_catalog.jsonb_array_elements(p_rows) as candidate(value)
   )
   for key share;

  insert into public.pricing_import_batches (
    source_type, idempotency_key, schema_version, status, metadata,
    created_by, updated_by
  ) values (
    'manual',
    'manual-price-batch:' || p_correlation_id::text,
    'manual-price-batch/1',
    'uploaded',
    pg_catalog.jsonb_build_object(
      'kind', 'manual_price_batch',
      'rowCount', row_count,
      'correlationId', p_correlation_id
    ),
    p_actor_id,
    p_actor_id
  ) returning id into batch_id_value;

  row_number := 0;
  for row_payload in select value from pg_catalog.jsonb_array_elements(p_rows)
  loop
    row_number := row_number + 1;
    client_row_id := pg_catalog.btrim(row_payload ->> 'clientRowId');
    product_id_value := (row_payload ->> 'productId')::integer;
    amount_text := row_payload ->> 'amount';
    amount_value := amount_text::numeric(14,2);
    starts_on_value := (row_payload ->> 'startsOn')::date;
    ends_on_text := nullif(pg_catalog.btrim(row_payload ->> 'endsOn'), '');
    ends_on_value := case when ends_on_text is null then null else ends_on_text::date end;

    insert into public.pricing_import_rows (
      batch_id, source_row_number, raw_payload, normalized_payload,
      matched_product_id, status, created_by, updated_by
    ) values (
      batch_id_value,
      row_number,
      row_payload,
      pg_catalog.jsonb_build_object(
        'clientRowId', client_row_id,
        'productId', product_id_value,
        'amount', amount_text,
        'currencyCode', 'BRL',
        'startsOn', starts_on_value,
        'endsOn', ends_on_value
      ),
      product_id_value,
      'approved',
      p_actor_id,
      p_actor_id
    ) returning id into import_row_id_value;

    insert into public.product_public_prices (
      product_id, amount, currency_code, starts_on, ends_on, price_type,
      status, source_type, source_import_row_id, source_reference,
      source_snapshot, created_by, updated_by
    ) values (
      product_id_value,
      amount_value,
      'BRL',
      starts_on_value,
      ends_on_value,
      'msrp',
      'draft',
      'manual',
      import_row_id_value,
      'manual-price-batch:' || p_correlation_id::text || ':' || client_row_id,
      pg_catalog.jsonb_build_object(
        'kind', 'manual_price_batch',
        'batchId', batch_id_value,
        'clientRowId', client_row_id,
        'correlationId', p_correlation_id
      ),
      p_actor_id,
      p_actor_id
    ) returning id into price_id_value;

    insert into public.pricing_import_row_outputs (
      import_row_id, public_price_id, created_by
    ) values (
      import_row_id_value, price_id_value, p_actor_id
    );

    update public.pricing_import_rows
       set status = 'promoted', updated_by = p_actor_id
     where id = import_row_id_value;

    insert into public.pricing_audit_events (
      aggregate_type, aggregate_id, action, after_snapshot, reason,
      actor_id, correlation_id
    ) values (
      'product_public_price',
      price_id_value,
      'insert',
      pg_catalog.jsonb_build_object(
        'id', price_id_value,
        'productId', product_id_value,
        'amount', amount_text,
        'currencyCode', 'BRL',
        'startsOn', starts_on_value,
        'endsOn', ends_on_value,
        'status', 'draft',
        'sourceType', 'manual',
        'sourceImportRowId', import_row_id_value
      ),
      'manual price batch',
      p_actor_id,
      p_correlation_id
    );

    result_rows := result_rows || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'clientRowId', client_row_id,
        'importRowId', import_row_id_value,
        'priceId', price_id_value
      )
    );
    result_price_ids := result_price_ids || pg_catalog.jsonb_build_array(price_id_value);
  end loop;

  update public.pricing_import_batches
     set status = 'promoted',
         promoted_at = pg_catalog.now(),
         promoted_by = p_actor_id,
         updated_by = p_actor_id
   where id = batch_id_value;

  insert into public.pricing_audit_events (
    aggregate_type, aggregate_id, action, after_snapshot, reason,
    actor_id, correlation_id
  ) values (
    'pricing_import_batch',
    batch_id_value,
    'promote',
    pg_catalog.jsonb_build_object(
      'id', batch_id_value,
      'sourceType', 'manual',
      'status', 'promoted',
      'rowCount', row_count
    ),
    'manual price batch persisted atomically as drafts',
    p_actor_id,
    p_correlation_id
  );

  return pg_catalog.jsonb_build_object(
    'batchId', batch_id_value,
    'createdCount', row_count,
    'priceIds', result_price_ids,
    'rows', result_rows
  );
end;
$$;

alter function public.create_manual_price_batch(jsonb, uuid, uuid) owner to postgres;
revoke all on function public.create_manual_price_batch(jsonb, uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.create_manual_price_batch(jsonb, uuid, uuid)
to service_role;
