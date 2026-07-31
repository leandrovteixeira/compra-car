begin;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select has_function('public','update_commercial_policy_draft',array['bigint','integer','jsonb','uuid','uuid'],'draft policy update RPC exists');
select has_function('public','archive_commercial_policy',array['bigint','integer','uuid','uuid'],'policy archive RPC exists');
select has_function('public','replace_commercial_offer_draft',array['bigint','integer','bigint[]','uuid','uuid'],'draft offer replacement RPC exists');
select has_function('public','archive_commercial_offer',array['bigint','integer','uuid','uuid'],'offer archive RPC exists');

insert into auth.users(id,email,raw_user_meta_data) values ('9a000000-0000-4000-8000-000000000001','sprint-9g-admin@example.invalid','{}');
update public.profiles set role='admin',status='active',accepted_at=now() where id='9a000000-0000-4000-8000-000000000001';
insert into public.products(id,brand,model,version,model_year,production_year,is_active,is_public)
values (2099000001,'Sprint 9G','Model','Version',2027,2026,true,true);
insert into public.product_public_prices(id,product_id,amount,starts_on,ends_on,price_type,status,source_type,published_at,published_by)
values (209900001,2099000001,200000,'2026-01-01','2026-12-31','msrp','published','manual',now(),'9a000000-0000-4000-8000-000000000001');
insert into public.commercial_policies(id,product_id,policy_type,scope_type,scope_snapshot,title,starts_on,ends_on,calculation_method,fixed_amount,customer_benefit_amount,status,source_type)
values
 (209900101,2099000001,'retail_bonus','product_set','{}','Livre','2026-08-01','2026-11-30','fixed_amount',1000,1000,'draft','manual'),
 (209900102,2099000001,'trade_in_bonus','product_set','{}','Usada','2026-08-01','2026-11-30','fixed_amount',2000,2000,'draft','manual'),
 (209900103,2099000001,'loyalty_bonus','product_set','{}','Nova membership','2026-08-01','2026-11-30','fixed_amount',500,500,'draft','manual');

select lives_ok($$select public.update_commercial_policy_draft(209900101,1,'{"title":"Livre editada","customerBenefitAmount":"1500","fixedAmount":"1500"}','9a000000-0000-4000-8000-000000000001','9c000000-0000-4000-8000-000000000001')$$,'unused draft policy is editable');
select is((select title from public.commercial_policies where id=209900101),'Livre editada','draft update persisted');

insert into public.commercial_offers(id,product_id,public_price_id,source_system,source_reference,valid_from,valid_to,status,blocking_issues)
values (209900201,2099000001,209900001,'manual','sprint-9g','2026-08-01','2026-11-30','draft','[]');
insert into public.commercial_offer_policies(commercial_offer_id,commercial_policy_id)
values (209900201,209900102);

select throws_ok($$select public.update_commercial_policy_draft(209900102,1,'{"title":"Não pode"}','9a000000-0000-4000-8000-000000000001','9c000000-0000-4000-8000-000000000002')$$,'55000','commercial policy is used by a non-archived commercial offer','used draft policy update is rejected');
select throws_ok($$select public.archive_commercial_policy(209900102,1,'9a000000-0000-4000-8000-000000000001','9c000000-0000-4000-8000-000000000003')$$,'55000','commercial policy is used by a non-archived commercial offer','used draft policy archive is rejected');

select lives_ok($$select public.replace_commercial_offer_draft(209900201,1,array[209900101,209900103],'9a000000-0000-4000-8000-000000000001','9c000000-0000-4000-8000-000000000004')$$,'draft offer memberships are replaced atomically');
select is((select array_agg(commercial_policy_id order by commercial_policy_id) from public.commercial_offer_policies where commercial_offer_id=209900201),array[209900101::bigint,209900103::bigint],'replacement persisted complete membership set');
select throws_ok($$select public.replace_commercial_offer_draft(209900201,1,array[209900102],'9a000000-0000-4000-8000-000000000001','9c000000-0000-4000-8000-000000000005')$$,'40001','commercial offer changed by another operator','stale offer update is rejected');
select lives_ok($$select public.archive_commercial_offer(209900201,2,'9a000000-0000-4000-8000-000000000001','9c000000-0000-4000-8000-000000000006')$$,'draft offer archives');
select is((select count(*) from public.commercial_offer_policies where commercial_offer_id=209900201),2::bigint,'archive preserves memberships');
select lives_ok($$select public.archive_commercial_policy(209900101,2,'9a000000-0000-4000-8000-000000000001','9c000000-0000-4000-8000-000000000007')$$,'policy referenced only by archived offer may archive');
select throws_ok($$select public.archive_commercial_offer(209900201,3,'9a000000-0000-4000-8000-000000000001','9c000000-0000-4000-8000-000000000008')$$,'55000','commercial offer status is not archivable','archived offer cannot archive again');
select cmp_ok((select count(*) from public.pricing_audit_events where correlation_id::text like '9c000000-%'),'>=',4::bigint,'new operations append audit events');

select * from finish();
rollback;
