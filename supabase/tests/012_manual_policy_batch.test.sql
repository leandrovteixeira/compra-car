begin;
select plan(5);
select has_function('public','create_manual_policy_batch',array['jsonb','uuid','uuid'],'manual policy batch RPC exists');
select function_lang_is('public','create_manual_policy_batch',array['jsonb','uuid','uuid'],'plpgsql','RPC is plpgsql');
select function_returns('public','create_manual_policy_batch',array['jsonb','uuid','uuid'],'jsonb','RPC returns jsonb');
select is((select prosecdef from pg_proc where oid='public.create_manual_policy_batch(jsonb,uuid,uuid)'::regprocedure),true,'RPC is security definer');
select is((select proconfig from pg_proc where oid='public.create_manual_policy_batch(jsonb,uuid,uuid)'::regprocedure),array['search_path='],'RPC has empty search_path');
select * from finish();
rollback;
