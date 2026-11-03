-- Management API /database/query/read-only only. One SELECT; no application data or writes.
-- Fully qualified catalog references for supabase_read_only_user.
select
 pg_catalog.current_database() as database_name,
 current_user as database_role,
 pg_catalog.current_setting('server_version_num')::integer as postgres_version_num,
 (pg_catalog.current_setting('transaction_read_only') = 'on') as read_only,
 (select count(*) = 3 from pg_catalog.pg_roles where rolname in ('anon','authenticated','service_role')) as required_roles_present,
 exists(select 1 from pg_catalog.pg_roles where rolname='service_role' and rolbypassrls) as service_bypassrls,
 pg_catalog.has_schema_privilege('service_role','public','USAGE') as service_usage,
 (select count(*)::integer from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and pg_catalog.left(c.relname,8)='watcher_') as watcher_relation_count,
 (select count(*)::integer from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and pg_catalog.left(p.proname,8)='watcher_') as watcher_function_count,
 (select count(*)::integer from pg_catalog.pg_policies
  where schemaname='public' and pg_catalog.left(tablename,8)='watcher_') as watcher_policy_count,
 (select count(*)::integer from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and pg_catalog.left(c.relname,8)='watcher_' and c.relkind in ('r','p') and not c.relrowsecurity) as watcher_rls_disabled_count,
 (select count(*)::integer from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  cross join lateral pg_catalog.aclexplode(c.relacl) a
  where n.nspname='public' and pg_catalog.left(c.relname,8)='watcher_'
   and (a.grantee=0 or a.grantee in (select oid from pg_catalog.pg_roles where rolname in ('anon','authenticated')))) as watcher_browser_grant_count,
 (select count(*)::integer from pg_catalog.pg_event_trigger where evtenabled <> 'D') as enabled_event_trigger_count,
 (select count(*)::integer from pg_catalog.pg_default_acl d
  cross join lateral pg_catalog.aclexplode(d.defaclacl) a
  where d.defaclnamespace in (0,(select oid from pg_catalog.pg_namespace where nspname='public'))
   and (a.grantee=0 or a.grantee in (select oid from pg_catalog.pg_roles where rolname in ('anon','authenticated')))) as default_acl_browser_grant_count;
