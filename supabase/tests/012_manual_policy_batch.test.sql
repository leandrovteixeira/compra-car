begin;
set local search_path = extensions, public, pg_catalog;
select no_plan();
select has_function('public','create_manual_policy_batch',array['jsonb','uuid','uuid'],'manual policy batch RPC exists');
select function_lang_is('public','create_manual_policy_batch',array['jsonb','uuid','uuid'],'plpgsql','RPC is plpgsql');
select function_returns('public','create_manual_policy_batch',array['jsonb','uuid','uuid'],'jsonb','RPC returns jsonb');
select is((select prosecdef from pg_proc where oid='public.create_manual_policy_batch(jsonb,uuid,uuid)'::regprocedure),true,'RPC is security definer');
select is(replace((select proconfig[1] from pg_proc where oid='public.create_manual_policy_batch(jsonb,uuid,uuid)'::regprocedure),'"',''),'search_path=','RPC has empty search_path');

insert into auth.users (id, email, raw_user_meta_data) values
  ('ac000000-0000-4000-8000-000000000001', 'manual-policy-admin@example.invalid', '{"full_name":"Manual Policy Admin"}');
update public.profiles set role = 'admin', status = 'active', accepted_at = now()
 where id = 'ac000000-0000-4000-8000-000000000001';

insert into public.products (
  id, brand, model, version, model_year, production_year, is_active, is_public
) values
  (2140000001, 'Policy', 'Atomic', 'Open MSRP', 2026, 2026, true, true);

insert into public.product_public_prices (
  id, product_id, amount, starts_on, ends_on, price_type, status, source_type,
  published_at, published_by, source_reference
) values (
  214000001, 2140000001, 200000, date '2026-07-01', date '2026-12-31', 'msrp',
  'published', 'manual', now(), 'ac000000-0000-4000-8000-000000000001', 'manual-policy-finite-msrp'
);

create temporary table manual_policy_batch_result (payload jsonb);
insert into manual_policy_batch_result
select public.create_manual_policy_batch(
  '[
    {"clientRowId":"bonus","productId":"2140000001","policyType":"retail_bonus","title":"Bônus varejo","description":"","startsOn":"2026-08-01","endsOn":null,"amount":"10000.00","customerBenefitAmount":"10000.00"},
    {"clientRowId":"ipva","productId":"2140000001","policyType":"free_ipva","title":"IPVA grátis","description":"","startsOn":"2026-08-01","endsOn":null,"calculationBasePriceId":"214000001","annualRate":"0.04","offerMonth":"8","customerBenefitAmount":"3333.33"}
  ]'::jsonb,
  'ac000000-0000-4000-8000-000000000001',
  'cc000000-0000-4000-8000-000000000001'
);

select is(
  (select (payload ->> 'createdCount')::integer from manual_policy_batch_result),
  2,
  'open-ended bonus and IPVA batch accepts a finite MSRP valid on startsOn'
);
select is(
  (select count(*) from public.commercial_policies
    where product_id = 2140000001 and title in ('Bônus varejo', 'IPVA grátis') and status = 'draft'),
  2::bigint,
  'both valid policies persist together as drafts'
);

select throws_ok(
  $$select public.create_manual_policy_batch(
    '[
      {"clientRowId":"rollback-bonus","productId":"2140000001","policyType":"trade_in_bonus","title":"Rollback bonus","description":"","startsOn":"2027-01-01","endsOn":null,"amount":"15000.00","customerBenefitAmount":"15000.00"},
      {"clientRowId":"incompatible-ipva","productId":"2140000001","policyType":"free_ipva","title":"Incompatible IPVA","description":"","startsOn":"2027-01-01","endsOn":null,"calculationBasePriceId":"214000001","annualRate":"0.04","offerMonth":"1","customerBenefitAmount":"8000.00"}
    ]'::jsonb,
    'ac000000-0000-4000-8000-000000000001',
    'cc000000-0000-4000-8000-000000000002')$$,
  '23514',
  'compatible published MSRP is required',
  'an MSRP expired before startsOn remains incompatible'
);
select is(
  (select count(*) from public.commercial_policies where title in ('Rollback bonus', 'Incompatible IPVA')),
  0::bigint,
  'a temporally incompatible row rolls back the complete batch'
);
select is(
  (select count(*) from public.pricing_import_batches
    where idempotency_key = 'manual-policy-batch:cc000000-0000-4000-8000-000000000002'),
  0::bigint,
  'the rejected batch leaves no provenance record'
);
select * from finish();
rollback;
