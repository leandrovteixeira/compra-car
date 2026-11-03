-- QA postflight: read-only catalog inspection. No DDL, DML, fixtures, temporary grants or RPC mutations.
-- The guarded deployment procedure MUST attest the QA connection before sending this file.
begin read only;
with expected(name) as (values
 ('watcher_sources'),('watcher_source_state'),('watcher_articles'),('watcher_feed_items'),
 ('watcher_candidates'),('watcher_candidate_evidence'),('watcher_hints'),
 ('watcher_batches'),('watcher_batch_items'),('watcher_article_revisions')),
tables as (select e.name,c.oid,c.relrowsecurity from expected e left join pg_class c
 on c.relnamespace='public'::regnamespace and c.relname=e.name and c.relkind='r')
select 'table_security:'||name as check_name,
 coalesce(oid is not null and relrowsecurity
 and not has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 and not has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 and not has_any_column_privilege('anon',oid,'SELECT,INSERT,UPDATE,REFERENCES')
 and not has_any_column_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,REFERENCES')
 and has_table_privilege('service_role',oid,'SELECT')
 and has_table_privilege('service_role',oid,'INSERT')
 and not has_table_privilege('service_role',oid,'DELETE,TRUNCATE,REFERENCES,TRIGGER')
 and not exists(select 1 from pg_policy where polrelid=oid),false) as passed
from tables order by name;

-- Only inspect constraints whose ORIGIN is one of the ten Watcher tables.
with expected(name) as (values
 ('watcher_sources'),('watcher_source_state'),('watcher_articles'),('watcher_feed_items'),
 ('watcher_candidates'),('watcher_candidate_evidence'),('watcher_hints'),
 ('watcher_batches'),('watcher_batch_items'),('watcher_article_revisions'))
select 'constraints:'||e.name as check_name,
 count(*) filter(where k.contype='p')=1 and count(*) filter(where k.contype='c')>=1
 and bool_and(k.convalidated) as passed
from expected e left join pg_class t on t.relnamespace='public'::regnamespace and t.relname=e.name
left join pg_constraint k on k.conrelid=t.oid group by e.name order by e.name;

select 'foreign_keys' as check_name, count(*)=14
 and bool_and(k.confrelid in (select oid from pg_class where relnamespace='public'::regnamespace
 and relname=any(array['watcher_sources','watcher_source_state','watcher_articles','watcher_feed_items',
 'watcher_candidates','watcher_candidate_evidence','watcher_hints','watcher_batches','watcher_batch_items','watcher_article_revisions'])))
 and bool_and(k.confdeltype='r' or k.conname='watcher_feed_current_revision_fk')
 and count(*) filter(where k.conname='watcher_feed_current_revision_fk' and k.condeferrable and k.condeferred)=1
 as passed
from pg_constraint k join pg_class t on t.oid=k.conrelid
where t.relnamespace='public'::regnamespace and t.relname=any(array['watcher_sources','watcher_source_state',
 'watcher_articles','watcher_feed_items','watcher_candidates','watcher_candidate_evidence','watcher_hints',
 'watcher_batches','watcher_batch_items','watcher_article_revisions']) and k.contype='f';

-- Match each FK's columns and target, not merely its name/count.
with expected(child,child_columns,parent,parent_columns) as (values
 ('watcher_source_state',array['source_id'],'watcher_sources',array['id']),
 ('watcher_batches',array['source_id'],'watcher_sources',array['id']),
 ('watcher_feed_items',array['source_id'],'watcher_sources',array['id']),
 ('watcher_feed_items',array['article_id'],'watcher_articles',array['id']),
 ('watcher_article_revisions',array['article_id'],'watcher_articles',array['id']),
 ('watcher_article_revisions',array['feed_item_id'],'watcher_feed_items',array['id']),
 ('watcher_feed_items',array['current_revision_id','id','article_id'],'watcher_article_revisions',array['id','feed_item_id','article_id']),
 ('watcher_batch_items',array['batch_id'],'watcher_batches',array['id']),
 ('watcher_batch_items',array['feed_item_id'],'watcher_feed_items',array['id']),
 ('watcher_batch_items',array['revision_id'],'watcher_article_revisions',array['id']),
 ('watcher_candidate_evidence',array['candidate_id'],'watcher_candidates',array['id']),
 ('watcher_candidate_evidence',array['revision_id'],'watcher_article_revisions',array['id']),
 ('watcher_hints',array['candidate_id'],'watcher_candidates',array['id']),
 ('watcher_hints',array['evidence_id','candidate_id','candidate_version'],'watcher_candidate_evidence',array['id','candidate_id','candidate_version'])),
