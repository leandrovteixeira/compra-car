begin;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select has_function(
  'public',
  'create_manual_policy_batch_with_rollover',
  array['jsonb','uuid','uuid'],
  'monthly policy rollover RPC exists'
);
select has_function(
  'public',
  'create_commercial_offer_batch_at_reference',
  array['jsonb','uuid','uuid'],
  'reference-date offer batch RPC exists'
);

insert into auth.users(id,email,raw_user_meta_data)
values ('9a100000-0000-4000-8000-000000000001','sprint-9h-admin@example.invalid','{}');
update public.profiles
   set role='admin',status='active',accepted_at=now()
 where id='9a100000-0000-4000-8000-000000000001';

insert into public.products(id,brand,model,version,model_year,production_year,is_active,is_public)
select 2100000000 + value, 'Sprint 9H', 'Model', 'V' || value, 2027, 2026, true, true
  from generate_series(1,9) as value;

insert into public.commercial_policies(
  id,product_id,policy_type,scope_type,scope_snapshot,title,starts_on,ends_on,
  calculation_method,fixed_amount,customer_benefit_amount,status,source_type
) values
 (210000101,2100000001,'retail_bonus','product_set','{}','A open','2026-07-01',null,'fixed_amount',1000,1000,'draft','manual'),
 (210000102,2100000002,'trade_in_bonus','product_set','{}','B finite','2026-07-01','2026-09-30','fixed_amount',1000,1000,'draft','manual'),
 (210000103,2100000003,'loyalty_bonus','product_set','{}','C ended','2026-06-01','2026-06-30','fixed_amount',1000,1000,'draft','manual'),
 (210000104,2100000004,'free_wallbox','product_set','{}','D overlap 1','2026-06-01',null,'fixed_amount',1000,1000,'draft','manual'),
 (210000105,2100000004,'free_wallbox','product_set','{}','D overlap 2','2026-07-01',null,'fixed_amount',1000,1000,'needs_review','manual'),
 (210000106,2100000005,'free_maintenance','product_set','{}','E future','2026-09-01',null,'fixed_amount',1000,1000,'draft','manual'),
 (210000107,2100000006,'fuel_or_recharge_voucher','product_set','{}','F rollback','2026-07-01',null,'fixed_amount',1000,1000,'draft','manual'),
 (210000108,2100000007,'other','product_set','{}','G offer','2026-07-01',null,'fixed_amount',1000,1000,'draft','manual'),
 (210000109,2100000008,'retail_bonus','product_set','{}','H stale','2026-07-01',null,'fixed_amount',1000,1000,'draft','manual'),
 (210000111,2100000009,'loyalty_bonus','product_set','{}','L archived','2026-07-01',null,'fixed_amount',1000,1000,'archived','manual');

insert into public.commercial_policies(
  id,product_id,policy_type,scope_type,scope_snapshot,title,starts_on,ends_on,
  calculation_method,fixed_amount,customer_benefit_amount,status,source_type,published_at,published_by
) values (
  210000110,2100000009,'trade_in_bonus','product_set','{}','K published','2026-07-01',null,
  'fixed_amount',1000,1000,'published','manual',now(),'9a100000-0000-4000-8000-000000000001'
);

select lives_ok($$
  select public.create_manual_policy_batch_with_rollover(
    '[{"clientRowId":"a","productId":2100000001,"policyType":"retail_bonus","title":"A successor","description":"","startsOn":"2026-08-01","endsOn":null,"amount":"2000","customerBenefitAmount":"2000","expectedPredecessorId":"210000101","expectedPredecessorLockVersion":"1"}]',
    '9a100000-0000-4000-8000-000000000001','9c100000-0000-4000-8000-000000000001'
  )
$$,'open predecessor rolls over with its successor');
select is((select ends_on from public.commercial_policies where id=210000101),'2026-07-31'::date,'open predecessor ends on D-1');
select is((select lock_version from public.commercial_policies where id=210000101),2,'predecessor lock_version increments exactly once');

select lives_ok($$
  select public.create_manual_policy_batch_with_rollover(
    '[{"clientRowId":"b","productId":2100000002,"policyType":"trade_in_bonus","title":"B successor","description":"","startsOn":"2026-08-01","endsOn":null,"amount":"2000","customerBenefitAmount":"2000","expectedPredecessorId":"210000102","expectedPredecessorLockVersion":"1"}]',
    '9a100000-0000-4000-8000-000000000001','9c100000-0000-4000-8000-000000000002'
  )
$$,'finite predecessor rolls over');
select is((select ends_on from public.commercial_policies where id=210000102),'2026-07-31'::date,'finite predecessor ends on D-1');

select lives_ok($$
  select public.create_manual_policy_batch_with_rollover(
    '[{"clientRowId":"c","productId":2100000003,"policyType":"loyalty_bonus","title":"C successor","description":"","startsOn":"2026-08-01","endsOn":null,"amount":"2000","customerBenefitAmount":"2000"}]',
    '9a100000-0000-4000-8000-000000000001','9c100000-0000-4000-8000-000000000003'
  )
$$,'an already ended policy is not a predecessor');
select is((select ends_on from public.commercial_policies where id=210000103),'2026-06-30'::date,'ended policy remains unchanged');

