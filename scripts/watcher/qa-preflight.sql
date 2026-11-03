-- First QA preflight. Catalog reads only; no setup, grants, fixtures, seeds or migration application.
-- Identity is attested by the mandatory client-side QA guard and TLS-verified exact endpoint.
begin read only;
select current_database() as database_name,current_user as database_role,version() as postgres_version,
 current_setting('transaction_read_only') as read_only,current_setting('statement_timeout') as statement_timeout,
 current_setting('lock_timeout') as lock_timeout;
select rolname,rolbypassrls,rolinherit from pg_roles where rolname in ('anon','authenticated','service_role');
select nspname,has_schema_privilege('service_role',oid,'USAGE') as service_usage
 from pg_namespace where nspname='public';
select c.relname,c.relkind,c.relrowsecurity from pg_class c where c.relnamespace='public'::regnamespace
 and c.relname=any(array['watcher_sources','watcher_source_state','watcher_articles','watcher_feed_items',
 'watcher_candidates','watcher_candidate_evidence','watcher_hints','watcher_batches','watcher_batch_items','watcher_article_revisions']) order by c.relname;
select p.oid::regprocedure::text as signature,p.prosecdef,p.provolatile,p.proconfig from pg_proc p
 where p.pronamespace='public'::regnamespace and p.proname like 'watcher\_%' escape '\' order by signature;
select evtname,evtevent,evtenabled from pg_event_trigger order by evtname;
select defaclrole::regrole::text,defaclnamespace::regnamespace::text,defaclobjtype,defaclacl::text
 from pg_default_acl where defaclnamespace in (0,'public'::regnamespace);
select to_regclass('supabase_migrations.schema_migrations') is not null as migration_history_exists;
-- Read the two allowlisted version rows separately, only if that history table exists.
commit;
