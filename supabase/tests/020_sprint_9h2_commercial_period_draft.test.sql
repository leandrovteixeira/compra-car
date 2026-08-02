begin;
set local search_path = extensions, public, pg_catalog;
select extensions.no_plan();

select extensions.has_function(
  'public',
  'create_commercial_period_draft',
  array['integer','date','date','text','jsonb','jsonb','jsonb','uuid','uuid'],
  'commercial period draft RPC exists'
);
select extensions.ok(
  has_function_privilege(
    'service_role',
    'public.create_commercial_period_draft(integer,date,date,text,jsonb,jsonb,jsonb,uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.create_commercial_period_draft(integer,date,date,text,jsonb,jsonb,jsonb,uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.create_commercial_period_draft(integer,date,date,text,jsonb,jsonb,jsonb,uuid,uuid)',
    'EXECUTE'
  ),
  'only service_role can execute the commercial period RPC'
);

insert into auth.users(id,email,raw_user_meta_data)
values ('9a200000-0000-4000-8000-000000000001','sprint-9h2-admin@example.invalid','{}');
update public.profiles
set role='admin',status='active',accepted_at=now()
where id='9a200000-0000-4000-8000-000000000001';

insert into public.products(id,brand,model,version,model_year,production_year,is_active,is_public)
select 2080000000 + value, 'Sprint 9H.2', 'Model', 'V' || value, 2031, 2030, true, true
from generate_series(1,3) as value;

insert into public.product_public_prices(
  id,product_id,amount,starts_on,ends_on,price_type,status,source_type,published_at,published_by
) values
  (2080000101,2080000001,200000,'2030-01-01','2031-12-31','msrp','published','manual',now(),'9a200000-0000-4000-8000-000000000001'),
  (2080000102,2080000002,200000,'2019-01-01','2022-12-31','msrp','published','manual',now(),'9a200000-0000-4000-8000-000000000001'),
  (2080000103,2080000003,200000,'2030-01-01','2031-12-31','msrp','published','manual',now(),'9a200000-0000-4000-8000-000000000001');

insert into public.commercial_policies(
  id,product_id,policy_type,scope_type,scope_snapshot,title,starts_on,ends_on,
  calculation_method,fixed_amount,customer_benefit_amount,status,source_type,
  published_at,published_by
) values
  (2080000201,2080000001,'retail_bonus','product_set','{}','Published predecessor','2030-12-01',null,'fixed_amount',1000,1000,'published','manual',now(),'9a200000-0000-4000-8000-000000000001'),
  (2080000202,2080000002,'trade_in_bonus','product_set','{}','Retro predecessor','2019-01-01',null,'fixed_amount',1000,1000,'published','manual',now(),'9a200000-0000-4000-8000-000000000001'),
  (2080000203,2080000003,'loyalty_bonus','product_set','{}','Rollback predecessor','2030-12-01',null,'fixed_amount',1000,1000,'draft','manual',null,null);

insert into public.commercial_offers(
  id,product_id,public_price_id,source_system,source_reference,valid_from,valid_to,
  status,blocking_issues
) values
  (2080000301,2080000001,2080000101,'manual','period-success','2030-12-01','2031-12-31','draft','[]'),
  (2080000302,2080000001,2080000101,'manual','period-archived','2031-02-15','2031-12-31','draft','[]'),
  (2080000303,2080000002,2080000102,'manual','period-retro','2019-01-01','2022-12-31','draft','[]'),
  (2080000304,2080000003,2080000103,'manual','period-rollback','2030-12-01','2031-12-31','draft','[]');
insert into public.commercial_offer_policies(commercial_offer_id,commercial_policy_id)
values
  (2080000301,2080000201),
  (2080000302,2080000201),
  (2080000303,2080000202),
  (2080000304,2080000203);
select public.publish_commercial_offer(2080000301,'9a200000-0000-4000-8000-000000000001',1,'9c200000-0000-4000-8000-000000000011');
select public.archive_commercial_offer(2080000302,1,'9a200000-0000-4000-8000-000000000001','9c200000-0000-4000-8000-000000000012');
select public.publish_commercial_offer(2080000303,'9a200000-0000-4000-8000-000000000001',1,'9c200000-0000-4000-8000-000000000013');

select extensions.throws_ok(
  $$update public.commercial_offers set valid_to='2031-02-09' where id=2080000301$$,
  '55000','published or archived pricing migration fields are immutable',
  'a published Offer cannot be closed outside the commercial period RPC'
);

select extensions.lives_ok($$
  select public.create_commercial_period_draft(
    2080000001,'2031-02-10','2031-02-20','special',
    '[{"clientRowId":"policy-successor","productId":2080000001,"policyType":"retail_bonus","title":"Successor","description":"","startsOn":"1900-01-01","endsOn":null,"amount":"2000","customerBenefitAmount":"2000","expectedPredecessorId":"2080000201","expectedPredecessorLockVersion":"1"}]',
    '[{"clientRowId":"offer-successor","policyRefs":[{"policyClientRowId":"policy-successor"}]}]',
    '[{"offerId":2080000301,"expectedLockVersion":2}]',
    '9a200000-0000-4000-8000-000000000001','9c200000-0000-4000-8000-000000000001'
  )
$$,'special period closes predecessors and creates draft successors atomically');

