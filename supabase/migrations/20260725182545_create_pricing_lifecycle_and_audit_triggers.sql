create function public.set_pricing_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  new.lock_version := old.lock_version + 1;
  return new;
end;
$$;

create function public.prevent_pricing_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'pricing_audit_events is append-only; UPDATE and DELETE are not allowed';
end;
$$;

create function public.prevent_published_pricing_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    tg_table_name in (
      'product_public_prices',
      'financial_parameter_sets',
      'commercial_policies',
      'commercial_policy_accumulators'
    )
    and old.status::text in ('published', 'archived')
  ) or (
    tg_table_name = 'pricing_import_batches'
    and old.status::text in ('promoted', 'archived')
  ) or (
    tg_table_name = 'pricing_import_rows'
    and old.status::text = 'promoted'
  ) then
    raise exception using
      errcode = '55000',
      message = pg_catalog.format(
        'DELETE is not allowed for terminal pricing record public.%I id=%s status=%s',
        tg_table_name,
        old.id,
        old.status
      );
  end if;

  return old;
end;
$$;

create function public.prevent_published_pricing_identity_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  accumulator_id_to_check bigint;
  parent_is_terminal boolean;
begin
  if tg_table_name = 'product_public_prices' then
    if old.status::text in ('published', 'archived') and (
      (old.status::text = 'published' and new.status::text not in ('published', 'archived'))
      or (old.status::text = 'archived' and new.status::text <> 'archived')
      or new.product_id is distinct from old.product_id
      or new.amount is distinct from old.amount
      or new.currency_code is distinct from old.currency_code
      or new.starts_on is distinct from old.starts_on
      or new.source_type is distinct from old.source_type
      or new.source_import_row_id is distinct from old.source_import_row_id
      or new.source_snapshot is distinct from old.source_snapshot
    ) then
      raise exception using
        errcode = '55000',
        message = 'published or archived product_public_prices economic identity is immutable';
    end if;

  elsif tg_table_name = 'financial_parameter_sets' then
    if old.status::text in ('published', 'archived') and (
      (old.status::text = 'published' and new.status::text not in ('published', 'archived'))
      or (old.status::text = 'archived' and new.status::text <> 'archived')
      or new.version is distinct from old.version
      or new.name is distinct from old.name
      or new.effective_from is distinct from old.effective_from
      or new.cdi_monthly_percentage is distinct from old.cdi_monthly_percentage
      or new.spread_monthly_percentage is distinct from old.spread_monthly_percentage
      or new.source_type is distinct from old.source_type
      or new.source_reference is distinct from old.source_reference
      or new.source_snapshot is distinct from old.source_snapshot
    ) then
      raise exception using
        errcode = '55000',
        message = 'published or archived financial_parameter_sets economic identity is immutable';
    end if;

  elsif tg_table_name = 'commercial_policies' then
    if old.status::text in ('published', 'archived') and (
      (old.status::text = 'published' and new.status::text not in ('published', 'archived'))
      or (old.status::text = 'archived' and new.status::text <> 'archived')
      or new.policy_type is distinct from old.policy_type
      or new.scope_type is distinct from old.scope_type
      or new.model_brand is distinct from old.model_brand
      or new.model_name is distinct from old.model_name
      or new.scope_snapshot is distinct from old.scope_snapshot
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.starts_on is distinct from old.starts_on
      or new.ends_on is distinct from old.ends_on
      or new.benefit_percentage is distinct from old.benefit_percentage
      or new.down_payment_percentage is distinct from old.down_payment_percentage
      or new.term_months is distinct from old.term_months
      or new.customer_interest_rate_monthly is distinct from old.customer_interest_rate_monthly
      or new.calculation_method is distinct from old.calculation_method
      or new.financial_parameter_set_id is distinct from old.financial_parameter_set_id
      or new.source_type is distinct from old.source_type
      or new.source_import_row_id is distinct from old.source_import_row_id
      or new.supersedes_policy_id is distinct from old.supersedes_policy_id
    ) then
      raise exception using
        errcode = '55000',
        message = 'published or archived commercial_policies economic identity is immutable';
    end if;

  elsif tg_table_name = 'commercial_policy_applications' then
    select coalesce(pg_catalog.bool_or(policy.status::text in ('published', 'archived')), false)
      into parent_is_terminal
      from public.commercial_policies as policy
     where policy.id = old.policy_id
        or policy.id = new.policy_id;

    if parent_is_terminal and (
      new.policy_id is distinct from old.policy_id
      or new.product_id is distinct from old.product_id
      or new.basis_public_price_id is distinct from old.basis_public_price_id
      or new.input_monetary_value is distinct from old.input_monetary_value
      or new.monetary_value is distinct from old.monetary_value
      or new.currency_code is distinct from old.currency_code
      or new.calculation_snapshot is distinct from old.calculation_snapshot
    ) then
      raise exception using
        errcode = '55000',
        message = 'application of a published or archived commercial policy is immutable';
    end if;

  elsif tg_table_name = 'commercial_policy_accumulators' then
    if old.status::text in ('published', 'archived') and (
      (old.status::text = 'published' and new.status::text not in ('published', 'archived'))
      or (old.status::text = 'archived' and new.status::text <> 'archived')
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.starts_on is distinct from old.starts_on
      or new.ends_on is distinct from old.ends_on
      or new.combination_fingerprint is distinct from old.combination_fingerprint
      or new.source_type is distinct from old.source_type
      or new.source_import_row_id is distinct from old.source_import_row_id
    ) then
      raise exception using
        errcode = '55000',
        message = 'published or archived commercial_policy_accumulators economic identity is immutable';
    end if;

  elsif tg_table_name in (
    'commercial_policy_accumulator_items',
    'commercial_policy_accumulator_values'
  ) then
    if tg_op = 'INSERT' then
      accumulator_id_to_check := new.accumulator_id;
      select exists (
        select 1
          from public.commercial_policy_accumulators as accumulator
         where accumulator.id = accumulator_id_to_check
           and accumulator.status::text in ('published', 'archived')
      ) into parent_is_terminal;
    elsif tg_op = 'DELETE' then
      accumulator_id_to_check := old.accumulator_id;
      select exists (
        select 1
          from public.commercial_policy_accumulators as accumulator
         where accumulator.id = accumulator_id_to_check
           and accumulator.status::text in ('published', 'archived')
      ) into parent_is_terminal;
    else
      select exists (
        select 1
          from public.commercial_policy_accumulators as accumulator
         where accumulator.id in (old.accumulator_id, new.accumulator_id)
           and accumulator.status::text in ('published', 'archived')
      ) into parent_is_terminal;
    end if;

    if parent_is_terminal then
      raise exception using
        errcode = '55000',
        message = pg_catalog.format(
          '%s is not allowed for children of a published or archived accumulator',
          tg_op
        );
    end if;

  elsif tg_table_name = 'pricing_import_batches' then
    if old.status::text in ('promoted', 'archived') and (
      (old.status::text = 'promoted' and new.status::text not in ('promoted', 'archived'))
      or (old.status::text = 'archived' and new.status::text <> 'archived')
      or new.source_type is distinct from old.source_type
      or new.idempotency_key is distinct from old.idempotency_key
      or new.original_file_name is distinct from old.original_file_name
      or new.storage_object_path is distinct from old.storage_object_path
      or new.content_sha256 is distinct from old.content_sha256
      or new.campaign_reference is distinct from old.campaign_reference
      or new.valid_from is distinct from old.valid_from
      or new.valid_to is distinct from old.valid_to
      or new.extractor_provider is distinct from old.extractor_provider
      or new.extractor_model is distinct from old.extractor_model
      or new.prompt_version is distinct from old.prompt_version
      or new.schema_version is distinct from old.schema_version
      or new.metadata is distinct from old.metadata
      or new.legacy_import_id is distinct from old.legacy_import_id
    ) then
      raise exception using
        errcode = '55000',
        message = 'promoted or archived pricing_import_batches source identity is immutable';
    end if;

  elsif tg_table_name = 'pricing_import_rows' then
    if old.status::text = 'promoted' and (
      new.batch_id is distinct from old.batch_id
      or new.source_row_number is distinct from old.source_row_number
      or new.source_page is distinct from old.source_page
      or new.legacy_source_table is distinct from old.legacy_source_table
      or new.legacy_source_id is distinct from old.legacy_source_id
      or new.raw_text is distinct from old.raw_text
      or new.raw_payload is distinct from old.raw_payload
      or new.normalized_payload is distinct from old.normalized_payload
      or new.confidence_score is distinct from old.confidence_score
      or new.matched_product_id is distinct from old.matched_product_id
      or new.status is distinct from old.status
      or new.issue_codes is distinct from old.issue_codes
    ) then
      raise exception using
        errcode = '55000',
        message = 'promoted pricing_import_rows content and classification are immutable';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.set_pricing_updated_at()
