begin;
select plan(8);

select has_function('public','rollover_product_public_price',array['bigint','bigint','uuid','integer','integer','uuid'],'controlled rollover RPC exists');
select function_returns('public','rollover_product_public_price',array['bigint','bigint','uuid','integer','integer','uuid'],'product_public_prices','rollover returns predecessor');
select is((select prosecdef from pg_proc where oid='public.rollover_product_public_price(bigint,bigint,uuid,integer,integer,uuid)'::regprocedure),true,'rollover is security definer');
select is(replace((select proconfig[1] from pg_proc where oid='public.rollover_product_public_price(bigint,bigint,uuid,integer,integer,uuid)'::regprocedure),'"',''),'search_path=','rollover has empty search_path');
select ok(has_function_privilege('service_role','public.rollover_product_public_price(bigint,bigint,uuid,integer,integer,uuid)','EXECUTE'),'service role can execute rollover');
select ok(not has_function_privilege('authenticated','public.rollover_product_public_price(bigint,bigint,uuid,integer,integer,uuid)','EXECUTE'),'authenticated cannot execute rollover');
select function_returns('public','publish_product_public_price',array['bigint','uuid','integer','uuid'],'product_public_prices','publication contract is preserved');
select function_lang_is('public','prevent_terminal_product_public_price_v2_change',array[]::text[],'plpgsql','terminal guard remains active');

select * from finish();
rollback;
