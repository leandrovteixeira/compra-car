-- Destructive test-data cleanup for Compra Car Staging only.
-- Approved for project shfsjyjxmgwnlexmdkcs on 2026-08-01. This is not a migration.
-- The server-address guard is deliberately fail-closed and must not be generalized.
begin;

create temporary table cleanup_policy_batches on commit drop as
select id
from public.pricing_import_batches
where metadata->>'kind' = 'manual_policy_batch';

create temporary table cleanup_policy_rows on commit drop as
select row_data.id
from public.pricing_import_rows as row_data
join cleanup_policy_batches as batch on batch.id = row_data.batch_id;

create temporary table cleanup_protected_snapshot on commit drop as
select
  (select count(*) from public.products) as product_count,
  (select count(*) from public.product_public_prices) as price_count,
  (select count(*) from public.financial_parameter_sets) as parameter_count,
  (select count(*) from auth.users) as user_count,
  (select count(*) from public.profiles) as profile_count,
  (select count(*) from public.specs) as spec_count,
  (select count(*) from public.product_specs) as product_spec_count,
  (select count(*) from public.pricing_import_batches where metadata->>'kind'='manual_price_batch') as price_batch_count,
  (select count(*) from public.pricing_import_rows as row_data join public.pricing_import_batches as batch on batch.id=row_data.batch_id where batch.metadata->>'kind'='manual_price_batch') as price_row_count,
  (select count(*) from public.pricing_import_row_outputs where public_price_id is not null) as price_output_count,
  (select md5(coalesce(string_agg(to_jsonb(price)::text, ',' order by price.id), '')) from public.product_public_prices as price) as price_digest,
  (
    select md5(coalesce(string_agg(protected.payload, ',' order by protected.kind, protected.id), ''))
    from (
      select 'batch' as kind, batch.id, to_jsonb(batch)::text as payload
      from public.pricing_import_batches as batch
      where batch.metadata->>'kind'='manual_price_batch'
      union all
      select 'row', row_data.id, to_jsonb(row_data)::text
      from public.pricing_import_rows as row_data
      join public.pricing_import_batches as batch on batch.id=row_data.batch_id
      where batch.metadata->>'kind'='manual_price_batch'
      union all
      select 'output', output.id, to_jsonb(output)::text
      from public.pricing_import_row_outputs as output
      where output.public_price_id is not null
    ) as protected
  ) as price_provenance_digest,
  (
    select md5(coalesce(string_agg(to_jsonb(audit)::text, ',' order by audit.id), ''))
    from public.pricing_audit_events as audit
    where audit.aggregate_type in ('product_public_price','financial_parameter_set')
       or (
         audit.aggregate_type='pricing_import_batch'
         and audit.aggregate_id in (
           select id from public.pricing_import_batches
           where metadata->>'kind'='manual_price_batch'
         )
       )
  ) as protected_audit_digest,
  (
    select md5(coalesce(string_agg(protected.payload, ',' order by protected.kind, protected.id), ''))
    from (
      select 'product' as kind, product.id::bigint as id, to_jsonb(product)::text as payload
      from public.products as product
      union all
      select 'parameter', parameter.id, to_jsonb(parameter)::text
      from public.financial_parameter_sets as parameter
      union all
      select 'spec', spec.id::bigint, to_jsonb(spec)::text
      from public.specs as spec
      union all
      select 'product_spec', product_spec.id, to_jsonb(product_spec)::text
      from public.product_specs as product_spec
    ) as protected
  ) as structural_digest;

do $guard$
declare
  snapshot cleanup_protected_snapshot%rowtype;
begin
  if inet_server_addr()::text <> '2600:1f11:63d:d101:c7e9:a24d:5b42:c2b7/128' then
    raise exception 'staging cleanup refused: unexpected database server';
  end if;
  select * into strict snapshot from cleanup_protected_snapshot;
  if snapshot.product_count <> 10
     or snapshot.price_count <> 17
     or snapshot.parameter_count <> 1
     or snapshot.price_batch_count <> 4
     or snapshot.price_row_count <> 8
     or snapshot.price_output_count <> 8 then
    raise exception 'staging cleanup refused: protected baseline differs';
  end if;
end;
$guard$;

-- Both terminal lifecycle guards and append-only audit guards are bypassed only
-- for this transaction and only after the fail-closed Staging baseline check.
set local session_replication_role = replica;

delete from public.pricing_audit_events
where aggregate_type in ('commercial_policy','commercial_offer')
   or (
     aggregate_type='pricing_import_batch'
     and aggregate_id in (select id from cleanup_policy_batches)
   );
delete from public.commercial_policy_accumulator_values;
delete from public.commercial_policy_accumulator_items;
delete from public.commercial_policy_accumulators;
delete from public.commercial_offer_policies;
delete from public.commercial_policy_applications;
delete from public.pricing_import_row_reviews
where import_row_id in (select id from cleanup_policy_rows);
delete from public.pricing_import_row_outputs
where import_row_id in (select id from cleanup_policy_rows)
   or policy_id is not null;
delete from public.commercial_offers;
delete from public.commercial_policies;
delete from public.pricing_import_rows
where id in (select id from cleanup_policy_rows);
delete from public.pricing_import_batches
where id in (select id from cleanup_policy_batches);