actual as (select k.*,t.relname as child,p.relname as parent,
 array(select a.attname::text from unnest(k.conkey) with ordinality x(num,ord)
 join pg_attribute a on a.attrelid=k.conrelid and a.attnum=x.num order by x.ord) as child_columns,
 array(select a.attname::text from unnest(k.confkey) with ordinality x(num,ord)
 join pg_attribute a on a.attrelid=k.confrelid and a.attnum=x.num order by x.ord) as parent_columns
 from pg_constraint k join pg_class t on t.oid=k.conrelid join pg_class p on p.oid=k.confrelid
 where k.contype='f' and t.relnamespace='public'::regnamespace and p.relnamespace='public'::regnamespace)
select 'fk:'||e.child||':'||array_to_string(e.child_columns,',') as check_name,
 count(a.oid)=1 and coalesce(bool_and(a.convalidated),false) as passed
from expected e left join actual a on a.child=e.child and a.parent=e.parent
 and a.child_columns=e.child_columns and a.parent_columns=e.parent_columns
 group by e.child,e.child_columns order by check_name;

-- Signature discovery also catches missing RPCs and accidental security-definer changes.
with expected(signature,volatility) as (values
 ('public.watcher_register_source(jsonb,jsonb,bigint)','v'),
 ('public.watcher_claim_source(text,text,integer)','v'),
 ('public.watcher_release_source(text,uuid,text)','v'),
 ('public.watcher_persist_batch(uuid,uuid,bigint,bigint,jsonb)','v'),
 ('public.watcher_stage_candidate(jsonb,bigint)','v'),
 ('public.watcher_attach_evidence(jsonb)','v'),
 ('public.watcher_prepare_hint(uuid,uuid,bigint)','v'),
 ('public.watcher_query(text,text,integer,integer)','s'),
 ('public.watcher_array_digest(text,text[])','i'),
 ('public.watcher_batch_receipt(public.watcher_batches,boolean)','s'),
 ('public.watcher_text_ok(text,integer)','i'),('public.watcher_exact_object(jsonb,text[])','i'),
 ('public.watcher_url_ok(text)','i'),('public.watcher_hosts_ok(jsonb)','i'),
 ('public.watcher_strings_ok(jsonb,text[],text[])','i'),('public.watcher_aliases_ok(jsonb)','i'),
 ('public.watcher_immutable()','v'))
select 'function:'||e.signature as check_name,
 coalesce(p.oid is not null and not p.prosecdef and p.provolatile::text=e.volatility
 and 'search_path=""'=any(p.proconfig)
 and p.prorettype=case
   when p.proname='watcher_release_source' then 'boolean'::regtype
   when p.proname in ('watcher_array_digest') then 'text'::regtype
   when p.proname='watcher_immutable' then 'trigger'::regtype
   when p.proname in ('watcher_text_ok','watcher_exact_object','watcher_url_ok','watcher_hosts_ok','watcher_strings_ok','watcher_aliases_ok') then 'boolean'::regtype
   else 'jsonb'::regtype end
 and has_function_privilege('service_role',p.oid,'EXECUTE')
 and not has_function_privilege('anon',p.oid,'EXECUTE')
 and not has_function_privilege('authenticated',p.oid,'EXECUTE'),false) as passed
from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature) order by e.signature;

-- PostgREST named RPC arguments must match the adapter's actual request keys.
with expected(name,args) as (values
 ('watcher_register_source',array['p_source','p_settings','p_expected_version']),
 ('watcher_claim_source',array['p_source_id','p_owner','p_ttl_seconds']),
 ('watcher_release_source',array['p_source_id','p_token','p_failure_code']),
 ('watcher_persist_batch',array['p_batch_id','p_token','p_config_version','p_state_version','p_payload']),
 ('watcher_stage_candidate',array['p_candidate','p_expected_version']),
 ('watcher_attach_evidence',array['p_evidence']),
 ('watcher_prepare_hint',array['p_candidate_id','p_evidence_id','p_expected_version']),
 ('watcher_query',array['p_kind','p_filter','p_limit','p_offset']))
select 'rpc_arguments:'||e.name as check_name,count(p.oid)=1 and bool_and(p.proargnames=e.args) as passed
from expected e left join pg_proc p on p.pronamespace='public'::regnamespace and p.proname=e.name
 group by e.name,e.args order by e.name;