from public, anon, authenticated, service_role;
revoke all on function public.prevent_pricing_audit_mutation()
from public, anon, authenticated, service_role;
revoke all on function public.prevent_published_pricing_delete()
from public, anon, authenticated, service_role;
revoke all on function public.prevent_published_pricing_identity_change()
from public, anon, authenticated, service_role;

create trigger product_public_prices_set_pricing_updated_at
before update on public.product_public_prices
for each row execute function public.set_pricing_updated_at();
create trigger financial_parameter_sets_set_pricing_updated_at
before update on public.financial_parameter_sets
for each row execute function public.set_pricing_updated_at();
create trigger commercial_policies_set_pricing_updated_at
before update on public.commercial_policies
for each row execute function public.set_pricing_updated_at();
create trigger commercial_policy_applications_set_pricing_updated_at
before update on public.commercial_policy_applications
for each row execute function public.set_pricing_updated_at();
create trigger commercial_policy_accumulators_set_pricing_updated_at
before update on public.commercial_policy_accumulators
for each row execute function public.set_pricing_updated_at();
create trigger pricing_import_batches_set_pricing_updated_at
before update on public.pricing_import_batches
for each row execute function public.set_pricing_updated_at();
create trigger pricing_import_rows_set_pricing_updated_at
before update on public.pricing_import_rows
for each row execute function public.set_pricing_updated_at();

