-- Runs ONLY in the isolated disposable database; all fixture/temporary grant changes roll back.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'ASSERTION FAILED: %',label; end if; end $$;
select pg_temp.assert_true((select count(*)=10 and bool_and(relrowsecurity) from pg_class where relnamespace='public'::regnamespace and relname like 'watcher_%' and relkind='r'),'RLS enabled on all ten tables');
select pg_temp.assert_true(not exists(select 1 from pg_class c cross join (values ('anon'),('authenticated'))r(role_name) where c.relnamespace='public'::regnamespace and c.relname like 'watcher_%' and c.relkind='r' and (has_table_privilege(r.role_name,c.oid,'SELECT') or has_table_privilege(r.role_name,c.oid,'INSERT') or has_table_privilege(r.role_name,c.oid,'UPDATE') or has_table_privilege(r.role_name,c.oid,'DELETE'))),'browser table ACLs');
select pg_temp.assert_true(not exists(select 1 from pg_class c where c.relnamespace='public'::regnamespace and c.relname like 'watcher_%' and c.relkind='r' and (has_table_privilege('service_role',c.oid,'DELETE') or has_table_privilege('service_role',c.oid,'TRUNCATE'))),'service_role cannot delete/truncate');
select pg_temp.assert_true(not exists(select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'watcher_%' and (p.prosecdef or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))),'invoker RPCs and no browser execute');
select pg_temp.assert_true((select count(*)>=20 from pg_indexes where schemaname='public' and tablename like 'watcher_%'),'indexes and unique identities');
select pg_temp.assert_true((select count(*)=0 from pg_constraint where connamespace='public'::regnamespace and contype='f' and confrelid not in (select oid from pg_class where relnamespace='public'::regnamespace and relname like 'watcher_%')),'no canonical/legacy FK coupling');
select pg_temp.assert_true(not has_table_privilege('service_role','public.watcher_article_revisions','UPDATE') and not has_table_privilege('service_role','public.watcher_hints','UPDATE'),'immutable observations grants');
select public.watcher_register_source('{"id":"rls","feedUrl":"https://rls.example.org/rss","editorialMarket":"BR","language":"pt-BR","sourceRank":1,"enabled":true}'::jsonb,'{"requestUrl":"https://rls.example.org/rss","allowedHosts":["rls.example.org"],"allowedArticleHosts":["rls.example.org"],"allowRelativeUrls":false,"pollIntervalSeconds":3600}'::jsonb);
-- Even temporarily granting SELECT cannot bypass the absence of RLS policies.
grant select on public.watcher_sources to anon,authenticated;
set local role anon;
do $$ begin if (select count(*) from public.watcher_sources)<>0 then raise exception 'RLS ANON LEAK'; end if; end $$;
reset role;
set local role authenticated;
do $$ begin if (select count(*) from public.watcher_sources)<>0 then raise exception 'RLS AUTHENTICATED LEAK'; end if; end $$;
reset role;
-- EXECUTE is denied before a privileged RPC can touch data.
do $$ begin
 execute 'set local role anon';
 begin perform public.watcher_claim_source('rls','intruder',60); raise exception 'RPC ALLOWED'; exception when insufficient_privilege then null; end;
 execute 'reset role';
end $$;
select pg_temp.assert_true(public.watcher_array_digest('watcher-item/1',array['rss-br','GUID','opaque-guid'])='watcher-item/1:sha256:e330ebae73b4f55df2623bda86f90990d75b82be0f739d1bae579334c5cda0ff','Core v1 golden identity');
select pg_temp.assert_true(public.watcher_array_digest('watcher-evidence/1',array['watcher-url/1','watcher-item/1:sha256:e330ebae73b4f55df2623bda86f90990d75b82be0f739d1bae579334c5cda0ff','https://auto.example.br/article','Lançamento na Europa',null,'2026-10-20T12:00:00.000Z',null])='watcher-evidence/1:sha256:2a7c93993f02a368b22281d79c000ae79f1698e67b9ded364991ed96ae7bef03','Core v1 golden evidence with Unicode');
select pg_temp.assert_true(public.watcher_text_ok(repeat(U&'\+01F697',250),500) and not public.watcher_text_ok(repeat(U&'\+01F697',251),500),'SQL limits count UTF-16 units like Core');
do $$
declare t timestamptz:=clock_timestamp(); a uuid:=gen_random_uuid();
begin
 begin
  insert into public.watcher_articles(id,canonical_url,first_seen_at,last_seen_at) values(a,'https://deferred.example.org/a',t,t);
  insert into public.watcher_feed_items(id,source_id,item_key,guid,article_id,current_revision_id,current_observed_at,first_seen_at,last_seen_at) values(gen_random_uuid(),'rls','watcher-item/1:sha256:'||repeat('a',64),'guid',a,gen_random_uuid(),t,t,t);
  set constraints public.watcher_feed_current_revision_fk immediate;
  raise exception 'MISSING CURRENT REVISION ALLOWED';
 exception when foreign_key_violation then null;
 end;
end $$;
-- Structural/size checks must reject rather than truncate or store unknown content.
do $$ begin
 begin insert into public.watcher_sources(id,feed_url,definition,settings) select 'bad','https://bad.example.org/rss',definition||'{"id":"bad","feedUrl":"https://bad.example.org/rss","sourceRank":null}',settings from public.watcher_sources limit 1; raise exception 'NULL RANK ALLOWED'; exception when check_violation then null; end;
 begin insert into public.watcher_candidates(id,identity_key,brand,model_hint,aliases,status) values(gen_random_uuid(),'watcher-candidate/1:sha256:'||repeat('a',64),'Brand','Model','[12]','OBSERVED'); raise exception 'INVALID ALIASES ALLOWED'; exception when check_violation then null; end;
 begin update public.watcher_batches set status='FAILED'; exception when others then raise; end;
end $$;
rollback;
