create or replace function public.validate_commercial_policy_for_publication(p_policy_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  policy_record public.commercial_policies%rowtype;
  base_price_amount numeric;
  reference_rate numeric;
  promotional_rate numeric;
  promotional_payment numeric;
  promotional_present_value numeric;
  expected_financing_benefit numeric;
begin
  select * into policy_record
    from public.commercial_policies
   where id = p_policy_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'commercial policy does not exist';
  end if;
  if not exists (select 1 from public.products where id = policy_record.product_id) then
    raise exception using errcode = '23514', message = 'commercial policy requires an existing product';
  end if;
  if policy_record.ends_on is not null and policy_record.ends_on < policy_record.starts_on then
    raise exception using errcode = '23514', message = 'commercial policy period is invalid';
  end if;
  if policy_record.customer_benefit_amount is null or policy_record.customer_benefit_amount <= 0 then
    raise exception using errcode = '23514', message = 'published commercial policy requires a positive customer benefit amount';
  end if;

  if policy_record.source_import_row_id is not null then
    if not exists (
      select 1 from public.pricing_import_rows as import_row
       where import_row.id = policy_record.source_import_row_id
    ) or not exists (
      select 1 from public.pricing_import_row_outputs as output
       where output.import_row_id = policy_record.source_import_row_id
         and output.policy_id = policy_record.id
    ) then
      raise exception using errcode = '23514', message = 'commercial policy batch source and output are inconsistent';
    end if;
  elsif exists (
    select 1 from public.pricing_import_row_outputs as output
     where output.policy_id = policy_record.id
  ) then
    raise exception using errcode = '23514', message = 'commercial policy output requires source_import_row_id';
  end if;

  if policy_record.calculation_base_price_id is not null then
    select price.amount into base_price_amount
      from public.product_public_prices as price
     where price.id = policy_record.calculation_base_price_id
       and price.product_id = policy_record.product_id
       and price.status = 'published'
       and price.amount > 0
       and price.currency_code = 'BRL'
       and (price.price_type is null or price.price_type = 'msrp')
       and price.starts_on <= policy_record.starts_on
       and (
         price.ends_on is null
         or (policy_record.ends_on is not null and price.ends_on >= policy_record.ends_on)
       );
    if not found then
      raise exception using errcode = '23514', message = 'commercial policy requires a compatible published MSRP';
    end if;
  end if;

  if (policy_record.dealer_rebate_amount is null) is distinct from
     (policy_record.dealer_rebate_allocation_method is null) then
    raise exception using errcode = '23514', message = 'dealer rebate amount and allocation method must be set together';
  end if;
  if policy_record.dealer_rebate_amount is not null and (
       policy_record.dealer_rebate_amount <= 0
       or policy_record.policy_type::text not in ('retail_bonus', 'trade_in_bonus', 'subsidized_financing')
       or policy_record.dealer_rebate_allocation_method::text not in ('explicit_legacy_component', 'proportional_legacy_total')
     ) then
    raise exception using errcode = '23514', message = 'dealer rebate allocation is not publishable';
  end if;

  if policy_record.policy_type::text in (
    'retail_bonus', 'trade_in_bonus', 'loyalty_bonus', 'free_wallbox', 'free_maintenance'
  ) then
    if policy_record.calculation_method::text <> 'fixed_amount'
       or policy_record.fixed_amount is null
       or policy_record.fixed_amount <= 0
       or policy_record.customer_benefit_amount is distinct from policy_record.fixed_amount then
      raise exception using errcode = '23514', message = 'fixed commercial policy is not publishable';
    end if;
  elsif policy_record.policy_type::text = 'free_ipva' then
    if policy_record.calculation_method::text <> 'proportional_ipva'
       or policy_record.annual_rate is null or policy_record.annual_rate <= 0 or policy_record.annual_rate > 1
       or policy_record.calculation_base_price_id is null
       or policy_record.offer_month is null or policy_record.offer_month not between 1 and 12
       or policy_record.remaining_months is null or policy_record.remaining_months <> 13 - policy_record.offer_month
       or policy_record.customer_benefit_amount is distinct from
          round(base_price_amount * policy_record.annual_rate * policy_record.remaining_months / 12, 2) then
      raise exception using errcode = '23514', message = 'proportional IPVA policy is not publishable';
    end if;
  elsif policy_record.policy_type::text = 'free_insurance' then
    if policy_record.calculation_method::text <> 'percentage_of_msrp'
       or policy_record.coverage_years is null or policy_record.coverage_years <= 0
       or policy_record.annual_rate is null or policy_record.annual_rate <= 0 or policy_record.annual_rate > 1
       or policy_record.calculation_base_price_id is null
       or policy_record.customer_benefit_amount is distinct from
          round(base_price_amount * policy_record.annual_rate * policy_record.coverage_years, 2) then
      raise exception using errcode = '23514', message = 'insurance policy is not publishable';
    end if;
  elsif policy_record.policy_type::text = 'subsidized_financing' then
    if policy_record.calculation_method::text <> 'discounted_promotional_cash_flow_difference'
       or policy_record.term_months is null or policy_record.term_months <= 0
       or policy_record.customer_interest_rate_monthly is null or policy_record.customer_interest_rate_monthly < 0
       or policy_record.down_payment_percentage is null
       or policy_record.down_payment_percentage < 0 or policy_record.down_payment_percentage >= 100
       or policy_record.financed_principal is null or policy_record.financed_principal <= 0
       or policy_record.financial_parameter_set_id is null
       or policy_record.calculation_base_price_id is null then
      raise exception using errcode = '23514', message = 'financing policy is not publishable';
    end if;
    if policy_record.financed_principal is distinct from
       round(base_price_amount * (1 - policy_record.down_payment_percentage / 100), 2) then
      raise exception using errcode = '23514', message = 'financing principal does not match MSRP and down payment';
    end if;
    select coalesce(
             parameter_set.monthly_reference_rate,
             (parameter_set.cdi_monthly_percentage + parameter_set.spread_monthly_percentage) / 100
           ) into reference_rate
      from public.financial_parameter_sets as parameter_set
     where parameter_set.id = policy_record.financial_parameter_set_id
       and parameter_set.status = 'published'
       and coalesce(
             parameter_set.monthly_reference_rate,
             (parameter_set.cdi_monthly_percentage + parameter_set.spread_monthly_percentage) / 100
           ) >= 0
       and parameter_set.effective_from <= policy_record.starts_on
       and (
         parameter_set.valid_to is null
         or (policy_record.ends_on is not null and parameter_set.valid_to >= policy_record.ends_on)
       );
    if not found then
      raise exception using errcode = '23514', message = 'financing requires compatible published financial parameters';
    end if;
    promotional_rate := policy_record.customer_interest_rate_monthly / 100;
    promotional_payment := case
      when promotional_rate = 0 then policy_record.financed_principal / policy_record.term_months
      else policy_record.financed_principal * promotional_rate
        * power(1 + promotional_rate, policy_record.term_months)
        / (power(1 + promotional_rate, policy_record.term_months) - 1)
    end;
    promotional_present_value := case
      when reference_rate = 0 then promotional_payment * policy_record.term_months
      else promotional_payment
        * (1 - power(1 + reference_rate, -policy_record.term_months)) / reference_rate
    end;
    expected_financing_benefit := round(policy_record.financed_principal - promotional_present_value, 2);
    if expected_financing_benefit <= 0
       or policy_record.customer_benefit_amount is distinct from expected_financing_benefit then
      raise exception using errcode = '23514', message = 'financing benefit does not match the approved calculation';
    end if;
  elsif policy_record.policy_type::text = 'free_registration' then
    if policy_record.calculation_method::text <> 'percentage_of_msrp'
       or policy_record.percentage_rate is distinct from 0.01
       or policy_record.calculation_base_price_id is null
       or policy_record.fixed_amount is not null
       or policy_record.customer_benefit_amount is distinct from round(base_price_amount * 0.01, 2) then
      raise exception using errcode = '23514', message = 'registration policy must equal one percent of its MSRP';
    end if;
  elsif policy_record.policy_type::text = 'fuel_or_recharge_voucher' then
    if policy_record.calculation_method::text <> 'fixed_amount'
       or policy_record.fixed_amount is null
       or policy_record.fixed_amount <= 0
       or policy_record.customer_benefit_amount is distinct from policy_record.fixed_amount
       or policy_record.voucher_type is null
       or policy_record.voucher_type not in ('fuel', 'electric_recharge', 'unspecified') then
      raise exception using errcode = '23514', message = 'voucher policy is not publishable';
    end if;
  elsif policy_record.policy_type::text = 'other' then
    if policy_record.calculation_method::text <> 'fixed_amount'
       or policy_record.fixed_amount is null
       or policy_record.fixed_amount <= 0
       or policy_record.customer_benefit_amount is distinct from policy_record.fixed_amount
       or (
         policy_record.legacy_policy_source is distinct from 'others_bonus'
         and nullif(btrim(policy_record.description), '') is null
       ) then
      raise exception using errcode = '23514', message = 'other policy is not publishable';
    end if;
  else
    raise exception using errcode = '23514', message = 'deprecated or unsupported policy type is not publishable';
  end if;
end;
$$;


create or replace function public.create_manual_policy_batch(p_rows jsonb,p_actor_id uuid,p_correlation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare r jsonb; n integer:=0; total integer; batch_id bigint; import_row_id bigint; policy_id bigint;
  product_id integer; policy_type text; starts_on date; ends_on date; base_price numeric; benefit numeric;
  method public.policy_calculation_method; fixed numeric; annual numeric; years numeric; offer_month integer; remaining integer;
  term integer; customer_rate numeric; down_payment numeric; principal numeric; parameter_id bigint; reference_rate numeric; payment numeric; pv numeric;
  ids jsonb:='[]'::jsonb; client_id text; description text; parameters jsonb;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or pg_catalog.jsonb_typeof(p_rows)<>'array' then raise exception using errcode='22023',message='invalid manual policy batch'; end if;
  total:=pg_catalog.jsonb_array_length(p_rows); if total<1 or total>100 then raise exception using errcode='22023',message='manual policy batch requires between 1 and 100 rows'; end if;
  if exists(select 1 from pg_catalog.jsonb_array_elements(p_rows) x(v) group by v->>'clientRowId' having count(*)>1) then raise exception using errcode='23505',message='duplicate clientRowId'; end if;
  if exists(select 1 from pg_catalog.jsonb_array_elements(p_rows) x(v) group by v-'clientRowId' having count(*)>1) then raise exception using errcode='23505',message='duplicate policy fingerprint'; end if;
  insert into public.pricing_import_batches(source_type,idempotency_key,schema_version,status,metadata,created_by,updated_by)
  values('manual','manual-policy-batch:'||p_correlation_id,'manual-policy-batch/1','uploaded',pg_catalog.jsonb_build_object('kind','manual_policy_batch','rowCount',total,'correlationId',p_correlation_id),p_actor_id,p_actor_id) returning id into batch_id;
  for r in select value from pg_catalog.jsonb_array_elements(p_rows) loop
    n:=n+1; client_id:=pg_catalog.btrim(r->>'clientRowId'); product_id:=(r->>'productId')::integer; policy_type:=r->>'policyType';
    if client_id!~'^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$' or policy_type not in('retail_bonus','trade_in_bonus','loyalty_bonus','subsidized_financing','free_ipva','free_insurance','free_wallbox','free_registration','free_maintenance','fuel_or_recharge_voucher','other') then raise exception using errcode='22023',message='invalid manual policy row'; end if;
    if nullif(pg_catalog.btrim(r->>'title'),'') is null then raise exception using errcode='22023',message='policy title is required'; end if;
    starts_on:=(r->>'startsOn')::date; ends_on:=nullif(r->>'endsOn','')::date; if ends_on<starts_on then raise exception using errcode='22023',message='invalid policy period'; end if;
    if not exists(select 1 from public.products p where p.id=product_id) then raise exception using errcode='23503',message='unknown policy product'; end if;
    description:=nullif(pg_catalog.btrim(r->>'description'),''); parameters:='{}'::jsonb; fixed:=null; annual:=null; years:=null;offer_month:=null;remaining:=null;term:=null;customer_rate:=null;down_payment:=null;principal:=null;parameter_id:=null;base_price:=null;
    if policy_type in('retail_bonus','trade_in_bonus','loyalty_bonus','free_wallbox','free_maintenance','fuel_or_recharge_voucher','other') then
      fixed:=(r->>'amount')::numeric; benefit:=fixed; method:='fixed_amount'; if fixed<=0 then raise exception using errcode='22023',message='fixed benefit must be positive'; end if;
      if policy_type='other' and description is null then raise exception using errcode='22023',message='other policy description is required'; end if;
      if policy_type='fuel_or_recharge_voucher' and coalesce(r->>'voucherType','') not in('fuel','electric_recharge','unspecified') then raise exception using errcode='22023',message='invalid voucher type'; end if;
      if policy_type='free_maintenance' then parameters:=pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('maintenanceCount',nullif(r->>'maintenanceCount','')::integer,'coverageMonths',nullif(r->>'coverageMonths','')::integer,'coverageKm',nullif(r->>'coverageKm','')::numeric)); end if;
    else
      select p.amount into base_price from public.product_public_prices p where p.id=(r->>'calculationBasePriceId')::bigint and p.product_id=product_id and p.status='published' and p.currency_code='BRL' and p.amount>0 and (p.price_type is null or p.price_type='msrp') and p.starts_on<=starts_on and (p.ends_on is null or (ends_on is null and p.ends_on>=starts_on) or (ends_on is not null and p.ends_on>=ends_on));
      if not found then raise exception using errcode='23514',message='compatible published MSRP is required'; end if;
      if policy_type='free_registration' then method:='percentage_of_msrp';benefit:=pg_catalog.round(base_price*.01,2);
      elsif policy_type='free_ipva' then method:='proportional_ipva';annual:=(r->>'annualRate')::numeric;offer_month:=(r->>'offerMonth')::integer;remaining:=13-offer_month;if annual<=0 or annual>1 or offer_month not between 1 and 12 then raise exception using errcode='22023',message='invalid IPVA parameters';end if;benefit:=pg_catalog.round(base_price*annual*remaining/12,2);
      elsif policy_type='free_insurance' then method:='percentage_of_msrp';annual:=(r->>'annualRate')::numeric;years:=(r->>'coverageYears')::numeric;if annual<=0 or annual>1 or years<=0 then raise exception using errcode='22023',message='invalid insurance parameters';end if;benefit:=pg_catalog.round(base_price*annual*years,2);
      else method:='discounted_promotional_cash_flow_difference';term:=(r->>'termMonths')::integer;customer_rate:=(r->>'customerInterestRateMonthly')::numeric;down_payment:=(r->>'downPaymentPercentage')::numeric;
        select f.id,f.monthly_reference_rate into parameter_id,reference_rate from public.financial_parameter_sets f where f.status='published' and f.effective_from<=starts_on and (f.valid_to is null or (ends_on is not null and f.valid_to>=ends_on));
        if not found or term<=0 or customer_rate<0 or down_payment<0 or down_payment>=100 then raise exception using errcode='23514',message='compatible financial reference is required';end if;
        principal:=pg_catalog.round(base_price*(1-down_payment/100),2);customer_rate:=customer_rate/100;payment:=case when customer_rate=0 then principal/term else principal*customer_rate*pg_catalog.power(1+customer_rate,term)/(pg_catalog.power(1+customer_rate,term)-1) end;pv:=case when reference_rate=0 then payment*term else payment*(1-pg_catalog.power(1+reference_rate,-term))/reference_rate end;benefit:=pg_catalog.round(principal-pv,2);
      end if;
    end if;
    if benefit<=0 or benefit is distinct from (r->>'customerBenefitAmount')::numeric then raise exception using errcode='23514',message='server calculated benefit mismatch';end if;
    insert into public.pricing_import_rows(batch_id,source_row_number,raw_payload,normalized_payload,matched_product_id,status,created_by,updated_by) values(batch_id,n,r,r,product_id,'approved',p_actor_id,p_actor_id) returning id into import_row_id;
    insert into public.commercial_policies(product_id,policy_type,scope_type,scope_snapshot,title,description,starts_on,ends_on,calculation_method,financial_parameter_set_id,status,source_type,source_import_row_id,created_by,updated_by,calculation_base_price_id,customer_benefit_amount,fixed_amount,percentage_rate,voucher_type,policy_parameters,annual_rate,coverage_years,remaining_months,offer_month,financed_principal,down_payment_percentage,term_months,customer_interest_rate_monthly)
    values(product_id,policy_type::public.commercial_policy_type,'product_set',pg_catalog.jsonb_build_object('productId',product_id),pg_catalog.btrim(r->>'title'),description,starts_on,ends_on,method,parameter_id,'draft','manual',import_row_id,p_actor_id,p_actor_id,nullif(r->>'calculationBasePriceId','')::bigint,benefit,fixed,case when policy_type='free_registration' then .01 else null end,nullif(r->>'voucherType',''),parameters,annual,years,remaining,offer_month,principal,down_payment,term,case when policy_type='subsidized_financing' then (r->>'customerInterestRateMonthly')::numeric else null end) returning id into policy_id;
    insert into public.pricing_import_row_outputs(import_row_id,policy_id,created_by) values(import_row_id,policy_id,p_actor_id);update public.pricing_import_rows set status='promoted',updated_by=p_actor_id where id=import_row_id;
    insert into public.pricing_audit_events(aggregate_type,aggregate_id,action,after_snapshot,reason,actor_id,correlation_id) values('commercial_policy',policy_id,'insert',pg_catalog.jsonb_build_object('id',policy_id,'status','draft','customerBenefitAmount',benefit),'manual policy batch',p_actor_id,p_correlation_id);ids:=ids||pg_catalog.jsonb_build_array(policy_id);
  end loop;
  update public.pricing_import_batches set status='promoted',promoted_at=pg_catalog.now(),promoted_by=p_actor_id,updated_by=p_actor_id where id=batch_id;
  insert into public.pricing_audit_events(aggregate_type,aggregate_id,action,after_snapshot,reason,actor_id,correlation_id) values('pricing_import_batch',batch_id,'promote',pg_catalog.jsonb_build_object('rowCount',total),'manual policy batch persisted atomically as drafts',p_actor_id,p_correlation_id);
  return pg_catalog.jsonb_build_object('batchId',batch_id,'createdCount',total,'policyIds',ids);
end;$$;
alter function public.create_manual_policy_batch(jsonb,uuid,uuid) owner to postgres;
revoke all on function public.create_manual_policy_batch(jsonb,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_manual_policy_batch(jsonb,uuid,uuid) to service_role;


create or replace function public.create_commercial_offer_batch(
  p_rows jsonb,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  row_value jsonb;
  resolved_rows jsonb := '[]'::jsonb;
  created_offers jsonb := '[]'::jsonb;
  client_ids text[] := '{}';
  fingerprints text[] := '{}';
  client_id text;
  product_id integer;
  locked_product_id integer;
  policy_ids bigint[];
  policy_count integer;
  type_count integer;
  valid_from date;
  valid_to date;
  price_count integer;
  public_price_id bigint;
  public_price_amount numeric(14,2);
  public_price_ends_on date;
  benefit_amount numeric(14,2);
  fingerprint text;
  offer_id_value bigint;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode='22023', message='invalid commercial offer batch';
  end if;
  if pg_catalog.jsonb_array_length(p_rows) < 1 or pg_catalog.jsonb_array_length(p_rows) > 100 then
    raise exception using errcode='22023', message='commercial offer batch requires between 1 and 100 rows';
  end if;

  -- A stable Product-scoped lock order protects duplicate detection without deadlocks.
  for locked_product_id in
    select distinct (item.value->>'productId')::integer
      from pg_catalog.jsonb_array_elements(p_rows) as item(value)
     order by 1
  loop
    perform pg_catalog.pg_advisory_xact_lock(9049, locked_product_id);
  end loop;

  -- Resolve and validate every row before the first persistent write.
  for row_value in select value from pg_catalog.jsonb_array_elements(p_rows)
  loop
    client_id := pg_catalog.btrim(row_value->>'clientRowId');
    if client_id is null or client_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'
       or client_id = any(client_ids) then
      raise exception using errcode='22023', message='invalid or duplicate clientRowId';
    end if;
    client_ids := pg_catalog.array_append(client_ids, client_id);
    product_id := (row_value->>'productId')::integer;
    if not exists (select 1 from public.products as product where product.id=product_id) then
      raise exception using errcode='23503', message='unknown offer product';
    end if;
    if pg_catalog.jsonb_typeof(row_value->'policyIds') <> 'array'
       or pg_catalog.jsonb_array_length(row_value->'policyIds') < 1 then
      raise exception using errcode='22023', message='combination requires at least one policy';
    end if;
    select pg_catalog.array_agg((item.value #>> '{}')::bigint order by (item.value #>> '{}')::bigint)
      into policy_ids
      from pg_catalog.jsonb_array_elements(row_value->'policyIds') as item(value);
    if pg_catalog.cardinality(policy_ids) <> (
      select count(distinct selected_id) from pg_catalog.unnest(policy_ids) as selected(selected_id)
    ) then
      raise exception using errcode='23505', message='combination policy IDs must be unique';
    end if;

    perform policy.id
      from public.commercial_policies as policy
     where policy.id=any(policy_ids)
     order by policy.id
     for key share;
    select count(*), count(distinct policy.policy_type), max(policy.starts_on),
           coalesce(sum(policy.customer_benefit_amount), 0)
      into policy_count, type_count, valid_from, benefit_amount
      from public.commercial_policies as policy
     where policy.id=any(policy_ids)
       and policy.product_id=product_id
       and policy.status in ('draft','needs_review','published')
       and policy.policy_type::text in (
         'retail_bonus','trade_in_bonus','loyalty_bonus','subsidized_financing',
         'free_ipva','free_insurance','free_wallbox','free_registration',
         'free_maintenance','fuel_or_recharge_voucher','other'
       );
    if policy_count <> pg_catalog.cardinality(policy_ids) then
      raise exception using errcode='23514', message='combination contains an unknown or incompatible policy';
    end if;
    if type_count <> policy_count then
      raise exception using errcode='23514', message='combination contains more than one policy of the same type';
    end if;

    select count(*), min(price.id), min(price.amount), min(price.ends_on)
      into price_count, public_price_id, public_price_amount, public_price_ends_on
      from public.product_public_prices as price
     where price.product_id=product_id
       and price.status='published'
       and price.currency_code='BRL'
       and price.amount>0
       and (price.price_type is null or price.price_type='msrp')
       and price.starts_on<=valid_from
       and (price.ends_on is null or price.ends_on>=valid_from);
    if price_count=0 then
      raise exception using errcode='23514', message='Nenhum MSRP publicado Ã© compatÃ­vel com o inÃ­cio derivado.';
    elsif price_count>1 then
      raise exception using errcode='23514', message='Mais de um MSRP publicado Ã© compatÃ­vel com o inÃ­cio derivado.';
    end if;
    perform 1 from public.product_public_prices where id=public_price_id for key share;

    select min(candidate.end_date) into valid_to
      from (
        select policy.ends_on as end_date
          from public.commercial_policies as policy
         where policy.id=any(policy_ids) and policy.ends_on is not null
        union all
        select public_price_ends_on where public_price_ends_on is not null
      ) as candidate;
    if valid_to is null then
      raise exception using errcode='23514',
        message='NÃ£o foi possÃ­vel derivar uma vigÃªncia final concreta: as polÃ­ticas e o preÃ§o pÃºblico selecionado nÃ£o possuem data final.';
    end if;
    if valid_to < valid_from then
      raise exception using errcode='23514', message='As polÃ­ticas selecionadas nÃ£o possuem interseÃ§Ã£o temporal vÃ¡lida.';
    end if;
    if benefit_amount > public_price_amount then
      raise exception using errcode='23514', message='commercial offer benefit cannot exceed its public price';
    end if;

    fingerprint := product_id::text || ':' || pg_catalog.array_to_string(policy_ids, ',');
    if fingerprint=any(fingerprints) then
      raise exception using errcode='23505', message='the same combination appears more than once in the batch';
    end if;
    fingerprints := pg_catalog.array_append(fingerprints, fingerprint);
    if exists (
      select 1 from public.commercial_offers as offer
       where offer.product_id=product_id and offer.status='draft'
         and (select pg_catalog.array_agg(membership.commercial_policy_id order by membership.commercial_policy_id)
                from public.commercial_offer_policies as membership
               where membership.commercial_offer_id=offer.id)=policy_ids
    ) then
      raise exception using errcode='23505', message='an identical draft commercial offer already exists';
    end if;
    resolved_rows := resolved_rows || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'clientRowId', client_id, 'productId', product_id, 'policyIds', policy_ids,
      'publicPriceId', public_price_id, 'publicPriceAmount', public_price_amount,
      'validFrom', valid_from, 'validTo', valid_to, 'benefitAmount', benefit_amount
    ));
  end loop;

  for row_value in select value from pg_catalog.jsonb_array_elements(resolved_rows)
  loop
    client_id:=row_value->>'clientRowId'; product_id:=(row_value->>'productId')::integer;
    public_price_id:=(row_value->>'publicPriceId')::bigint;
    public_price_amount:=(row_value->>'publicPriceAmount')::numeric;
    valid_from:=(row_value->>'validFrom')::date; valid_to:=(row_value->>'validTo')::date;
    benefit_amount:=(row_value->>'benefitAmount')::numeric;
    select pg_catalog.array_agg((item.value #>> '{}')::bigint order by (item.value #>> '{}')::bigint)
      into policy_ids from pg_catalog.jsonb_array_elements(row_value->'policyIds') as item(value);
    insert into public.commercial_offers(
      product_id,public_price_id,source_system,source_reference,valid_from,valid_to,
      status,blocking_issues,created_by,updated_by
    ) values (
      product_id,public_price_id,'manual','policy-combination:'||p_correlation_id::text||':'||client_id,
      valid_from,valid_to,'draft','[]'::jsonb,p_actor_id,p_actor_id
    ) returning id into offer_id_value;
    insert into public.commercial_offer_policies(commercial_offer_id,commercial_policy_id,created_by)
      select offer_id_value,selected_id,p_actor_id from pg_catalog.unnest(policy_ids) as selected(selected_id);
    insert into public.pricing_audit_events(
      aggregate_type,aggregate_id,action,after_snapshot,reason,actor_id,correlation_id
    ) values (
      'commercial_offer',offer_id_value,'insert',
      pg_catalog.jsonb_build_object(
        'id',offer_id_value,'productId',product_id,'publicPriceId',public_price_id,
        'validFrom',valid_from,'validTo',valid_to,'status','draft','policyIds',policy_ids,
        'benefitAmount',benefit_amount,'transactionalPrice',public_price_amount-benefit_amount
      ),'policy combination batch',p_actor_id,p_correlation_id
    );
    created_offers := created_offers || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'offerId',offer_id_value,'productId',product_id,'publicPriceId',public_price_id,
      'publicPriceAmount',public_price_amount::text,'validFrom',valid_from,'validTo',valid_to,
      'status','draft','policyIds',policy_ids,'lockVersion',1,
      'benefitAmount',benefit_amount::text,'transactionalPrice',(public_price_amount-benefit_amount)::text
    ));
  end loop;
  return pg_catalog.jsonb_build_object('createdCount',pg_catalog.jsonb_array_length(created_offers),'offers',created_offers);
end;
$$;
alter function public.create_commercial_offer_batch(jsonb,uuid,uuid) owner to postgres;
revoke all on function public.create_commercial_offer_batch(jsonb,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_commercial_offer_batch(jsonb,uuid,uuid) to service_role;
