create function public.assert_active_pricing_admin(p_actor_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_role public.app_role;
  actor_status public.user_status;
begin
  if p_actor_id is null then
    raise exception using
      errcode = '22004',
      message = 'pricing authorization failed: actor_id is required';
  end if;

  select profile.role, profile.status
    into actor_role, actor_status
    from public.profiles as profile
   where profile.id = p_actor_id;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'pricing authorization failed: actor does not exist';
  end if;

  if actor_role <> 'admin'::public.app_role then
    raise exception using
      errcode = '42501',
      message = 'pricing authorization failed: actor is not an admin';
  end if;

  if actor_status <> 'active'::public.user_status then
    raise exception using
      errcode = '42501',
      message = 'pricing authorization failed: actor is not active';
  end if;
end;
$$;

alter function public.assert_active_pricing_admin(uuid) owner to postgres;
revoke all on function public.assert_active_pricing_admin(uuid)
from public, anon, authenticated, service_role;

create function public.pricing_snapshot_decimal(
  p_snapshot jsonb,
  p_path text[],
  p_field_name text
)
returns numeric
language plpgsql
stable
strict
security invoker
set search_path = ''
as $$
declare
  decimal_text text;
begin
  decimal_text := p_snapshot #>> p_path;

  if decimal_text is null
     or decimal_text !~ '^-?[0-9]+([.][0-9]+)?$' then
    raise exception using
      errcode = '23514',
      message = pg_catalog.format(
        'pricing publication validation failed: snapshot field %s must be a decimal string',
        p_field_name
      );
  end if;

  return decimal_text::numeric;
end;
$$;

alter function public.pricing_snapshot_decimal(jsonb, text[], text) owner to postgres;
revoke all on function public.pricing_snapshot_decimal(jsonb, text[], text)
from public, anon, authenticated, service_role;

create function public.insert_pricing_publish_audit(
  p_aggregate_type text,
  p_aggregate_id bigint,
  p_before_snapshot jsonb,
  p_after_snapshot jsonb,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_aggregate_type not in (
    'product_public_price',
    'financial_parameter_set',
    'commercial_policy',
    'commercial_policy_accumulator'
  ) then
    raise exception using
      errcode = '22023',
      message = 'pricing audit validation failed: aggregate_type is not publishable';
  end if;

  if p_aggregate_id is null then
    raise exception using
      errcode = '22004',
      message = 'pricing audit validation failed: aggregate_id is required';
  end if;

  if p_actor_id is null then
    raise exception using
      errcode = '22004',
      message = 'pricing audit validation failed: actor_id is required';
  end if;

  if p_correlation_id is null then
    raise exception using
      errcode = '22004',
      message = 'pricing audit validation failed: correlation_id is required';
  end if;

  if p_before_snapshot is null or p_after_snapshot is null then
    raise exception using
      errcode = '22004',
      message = 'pricing audit validation failed: before and after snapshots are required';
  end if;

  if exists (
    select 1
      from public.pricing_audit_events as event
     where event.aggregate_type = p_aggregate_type
       and event.aggregate_id = p_aggregate_id
       and event.action = 'publish'::public.pricing_audit_action
       and event.correlation_id = p_correlation_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'pricing audit validation failed: duplicate publish event';
  end if;

  insert into public.pricing_audit_events (
    aggregate_type,
    aggregate_id,
    action,
    before_snapshot,
    after_snapshot,
    actor_id,
    correlation_id
  ) values (
    p_aggregate_type,
    p_aggregate_id,
    'publish',
    p_before_snapshot,
    p_after_snapshot,
    p_actor_id,
    p_correlation_id
  );
end;
$$;

alter function public.insert_pricing_publish_audit(text, bigint, jsonb, jsonb, uuid, uuid)
owner to postgres;
revoke all on function public.insert_pricing_publish_audit(text, bigint, jsonb, jsonb, uuid, uuid)
from public, anon, authenticated, service_role;

create function public.prevent_direct_pricing_publication()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status::text in ('published', 'archived')
     and (tg_op = 'INSERT' or old.status::text not in ('published', 'archived'))
     and current_user <> 'postgres' then
    raise exception using
      errcode = '42501',
      message = 'pricing publication failed: terminal transition requires a publication function';
  end if;

  return new;
end;
$$;

alter function public.prevent_direct_pricing_publication() owner to postgres;
revoke all on function public.prevent_direct_pricing_publication()
from public, anon, authenticated, service_role;

create function public.prevent_finalized_pricing_import_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_is_terminal boolean;
begin
  if tg_table_name = 'pricing_import_rows' then
    if tg_op = 'INSERT' then
      select batch.status::text in ('promoted', 'archived')
        into parent_is_terminal
        from public.pricing_import_batches as batch
       where batch.id = new.batch_id;
    elsif tg_op = 'DELETE' then
      select batch.status::text in ('promoted', 'archived')
        into parent_is_terminal
        from public.pricing_import_batches as batch
       where batch.id = old.batch_id;
    else
      select pg_catalog.bool_or(batch.status::text in ('promoted', 'archived'))
        into parent_is_terminal
        from public.pricing_import_batches as batch
       where batch.id in (old.batch_id, new.batch_id);
    end if;

    if coalesce(parent_is_terminal, false) then
      raise exception using
        errcode = '55000',
        message = 'pricing import integrity failed: rows of promoted or archived batches are immutable';
    end if;

  elsif tg_table_name = 'pricing_import_row_outputs' then
    if tg_op = 'INSERT' then
      select import_row.status::text = 'promoted'
        into parent_is_terminal
        from public.pricing_import_rows as import_row
       where import_row.id = new.import_row_id;
    elsif tg_op = 'DELETE' then
      select import_row.status::text = 'promoted'
        into parent_is_terminal
        from public.pricing_import_rows as import_row
       where import_row.id = old.import_row_id;
    else
      select pg_catalog.bool_or(import_row.status::text = 'promoted')
        into parent_is_terminal
        from public.pricing_import_rows as import_row
       where import_row.id in (old.import_row_id, new.import_row_id);
    end if;

    if coalesce(parent_is_terminal, false) then
      raise exception using
        errcode = '55000',
        message = 'pricing import integrity failed: outputs of promoted rows are immutable';
    end if;

  elsif tg_table_name = 'pricing_import_row_reviews' then
    if tg_op in ('UPDATE', 'DELETE') then
      raise exception using
        errcode = '55000',
        message = 'pricing import integrity failed: reviews are append-only';
    end if;

    select import_row.status::text = 'promoted'
      into parent_is_terminal
      from public.pricing_import_rows as import_row
     where import_row.id = new.import_row_id;

    if coalesce(parent_is_terminal, false) then
      raise exception using
        errcode = '55000',
        message = 'pricing import integrity failed: promoted rows cannot receive new reviews';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

alter function public.prevent_finalized_pricing_import_mutation() owner to postgres;
revoke all on function public.prevent_finalized_pricing_import_mutation()
from public, anon, authenticated, service_role;

create function public.validate_commercial_policy_application(
  p_policy_id bigint,
  p_application_id bigint,
  p_actor_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  policy_record public.commercial_policies%rowtype;
  application_record public.commercial_policy_applications%rowtype;
  price_record public.product_public_prices%rowtype;
  parameter_record public.financial_parameter_sets%rowtype;
  snapshot jsonb;
  expected_unrounded numeric;
  expected_monetary numeric;
  financed_principal numeric;
  customer_rate numeric;
  reference_rate numeric;
  customer_payment numeric;
  customer_present_value numeric;
  growth_factor numeric;
  expected_formula text;
begin
  select *
    into policy_record
    from public.commercial_policies as policy
   where policy.id = p_policy_id;

  select *
    into application_record
    from public.commercial_policy_applications as application
   where application.id = p_application_id
     and application.policy_id = p_policy_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'pricing policy validation failed: application does not exist';
  end if;

  snapshot := application_record.calculation_snapshot;

  if application_record.monetary_value <= 0 then
    raise exception using
      errcode = '23514',
      message = 'pricing policy validation failed: monetary_value must be positive';
  end if;

  if application_record.currency_code <> 'BRL' then
    raise exception using
      errcode = '23514',
      message = 'pricing policy validation failed: application currency must be BRL';
  end if;

  if pg_catalog.jsonb_typeof(snapshot) <> 'object' or snapshot = '{}'::jsonb then
    raise exception using
      errcode = '23514',
      message = 'pricing policy validation failed: calculation_snapshot must be a non-empty object';
  end if;

  if snapshot ->> 'schemaVersion' <> '1'
     or snapshot ->> 'ruleCode' <> policy_record.policy_type::text
     or snapshot ->> 'ruleVersion' <> '1.0.0'
     or snapshot ->> 'calculationMethod' <> policy_record.calculation_method::text
     or nullif(pg_catalog.btrim(snapshot ->> 'calculatedAt'), '') is null
     or snapshot ->> 'calculatedBy' <> p_actor_id::text
     or snapshot ->> 'currency' <> 'BRL'
     or pg_catalog.jsonb_typeof(snapshot -> 'inputs') <> 'object'
     or pg_catalog.jsonb_typeof(snapshot -> 'rounding') <> 'object'
     or snapshot #>> '{rounding,mode}' <> 'HALF_UP'
     or snapshot #>> '{rounding,scale}' <> '2'
     or pg_catalog.jsonb_typeof(snapshot -> 'assumptions') <> 'array' then
    raise exception using
      errcode = '23514',
      message = 'pricing policy validation failed: calculation_snapshot common contract is invalid';
  end if;

  if not (snapshot ? 'inputMonetaryValue') then
    raise exception using
      errcode = '23514',
      message = 'pricing policy validation failed: snapshot inputMonetaryValue is required';
  end if;

  if application_record.input_monetary_value is null then
    if snapshot -> 'inputMonetaryValue' <> 'null'::jsonb then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: snapshot inputMonetaryValue must be null';
    end if;
  elsif public.pricing_snapshot_decimal(
    snapshot,
    array['inputMonetaryValue'],
    'inputMonetaryValue'
  ) <> application_record.input_monetary_value then
    raise exception using
      errcode = '23514',
      message = 'pricing policy validation failed: snapshot inputMonetaryValue does not match';
  end if;

  if application_record.basis_public_price_id is null then
    if not (snapshot ? 'publicPrice') or snapshot -> 'publicPrice' <> 'null'::jsonb then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: snapshot publicPrice must be null';
    end if;
  else
    select *
      into price_record
      from public.product_public_prices as price
     where price.id = application_record.basis_public_price_id;

    if not found
       or price_record.product_id <> application_record.product_id
       or price_record.status <> 'published'::public.pricing_workflow_status then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: basis public price must be published for the same product';
    end if;

    if pg_catalog.jsonb_typeof(snapshot -> 'publicPrice') <> 'object'
       or public.pricing_snapshot_decimal(snapshot, array['publicPrice', 'id'], 'publicPrice.id') <> price_record.id
       or public.pricing_snapshot_decimal(snapshot, array['publicPrice', 'amount'], 'publicPrice.amount') <> price_record.amount
       or snapshot #>> '{publicPrice,startsOn}' <> price_record.starts_on::text then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: snapshot publicPrice does not match';
    end if;
  end if;

  if policy_record.policy_type in (
    'retail_bonus'::public.commercial_policy_type,
    'trade_in_bonus'::public.commercial_policy_type,
    'free_wallbox'::public.commercial_policy_type
  ) then
    if policy_record.calculation_method <> 'fixed_amount'::public.policy_calculation_method
       or application_record.input_monetary_value is null
       or application_record.input_monetary_value <= 0
       or application_record.monetary_value <> application_record.input_monetary_value then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: fixed amount policy fields are inconsistent';
    end if;
    expected_unrounded := application_record.input_monetary_value;
    expected_formula := 'input_monetary_value';

  elsif policy_record.policy_type = 'other'::public.commercial_policy_type then
    if policy_record.calculation_method <> 'manual_amount'::public.policy_calculation_method
       or nullif(pg_catalog.btrim(policy_record.description), '') is null
       or application_record.input_monetary_value is null
       or application_record.input_monetary_value <= 0
       or application_record.monetary_value <> application_record.input_monetary_value then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: manual amount policy fields are inconsistent';
    end if;
    expected_unrounded := application_record.input_monetary_value;
    expected_formula := 'input_monetary_value';

  elsif policy_record.policy_type in (
    'free_ipva'::public.commercial_policy_type,
    'registration'::public.commercial_policy_type
  ) then
    if policy_record.calculation_method <> 'percentage_of_msrp'::public.policy_calculation_method
       or application_record.input_monetary_value is not null
       or policy_record.benefit_percentage is null
       or policy_record.benefit_percentage <= 0
       or application_record.basis_public_price_id is null then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: percentage policy fields are inconsistent';
    end if;
    expected_unrounded := price_record.amount * policy_record.benefit_percentage / 100;
    expected_formula := 'MSRP * percentage / 100';

    if public.pricing_snapshot_decimal(
      snapshot,
      array['inputs', 'benefitPercentage'],
      'inputs.benefitPercentage'
    ) <> policy_record.benefit_percentage then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: snapshot benefit percentage does not match';
    end if;

  elsif policy_record.policy_type = 'free_insurance'::public.commercial_policy_type then
    if policy_record.calculation_method <> 'percentage_of_msrp'::public.policy_calculation_method
       or application_record.input_monetary_value is not null
       or policy_record.benefit_percentage is null
       or policy_record.benefit_percentage <= 0
       or policy_record.term_months is null
       or policy_record.term_months <= 0
       or application_record.basis_public_price_id is null then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: insurance policy fields are inconsistent';
    end if;
    expected_unrounded := price_record.amount * policy_record.benefit_percentage
      * policy_record.term_months / 1200;
    expected_formula := 'MSRP * percentage / 100 * term_months / 12';

    if public.pricing_snapshot_decimal(
      snapshot,
      array['inputs', 'benefitPercentage'],
      'inputs.benefitPercentage'
    ) <> policy_record.benefit_percentage
       or public.pricing_snapshot_decimal(
         snapshot,
         array['inputs', 'termMonths'],
         'inputs.termMonths'
       ) <> policy_record.term_months then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: snapshot insurance inputs do not match';
    end if;

  elsif policy_record.policy_type = 'subsidized_financing'::public.commercial_policy_type then
    if policy_record.calculation_method <> 'present_value_subsidy'::public.policy_calculation_method
       or application_record.input_monetary_value is not null
       or policy_record.down_payment_percentage is null
       or policy_record.down_payment_percentage < 0
       or policy_record.down_payment_percentage >= 100
       or policy_record.term_months is null
       or policy_record.term_months <= 0
       or policy_record.customer_interest_rate_monthly is null
       or policy_record.customer_interest_rate_monthly < 0
       or policy_record.financial_parameter_set_id is null
       or application_record.basis_public_price_id is null then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: financing policy fields are inconsistent';
    end if;

    select *
      into parameter_record
      from public.financial_parameter_sets as parameter_set
     where parameter_set.id = policy_record.financial_parameter_set_id;

    if not found
       or parameter_record.status <> 'published'::public.pricing_workflow_status then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: financing parameter set must be published';
    end if;

    customer_rate := policy_record.customer_interest_rate_monthly / 100;
    reference_rate := (
      parameter_record.cdi_monthly_percentage
      + parameter_record.spread_monthly_percentage
    ) / 100;
    financed_principal := price_record.amount
      * (1 - policy_record.down_payment_percentage / 100);

    if financed_principal <= 0 then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: financed principal must be positive';
    end if;

    if customer_rate = 0 then
      customer_payment := financed_principal / policy_record.term_months;
    else
      growth_factor := pg_catalog.power(1 + customer_rate, policy_record.term_months);
      customer_payment := financed_principal
        * customer_rate * growth_factor / (growth_factor - 1);
    end if;

    if reference_rate = 0 then
      customer_present_value := customer_payment * policy_record.term_months;
    else
      customer_present_value := customer_payment
        * (1 - pg_catalog.power(1 + reference_rate, -policy_record.term_months))
        / reference_rate;
    end if;

    expected_unrounded := financed_principal - customer_present_value;
    expected_formula := 'financed_principal - present_value_customer_payments';

    if expected_unrounded <= 0 then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: financing subsidy must be positive';
    end if;

    if public.pricing_snapshot_decimal(snapshot, array['inputs', 'downPaymentPercentage'], 'inputs.downPaymentPercentage')
         <> policy_record.down_payment_percentage
       or public.pricing_snapshot_decimal(snapshot, array['inputs', 'termMonths'], 'inputs.termMonths')
         <> policy_record.term_months
       or public.pricing_snapshot_decimal(snapshot, array['inputs', 'customerInterestRateMonthly'], 'inputs.customerInterestRateMonthly')
         <> policy_record.customer_interest_rate_monthly
       or pg_catalog.abs(
         public.pricing_snapshot_decimal(snapshot, array['inputs', 'financedPrincipal'], 'inputs.financedPrincipal')
         - financed_principal
       ) > 0.0000000001::numeric
       or pg_catalog.abs(
         public.pricing_snapshot_decimal(snapshot, array['inputs', 'customerPayment'], 'inputs.customerPayment')
         - customer_payment
       ) > 0.0000000001::numeric
       or pg_catalog.abs(
         public.pricing_snapshot_decimal(snapshot, array['inputs', 'referenceRateMonthly'], 'inputs.referenceRateMonthly')
         - reference_rate
       ) > 0.0000000001::numeric
       or pg_catalog.abs(
         public.pricing_snapshot_decimal(snapshot, array['inputs', 'customerPresentValue'], 'inputs.customerPresentValue')
         - customer_present_value
       ) > 0.0000000001::numeric
       or pg_catalog.jsonb_typeof(snapshot -> 'financialParameterSet') <> 'object'
       or public.pricing_snapshot_decimal(snapshot, array['financialParameterSet', 'id'], 'financialParameterSet.id')
         <> parameter_record.id
       or public.pricing_snapshot_decimal(snapshot, array['financialParameterSet', 'version'], 'financialParameterSet.version')
         <> parameter_record.version
       or public.pricing_snapshot_decimal(snapshot, array['financialParameterSet', 'cdiMonthlyPercentage'], 'financialParameterSet.cdiMonthlyPercentage')
         <> parameter_record.cdi_monthly_percentage
       or public.pricing_snapshot_decimal(snapshot, array['financialParameterSet', 'spreadMonthlyPercentage'], 'financialParameterSet.spreadMonthlyPercentage')
         <> parameter_record.spread_monthly_percentage then
      raise exception using
        errcode = '23514',
        message = 'pricing policy validation failed: snapshot financing inputs do not match';
    end if;
  else
    raise exception using
      errcode = '23514',
      message = 'pricing policy validation failed: policy type is unsupported';
  end if;

  if policy_record.policy_type <> 'subsidized_financing'::public.commercial_policy_type
     and (
       not (snapshot ? 'financialParameterSet')
       or snapshot -> 'financialParameterSet' <> 'null'::jsonb
     ) then
    raise exception using
      errcode = '23514',
      message = 'pricing policy validation failed: snapshot financialParameterSet must be null';
  end if;

  expected_monetary := pg_catalog.round(expected_unrounded, 2);

  if expected_monetary <> application_record.monetary_value
     or pg_catalog.abs(
       public.pricing_snapshot_decimal(snapshot, array['unroundedValue'], 'unroundedValue')
       - expected_unrounded
     ) > 0.0000000001::numeric
     or public.pricing_snapshot_decimal(snapshot, array['monetaryValue'], 'monetaryValue')
       <> application_record.monetary_value
     or snapshot ->> 'formula' <> expected_formula then
    raise exception using
      errcode = '23514',
      message = 'pricing policy validation failed: snapshot or monetary formula result does not match';
  end if;
end;
$$;

alter function public.validate_commercial_policy_application(bigint, bigint, uuid)
owner to postgres;
revoke all on function public.validate_commercial_policy_application(bigint, bigint, uuid)
from public, anon, authenticated, service_role;

create function public.publish_product_public_price(
  p_price_id bigint,
  p_actor_id uuid,
  p_expected_lock_version integer,
  p_correlation_id uuid
)
returns public.product_public_prices
language plpgsql
security definer
set search_path = ''
as $$
declare
  price_record public.product_public_prices%rowtype;
  before_snapshot jsonb;
  after_snapshot jsonb;
begin
  perform public.assert_active_pricing_admin(p_actor_id);

  if p_correlation_id is null then
    raise exception using
      errcode = '22004',
      message = 'pricing publication failed: correlation_id is required';
  end if;

  if p_expected_lock_version is null then
    raise exception using
      errcode = '22004',
      message = 'pricing publication failed: expected_lock_version is required';
  end if;

  select *
    into price_record
    from public.product_public_prices as price
   where price.id = p_price_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'pricing publication failed: product public price does not exist';
  end if;

  if price_record.status not in (
    'draft'::public.pricing_workflow_status,
    'needs_review'::public.pricing_workflow_status
  ) then
    raise exception using
      errcode = '55000',
      message = 'pricing publication failed: product public price is not publishable';
  end if;

  if price_record.lock_version <> p_expected_lock_version then
    raise exception using
      errcode = '40001',
      message = 'pricing publication failed: stale product public price lock_version';
  end if;

  if price_record.amount <= 0
     or price_record.currency_code <> 'BRL'
     or price_record.starts_on is null then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: product public price fields are invalid';
  end if;

  if not exists (
    select 1 from public.products as product where product.id = price_record.product_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'pricing publication failed: product does not exist';
  end if;

  if price_record.source_type <> 'manual'::public.pricing_source_type
     and (
       price_record.source_import_row_id is null
       or not exists (
         select 1
           from public.pricing_import_rows as import_row
          where import_row.id = price_record.source_import_row_id
       )
     ) then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: non-manual price source row is invalid';
  end if;

  if exists (
    select 1
      from public.product_public_prices as other_price
     where other_price.id <> price_record.id
       and other_price.product_id = price_record.product_id
       and other_price.starts_on = price_record.starts_on
       and other_price.status = 'published'::public.pricing_workflow_status
  ) then
    raise exception using
      errcode = '23505',
      message = 'pricing publication failed: published price already exists for product and starts_on';
  end if;

  before_snapshot := pg_catalog.jsonb_build_object(
    'id', price_record.id,
    'productId', price_record.product_id,
    'amount', price_record.amount::text,
    'currency', price_record.currency_code,
    'startsOn', price_record.starts_on,
    'status', price_record.status,
    'sourceType', price_record.source_type,
    'sourceImportRowId', price_record.source_import_row_id,
    'lockVersion', price_record.lock_version
  );

  update public.product_public_prices
     set reviewed_at = coalesce(reviewed_at, pg_catalog.now()),
         reviewed_by = coalesce(reviewed_by, p_actor_id),
         published_at = pg_catalog.now(),
         published_by = p_actor_id,
         updated_by = p_actor_id,
         status = 'published'
   where id = price_record.id
  returning * into price_record;

  after_snapshot := pg_catalog.jsonb_build_object(
    'id', price_record.id,
    'productId', price_record.product_id,
    'amount', price_record.amount::text,
    'currency', price_record.currency_code,
    'startsOn', price_record.starts_on,
    'status', price_record.status,
    'sourceType', price_record.source_type,
    'sourceImportRowId', price_record.source_import_row_id,
    'reviewedAt', price_record.reviewed_at,
    'reviewedBy', price_record.reviewed_by,
    'publishedAt', price_record.published_at,
    'publishedBy', price_record.published_by,
    'lockVersion', price_record.lock_version
  );

  perform public.insert_pricing_publish_audit(
    'product_public_price',
    price_record.id,
    before_snapshot,
    after_snapshot,
    p_actor_id,
    p_correlation_id
  );

  return price_record;
end;
$$;

alter function public.publish_product_public_price(bigint, uuid, integer, uuid)
owner to postgres;
revoke all on function public.publish_product_public_price(bigint, uuid, integer, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.publish_product_public_price(bigint, uuid, integer, uuid)
to service_role;

create function public.publish_financial_parameter_set(
  p_parameter_set_id bigint,
  p_actor_id uuid,
  p_expected_lock_version integer,
  p_correlation_id uuid
)
returns public.financial_parameter_sets
language plpgsql
security definer
set search_path = ''
as $$
declare
  parameter_record public.financial_parameter_sets%rowtype;
  before_snapshot jsonb;
  after_snapshot jsonb;
begin
  perform public.assert_active_pricing_admin(p_actor_id);

  if p_correlation_id is null then
    raise exception using
      errcode = '22004',
      message = 'pricing publication failed: correlation_id is required';
  end if;

  if p_expected_lock_version is null then
    raise exception using
      errcode = '22004',
      message = 'pricing publication failed: expected_lock_version is required';
  end if;

  select *
    into parameter_record
    from public.financial_parameter_sets as parameter_set
   where parameter_set.id = p_parameter_set_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'pricing publication failed: financial parameter set does not exist';
  end if;

  if parameter_record.status not in (
    'draft'::public.pricing_workflow_status,
    'needs_review'::public.pricing_workflow_status
  ) then
    raise exception using
      errcode = '55000',
      message = 'pricing publication failed: financial parameter set is not publishable';
  end if;

  if parameter_record.lock_version <> p_expected_lock_version then
    raise exception using
      errcode = '40001',
      message = 'pricing publication failed: stale financial parameter set lock_version';
  end if;

  if parameter_record.version <= 0
     or nullif(pg_catalog.btrim(parameter_record.name), '') is null
     or parameter_record.cdi_monthly_percentage not between 0 and 100
     or parameter_record.spread_monthly_percentage not between 0 and 100
     or pg_catalog.jsonb_typeof(parameter_record.source_snapshot) <> 'object' then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: financial parameter set fields are invalid';
  end if;

  if exists (
    select 1
      from public.financial_parameter_sets as other_parameter_set
     where other_parameter_set.id <> parameter_record.id
       and other_parameter_set.version = parameter_record.version
       and other_parameter_set.status = 'published'::public.pricing_workflow_status
  ) then
    raise exception using
      errcode = '23505',
      message = 'pricing publication failed: published financial parameter version already exists';
  end if;

  before_snapshot := pg_catalog.jsonb_build_object(
    'id', parameter_record.id,
    'version', parameter_record.version,
    'name', parameter_record.name,
    'effectiveFrom', parameter_record.effective_from,
    'cdiMonthlyPercentage', parameter_record.cdi_monthly_percentage::text,
    'spreadMonthlyPercentage', parameter_record.spread_monthly_percentage::text,
    'status', parameter_record.status,
    'sourceType', parameter_record.source_type,
    'sourceReference', parameter_record.source_reference,
    'lockVersion', parameter_record.lock_version
  );

  update public.financial_parameter_sets
     set published_at = pg_catalog.now(),
         published_by = p_actor_id,
         updated_by = p_actor_id,
         status = 'published'
   where id = parameter_record.id
  returning * into parameter_record;

  after_snapshot := pg_catalog.jsonb_build_object(
    'id', parameter_record.id,
    'version', parameter_record.version,
    'name', parameter_record.name,
    'effectiveFrom', parameter_record.effective_from,
    'cdiMonthlyPercentage', parameter_record.cdi_monthly_percentage::text,
    'spreadMonthlyPercentage', parameter_record.spread_monthly_percentage::text,
    'status', parameter_record.status,
    'sourceType', parameter_record.source_type,
    'sourceReference', parameter_record.source_reference,
    'publishedAt', parameter_record.published_at,
    'publishedBy', parameter_record.published_by,
    'lockVersion', parameter_record.lock_version
  );

  perform public.insert_pricing_publish_audit(
    'financial_parameter_set',
    parameter_record.id,
    before_snapshot,
    after_snapshot,
    p_actor_id,
    p_correlation_id
  );

  return parameter_record;
end;
$$;

alter function public.publish_financial_parameter_set(bigint, uuid, integer, uuid)
owner to postgres;
revoke all on function public.publish_financial_parameter_set(bigint, uuid, integer, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.publish_financial_parameter_set(bigint, uuid, integer, uuid)
to service_role;

create function public.publish_commercial_policy(
  p_policy_id bigint,
  p_actor_id uuid,
  p_expected_lock_version integer,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  policy_record public.commercial_policies%rowtype;
  application_record public.commercial_policy_applications%rowtype;
  before_snapshot jsonb;
  after_snapshot jsonb;
  application_summary jsonb;
  scope_product_count bigint;
  scope_distinct_count bigint;
begin
  perform public.assert_active_pricing_admin(p_actor_id);

  if p_correlation_id is null then
    raise exception using
      errcode = '22004',
      message = 'pricing publication failed: correlation_id is required';
  end if;

  if p_expected_lock_version is null then
    raise exception using
      errcode = '22004',
      message = 'pricing publication failed: expected_lock_version is required';
  end if;

  select *
    into policy_record
    from public.commercial_policies as policy
   where policy.id = p_policy_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'pricing publication failed: commercial policy does not exist';
  end if;

  if policy_record.status not in (
    'draft'::public.pricing_workflow_status,
    'needs_review'::public.pricing_workflow_status
  ) then
    raise exception using
      errcode = '55000',
      message = 'pricing publication failed: commercial policy is not publishable';
  end if;

  if policy_record.lock_version <> p_expected_lock_version then
    raise exception using
      errcode = '40001',
      message = 'pricing publication failed: stale commercial policy lock_version';
  end if;

  if policy_record.ends_on is not null and policy_record.ends_on < policy_record.starts_on then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: commercial policy period is invalid';
  end if;

  if pg_catalog.jsonb_typeof(policy_record.scope_snapshot) <> 'object'
     or pg_catalog.jsonb_typeof(policy_record.scope_snapshot -> 'productIds') <> 'array' then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: scope_snapshot productIds contract is invalid';
  end if;

  if exists (
    select 1
      from pg_catalog.jsonb_array_elements(policy_record.scope_snapshot -> 'productIds') as element(value)
     where pg_catalog.jsonb_typeof(element.value) <> 'number'
        or element.value::text !~ '^[1-9][0-9]*$'
  ) then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: scope_snapshot productIds must be positive integer numbers';
  end if;

  select count(*), count(distinct element.value::text)
    into scope_product_count, scope_distinct_count
    from pg_catalog.jsonb_array_elements(policy_record.scope_snapshot -> 'productIds') as element(value);

  if scope_product_count = 0 or scope_product_count <> scope_distinct_count then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: scope_snapshot productIds must be non-empty and distinct';
  end if;

  if not exists (
    select 1
      from public.commercial_policy_applications as application
     where application.policy_id = policy_record.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: commercial policy requires applications';
  end if;

  if exists (
    select 1
      from public.commercial_policy_applications as application
     where application.policy_id = policy_record.id
       and not exists (
         select 1
           from pg_catalog.jsonb_array_elements(policy_record.scope_snapshot -> 'productIds') as element(value)
          where element.value::text::integer = application.product_id
       )
  ) or exists (
    select 1
      from pg_catalog.jsonb_array_elements(policy_record.scope_snapshot -> 'productIds') as element(value)
     where not exists (
       select 1
         from public.commercial_policy_applications as application
        where application.policy_id = policy_record.id
          and application.product_id = element.value::text::integer
     )
  ) then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: scope_snapshot productIds must equal application products';
  end if;

  if policy_record.scope_type = 'model'::public.commercial_policy_scope_type
     and exists (
       select 1
         from public.commercial_policy_applications as application
         join public.products as product on product.id = application.product_id
        where application.policy_id = policy_record.id
          and (
            product.brand <> policy_record.model_brand
            or product.model <> policy_record.model_name
          )
     ) then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: model applications do not match model scope';
  end if;

  if policy_record.source_type <> 'manual'::public.pricing_source_type then
    if policy_record.source_import_row_id is null
       or not exists (
         select 1
           from public.pricing_import_rows as import_row
          where import_row.id = policy_record.source_import_row_id
       )
       or not exists (
         select 1
           from public.pricing_import_row_outputs as output
          where output.import_row_id = policy_record.source_import_row_id
            and output.policy_id = policy_record.id
       ) then
      raise exception using
        errcode = '23514',
        message = 'pricing publication failed: imported policy source and output are inconsistent';
    end if;
  elsif exists (
    select 1
      from public.pricing_import_row_outputs as output
     where output.policy_id = policy_record.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: manual policy cannot have an import output';
  end if;

  if exists (
    select 1
      from public.pricing_import_row_outputs as output
     where output.policy_id = policy_record.id
       and output.import_row_id is distinct from policy_record.source_import_row_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: policy output points to a different import row';
  end if;

  for application_record in
    select application.*
      from public.commercial_policy_applications as application
     where application.policy_id = policy_record.id
     order by application.id
  loop
    perform public.validate_commercial_policy_application(
      policy_record.id,
      application_record.id,
      p_actor_id
    );
  end loop;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', application.id,
      'productId', application.product_id,
      'basisPublicPriceId', application.basis_public_price_id,
      'inputMonetaryValue', case
        when application.input_monetary_value is null then null
        else application.input_monetary_value::text
      end,
      'monetaryValue', application.monetary_value::text,
      'currency', application.currency_code
    ) order by application.product_id, application.id
  )
    into application_summary
    from public.commercial_policy_applications as application
   where application.policy_id = policy_record.id;

  before_snapshot := pg_catalog.jsonb_build_object(
    'policy', pg_catalog.jsonb_build_object(
      'id', policy_record.id,
      'policyType', policy_record.policy_type,
      'scopeType', policy_record.scope_type,
      'scopeSnapshot', policy_record.scope_snapshot,
      'title', policy_record.title,
      'startsOn', policy_record.starts_on,
      'endsOn', policy_record.ends_on,
      'calculationMethod', policy_record.calculation_method,
      'status', policy_record.status,
      'lockVersion', policy_record.lock_version
    ),
    'applications', application_summary
  );

  update public.commercial_policies
     set reviewed_at = coalesce(reviewed_at, pg_catalog.now()),
         reviewed_by = coalesce(reviewed_by, p_actor_id),
         published_at = pg_catalog.now(),
         published_by = p_actor_id,
         updated_by = p_actor_id,
         status = 'published'
   where id = policy_record.id
  returning * into policy_record;

  after_snapshot := pg_catalog.jsonb_build_object(
    'policy', pg_catalog.jsonb_build_object(
      'id', policy_record.id,
      'policyType', policy_record.policy_type,
      'scopeType', policy_record.scope_type,
      'scopeSnapshot', policy_record.scope_snapshot,
      'title', policy_record.title,
      'startsOn', policy_record.starts_on,
      'endsOn', policy_record.ends_on,
      'calculationMethod', policy_record.calculation_method,
      'status', policy_record.status,
      'reviewedAt', policy_record.reviewed_at,
      'reviewedBy', policy_record.reviewed_by,
      'publishedAt', policy_record.published_at,
      'publishedBy', policy_record.published_by,
      'lockVersion', policy_record.lock_version
    ),
    'applications', application_summary
  );

  perform public.insert_pricing_publish_audit(
    'commercial_policy',
    policy_record.id,
    before_snapshot,
    after_snapshot,
    p_actor_id,
    p_correlation_id
  );

  return pg_catalog.jsonb_build_object(
    'policy', pg_catalog.to_jsonb(policy_record),
    'applications', (
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(application) order by application.product_id, application.id)
        from public.commercial_policy_applications as application
       where application.policy_id = policy_record.id
    )
  );
end;
$$;

alter function public.publish_commercial_policy(bigint, uuid, integer, uuid)
owner to postgres;
revoke all on function public.publish_commercial_policy(bigint, uuid, integer, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.publish_commercial_policy(bigint, uuid, integer, uuid)
to service_role;

create function public.publish_commercial_policy_accumulator(
  p_accumulator_id bigint,
  p_actor_id uuid,
  p_expected_lock_version integer,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  accumulator_record public.commercial_policy_accumulators%rowtype;
  member_count bigint;
  intersection_product_count bigint;
  canonical_fingerprint text;
  before_snapshot jsonb;
  after_snapshot jsonb;
  member_snapshot jsonb;
  value_snapshot jsonb;
  product_record record;
begin
  perform public.assert_active_pricing_admin(p_actor_id);

  if p_correlation_id is null then
    raise exception using
      errcode = '22004',
      message = 'pricing publication failed: correlation_id is required';
  end if;

  if p_expected_lock_version is null then
    raise exception using
      errcode = '22004',
      message = 'pricing publication failed: expected_lock_version is required';
  end if;

  select *
    into accumulator_record
    from public.commercial_policy_accumulators as accumulator
   where accumulator.id = p_accumulator_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'pricing publication failed: commercial policy accumulator does not exist';
  end if;

  if accumulator_record.status not in (
    'draft'::public.pricing_workflow_status,
    'needs_review'::public.pricing_workflow_status
  ) then
    raise exception using
      errcode = '55000',
      message = 'pricing publication failed: commercial policy accumulator is not publishable';
  end if;

  if accumulator_record.lock_version <> p_expected_lock_version then
    raise exception using
      errcode = '40001',
      message = 'pricing publication failed: stale commercial policy accumulator lock_version';
  end if;

  select count(*),
         'policy_ids:' || pg_catalog.string_agg(item.policy_id::text, ',' order by item.policy_id)
    into member_count, canonical_fingerprint
    from public.commercial_policy_accumulator_items as item
   where item.accumulator_id = accumulator_record.id;

  if member_count < 2 then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: accumulator requires at least two distinct policies';
  end if;

  if exists (
    select 1
      from public.commercial_policy_accumulator_items as item
      left join public.commercial_policies as policy on policy.id = item.policy_id
     where item.accumulator_id = accumulator_record.id
       and (
         policy.id is null
         or policy.status <> 'published'::public.pricing_workflow_status
       )
  ) then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: all accumulator members must be published';
  end if;

  if exists (
    select 1
      from public.commercial_policy_accumulator_items as item
      join public.commercial_policies as policy on policy.id = item.policy_id
     where item.accumulator_id = accumulator_record.id
       and (
         accumulator_record.starts_on < policy.starts_on
         or (
           policy.ends_on is not null
           and (
             accumulator_record.ends_on is null
             or accumulator_record.ends_on > policy.ends_on
           )
         )
       )
  ) then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: accumulator period is outside member intersection';
  end if;

  if exists (
    select 1
      from public.commercial_policy_accumulator_items as item
      join public.commercial_policy_applications as application
        on application.policy_id = item.policy_id
     where item.accumulator_id = accumulator_record.id
       and application.currency_code <> 'BRL'
  ) then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: accumulator applications must use BRL';
  end if;

  select count(*)
    into intersection_product_count
    from (
      select application.product_id
        from public.commercial_policy_accumulator_items as item
        join public.commercial_policy_applications as application
          on application.policy_id = item.policy_id
       where item.accumulator_id = accumulator_record.id
       group by application.product_id
      having count(distinct item.policy_id) = member_count
    ) as intersection_products;

  if intersection_product_count = 0 then
    raise exception using
      errcode = '23514',
      message = 'pricing publication failed: accumulator has no common product';
  end if;

  if exists (
    select 1
      from public.commercial_policy_accumulators as other_accumulator
     where other_accumulator.id <> accumulator_record.id
       and other_accumulator.status = 'published'::public.pricing_workflow_status
       and other_accumulator.combination_fingerprint = canonical_fingerprint
  ) then
    raise exception using
      errcode = '23505',
      message = 'pricing publication failed: published accumulator combination already exists';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'policyId', item.policy_id,
      'position', item.position
    ) order by item.policy_id
  )
    into member_snapshot
    from public.commercial_policy_accumulator_items as item
   where item.accumulator_id = accumulator_record.id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', accumulator_value.id,
        'productId', accumulator_value.product_id,
        'monetaryValue', accumulator_value.monetary_value::text,
        'currency', accumulator_value.currency_code
      ) order by accumulator_value.product_id
    ),
    '[]'::jsonb
  )
    into value_snapshot
    from public.commercial_policy_accumulator_values as accumulator_value
   where accumulator_value.accumulator_id = accumulator_record.id;

  before_snapshot := pg_catalog.jsonb_build_object(
    'accumulator', pg_catalog.jsonb_build_object(
      'id', accumulator_record.id,
      'title', accumulator_record.title,
      'startsOn', accumulator_record.starts_on,
      'endsOn', accumulator_record.ends_on,
      'combinationFingerprint', accumulator_record.combination_fingerprint,
      'status', accumulator_record.status,
      'lockVersion', accumulator_record.lock_version
    ),
    'members', member_snapshot,
    'values', value_snapshot
  );

  delete from public.commercial_policy_accumulator_values
   where accumulator_id = accumulator_record.id;

  for product_record in
    select application.product_id,
           pg_catalog.sum(application.monetary_value)::numeric(14,2) as total_value,
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'policyId', policy.id,
               'policyType', policy.policy_type,
               'applicationId', application.id,
               'monetaryValue', application.monetary_value::text
             ) order by policy.id
           ) as components
      from public.commercial_policy_accumulator_items as item
      join public.commercial_policies as policy on policy.id = item.policy_id
      join public.commercial_policy_applications as application
        on application.policy_id = item.policy_id
     where item.accumulator_id = accumulator_record.id
     group by application.product_id
    having count(distinct item.policy_id) = member_count
     order by application.product_id
  loop
    insert into public.commercial_policy_accumulator_values (
      accumulator_id,
      product_id,
      monetary_value,
      currency_code,
      calculation_snapshot,
      created_by,
      updated_by
    ) values (
      accumulator_record.id,
      product_record.product_id,
      product_record.total_value,
      'BRL',
      pg_catalog.jsonb_build_object(
        'schemaVersion', '1',
        'ruleCode', 'commercial_policy_accumulator',
        'ruleVersion', '1.0.0',
        'calculatedAt', pg_catalog.now(),
        'calculatedBy', p_actor_id,
        'currency', 'BRL',
        'components', product_record.components,
        'monetaryValue', product_record.total_value::text
      ),
      p_actor_id,
      p_actor_id
    );
  end loop;

  update public.commercial_policy_accumulators
     set combination_fingerprint = canonical_fingerprint,
         reviewed_at = coalesce(reviewed_at, pg_catalog.now()),
         reviewed_by = coalesce(reviewed_by, p_actor_id),
         published_at = pg_catalog.now(),
         published_by = p_actor_id,
         updated_by = p_actor_id,
         status = 'published'
   where id = accumulator_record.id
  returning * into accumulator_record;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', accumulator_value.id,
      'productId', accumulator_value.product_id,
      'monetaryValue', accumulator_value.monetary_value::text,
      'currency', accumulator_value.currency_code,
      'calculationSnapshot', accumulator_value.calculation_snapshot
    ) order by accumulator_value.product_id
  )
    into value_snapshot
    from public.commercial_policy_accumulator_values as accumulator_value
   where accumulator_value.accumulator_id = accumulator_record.id;

  after_snapshot := pg_catalog.jsonb_build_object(
    'accumulator', pg_catalog.jsonb_build_object(
      'id', accumulator_record.id,
      'title', accumulator_record.title,
      'startsOn', accumulator_record.starts_on,
      'endsOn', accumulator_record.ends_on,
      'combinationFingerprint', accumulator_record.combination_fingerprint,
      'status', accumulator_record.status,
      'reviewedAt', accumulator_record.reviewed_at,
      'reviewedBy', accumulator_record.reviewed_by,
      'publishedAt', accumulator_record.published_at,
      'publishedBy', accumulator_record.published_by,
      'lockVersion', accumulator_record.lock_version
    ),
    'members', member_snapshot,
    'values', value_snapshot
  );

  perform public.insert_pricing_publish_audit(
    'commercial_policy_accumulator',
    accumulator_record.id,
    before_snapshot,
    after_snapshot,
    p_actor_id,
    p_correlation_id
  );

  return pg_catalog.jsonb_build_object(
    'accumulator', pg_catalog.to_jsonb(accumulator_record),
    'members', member_snapshot,
    'values', value_snapshot
  );
end;
$$;

alter function public.publish_commercial_policy_accumulator(bigint, uuid, integer, uuid)
owner to postgres;
revoke all on function public.publish_commercial_policy_accumulator(bigint, uuid, integer, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.publish_commercial_policy_accumulator(bigint, uuid, integer, uuid)
to service_role;

create trigger product_public_prices_require_publication_function
before insert or update on public.product_public_prices
for each row execute function public.prevent_direct_pricing_publication();
create trigger financial_parameter_sets_require_publication_function
before insert or update on public.financial_parameter_sets
for each row execute function public.prevent_direct_pricing_publication();
create trigger commercial_policies_require_publication_function
before insert or update on public.commercial_policies
for each row execute function public.prevent_direct_pricing_publication();
create trigger commercial_policy_accumulators_require_publication_function
before insert or update on public.commercial_policy_accumulators
for each row execute function public.prevent_direct_pricing_publication();

create trigger pricing_import_rows_protect_finalized_batch
before insert or update or delete on public.pricing_import_rows
for each row execute function public.prevent_finalized_pricing_import_mutation();
create trigger pricing_import_row_outputs_protect_promoted_row
before insert or update or delete on public.pricing_import_row_outputs
for each row execute function public.prevent_finalized_pricing_import_mutation();
create trigger pricing_import_row_reviews_protect_history
before insert or update or delete on public.pricing_import_row_reviews
for each row execute function public.prevent_finalized_pricing_import_mutation();
