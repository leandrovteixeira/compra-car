create function public.create_commercial_offer_with_policies(
  p_product_id integer,
  p_public_price_id bigint,
  p_valid_from date,
  p_valid_to date,
  p_policy_ids bigint[],
  p_actor_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  price_record public.product_public_prices%rowtype;
  offer_id_value bigint;
  benefit_amount numeric(14,2);
  distinct_policy_count integer;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_correlation_id is null then raise exception using errcode='22004',message='offer builder requires correlation_id'; end if;
  if p_product_id is null or p_public_price_id is null or p_valid_from is null or p_valid_to is null or p_valid_to < p_valid_from then raise exception using errcode='22023',message='offer builder input is invalid'; end if;
  if p_policy_ids is null or pg_catalog.cardinality(p_policy_ids)<1 then raise exception using errcode='22023',message='offer builder requires at least one policy'; end if;
  select count(distinct policy_id) into distinct_policy_count from pg_catalog.unnest(p_policy_ids) as selected(policy_id);
  if distinct_policy_count <> pg_catalog.cardinality(p_policy_ids) then raise exception using errcode='23505',message='offer builder policy IDs must be unique'; end if;
  select * into price_record from public.product_public_prices as price where price.id=p_public_price_id and price.product_id=p_product_id and price.status='published' and price.currency_code='BRL' and price.amount>0 and (price.price_type is null or price.price_type='msrp') and price.starts_on<=p_valid_from and (price.ends_on is null or price.ends_on>=p_valid_to) for key share;
  if not found then raise exception using errcode='23514',message='offer builder requires a compatible published MSRP'; end if;
  perform policy.id from public.commercial_policies as policy where policy.id=any(p_policy_ids) order by policy.id for key share;
  if (select count(*) from public.commercial_policies as policy where policy.id=any(p_policy_ids))<>distinct_policy_count then raise exception using errcode='23503',message='offer builder references an unknown policy'; end if;
  if exists(select 1 from public.commercial_policies as policy where policy.id=any(p_policy_ids) and (policy.product_id<>p_product_id or policy.status in('rejected','archived') or policy.policy_type::text='registration' or policy.customer_benefit_amount is null or policy.customer_benefit_amount<=0 or policy.starts_on>p_valid_from or (policy.ends_on is not null and policy.ends_on<p_valid_to))) then raise exception using errcode='23514',message='offer builder policy is incompatible'; end if;
  select sum(policy.customer_benefit_amount) into benefit_amount from public.commercial_policies as policy where policy.id=any(p_policy_ids);
  if benefit_amount>price_record.amount then raise exception using errcode='23514',message='commercial offer benefit cannot exceed its public price'; end if;
  if exists(select 1 from public.commercial_offers as offer where offer.product_id=p_product_id and offer.public_price_id=p_public_price_id and offer.valid_from=p_valid_from and offer.valid_to=p_valid_to and offer.status='draft' and (select pg_catalog.array_agg(membership.commercial_policy_id order by membership.commercial_policy_id) from public.commercial_offer_policies as membership where membership.commercial_offer_id=offer.id)=(select pg_catalog.array_agg(policy_id order by policy_id) from pg_catalog.unnest(p_policy_ids) as selected(policy_id))) then raise exception using errcode='23505',message='an identical draft commercial offer already exists'; end if;
  insert into public.commercial_offers(product_id,public_price_id,source_system,source_reference,valid_from,valid_to,status,blocking_issues,created_by,updated_by) values(p_product_id,p_public_price_id,'manual','offer-builder:'||p_correlation_id::text,p_valid_from,p_valid_to,'draft','[]'::jsonb,p_actor_id,p_actor_id) returning id into offer_id_value;
  insert into public.commercial_offer_policies(commercial_offer_id,commercial_policy_id,created_by) select offer_id_value,selected.policy_id,p_actor_id from pg_catalog.unnest(p_policy_ids) as selected(policy_id) order by selected.policy_id;
  insert into public.pricing_audit_events(aggregate_type,aggregate_id,action,after_snapshot,reason,actor_id,correlation_id) values('commercial_offer',offer_id_value,'insert',pg_catalog.jsonb_build_object('id',offer_id_value,'productId',p_product_id,'publicPriceId',p_public_price_id,'validFrom',p_valid_from,'validTo',p_valid_to,'status','draft','policyIds',p_policy_ids,'benefitAmount',benefit_amount,'transactionalPrice',price_record.amount-benefit_amount),'commercial offer builder',p_actor_id,p_correlation_id);
  return pg_catalog.jsonb_build_object('offerId',offer_id_value,'productId',p_product_id,'publicPriceId',p_public_price_id,'publicPriceAmount',price_record.amount::text,'validFrom',p_valid_from,'validTo',p_valid_to,'status','draft','policyIds',p_policy_ids,'lockVersion',1,'benefitAmount',benefit_amount::text,'transactionalPrice',(price_record.amount-benefit_amount)::text);
end;
$$;
alter function public.create_commercial_offer_with_policies(integer,bigint,date,date,bigint[],uuid,uuid) owner to postgres;
revoke all on function public.create_commercial_offer_with_policies(integer,bigint,date,date,bigint[],uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_commercial_offer_with_policies(integer,bigint,date,date,bigint[],uuid,uuid) to service_role;