set local session_replication_role = origin;

do $verify$
declare
  before_snapshot cleanup_protected_snapshot%rowtype;
  after_snapshot cleanup_protected_snapshot%rowtype;
begin
  select * into strict before_snapshot from cleanup_protected_snapshot;

  create temporary table cleanup_after_snapshot on commit drop as
  select
    (select count(*) from public.products) as product_count,
    (select count(*) from public.product_public_prices) as price_count,
    (select count(*) from public.financial_parameter_sets) as parameter_count,
    (select count(*) from auth.users) as user_count,
    (select count(*) from public.profiles) as profile_count,
    (select count(*) from public.specs) as spec_count,
    (select count(*) from public.product_specs) as product_spec_count,
    (select count(*) from public.pricing_import_batches where metadata->>'kind'='manual_price_batch') as price_batch_count,
    (select count(*) from public.pricing_import_rows as row_data join public.pricing_import_batches as batch on batch.id=row_data.batch_id where batch.metadata->>'kind'='manual_price_batch') as price_row_count,
    (select count(*) from public.pricing_import_row_outputs where public_price_id is not null) as price_output_count,
    (select md5(coalesce(string_agg(to_jsonb(price)::text, ',' order by price.id), '')) from public.product_public_prices as price) as price_digest,
    (
      select md5(coalesce(string_agg(protected.payload, ',' order by protected.kind, protected.id), ''))
      from (
        select 'batch' as kind, batch.id, to_jsonb(batch)::text as payload from public.pricing_import_batches as batch where batch.metadata->>'kind'='manual_price_batch'
        union all
        select 'row', row_data.id, to_jsonb(row_data)::text from public.pricing_import_rows as row_data join public.pricing_import_batches as batch on batch.id=row_data.batch_id where batch.metadata->>'kind'='manual_price_batch'
        union all
        select 'output', output.id, to_jsonb(output)::text from public.pricing_import_row_outputs as output where output.public_price_id is not null
      ) as protected
    ) as price_provenance_digest,
    (
      select md5(coalesce(string_agg(to_jsonb(audit)::text, ',' order by audit.id), ''))
      from public.pricing_audit_events as audit
      where audit.aggregate_type in ('product_public_price','financial_parameter_set')
         or (audit.aggregate_type='pricing_import_batch' and audit.aggregate_id in (select id from public.pricing_import_batches where metadata->>'kind'='manual_price_batch'))
    ) as protected_audit_digest,
    (
      select md5(coalesce(string_agg(protected.payload, ',' order by protected.kind, protected.id), ''))
      from (
        select 'product' as kind, product.id::bigint as id, to_jsonb(product)::text as payload from public.products as product
        union all select 'parameter', parameter.id, to_jsonb(parameter)::text from public.financial_parameter_sets as parameter
        union all select 'spec', spec.id::bigint, to_jsonb(spec)::text from public.specs as spec
        union all select 'product_spec', product_spec.id, to_jsonb(product_spec)::text from public.product_specs as product_spec
      ) as protected
    ) as structural_digest;

  select * into strict after_snapshot from cleanup_after_snapshot;
  if to_jsonb(after_snapshot) is distinct from to_jsonb(before_snapshot) then
    raise exception 'staging cleanup rolled back: protected data or evidence changed';
  end if;
  if exists (
    select 1 where
      (select count(*) from public.commercial_policy_accumulator_values) <> 0 or
      (select count(*) from public.commercial_policy_accumulator_items) <> 0 or
      (select count(*) from public.commercial_policy_accumulators) <> 0 or
      (select count(*) from public.commercial_offer_policies) <> 0 or
      (select count(*) from public.commercial_policy_applications) <> 0 or
      (select count(*) from public.commercial_offers) <> 0 or
      (select count(*) from public.commercial_policies) <> 0 or
      (select count(*) from cleanup_policy_batches) <> 6 or
      (select count(*) from cleanup_policy_rows) <> 16
  ) then
    raise exception 'staging cleanup rolled back: target data remains or source scope changed';
  end if;
  if exists (
    select 1 from public.pricing_import_row_outputs as output
    left join public.pricing_import_rows as row_data on row_data.id=output.import_row_id
    left join public.product_public_prices as price on price.id=output.public_price_id
    where row_data.id is null or (output.public_price_id is not null and price.id is null)
  ) then
    raise exception 'staging cleanup rolled back: orphaned protected provenance';
  end if;
end;
$verify$;

select
  (select count(*) from public.products) as products,
  (select count(*) from public.product_public_prices) as product_public_prices,
  (select count(*) from public.financial_parameter_sets) as financial_parameter_sets,
  (select count(*) from public.commercial_policies) as commercial_policies,
  (select count(*) from public.commercial_offers) as commercial_offers,
  (select count(*) from public.commercial_offer_policies) as offer_memberships,
  (select count(*) from public.pricing_import_batches where metadata->>'kind'='manual_price_batch') as preserved_price_batches,
  (select count(*) from public.pricing_import_row_outputs where public_price_id is not null) as preserved_price_outputs;

commit;
