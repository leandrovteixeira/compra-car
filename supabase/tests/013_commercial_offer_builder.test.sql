begin;
select plan(5);
select has_function('public','create_commercial_offer_with_policies',array['integer','bigint','date','date','bigint[]','uuid','uuid'],'offer builder RPC exists');
select function_lang_is('public','create_commercial_offer_with_policies',array['integer','bigint','date','date','bigint[]','uuid','uuid'],'plpgsql','RPC is plpgsql');
select function_returns('public','create_commercial_offer_with_policies',array['integer','bigint','date','date','bigint[]','uuid','uuid'],'jsonb','RPC returns jsonb');
select is((select prosecdef from pg_proc where oid='public.create_commercial_offer_with_policies(integer,bigint,date,date,bigint[],uuid,uuid)'::regprocedure),true,'RPC is security definer');
select is((select proconfig from pg_proc where oid='public.create_commercial_offer_with_policies(integer,bigint,date,date,bigint[],uuid,uuid)'::regprocedure),array['search_path='],'RPC has empty search_path');
select * from finish();
rollback;
