-- Reproducible, idempotent Sprint 9G.1 dataset for Compra Car Staging only.
-- Source vehicles: Legacy/products.csv. This is test data, not a schema migration.
begin;

do $load$
declare
  actor uuid;
  parameter_id bigint;
  price_611 bigint;
  price_613 bigint;
  price_614 bigint;
  price_615 bigint;
  price_616 bigint;
  policy_trade bigint;
  policy_loyalty bigint;
  offer_614 bigint;
  item record;
begin
  if current_database() is null then
    raise exception 'database identity unavailable';
  end if;

  select id into strict actor
  from public.profiles
  where role = 'admin' and status = 'active' and full_name = 'Compra Car Staging Admin';

  select id into strict parameter_id
  from public.financial_parameter_sets
  where status = 'published' and effective_from <= date '2026-07-29'
    and (valid_to is null or valid_to >= date '2026-07-29')
  order by version desc
  limit 1;

  insert into public.products
    (id,brand,model,version,renavam_reference,model_year,production_year,is_active,is_public)
  values
    (610,'Omoda','E5','EV','I/OMODA E5',2026,2025,true,true),
    (611,'Jaecoo','7','Luxury 1.5 TGDI PHEV DHT','I/JAECOO 7 LUXURY',2026,2025,true,true),
    (612,'GAC','GS4','Premium 2.0 HEV CVT','I/GAC GS4 PREMIUM',2026,2025,true,true),
    (613,'GWM','Haval H6','2 1.5 TGDI HEV DHT','I/GWM HAVAL H6 PREM HEV',2025,2025,true,true),
    (614,'BYD','Song Pro','GS 1.5 PHEV DHT','I/BYD SONG PRO GS DM',2025,2024,true,true),
    (615,'Toyota','Corolla Cross','XRX 1.8 HEV CVT','TOYOTA/CCROSS XRX HYBRID',2026,2025,true,true),
    (616,'Jeep','Compass','Limited 1.3 TGDI AT','JEEP/COMPASS LIMITED T',2025,2025,true,true),
    (617,'VW','Taos','Comfortline 1.4 TGDI AT','I/VW TAOS CL TSI',2025,2025,true,true)
  on conflict (id) do nothing;

  if (select count(*) from public.products where id between 610 and 617) <> 8 then
    raise exception 'reserved Product IDs 610-617 conflict with the staging fixture';
  end if;
  if exists (
    select 1 from public.products
    where (id,brand,model,version) not in (
      (610,'Omoda','E5','EV'),
      (611,'Jaecoo','7','Luxury 1.5 TGDI PHEV DHT'),
      (612,'GAC','GS4','Premium 2.0 HEV CVT'),
      (613,'GWM','Haval H6','2 1.5 TGDI HEV DHT'),
      (614,'BYD','Song Pro','GS 1.5 PHEV DHT'),
      (615,'Toyota','Corolla Cross','XRX 1.8 HEV CVT'),
      (616,'Jeep','Compass','Limited 1.3 TGDI AT'),
      (617,'VW','Taos','Comfortline 1.4 TGDI AT')
    ) and id between 610 and 617
  ) then
    raise exception 'existing Product does not match the approved staging fixture';
  end if;

  for item in
    select * from (values
      (610,189990::numeric,'draft'::public.pricing_workflow_status,'staging-9g1-610'),
      (611,219990::numeric,'published'::public.pricing_workflow_status,'staging-9g1-611'),
      (613,239990::numeric,'published'::public.pricing_workflow_status,'staging-9g1-613'),
      (614,149990::numeric,'published'::public.pricing_workflow_status,'staging-9g1-614'),
      (615,199990::numeric,'published'::public.pricing_workflow_status,'staging-9g1-615'),
      (616,189990::numeric,'published'::public.pricing_workflow_status,'staging-9g1-616')
    ) as fixture(product_id,amount,target_status,source_reference)
  loop
    if (select count(*) from public.product_public_prices where source_reference=item.source_reference) > 1 then
      raise exception 'duplicate price fixture: %', item.source_reference;
    end if;
    insert into public.product_public_prices
      (product_id,amount,currency_code,starts_on,ends_on,status,source_type,source_snapshot,
       created_by,updated_by,price_type,source_reference)
    select item.product_id,item.amount,'BRL',date '2026-07-29',
      case when item.product_id=613 then date '2026-07-31' else date '2026-12-31' end,
      'draft','manual',
      jsonb_build_object('environment','staging','fixture','sprint-9g1'),actor,actor,'msrp',item.source_reference
    where not exists (
      select 1 from public.product_public_prices where source_reference=item.source_reference
    );
    if item.target_status = 'published' then
      perform public.publish_product_public_price(p.id,actor,p.lock_version,gen_random_uuid())
      from public.product_public_prices p
      where p.source_reference=item.source_reference and p.status='draft';
    end if;
  end loop;

  select id into strict price_611 from public.product_public_prices where source_reference='staging-9g1-611';
  select id into strict price_613 from public.product_public_prices where source_reference='staging-9g1-613';
  select id into strict price_614 from public.product_public_prices where source_reference='staging-9g1-614';
  select id into strict price_615 from public.product_public_prices where source_reference='staging-9g1-615';
  select id into strict price_616 from public.product_public_prices where source_reference='staging-9g1-616';

  insert into public.commercial_policies
    (product_id,policy_type,scope_type,scope_snapshot,title,description,starts_on,ends_on,
     calculation_method,calculation_base_price_id,customer_benefit_amount,fixed_amount,status,
     source_type,policy_parameters,created_by,updated_by)
  select * from (values
    (611,'retail_bonus'::public.commercial_policy_type,'product_set'::public.commercial_policy_scope_type,
     '{"environment":"staging","fixtureKey":"staging-9g1-611-retail"}'::jsonb,'Bônus varejo',
     'Fixture controlada Sprint 9G.1',date '2026-07-29',date '2026-12-31',
     'fixed_amount'::public.policy_calculation_method,price_611,5000::numeric,5000::numeric,
     'draft'::public.pricing_workflow_status,'manual'::public.pricing_source_type,'{}'::jsonb,actor,actor),
    (614,'trade_in_bonus','product_set','{"environment":"staging","fixtureKey":"staging-9g1-614-trade"}',
     'Bônus trade-in','Fixture controlada Sprint 9G.1','2026-07-29','2026-12-31','fixed_amount',
     price_614,8000,8000,'draft','manual','{}',actor,actor),
    (614,'loyalty_bonus','product_set','{"environment":"staging","fixtureKey":"staging-9g1-614-loyalty"}',
     'Loyalty','Fixture controlada Sprint 9G.1','2026-07-29','2026-12-31','fixed_amount',
     price_614,3000,3000,'draft','manual','{}',actor,actor),
    (615,'free_wallbox','product_set','{"environment":"staging","fixtureKey":"staging-9g1-615-wallbox"}',
     'Wallbox grátis','Fixture controlada Sprint 9G.1','2026-07-29','2026-12-31','fixed_amount',
     price_615,4500,4500,'draft','manual','{}',actor,actor),
    (615,'fuel_or_recharge_voucher','product_set','{"environment":"staging","fixtureKey":"staging-9g1-615-voucher"}',
     'Voucher combustível/recarga','Fixture controlada Sprint 9G.1','2026-07-29','2026-12-31','fixed_amount',
     price_615,1200,1200,'draft','manual','{"voucherType":"electric_recharge"}',actor,actor),
    (615,'other','product_set','{"environment":"staging","fixtureKey":"staging-9g1-615-other"}',
     'Outro benefício','Película de proteção — fixture Sprint 9G.1','2026-07-29','2026-12-31','fixed_amount',
     price_615,900,900,'draft','manual','{}',actor,actor),
    (616,'free_ipva','product_set','{"environment":"staging","fixtureKey":"staging-9g1-616-ipva"}',
     'IPVA grátis','Fixture controlada Sprint 9G.1','2026-07-29','2026-12-31','proportional_ipva',
     price_616,6333,NULL,'draft','manual','{"annualRate":"0.04","offerMonth":7,"remainingMonths":6}',actor,actor)
  ) fixture(product_id,policy_type,scope_type,scope_snapshot,title,description,starts_on,ends_on,
    calculation_method,calculation_base_price_id,customer_benefit_amount,fixed_amount,status,
    source_type,policy_parameters,created_by,updated_by)
  where not exists (
    select 1 from public.commercial_policies p
    where p.scope_snapshot->>'fixtureKey'=fixture.scope_snapshot->>'fixtureKey'
  );

  insert into public.commercial_policies
    (product_id,policy_type,scope_type,scope_snapshot,title,description,starts_on,ends_on,
     term_months,customer_interest_rate_monthly,down_payment_percentage,calculation_method,
     financial_parameter_set_id,calculation_base_price_id,customer_benefit_amount,financed_principal,
     status,source_type,policy_parameters,created_by,updated_by)
  select 613,'subsidized_financing','product_set',
    '{"environment":"staging","fixtureKey":"staging-9g1-613-rate"}',
    'Financiamento subsidiado','Fixture controlada Sprint 9G.1',date '2026-07-29',date '2026-12-31',
    36,0.0049,20,'discounted_promotional_cash_flow_difference',parameter_id,price_613,7500,191992,
    'draft','manual','{}',actor,actor
  where not exists (
    select 1 from public.commercial_policies where scope_snapshot->>'fixtureKey'='staging-9g1-613-rate'
  );

  select id into strict policy_trade from public.commercial_policies
  where scope_snapshot->>'fixtureKey'='staging-9g1-614-trade';
  select id into strict policy_loyalty from public.commercial_policies
  where scope_snapshot->>'fixtureKey'='staging-9g1-614-loyalty';

  insert into public.commercial_offers
    (product_id,public_price_id,source_system,source_reference,valid_from,valid_to,status,
     blocking_issues,created_by,updated_by)
  select 614,price_614,'staging_fixture','offer-staging-9g1-song-pro','2026-07-29','2026-12-31',
    'draft','[]',actor,actor
  where not exists (
    select 1 from public.commercial_offers
    where source_system='staging_fixture' and source_reference='offer-staging-9g1-song-pro'
  );
  select id into strict offer_614 from public.commercial_offers
  where source_system='staging_fixture' and source_reference='offer-staging-9g1-song-pro';

  insert into public.commercial_offer_policies(commercial_offer_id,commercial_policy_id,created_by)
  values (offer_614,policy_trade,actor),(offer_614,policy_loyalty,actor)
  on conflict do nothing;

  if (select count(*) from public.product_public_prices where source_reference like 'staging-9g1-%') <> 6
    or (select count(*) from public.commercial_policies where scope_snapshot->>'fixtureKey' like 'staging-9g1-%') <> 8
    or (select count(*) from public.commercial_offers where source_reference='offer-staging-9g1-song-pro') <> 1
    or (select count(*) from public.commercial_offer_policies where commercial_offer_id=offer_614) <> 2
  then
    raise exception 'Sprint 9G.1 staging fixture validation failed';
  end if;

  if exists (
    select 1 from public.product_public_prices
    where source_reference in ('staging-9g1-611','staging-9g1-613','staging-9g1-614','staging-9g1-615','staging-9g1-616')
      and status <> 'published'
  ) then
    raise exception 'published price fixture did not reach its target status';
  end if;

  perform setval('public.products_id_seq',greatest((select max(id) from public.products),617),true);
end
$load$;

commit;
