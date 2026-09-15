-- Run in disposable PostgreSQL only, after 19B (and optionally 19C).
-- psql relative include expects the repository supabase directory structure.
create temp table before_security as
select oid, relname, relrowsecurity, relacl::text as acl from pg_class
where relnamespace='public'::regnamespace and relname in ('agent_runs','agent_findings','agent_evidence','agent_reviews');
insert into public.agent_runs(id,agent_type,status,started_at,completed_at)
values('20000000-0000-4000-8000-000000000001','PRODUCT_YEAR','COMPLETED',now(),now());
insert into public.agent_findings(id,run_id,finding_type,fingerprint,title)
values('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','NEW_PRODUCT_YEAR','legacy','Historical fixture');
\ir ../migrations/20260915163527_sprint_20_model_year.sql
begin;
do $$ begin
 if exists(select 1 from before_security b join pg_class c on c.oid=b.oid where c.relrowsecurity is distinct from b.relrowsecurity or c.relacl::text is distinct from b.acl) then raise exception 'security changed'; end if;
 if (select count(*) from public.agent_runs where agent_type='PRODUCT_YEAR') <> 1 then raise exception 'legacy run lost'; end if;
 if (select count(*) from public.agent_findings where finding_type='NEW_PRODUCT_YEAR') <> 1 then raise exception 'legacy finding lost'; end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename in ('agent_runs','agent_findings','agent_evidence','agent_reviews')) then raise exception 'browser policy exists'; end if;
 if has_table_privilege('anon','public.agent_runs','SELECT') or has_table_privilege('authenticated','public.agent_findings','SELECT') then raise exception 'browser grant exists'; end if;
 if has_table_privilege('service_role','public.agent_findings','UPDATE') or has_table_privilege('service_role','public.agent_reviews','DELETE') then raise exception 'observation/review mutable'; end if;
end $$;
set local role service_role;
insert into public.agent_runs(id,agent_type,status,started_at,completed_at)
values('20000000-0000-4000-8000-000000000003','MODEL_YEAR','COMPLETED',now(),now());
insert into public.agent_findings(id,run_id,finding_type,fingerprint,title,requires_review,proposal)
values('20000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000003','MODEL_YEAR_MATCHED','my-match','MY 2026',false,null),
('20000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000003','NEW_MODEL_YEAR','my-new','MY 2027',true,'{"mmvIdentity":"synthetic","modelYear":2027}');
insert into public.agent_evidence(id,finding_id,source_type,source_url,evidence_fingerprint,excerpt)
values('20000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000005','MODEL_PAGE','https://vw.com.br/modelos','my-evidence','Synthetic Nivus Highline 200 TSI modelo 2027');
insert into public.agent_reviews(id,finding_id,decision) values('20000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000005','ACCEPT');
do $$ begin
 if (select count(*) from public.agent_findings where run_id='20000000-0000-4000-8000-000000000003') <> 2 then raise exception 'MY findings missing'; end if;
 if (select proposal->>'modelYear' from public.agent_findings where id='20000000-0000-4000-8000-000000000005') <> '2027' then raise exception 'review changed proposal'; end if;
end $$;
rollback;
select 'SPRINT_20_LOCAL_SQL_PASSED' as result;
