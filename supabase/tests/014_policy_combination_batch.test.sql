begin;
set local search_path = extensions, public, pg_catalog;
select no_plan();
select has_function('public','create_commercial_offer_batch',array['jsonb','uuid','uuid'],'policy combination batch RPC exists');
select is((select prosecdef from pg_proc where oid='public.create_commercial_offer_batch(jsonb,uuid,uuid)'::regprocedure),true,'batch RPC is security definer');

insert into auth.users(id,email,raw_user_meta_data) values ('ad000000-0000-4000-8000-000000000001','combination-admin@example.invalid','{}');
update public.profiles set role='admin',status='active',accepted_at=now() where id='ad000000-0000-4000-8000-000000000001';
insert into public.products(id,brand,model,version,model_year,production_year,is_active,is_public) values
 (2135000001,'Combination','A','Open policy finite MSRP',2026,2026,true,true),
 (2135000002,'Combination','B','Finite policy open MSRP',2026,2026,true,true),
 (2135000003,'Combination','C','Earliest policy end',2026,2026,true,true),
 (2135000004,'Combination','D','All open',2026,2026,true,true),
 (2135000005,'Combination','E','Atomic valid row',2026,2026,true,true);
insert into public.product_public_prices(id,product_id,amount,starts_on,ends_on,price_type,status,source_type,published_at,published_by,source_reference) values
 (213500001,2135000001,200000,'2026-01-01','2026-12-31','msrp','published','manual',now(),'ad000000-0000-4000-8000-000000000001','combination-a'),
 (213500002,2135000002,200000,'2026-01-01',null,'msrp','published','manual',now(),'ad000000-0000-4000-8000-000000000001','combination-b'),
 (213500003,2135000003,200000,'2026-01-01',null,'msrp','published','manual',now(),'ad000000-0000-4000-8000-000000000001','combination-c'),
 (213500004,2135000004,200000,'2026-01-01',null,'msrp','published','manual',now(),'ad000000-0000-4000-8000-000000000001','combination-d'),
 (213500005,2135000005,200000,'2026-01-01','2026-12-31','msrp','published','manual',now(),'ad000000-0000-4000-8000-000000000001','combination-e');
insert into public.commercial_policies(id,product_id,policy_type,scope_type,scope_snapshot,title,starts_on,ends_on,calculation_method,fixed_amount,customer_benefit_amount,status,source_type) values
 (213500101,2135000001,'retail_bonus','product_set','{}','A','2026-08-01',null,'fixed_amount',1000,1000,'draft','manual'),
 (213500102,2135000002,'retail_bonus','product_set','{}','B','2026-08-01','2026-10-15','fixed_amount',1000,1000,'draft','manual'),
 (213500103,2135000003,'retail_bonus','product_set','{}','C1','2026-08-01','2026-11-30','fixed_amount',1000,1000,'draft','manual'),
 (213500104,2135000003,'loyalty_bonus','product_set','{}','C2','2026-07-01','2026-09-30','fixed_amount',500,500,'draft','manual'),
 (213500105,2135000004,'retail_bonus','product_set','{}','D','2026-08-01',null,'fixed_amount',1000,1000,'draft','manual'),
 (213500106,2135000005,'retail_bonus','product_set','{}','E','2026-08-01',null,'fixed_amount',1000,1000,'draft','manual');

create temporary table combination_results(case_name text,payload jsonb);
insert into combination_results values
 ('A',public.create_commercial_offer_batch('[{"clientRowId":"a","productId":2135000001,"policyIds":[213500101]}]','ad000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000001')),
 ('B',public.create_commercial_offer_batch('[{"clientRowId":"b","productId":2135000002,"policyIds":[213500102]}]','ad000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000002')),
 ('C',public.create_commercial_offer_batch('[{"clientRowId":"c","productId":2135000003,"policyIds":[213500103,213500104]}]','ad000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000003'));
select is((select valid_to from public.commercial_offers where product_id=2135000001),'2026-12-31'::date,'A uses finite MSRP end');
select is((select valid_to from public.commercial_offers where product_id=2135000002),'2026-10-15'::date,'B uses finite policy end');
select is((select valid_to from public.commercial_offers where product_id=2135000003),'2026-09-30'::date,'C uses earliest policy end');
select throws_ok($$select public.create_commercial_offer_batch('[{"clientRowId":"d","productId":2135000004,"policyIds":[213500105]}]','ad000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000004')$$,'23514','NÃ£o foi possÃ­vel derivar uma vigÃªncia final concreta: as polÃ­ticas e o preÃ§o pÃºblico selecionado nÃ£o possuem data final.','D rejects all-open combination explicitly');
select throws_ok($$select public.create_commercial_offer_batch('[{"clientRowId":"e","productId":2135000005,"policyIds":[213500106]},{"clientRowId":"d2","productId":2135000004,"policyIds":[213500105]}]','ad000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000005')$$,'23514','NÃ£o foi possÃ­vel derivar uma vigÃªncia final concreta: as polÃ­ticas e o preÃ§o pÃºblico selecionado nÃ£o possuem data final.','E rejects complete mixed batch');
select is((select count(*) from public.commercial_offers where product_id=2135000005),0::bigint,'E leaves zero offers from otherwise valid rows');
select * from finish();
rollback;
