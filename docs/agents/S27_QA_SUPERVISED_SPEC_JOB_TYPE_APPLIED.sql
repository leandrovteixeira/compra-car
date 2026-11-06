-- Sprint 27 / Compra Car Staging ONLY.
-- Applied via Supabase migration s27_qa_supervised_spec_job_type on 2026-11-05.
-- Do not run again or apply to Production without a separate release review.
-- No jobs are created; the active worker is unaffected until deployed.
alter table public.agent_jobs
  drop constraint if exists agent_jobs_job_type_check;
alter table public.agent_jobs
  add constraint agent_jobs_job_type_check
  check (job_type = any (array[
    'MMV_DISCOVERY','BRAND_CONNECTOR','SOURCE_MONITOR',
    'PRODUCT_YEAR','PRICE_INTELLIGENCE','FIPE_DISCOVERY',
    'SPEC_INTELLIGENCE'
  ]));