select throws_ok($$
  select public.create_manual_policy_batch_with_rollover(
    '[{"clientRowId":"d","productId":2100000004,"policyType":"free_wallbox","title":"D successor","description":"","startsOn":"2026-08-01","endsOn":null,"amount":"2000","customerBenefitAmount":"2000","expectedPredecessorId":"210000104","expectedPredecessorLockVersion":"1"}]',
    '9a100000-0000-4000-8000-000000000001','9c100000-0000-4000-8000-000000000004'
  )
$$,'23514','policy timeline has multiple overlapping predecessors','multiple predecessors reject the complete batch');

select throws_ok($$
  select public.create_manual_policy_batch_with_rollover(
    '[{"clientRowId":"e","productId":2100000005,"policyType":"free_maintenance","title":"E retroactive","description":"","startsOn":"2026-08-01","endsOn":null,"amount":"2000","customerBenefitAmount":"2000"}]',
    '9a100000-0000-4000-8000-000000000001','9c100000-0000-4000-8000-000000000005'
  )
$$,'23505','a current or future policy of the same type already exists; retroactive insertion is not allowed','future policy rejects retroactive insertion');

select throws_ok($$
  select public.create_manual_policy_batch_with_rollover(
    '[{"clientRowId":"f","productId":2100000006,"policyType":"fuel_or_recharge_voucher","title":"F invalid successor","description":"","startsOn":"2026-08-01","endsOn":null,"amount":"-1","customerBenefitAmount":"-1","voucherType":"unspecified","expectedPredecessorId":"210000107","expectedPredecessorLockVersion":"1"}]',
    '9a100000-0000-4000-8000-000000000001','9c100000-0000-4000-8000-000000000006'
  )
$$,'22023','fixed benefit must be positive','successor failure rolls predecessor back');
select is((select ends_on from public.commercial_policies where id=210000107),null::date,'predecessor remains open after successor failure');

insert into public.product_public_prices(id,product_id,amount,starts_on,ends_on,price_type,status,source_type,published_at,published_by)
values (210000201,2100000007,200000,'2026-01-01','2026-12-31','msrp','published','manual',now(),'9a100000-0000-4000-8000-000000000001');
insert into public.commercial_offers(id,product_id,public_price_id,source_system,source_reference,valid_from,valid_to,status,blocking_issues)
values (210000301,2100000007,210000201,'manual','sprint-9h','2026-07-01','2026-08-31','draft','[]');
insert into public.commercial_offer_policies(commercial_offer_id,commercial_policy_id)
values (210000301,210000108);
select throws_ok($$
  select public.create_manual_policy_batch_with_rollover(
    '[{"clientRowId":"g","productId":2100000007,"policyType":"other","title":"G successor","description":"required","startsOn":"2026-08-01","endsOn":null,"amount":"2000","customerBenefitAmount":"2000","expectedPredecessorId":"210000108","expectedPredecessorLockVersion":"1"}]',
    '9a100000-0000-4000-8000-000000000001','9c100000-0000-4000-8000-000000000007'
  )
$$,'55000','policy rollover would invalidate a non-archived commercial offer','rollover failure creates no successor');
select is((select count(*) from public.commercial_policies where product_id=2100000007),1::bigint,'failed rollover creates no policy');
select is((select count(*) from public.commercial_offer_policies where commercial_offer_id=210000301),1::bigint,'historical membership remains intact');

select throws_ok($$
  select public.create_manual_policy_batch_with_rollover(
    '[{"clientRowId":"h","productId":2100000008,"policyType":"retail_bonus","title":"H successor","description":"","startsOn":"2026-08-01","endsOn":null,"amount":"2000","customerBenefitAmount":"2000","expectedPredecessorId":"210000109","expectedPredecessorLockVersion":"99"}]',
    '9a100000-0000-4000-8000-000000000001','9c100000-0000-4000-8000-000000000008'
  )
$$,'40001','policy rollover failed: stale predecessor lock_version','stale predecessor rolls the batch back');

select throws_ok(
  $$update public.commercial_policies set ends_on='2026-07-31' where id=210000110$$,
  '55000','published or archived commercial policy economic identity is immutable',
  'published predecessor cannot be changed directly'
);
select lives_ok($$
  select public.create_manual_policy_batch_with_rollover(
    '[{"clientRowId":"k","productId":2100000009,"policyType":"trade_in_bonus","title":"K successor","description":"","startsOn":"2026-08-01","endsOn":null,"amount":"2000","customerBenefitAmount":"2000","expectedPredecessorId":"210000110","expectedPredecessorLockVersion":"1"}]',
    '9a100000-0000-4000-8000-000000000001','9c100000-0000-4000-8000-000000000009'
  )
$$,'published predecessor changes only through the authorized rollover');
select is((select ends_on from public.commercial_policies where id=210000111),null::date,'archived policy does not participate');
select cmp_ok(
  (select count(*) from public.pricing_audit_events where correlation_id='9c100000-0000-4000-8000-000000000009'),
  '>=',3::bigint,
  'successor, batch and rollover audits share the correlation id'
);
select ok(
  exists(
    select 1 from public.pricing_audit_events
     where aggregate_id=210000110
       and reason='monthly commercial policy temporal rollover'
       and after_snapshot ? 'successorPolicyId'
  ),
  'rollover audit contains predecessor snapshots and successor id'
);
select throws_ok($$
  select public.create_commercial_offer_batch_at_reference(
    '[{"clientRowId":"matrix","productId":2100000003,"policyIds":[210000103],"referenceDate":"2026-08-01"}]',
    '9a100000-0000-4000-8000-000000000001','9c100000-0000-4000-8000-000000000010'
  )
$$,'23514','offer batch contains a policy that is not applicable on the reference date','offer matrix is enforced at the reference date in the database');

select * from finish();
rollback;
