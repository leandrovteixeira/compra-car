-- Atomic server-authoritative creation of manual CommercialPolicy batches.
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
    if client_id!~'^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$' or policy_type not in('retail_bonus','trade_in_bonus','subsidized_financing','free_ipva','free_insurance','free_wallbox','free_registration','free_maintenance','fuel_or_recharge_voucher','other') then raise exception using errcode='22023',message='invalid manual policy row'; end if;
    if nullif(pg_catalog.btrim(r->>'title'),'') is null then raise exception using errcode='22023',message='policy title is required'; end if;
    starts_on:=(r->>'startsOn')::date; ends_on:=nullif(r->>'endsOn','')::date; if ends_on<starts_on then raise exception using errcode='22023',message='invalid policy period'; end if;
    if not exists(select 1 from public.products p where p.id=product_id) then raise exception using errcode='23503',message='unknown policy product'; end if;
    description:=nullif(pg_catalog.btrim(r->>'description'),''); parameters:='{}'::jsonb; fixed:=null; annual:=null; years:=null;offer_month:=null;remaining:=null;term:=null;customer_rate:=null;down_payment:=null;principal:=null;parameter_id:=null;base_price:=null;
    if policy_type in('retail_bonus','trade_in_bonus','free_wallbox','free_maintenance','fuel_or_recharge_voucher','other') then
      fixed:=(r->>'amount')::numeric; benefit:=fixed; method:='fixed_amount'; if fixed<=0 then raise exception using errcode='22023',message='fixed benefit must be positive'; end if;
      if policy_type='other' and description is null then raise exception using errcode='22023',message='other policy description is required'; end if;
      if policy_type='fuel_or_recharge_voucher' and coalesce(r->>'voucherType','') not in('fuel','electric_recharge','unspecified') then raise exception using errcode='22023',message='invalid voucher type'; end if;
      if policy_type='free_maintenance' then parameters:=pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('maintenanceCount',nullif(r->>'maintenanceCount','')::integer,'coverageMonths',nullif(r->>'coverageMonths','')::integer,'coverageKm',nullif(r->>'coverageKm','')::numeric)); end if;
    else
      select p.amount into base_price from public.product_public_prices p where p.id=(r->>'calculationBasePriceId')::bigint and p.product_id=product_id and p.status='published' and p.currency_code='BRL' and p.amount>0 and (p.price_type is null or p.price_type='msrp') and p.starts_on<=starts_on and (p.ends_on is null or (ends_on is not null and p.ends_on>=ends_on));
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