create trigger pricing_audit_events_prevent_mutation
before update or delete on public.pricing_audit_events
for each row execute function public.prevent_pricing_audit_mutation();

create trigger product_public_prices_prevent_terminal_delete
before delete on public.product_public_prices
for each row execute function public.prevent_published_pricing_delete();
create trigger financial_parameter_sets_prevent_terminal_delete
before delete on public.financial_parameter_sets
for each row execute function public.prevent_published_pricing_delete();
create trigger commercial_policies_prevent_terminal_delete
before delete on public.commercial_policies
for each row execute function public.prevent_published_pricing_delete();
create trigger commercial_policy_accumulators_prevent_terminal_delete
before delete on public.commercial_policy_accumulators
for each row execute function public.prevent_published_pricing_delete();
create trigger pricing_import_batches_prevent_terminal_delete
before delete on public.pricing_import_batches
for each row execute function public.prevent_published_pricing_delete();
create trigger pricing_import_rows_prevent_terminal_delete
before delete on public.pricing_import_rows
for each row execute function public.prevent_published_pricing_delete();

create trigger product_public_prices_prevent_terminal_identity_change
before update on public.product_public_prices
for each row execute function public.prevent_published_pricing_identity_change();
create trigger financial_parameter_sets_prevent_terminal_identity_change
before update on public.financial_parameter_sets
for each row execute function public.prevent_published_pricing_identity_change();
create trigger commercial_policies_prevent_terminal_identity_change
before update on public.commercial_policies
for each row execute function public.prevent_published_pricing_identity_change();
create trigger commercial_policy_applications_prevent_terminal_identity_change
before update on public.commercial_policy_applications
for each row execute function public.prevent_published_pricing_identity_change();
create trigger commercial_policy_accumulators_prevent_terminal_identity_change
before update on public.commercial_policy_accumulators
for each row execute function public.prevent_published_pricing_identity_change();
create trigger commercial_policy_accumulator_items_prevent_terminal_mutation
before insert or update or delete on public.commercial_policy_accumulator_items
for each row execute function public.prevent_published_pricing_identity_change();
create trigger commercial_policy_accumulator_values_prevent_terminal_mutation
before insert or update or delete on public.commercial_policy_accumulator_values
for each row execute function public.prevent_published_pricing_identity_change();
create trigger pricing_import_batches_prevent_terminal_identity_change
before update on public.pricing_import_batches
for each row execute function public.prevent_published_pricing_identity_change();
create trigger pricing_import_rows_prevent_terminal_identity_change
before update on public.pricing_import_rows
for each row execute function public.prevent_published_pricing_identity_change();