-- Check named operational indexes plus all unique/primary constraint indexes.
with expected(name) as (values
 ('watcher_source_state_lease_idx'),('watcher_batches_source_observed_idx'),
 ('watcher_articles_last_seen_idx'),('watcher_feed_items_article_idx'),
 ('watcher_revisions_article_idx'),('watcher_batch_items_revision_idx'),('watcher_batch_items_feed_idx'),
 ('watcher_candidates_status_idx'),('watcher_candidate_evidence_revision_idx'),('watcher_hints_evidence_idx'))
select 'index:'||e.name as check_name,coalesce(i.indisvalid and i.indisready,false) as passed
from expected e left join pg_class c on c.relnamespace='public'::regnamespace and c.relname=e.name
left join pg_index i on i.indexrelid=c.oid order by e.name;
select 'unique_constraints' as check_name,count(*)=9 and bool_and(i.indisvalid and i.indisready) as passed
from pg_constraint k join pg_class t on t.oid=k.conrelid join pg_index i on i.indexrelid=k.conindid
where t.relnamespace='public'::regnamespace and t.relname=any(array['watcher_sources','watcher_source_state',
 'watcher_articles','watcher_feed_items','watcher_candidates','watcher_candidate_evidence','watcher_hints',
 'watcher_batches','watcher_batch_items','watcher_article_revisions']) and k.contype='u';
-- Effective column UPDATE grants must match the exact mutable-column allowlist.
with allowed(name,columns) as (values
 ('watcher_sources',array['feed_url','definition','settings','config_version','updated_at']),
 ('watcher_source_state',array['state_version','etag','last_modified','last_successful_observed_at','last_attempt_at','consecutive_failures','last_failure_code','lease_token','lease_owner','lease_expires_at']),
 ('watcher_articles',array['first_seen_at','last_seen_at']),
 ('watcher_feed_items',array['article_id','current_revision_id','current_observed_at','last_seen_at']),
 ('watcher_candidates',array['identity_key','brand','model_hint','project_code','aliases','status','version','updated_at']),
 ('watcher_batches',array[]::text[]),('watcher_batch_items',array[]::text[]),
 ('watcher_article_revisions',array[]::text[]),('watcher_candidate_evidence',array[]::text[]),('watcher_hints',array[]::text[]))
select 'update_columns:'||e.name as check_name,
 coalesce(bool_and(has_column_privilege('service_role',t.oid,a.attnum,'UPDATE')=(a.attname=any(e.columns))),false) as passed
from allowed e left join pg_class t on t.relnamespace='public'::regnamespace and t.relname=e.name
left join pg_attribute a on a.attrelid=t.oid and a.attnum>0 and not a.attisdropped group by e.name order by e.name;

with expected(table_name,trigger_name) as (values
 ('watcher_article_revisions','watcher_revisions_immutable'),('watcher_batches','watcher_batches_immutable'),
 ('watcher_batch_items','watcher_batch_items_immutable'),('watcher_candidate_evidence','watcher_evidence_immutable'),
 ('watcher_hints','watcher_hints_immutable'))
select 'immutable:'||e.table_name as check_name,
 coalesce(g.tgenabled='O' and g.tgfoid=to_regprocedure('public.watcher_immutable()'),false) as passed
from expected e left join pg_class t on t.relnamespace='public'::regnamespace and t.relname=e.table_name
left join pg_trigger g on g.tgrelid=t.oid and g.tgname=e.trigger_name;

-- Inventory is emitted for review; only Watcher objects are included.
select t.relname as table_name,k.conname,k.contype,pg_get_constraintdef(k.oid) as definition
from pg_constraint k join pg_class t on t.oid=k.conrelid
where t.relnamespace='public'::regnamespace and t.relname=any(array['watcher_sources','watcher_source_state',
 'watcher_articles','watcher_feed_items','watcher_candidates','watcher_candidate_evidence','watcher_hints',
 'watcher_batches','watcher_batch_items','watcher_article_revisions']) order by t.relname,k.conname;
select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename=any(array[
 'watcher_sources','watcher_source_state','watcher_articles','watcher_feed_items','watcher_candidates',
 'watcher_candidate_evidence','watcher_hints','watcher_batches','watcher_batch_items','watcher_article_revisions'])
 order by tablename,indexname;
select 'postgrest_role' as check_name,coalesce((select rolbypassrls from pg_roles where rolname='service_role'),false)
 and has_schema_privilege('service_role','public','USAGE') as passed;
-- SQL cannot prove gateway exposure/schema-cache freshness. HTTP RPC smoke remains a separate QA gate.
commit;
