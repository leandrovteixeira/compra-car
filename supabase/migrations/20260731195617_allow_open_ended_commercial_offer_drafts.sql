alter table public.commercial_offers alter column valid_to drop not null;
alter table public.commercial_offers drop constraint commercial_offers_validity_check;
alter table public.commercial_offers add constraint commercial_offers_validity_check
  check (valid_to is null or valid_from <= valid_to);

create or replace function public.create_commercial_offer_batch(p_rows jsonb,p_actor_id uuid,p_correlation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare row_value jsonb; resolved_rows jsonb:='[]'; created_offers jsonb:='[]'; client_ids text[]:='{}'; fingerprints text[]:='{}';
 client_id text; product_id integer; locked_product_id integer; policy_ids bigint[]; policy_count integer; type_count integer;
 valid_from date; valid_to date; price_count integer; public_price_id bigint; public_price_amount numeric(14,2); public_price_ends_on date;
 benefit_amount numeric(14,2); fingerprint text; offer_id_value bigint;
begin
 perform public.assert_active_pricing_admin(p_actor_id);
 if p_correlation_id is null or pg_catalog.jsonb_typeof(p_rows)<>'array' then raise exception using errcode='22023',message='invalid commercial offer batch'; end if;
 if pg_catalog.jsonb_array_length(p_rows)<1 or pg_catalog.jsonb_array_length(p_rows)>100 then raise exception using errcode='22023',message='commercial offer batch requires between 1 and 100 rows'; end if;
 for locked_product_id in select distinct (item.value->>'productId')::integer from pg_catalog.jsonb_array_elements(p_rows)item(value) order by 1 loop perform pg_catalog.pg_advisory_xact_lock(9049,locked_product_id); end loop;
 for row_value in select value from pg_catalog.jsonb_array_elements(p_rows) loop
  client_id:=pg_catalog.btrim(row_value->>'clientRowId');
  if client_id is null or client_id!~'^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$' or client_id=any(client_ids) then raise exception using errcode='22023',message='invalid or duplicate clientRowId'; end if;
  client_ids:=pg_catalog.array_append(client_ids,client_id); product_id:=(row_value->>'productId')::integer;
  if not exists(select 1 from public.products where id=product_id) then raise exception using errcode='23503',message='unknown offer product'; end if;
  if pg_catalog.jsonb_typeof(row_value->'policyIds')<>'array' or pg_catalog.jsonb_array_length(row_value->'policyIds')<1 then raise exception using errcode='22023',message='combination requires at least one policy'; end if;
  select pg_catalog.array_agg((item.value#>>'{}')::bigint order by (item.value#>>'{}')::bigint) into policy_ids from pg_catalog.jsonb_array_elements(row_value->'policyIds')item(value);
  if pg_catalog.cardinality(policy_ids)<>(select count(distinct selected_id) from pg_catalog.unnest(policy_ids)selected(selected_id)) then raise exception using errcode='23505',message='combination policy IDs must be unique'; end if;
  perform policy.id from public.commercial_policies policy where policy.id=any(policy_ids) order by policy.id for key share;
  select count(*),count(distinct policy.policy_type),max(policy.starts_on),coalesce(sum(policy.customer_benefit_amount),0) into policy_count,type_count,valid_from,benefit_amount
   from public.commercial_policies policy where policy.id=any(policy_ids) and policy.product_id=product_id and policy.status in('draft','needs_review','published')
   and policy.policy_type::text in('retail_bonus','trade_in_bonus','loyalty_bonus','subsidized_financing','free_ipva','free_insurance','free_wallbox','free_registration','free_maintenance','fuel_or_recharge_voucher','other');
  if policy_count<>pg_catalog.cardinality(policy_ids) then raise exception using errcode='23514',message='combination contains an unknown or incompatible policy'; end if;
  if type_count<>policy_count then raise exception using errcode='23514',message='combination contains more than one policy of the same type'; end if;
  select count(*),min(price.id),min(price.amount),min(price.ends_on) into price_count,public_price_id,public_price_amount,public_price_ends_on from public.product_public_prices price
   where price.product_id=product_id and price.status='published' and price.currency_code='BRL' and price.amount>0 and (price.price_type is null or price.price_type='msrp') and price.starts_on<=valid_from and (price.ends_on is null or price.ends_on>=valid_from);
  if price_count=0 then raise exception using errcode='23514',message='Nenhum MSRP publicado é compatível com o início derivado.'; elsif price_count>1 then raise exception using errcode='23514',message='Mais de um MSRP publicado é compatível com o início derivado.'; end if;
  perform 1 from public.product_public_prices where id=public_price_id for key share;
  select min(candidate.end_date) into valid_to from (select policy.ends_on end_date from public.commercial_policies policy where policy.id=any(policy_ids) and policy.ends_on is not null union all select public_price_ends_on where public_price_ends_on is not null)candidate;
  if valid_to is not null and valid_to<valid_from then raise exception using errcode='23514',message='As políticas selecionadas não possuem interseção temporal válida.'; end if;
  if benefit_amount>public_price_amount then raise exception using errcode='23514',message='commercial offer benefit cannot exceed its public price'; end if;
  fingerprint:=product_id::text||':'||pg_catalog.array_to_string(policy_ids,',');
  if fingerprint=any(fingerprints) then raise exception using errcode='23505',message='the same combination appears more than once in the batch'; end if; fingerprints:=pg_catalog.array_append(fingerprints,fingerprint);
  if exists(select 1 from public.commercial_offers offer where offer.product_id=product_id and offer.status='draft' and offer.valid_from=valid_from and offer.valid_to is not distinct from valid_to
   and (select pg_catalog.array_agg(membership.commercial_policy_id order by membership.commercial_policy_id) from public.commercial_offer_policies membership where membership.commercial_offer_id=offer.id)=policy_ids)
   then raise exception using errcode='23505',message='an identical draft commercial offer already exists'; end if;
  resolved_rows:=resolved_rows||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('clientRowId',client_id,'productId',product_id,'policyIds',policy_ids,'publicPriceId',public_price_id,'publicPriceAmount',public_price_amount,'validFrom',valid_from,'validTo',valid_to,'benefitAmount',benefit_amount));
 end loop;
 for row_value in select value from pg_catalog.jsonb_array_elements(resolved_rows) loop
  client_id:=row_value->>'clientRowId'; product_id:=(row_value->>'productId')::integer; public_price_id:=(row_value->>'publicPriceId')::bigint; public_price_amount:=(row_value->>'publicPriceAmount')::numeric; valid_from:=(row_value->>'validFrom')::date; valid_to:=nullif(row_value->>'validTo','')::date; benefit_amount:=(row_value->>'benefitAmount')::numeric;
  select pg_catalog.array_agg((item.value#>>'{}')::bigint order by (item.value#>>'{}')::bigint) into policy_ids from pg_catalog.jsonb_array_elements(row_value->'policyIds')item(value);
  insert into public.commercial_offers(product_id,public_price_id,source_system,source_reference,valid_from,valid_to,status,blocking_issues,created_by,updated_by)
   values(product_id,public_price_id,'manual','policy-combination:'||p_correlation_id::text||':'||client_id,valid_from,valid_to,'draft','[]',p_actor_id,p_actor_id) returning id into offer_id_value;
  insert into public.commercial_offer_policies(commercial_offer_id,commercial_policy_id,created_by) select offer_id_value,selected_id,p_actor_id from pg_catalog.unnest(policy_ids)selected(selected_id);
  insert into public.pricing_audit_events(aggregate_type,aggregate_id,action,after_snapshot,reason,actor_id,correlation_id) values('commercial_offer',offer_id_value,'insert',pg_catalog.jsonb_build_object('id',offer_id_value,'productId',product_id,'publicPriceId',public_price_id,'validFrom',valid_from,'validTo',valid_to,'status','draft','policyIds',policy_ids,'benefitAmount',benefit_amount,'transactionalPrice',public_price_amount-benefit_amount),'policy combination batch',p_actor_id,p_correlation_id);
  created_offers:=created_offers||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('offerId',offer_id_value,'productId',product_id,'publicPriceId',public_price_id,'publicPriceAmount',public_price_amount::text,'validFrom',valid_from,'validTo',valid_to,'status','draft','policyIds',policy_ids,'lockVersion',1,'benefitAmount',benefit_amount::text,'transactionalPrice',(public_price_amount-benefit_amount)::text));
 end loop;
 return pg_catalog.jsonb_build_object('createdCount',pg_catalog.jsonb_array_length(created_offers),'offers',created_offers);
end; $$;

alter function public.create_commercial_offer_batch(jsonb,uuid,uuid) owner to postgres;
revoke all on function public.create_commercial_offer_batch(jsonb,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_commercial_offer_batch(jsonb,uuid,uuid) to service_role;

create or replace function public.replace_commercial_offer_draft(p_offer_id bigint,p_expected_lock_version integer,p_policy_ids bigint[],p_actor_id uuid,p_correlation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare offer_record public.commercial_offers%rowtype; updated_offer public.commercial_offers%rowtype;
  normalized_ids bigint[]; policy_count integer; type_count integer; derived_from date; derived_to date;
  price_count integer; price_id bigint; price_amount numeric(14,2); price_ends date; benefit numeric(14,2);
  old_ids bigint[]; before_snapshot jsonb;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null or p_expected_lock_version is null or pg_catalog.cardinality(p_policy_ids)<1 then raise exception using errcode='22023',message='invalid commercial offer replacement request'; end if;
  select * into offer_record from public.commercial_offers where id=p_offer_id for update;
  if not found then raise exception using errcode='P0002',message='commercial offer does not exist'; end if;
  if offer_record.status<>'draft' then raise exception using errcode='55000',message='only draft commercial offers are editable'; end if;
  if offer_record.lock_version<>p_expected_lock_version then raise exception using errcode='40001',message='commercial offer changed by another operator'; end if;
  perform pg_catalog.pg_advisory_xact_lock(9049,offer_record.product_id);
  select pg_catalog.array_agg(id order by id) into normalized_ids from pg_catalog.unnest(p_policy_ids) selected(id);
  if pg_catalog.cardinality(normalized_ids)<>(select count(distinct id) from pg_catalog.unnest(normalized_ids) selected(id)) then raise exception using errcode='23505',message='commercial offer policy IDs must be unique'; end if;
  perform policy.id from public.commercial_policies policy where policy.id=any(normalized_ids) order by policy.id for key share;
  select count(*),count(distinct policy_type),max(starts_on),coalesce(sum(customer_benefit_amount),0) into policy_count,type_count,derived_from,benefit
    from public.commercial_policies where id=any(normalized_ids) and product_id=offer_record.product_id and status in('draft','needs_review','published')
    and policy_type::text in('retail_bonus','trade_in_bonus','loyalty_bonus','subsidized_financing','free_ipva','free_insurance','free_wallbox','free_registration','free_maintenance','fuel_or_recharge_voucher','other');
  if policy_count<>pg_catalog.cardinality(normalized_ids) then raise exception using errcode='23514',message='commercial offer contains an unknown or incompatible policy'; end if;
  if type_count<>policy_count then raise exception using errcode='23514',message='commercial offer contains more than one policy of the same type'; end if;
  select count(*),min(id),min(amount),min(ends_on) into price_count,price_id,price_amount,price_ends from public.product_public_prices
    where product_id=offer_record.product_id and status='published' and currency_code='BRL' and amount>0 and (price_type is null or price_type='msrp') and starts_on<=derived_from and (ends_on is null or ends_on>=derived_from);
  if price_count=0 then raise exception using errcode='23514',message='no compatible published MSRP for derived start date'; end if;
  if price_count>1 then raise exception using errcode='23514',message='more than one compatible published MSRP for derived start date'; end if;
  select min(end_date) into derived_to from (select ends_on end_date from public.commercial_policies where id=any(normalized_ids) and ends_on is not null union all select price_ends where price_ends is not null) dates;
  if derived_to is not null and derived_to<derived_from then raise exception using errcode='23514',message='commercial offer has no valid temporal intersection'; end if;
  if benefit>price_amount then raise exception using errcode='23514',message='commercial offer benefit cannot exceed MSRP'; end if;
  if exists(select 1 from public.commercial_offers other where other.id<>p_offer_id and other.product_id=offer_record.product_id and other.status='draft'
    and other.valid_from=derived_from and other.valid_to is not distinct from derived_to
    and (select pg_catalog.array_agg(commercial_policy_id order by commercial_policy_id) from public.commercial_offer_policies where commercial_offer_id=other.id)=normalized_ids)
    then raise exception using errcode='23505',message='an identical draft commercial offer already exists'; end if;
  select pg_catalog.array_agg(commercial_policy_id order by commercial_policy_id) into old_ids from public.commercial_offer_policies where commercial_offer_id=p_offer_id;
  before_snapshot:=pg_catalog.jsonb_build_object('offer',pg_catalog.to_jsonb(offer_record),'policyIds',coalesce(old_ids,'{}'));
  delete from public.commercial_offer_policies where commercial_offer_id=p_offer_id;
  insert into public.commercial_offer_policies(commercial_offer_id,commercial_policy_id,created_by) select p_offer_id,id,p_actor_id from pg_catalog.unnest(normalized_ids) selected(id);
  update public.commercial_offers set public_price_id=price_id,valid_from=derived_from,valid_to=derived_to,blocking_issues='[]'::jsonb,updated_by=p_actor_id where id=p_offer_id returning * into updated_offer;
  insert into public.pricing_audit_events(aggregate_type,aggregate_id,action,before_snapshot,after_snapshot,reason,actor_id,correlation_id)
  values('commercial_offer',p_offer_id,'update',before_snapshot,pg_catalog.jsonb_build_object('offer',pg_catalog.to_jsonb(updated_offer),'policyIds',normalized_ids,'benefitAmount',benefit,'transactionalPrice',price_amount-benefit),'Sprint 9G.4 atomic draft replacement',p_actor_id,p_correlation_id);
  return pg_catalog.jsonb_build_object('offerId',p_offer_id,'productId',updated_offer.product_id,'publicPriceId',price_id,'publicPriceAmount',price_amount::text,'validFrom',derived_from,'validTo',derived_to,'status','draft','policyIds',normalized_ids,'lockVersion',updated_offer.lock_version,'benefitAmount',benefit::text,'transactionalPrice',(price_amount-benefit)::text);
end; $$;

-- Drafts may be open, but publication remains conservative until open-offer lifecycle rules exist.
create or replace function public.assert_commercial_offer_publishable(p_offer_id bigint) returns void language plpgsql security invoker set search_path='' as $$
declare offer_record public.commercial_offers%rowtype; policy_record record; public_price_amount numeric; offer_benefit_amount numeric;
begin
  select * into offer_record from public.commercial_offers where id=p_offer_id;
  if not found then raise exception using errcode='P0002',message='commercial offer does not exist'; end if;
  if offer_record.status<>'draft' then raise exception using errcode='55000',message='commercial offer is not in a publishable transition state'; end if;
  if offer_record.valid_to is null then raise exception using errcode='23514',message='open-ended commercial offer cannot be published until a concrete valid_to is defined'; end if;
  if pg_catalog.jsonb_typeof(offer_record.blocking_issues)<>'array' or pg_catalog.jsonb_array_length(offer_record.blocking_issues)>0 then raise exception using errcode='23514',message='commercial offer has blocking issues'; end if;
  select price.amount into public_price_amount from public.product_public_prices price where price.id=offer_record.public_price_id and price.product_id=offer_record.product_id and price.status='published' and price.amount>0 and price.currency_code='BRL' and (price.price_type is null or price.price_type='msrp') and price.starts_on<=offer_record.valid_from and (price.ends_on is null or price.ends_on>=offer_record.valid_to);
  if not found then raise exception using errcode='23514',message='commercial offer requires a compatible published MSRP'; end if;
  if not exists(select 1 from public.commercial_offer_policies where commercial_offer_id=offer_record.id) then raise exception using errcode='23514',message='commercial offer requires at least one policy'; end if;
  offer_benefit_amount:=0;
  for policy_record in select policy.id,policy.customer_benefit_amount from public.commercial_offer_policies membership join public.commercial_policies policy on policy.id=membership.commercial_policy_id where membership.commercial_offer_id=offer_record.id order by policy.id loop
    perform public.validate_commercial_policy_for_offer(policy_record.id,offer_record.id); offer_benefit_amount:=offer_benefit_amount+policy_record.customer_benefit_amount;
  end loop;
  if offer_benefit_amount>public_price_amount then raise exception using errcode='23514',message='commercial offer benefit cannot exceed its public price'; end if;
end; $$;

alter function public.replace_commercial_offer_draft(bigint,integer,bigint[],uuid,uuid) owner to postgres;
alter function public.assert_commercial_offer_publishable(bigint) owner to postgres;
revoke all on function public.replace_commercial_offer_draft(bigint,integer,bigint[],uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.replace_commercial_offer_draft(bigint,integer,bigint[],uuid,uuid) to service_role;
revoke all on function public.assert_commercial_offer_publishable(bigint) from public,anon,authenticated,service_role;
