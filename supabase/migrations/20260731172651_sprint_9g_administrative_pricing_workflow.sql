create function public.update_commercial_policy_draft(
  p_policy_id bigint,
  p_expected_lock_version integer,
  p_changes jsonb,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns public.commercial_policies
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_record public.commercial_policies%rowtype;
  updated_record public.commercial_policies%rowtype;
  before_snapshot jsonb;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or p_expected_lock_version is null
     or pg_catalog.jsonb_typeof(p_changes) <> 'object' then
    raise exception using errcode='22023', message='invalid commercial policy update request';
  end if;
  select * into current_record from public.commercial_policies
   where id=p_policy_id for update;
  if not found then raise exception using errcode='P0002', message='commercial policy does not exist'; end if;
  if current_record.status <> 'draft' then
    raise exception using errcode='55000', message='only draft commercial policies are editable';
  end if;
  if current_record.lock_version <> p_expected_lock_version then
    raise exception using errcode='40001', message='commercial policy changed by another operator';
  end if;
  if exists (
    select 1 from public.commercial_offer_policies membership
    join public.commercial_offers offer on offer.id=membership.commercial_offer_id
    where membership.commercial_policy_id=p_policy_id and offer.status <> 'archived'
  ) then
    raise exception using errcode='55000',
      message='commercial policy is used by a non-archived commercial offer';
  end if;
  if p_changes - array[
    'title','description','startsOn','endsOn','customerBenefitAmount','fixedAmount',
    'calculationBasePriceId','financialParameterSetId','annualRate','coverageYears',
    'remainingMonths','offerMonth','financedPrincipal','downPaymentPercentage',
    'termMonths','customerInterestRateMonthly','voucherType','policyParameters'
  ] <> '{}'::jsonb then
    raise exception using errcode='22023', message='commercial policy update contains unsupported fields';
  end if;
  before_snapshot := pg_catalog.to_jsonb(current_record);
  update public.commercial_policies set
    title=coalesce(nullif(pg_catalog.btrim(p_changes->>'title'),''),title),
    description=case when p_changes ? 'description' then nullif(pg_catalog.btrim(p_changes->>'description'),'') else description end,
    starts_on=coalesce(nullif(p_changes->>'startsOn','')::date,starts_on),
    ends_on=case when p_changes ? 'endsOn' then nullif(p_changes->>'endsOn','')::date else ends_on end,
    customer_benefit_amount=coalesce(nullif(p_changes->>'customerBenefitAmount','')::numeric,customer_benefit_amount),
    fixed_amount=case when p_changes ? 'fixedAmount' then nullif(p_changes->>'fixedAmount','')::numeric else fixed_amount end,
    calculation_base_price_id=case when p_changes ? 'calculationBasePriceId' then nullif(p_changes->>'calculationBasePriceId','')::bigint else calculation_base_price_id end,
    financial_parameter_set_id=case when p_changes ? 'financialParameterSetId' then nullif(p_changes->>'financialParameterSetId','')::bigint else financial_parameter_set_id end,
    annual_rate=case when p_changes ? 'annualRate' then nullif(p_changes->>'annualRate','')::numeric else annual_rate end,
    coverage_years=case when p_changes ? 'coverageYears' then nullif(p_changes->>'coverageYears','')::numeric else coverage_years end,
    remaining_months=case when p_changes ? 'remainingMonths' then nullif(p_changes->>'remainingMonths','')::integer else remaining_months end,
    offer_month=case when p_changes ? 'offerMonth' then nullif(p_changes->>'offerMonth','')::integer else offer_month end,
    financed_principal=case when p_changes ? 'financedPrincipal' then nullif(p_changes->>'financedPrincipal','')::numeric else financed_principal end,
    down_payment_percentage=case when p_changes ? 'downPaymentPercentage' then nullif(p_changes->>'downPaymentPercentage','')::numeric else down_payment_percentage end,
    term_months=case when p_changes ? 'termMonths' then nullif(p_changes->>'termMonths','')::integer else term_months end,
    customer_interest_rate_monthly=case when p_changes ? 'customerInterestRateMonthly' then nullif(p_changes->>'customerInterestRateMonthly','')::numeric else customer_interest_rate_monthly end,
    voucher_type=case when p_changes ? 'voucherType' then nullif(p_changes->>'voucherType','') else voucher_type end,
    policy_parameters=case when p_changes ? 'policyParameters' then p_changes->'policyParameters' else policy_parameters end,
    updated_by=p_actor_id
  where id=p_policy_id returning * into updated_record;
  perform public.validate_commercial_policy_for_publication(p_policy_id);
  insert into public.pricing_audit_events(
    aggregate_type,aggregate_id,action,before_snapshot,after_snapshot,reason,actor_id,correlation_id
  ) values (
    'commercial_policy',p_policy_id,'update',before_snapshot,pg_catalog.to_jsonb(updated_record),
    'Sprint 9G administrative draft update',p_actor_id,p_correlation_id
  );
  return updated_record;
end;
$$;

create function public.archive_commercial_policy(
  p_policy_id bigint,
  p_expected_lock_version integer,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns public.commercial_policies
language plpgsql security definer set search_path = ''
as $$
declare current_record public.commercial_policies%rowtype; archived_record public.commercial_policies%rowtype;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or p_expected_lock_version is null then
    raise exception using errcode='22004', message='archive requires lock version and correlation id';
  end if;
  select * into current_record from public.commercial_policies where id=p_policy_id for update;
  if not found then raise exception using errcode='P0002', message='commercial policy does not exist'; end if;
  if current_record.status not in ('draft','published') then
    raise exception using errcode='55000', message='commercial policy status is not archivable';
  end if;
  if current_record.lock_version <> p_expected_lock_version then
    raise exception using errcode='40001', message='commercial policy changed by another operator';
  end if;
  if exists (select 1 from public.commercial_offer_policies membership join public.commercial_offers offer on offer.id=membership.commercial_offer_id where membership.commercial_policy_id=p_policy_id and offer.status<>'archived') then
    raise exception using errcode='55000', message='commercial policy is used by a non-archived commercial offer';
  end if;
  update public.commercial_policies set status='archived',updated_by=p_actor_id where id=p_policy_id returning * into archived_record;
  insert into public.pricing_audit_events(aggregate_type,aggregate_id,action,before_snapshot,after_snapshot,reason,actor_id,correlation_id)
  values('commercial_policy',p_policy_id,'archive',pg_catalog.to_jsonb(current_record),pg_catalog.to_jsonb(archived_record),'Sprint 9G administrative archive',p_actor_id,p_correlation_id);
  return archived_record;
end;
$$;

create function public.replace_commercial_offer_draft(
  p_offer_id bigint,
  p_expected_lock_version integer,
  p_policy_ids bigint[],
  p_actor_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  offer_record public.commercial_offers%rowtype; updated_offer public.commercial_offers%rowtype;
  normalized_ids bigint[]; policy_count integer; type_count integer; derived_from date; derived_to date;
  price_count integer; price_id bigint; price_amount numeric(14,2); price_ends date; benefit numeric(14,2);
  old_ids bigint[]; before_snapshot jsonb;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or p_expected_lock_version is null or pg_catalog.cardinality(p_policy_ids)<1 then
    raise exception using errcode='22023', message='invalid commercial offer replacement request';
  end if;
  select * into offer_record from public.commercial_offers where id=p_offer_id for update;
  if not found then raise exception using errcode='P0002', message='commercial offer does not exist'; end if;
  if offer_record.status<>'draft' then raise exception using errcode='55000', message='only draft commercial offers are editable'; end if;
  if offer_record.lock_version<>p_expected_lock_version then raise exception using errcode='40001', message='commercial offer changed by another operator'; end if;
  perform pg_catalog.pg_advisory_xact_lock(9049,offer_record.product_id);
  select pg_catalog.array_agg(id order by id) into normalized_ids from pg_catalog.unnest(p_policy_ids) selected(id);
  if pg_catalog.cardinality(normalized_ids)<>(select count(distinct id) from pg_catalog.unnest(normalized_ids) selected(id)) then
    raise exception using errcode='23505', message='commercial offer policy IDs must be unique';
  end if;
  perform policy.id from public.commercial_policies policy where policy.id=any(normalized_ids) order by policy.id for key share;
  select count(*),count(distinct policy_type),max(starts_on),coalesce(sum(customer_benefit_amount),0)
    into policy_count,type_count,derived_from,benefit from public.commercial_policies
   where id=any(normalized_ids) and product_id=offer_record.product_id
     and status in ('draft','needs_review','published') and policy_type::text in ('retail_bonus','trade_in_bonus','loyalty_bonus','subsidized_financing','free_ipva','free_insurance','free_wallbox','free_registration','free_maintenance','fuel_or_recharge_voucher','other');
  if policy_count<>pg_catalog.cardinality(normalized_ids) then raise exception using errcode='23514', message='commercial offer contains an unknown or incompatible policy'; end if;
  if type_count<>policy_count then raise exception using errcode='23514', message='commercial offer contains more than one policy of the same type'; end if;
  select count(*),min(id),min(amount),min(ends_on) into price_count,price_id,price_amount,price_ends
    from public.product_public_prices where product_id=offer_record.product_id and status='published' and currency_code='BRL' and amount>0 and (price_type is null or price_type='msrp') and starts_on<=derived_from and (ends_on is null or ends_on>=derived_from);
  if price_count=0 then raise exception using errcode='23514', message='no compatible published MSRP for derived start date'; end if;
  if price_count>1 then raise exception using errcode='23514', message='more than one compatible published MSRP for derived start date'; end if;
  select min(end_date) into derived_to from (select ends_on end_date from public.commercial_policies where id=any(normalized_ids) and ends_on is not null union all select price_ends where price_ends is not null) dates;
  if derived_to is null or derived_to<derived_from then raise exception using errcode='23514', message='commercial offer has no valid concrete temporal intersection'; end if;
  if benefit>price_amount then raise exception using errcode='23514', message='commercial offer benefit cannot exceed MSRP'; end if;
  if exists(select 1 from public.commercial_offers other where other.id<>p_offer_id and other.product_id=offer_record.product_id and other.status='draft' and (select pg_catalog.array_agg(commercial_policy_id order by commercial_policy_id) from public.commercial_offer_policies where commercial_offer_id=other.id)=normalized_ids) then
    raise exception using errcode='23505', message='an identical draft commercial offer already exists';
  end if;
  select pg_catalog.array_agg(commercial_policy_id order by commercial_policy_id) into old_ids from public.commercial_offer_policies where commercial_offer_id=p_offer_id;
  before_snapshot:=pg_catalog.jsonb_build_object('offer',pg_catalog.to_jsonb(offer_record),'policyIds',coalesce(old_ids,'{}'));
  delete from public.commercial_offer_policies where commercial_offer_id=p_offer_id;
  insert into public.commercial_offer_policies(commercial_offer_id,commercial_policy_id,created_by) select p_offer_id,id,p_actor_id from pg_catalog.unnest(normalized_ids) selected(id);
  update public.commercial_offers set public_price_id=price_id,valid_from=derived_from,valid_to=derived_to,blocking_issues='[]'::jsonb,updated_by=p_actor_id where id=p_offer_id returning * into updated_offer;
  insert into public.pricing_audit_events(aggregate_type,aggregate_id,action,before_snapshot,after_snapshot,reason,actor_id,correlation_id)
  values('commercial_offer',p_offer_id,'update',before_snapshot,pg_catalog.jsonb_build_object('offer',pg_catalog.to_jsonb(updated_offer),'policyIds',normalized_ids,'benefitAmount',benefit,'transactionalPrice',price_amount-benefit),'Sprint 9G atomic draft replacement',p_actor_id,p_correlation_id);
  return pg_catalog.jsonb_build_object('offerId',p_offer_id,'productId',updated_offer.product_id,'publicPriceId',price_id,'publicPriceAmount',price_amount::text,'validFrom',derived_from,'validTo',derived_to,'status','draft','policyIds',normalized_ids,'lockVersion',updated_offer.lock_version,'benefitAmount',benefit::text,'transactionalPrice',(price_amount-benefit)::text);
end;
$$;

create function public.archive_commercial_offer(
  p_offer_id bigint,
  p_expected_lock_version integer,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns public.commercial_offers
language plpgsql security definer set search_path = ''
as $$
declare current_record public.commercial_offers%rowtype; archived_record public.commercial_offers%rowtype; policy_ids bigint[];
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or p_expected_lock_version is null then raise exception using errcode='22004', message='archive requires lock version and correlation id'; end if;
  select * into current_record from public.commercial_offers where id=p_offer_id for update;
  if not found then raise exception using errcode='P0002', message='commercial offer does not exist'; end if;
  if current_record.status not in ('draft','published') then raise exception using errcode='55000', message='commercial offer status is not archivable'; end if;
  if current_record.lock_version<>p_expected_lock_version then raise exception using errcode='40001', message='commercial offer changed by another operator'; end if;
  select pg_catalog.array_agg(commercial_policy_id order by commercial_policy_id) into policy_ids from public.commercial_offer_policies where commercial_offer_id=p_offer_id;
  update public.commercial_offers set status='archived',updated_by=p_actor_id where id=p_offer_id returning * into archived_record;
  insert into public.pricing_audit_events(aggregate_type,aggregate_id,action,before_snapshot,after_snapshot,reason,actor_id,correlation_id)
  values('commercial_offer',p_offer_id,'archive',pg_catalog.jsonb_build_object('offer',pg_catalog.to_jsonb(current_record),'policyIds',coalesce(policy_ids,'{}')),pg_catalog.jsonb_build_object('offer',pg_catalog.to_jsonb(archived_record),'policyIds',coalesce(policy_ids,'{}')),'Sprint 9G administrative archive',p_actor_id,p_correlation_id);
  return archived_record;
end;
$$;

alter function public.update_commercial_policy_draft(bigint,integer,jsonb,uuid,uuid) owner to postgres;
alter function public.archive_commercial_policy(bigint,integer,uuid,uuid) owner to postgres;
alter function public.replace_commercial_offer_draft(bigint,integer,bigint[],uuid,uuid) owner to postgres;
alter function public.archive_commercial_offer(bigint,integer,uuid,uuid) owner to postgres;
revoke all on function public.update_commercial_policy_draft(bigint,integer,jsonb,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.archive_commercial_policy(bigint,integer,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.replace_commercial_offer_draft(bigint,integer,bigint[],uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.archive_commercial_offer(bigint,integer,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.update_commercial_policy_draft(bigint,integer,jsonb,uuid,uuid) to service_role;
grant execute on function public.archive_commercial_policy(bigint,integer,uuid,uuid) to service_role;
grant execute on function public.replace_commercial_offer_draft(bigint,integer,bigint[],uuid,uuid) to service_role;
grant execute on function public.archive_commercial_offer(bigint,integer,uuid,uuid) to service_role;
