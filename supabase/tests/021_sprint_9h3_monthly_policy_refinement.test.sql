begin;
set local search_path = extensions, public, pg_catalog;
select extensions.no_plan();

select extensions.ok(
  'invoice_discount' = any(enum_range(null::public.commercial_policy_type)::text[]),
  'invoice discount is an approved commercial policy type'
);
select extensions.ok(
  'manual' = any(enum_range(null::public.dealer_rebate_allocation_method)::text[]),
  'manual dealer rebate provenance is explicit'
);

insert into auth.users(id,email,raw_user_meta_data)
values ('9a300000-0000-4000-8000-000000000001','sprint-9h3-admin@example.invalid','{}');
update public.profiles set role='admin',status='active',accepted_at=now()
where id='9a300000-0000-4000-8000-000000000001';
insert into public.products(id,brand,model,version,model_year,production_year,is_active,is_public)
values (2083000001,'Sprint 9H.3','Model','Monthly',2032,2031,true,true);
insert into public.product_public_prices(
  id,product_id,amount,starts_on,ends_on,price_type,status,source_type,published_at,published_by
) values (
  2083000101,2083000001,200000,'2032-01-01','2032-12-31','msrp','published','manual',now(),
  '9a300000-0000-4000-8000-000000000001'
);

select extensions.lives_ok($$
  select public.create_commercial_period_draft(
    2083000001,'2032-08-01','2032-08-31','monthly',
    '[{"clientRowId":"aug-retail","productId":2083000001,"policyType":"retail_bonus","title":"Bônus varejo","description":"","startsOn":"2032-08-01","endsOn":"2032-08-31","amount":"10000.00","rebateAmount":"2500.00","customerBenefitAmount":"10000.00"},{"clientRowId":"aug-invoice","productId":2083000001,"policyType":"invoice_discount","title":"Desconto NF","description":"Carta agosto","startsOn":"2032-08-01","endsOn":"2032-08-31","amount":"5000.00","rebateAmount":"0.00","customerBenefitAmount":"5000.00"}]',
    '[{"clientRowId":"aug-offer","policyRefs":[{"policyClientRowId":"aug-retail"},{"policyClientRowId":"aug-invoice"}]}]',
    '[]','9a300000-0000-4000-8000-000000000001','9c300000-0000-4000-8000-000000000801'
  )
$$,'August policies and Offer are persisted atomically');

select extensions.is(
  (select dealer_rebate_amount from public.commercial_policies
    where product_id=2083000001 and policy_type='retail_bonus' and starts_on='2032-08-01'),
  2500.00::numeric,'manual dealer rebate is persisted independently from customer benefit'
);
select extensions.is(
  (select dealer_rebate_allocation_method::text from public.commercial_policies
    where product_id=2083000001 and policy_type='retail_bonus' and starts_on='2032-08-01'),
  'manual','manual dealer rebate provenance is persisted'
);
select extensions.is(
  (select customer_benefit_amount from public.commercial_policies
    where product_id=2083000001 and policy_type='retail_bonus' and starts_on='2032-08-01'),
  10000.00::numeric,'dealer rebate does not reduce customer benefit'
);
select extensions.is(
  (select sum(policy.customer_benefit_amount)
    from public.commercial_offers offer
    join public.commercial_offer_policies membership on membership.commercial_offer_id=offer.id
    join public.commercial_policies policy on policy.id=membership.commercial_policy_id
    where offer.product_id=2083000001 and offer.valid_from='2032-08-01'),
  15000.00::numeric,'invoice discount participates in Offer total while rebate is excluded'
);

select extensions.lives_ok($$
  select public.publish_commercial_policy(
    (select id from public.commercial_policies
      where product_id=2083000001 and policy_type='invoice_discount' and starts_on='2032-08-01'),
    '9a300000-0000-4000-8000-000000000001',1,
    '9c300000-0000-4000-8000-000000000802'
  )
$$,'invoice discount remains publishable only through the individual Policy RPC');
select extensions.is(
  (select status::text from public.commercial_policies
    where product_id=2083000001 and policy_type='invoice_discount' and starts_on='2032-08-01'),
  'published','individual publication preserves the existing publication workflow'
);

select extensions.lives_ok($$
  select public.create_commercial_period_draft(
    2083000001,'2032-09-01','2032-09-30','monthly',
    '[{"clientRowId":"copied-1","productId":2083000001,"policyType":"retail_bonus","title":"Bônus varejo","description":"","startsOn":"2032-09-01","endsOn":"2032-09-30","amount":"12000.00","rebateAmount":"3000.00","customerBenefitAmount":"12000.00"},{"clientRowId":"copied-2","productId":2083000001,"policyType":"invoice_discount","title":"Desconto NF","description":"Carta setembro","startsOn":"2032-09-01","endsOn":"2032-09-30","amount":"6000.00","rebateAmount":"0.00","customerBenefitAmount":"6000.00"}]',
    '[{"clientRowId":"copied-offer-1","policyRefs":[{"policyClientRowId":"copied-1"},{"policyClientRowId":"copied-2"}]}]',
    '[]','9a300000-0000-4000-8000-000000000001','9c300000-0000-4000-8000-000000000901'
  )
$$,'September resolves copied clientRowIds to new Policies');

select extensions.is(
  (select count(*) from public.commercial_offer_policies membership
    join public.commercial_offers offer on offer.id=membership.commercial_offer_id
    join public.commercial_policies policy on policy.id=membership.commercial_policy_id
    where offer.product_id=2083000001 and offer.valid_from='2032-09-01'
      and policy.starts_on='2032-09-01' and policy.ends_on='2032-09-30'),
  2::bigint,'September memberships point only to September Policies'
);
select extensions.is(
  (select count(*) from public.commercial_offer_policies membership
    join public.commercial_offers offer on offer.id=membership.commercial_offer_id
    join public.commercial_policies policy on policy.id=membership.commercial_policy_id
    where offer.product_id=2083000001 and offer.valid_from='2032-09-01'
      and policy.ends_on='2032-08-31'),
  0::bigint,'September Offer never reuses August Policy IDs'
);

select extensions.throws_ok($$
  select public.create_commercial_period_draft(
    2083000001,'2032-10-01','2032-10-31','monthly',
    '[{"clientRowId":"invalid-rebate","productId":2083000001,"policyType":"invoice_discount","title":"Desconto NF","description":"","startsOn":"2032-10-01","endsOn":"2032-10-31","amount":"1000.00","rebateAmount":"1000.01","customerBenefitAmount":"1000.00"}]',
    '[]','[]','9a300000-0000-4000-8000-000000000001','9c300000-0000-4000-8000-000000000999'
  )
$$,'23514','manual dealer rebate must be between zero and customer benefit',
  'rebate above customer benefit rejects the complete transaction');
select extensions.is(
  (select count(*) from public.commercial_policies
    where product_id=2083000001 and starts_on='2032-10-01'),
  0::bigint,'invalid rebate rollback creates no Policy'
);

select * from extensions.finish();
rollback;