select extensions.is((select ends_on from public.commercial_policies where id=2080000201),'2031-02-09'::date,'Policy predecessor ends on D-1');
select extensions.is((select valid_to from public.commercial_offers where id=2080000301),'2031-02-09'::date,'Offer predecessor ends on D-1');
select extensions.is((select status::text from public.commercial_offers where id=2080000301),'published','published Offer keeps its lifecycle status');
select extensions.is((select count(*) from public.commercial_offer_policies where commercial_offer_id=2080000301),1::bigint,'published Offer memberships remain unchanged');
select extensions.ok(
  exists(
    select 1 from public.commercial_offers
    where product_id=2080000001 and valid_from='2031-02-10' and valid_to='2031-02-20' and status='draft'
  ),
  'new Offer is draft with the exact special interval'
);
select extensions.ok(
  exists(
    select 1 from public.commercial_policies
    where product_id=2080000001 and starts_on='2031-02-10' and ends_on='2031-02-20' and status='draft'
  ),
  'new Policy is draft with the exact special interval'
);
select extensions.ok(
  exists(
    select 1 from public.pricing_audit_events
    where aggregate_type='commercial_offer'
      and aggregate_id=2080000301
      and correlation_id='9c200000-0000-4000-8000-000000000001'
      and before_snapshot ? 'offer'
      and before_snapshot ? 'policyIds'
      and after_snapshot ? 'offer'
      and after_snapshot ? 'policyIds'
  ),
  'published Offer temporal closing has append-only before/after snapshots and memberships'
);

select extensions.throws_ok($$
  select public.create_commercial_period_draft(
    2080000001,'2031-03-10','2031-03-20','special','[]',
    '[{"clientRowId":"archived-attempt","policyRefs":[{"policyId":2080000201}]}]',
    '[{"offerId":2080000302,"expectedLockVersion":2}]',
    '9a200000-0000-4000-8000-000000000001','9c200000-0000-4000-8000-000000000002'
  )
$$,'23514','affected Offer is not eligible for temporal closing','archived Offer cannot be changed by the RPC');
select extensions.is((select valid_to from public.commercial_offers where id=2080000302),'2031-12-31'::date,'archived Offer remains unchanged');

select extensions.throws_ok($$
  select public.create_commercial_period_draft(
    2080000002,'2020-02-01','2020-02-29','monthly','[]',
    '[{"clientRowId":"retro-attempt","policyRefs":[{"policyId":2080000202}]}]',
    '[{"offerId":2080000303,"expectedLockVersion":2}]',
    '9a200000-0000-4000-8000-000000000001','9c200000-0000-4000-8000-000000000003'
  )
$$,'55000','retroactive closing of a published Offer is not allowed for a monthly period','common monthly flow rejects retroactive published Offer closing');
select extensions.is((select valid_to from public.commercial_offers where id=2080000303),'2022-12-31'::date,'retroactive rejection leaves published Offer unchanged');

select extensions.throws_ok($$
  select public.create_commercial_period_draft(
    2080000003,'2031-02-10','2031-02-28','special',
    '[{"clientRowId":"rollback-policy","productId":2080000003,"policyType":"loyalty_bonus","title":"Rollback successor","description":"","startsOn":"1900-01-01","endsOn":null,"amount":"2000","customerBenefitAmount":"2000","expectedPredecessorId":"2080000203","expectedPredecessorLockVersion":"1"}]',
    '[{"clientRowId":"rollback-offer","policyRefs":[{"policyClientRowId":"rollback-policy"}]}]',
    '[{"offerId":2080000304,"expectedLockVersion":99}]',
    '9a200000-0000-4000-8000-000000000001','9c200000-0000-4000-8000-000000000004'
  )
$$,'40001','affected Offer changed by another operator','stale Offer lock rolls the complete period operation back');
select extensions.is((select ends_on from public.commercial_policies where id=2080000203),null::date,'failed operation restores predecessor Policy');
select extensions.is((select count(*) from public.commercial_policies where product_id=2080000003),1::bigint,'failed operation creates no Policy successor');
select extensions.is((select count(*) from public.commercial_offers where product_id=2080000003),1::bigint,'failed operation creates no Offer successor');

select extensions.throws_ok($$
  select public.create_commercial_period_draft(
    2080000003,'2030-11-01','2030-11-30','monthly','[]',
    '[{"clientRowId":"invalid-close","policyRefs":[{"policyId":2080000203}]}]',
    '[{"offerId":2080000304,"expectedLockVersion":1}]',
    '9a200000-0000-4000-8000-000000000001','9c200000-0000-4000-8000-000000000005'
  )
$$,'23514','commercial Offer cannot end before its valid_from','D-1 cannot precede the Offer valid_from');

select * from extensions.finish();
rollback;
