-- QA-only job type expansion. The Price worker defaults to deterministic mode;
-- LLM remains disabled unless separately configured and authorized.
alter table public.agent_jobs drop constraint if exists agent_jobs_job_type_check;
alter table public.agent_jobs
  add constraint agent_jobs_job_type_check
  check (job_type in ('MMV_DISCOVERY','BRAND_CONNECTOR','SOURCE_MONITOR','PRODUCT_YEAR','PRICE_INTELLIGENCE'));

create or replace function public.enqueue_price_intelligence_job(
  p_brand text, p_created_by uuid
) returns public.agent_jobs
language plpgsql security invoker set search_path = '' as $$
declare result public.agent_jobs;
begin
  if p_created_by is null or coalesce(length(btrim(p_brand)),0) not between 1 and 100
    then raise exception 'AGENT_JOB_INVALID_INPUT'; end if;
  insert into public.agent_jobs(job_type,status,market,brand,input,created_by)
    values ('PRICE_INTELLIGENCE','QUEUED','BR',btrim(p_brand),
      '{"provider":"deterministic","persistFindings":true}'::jsonb,p_created_by)
    returning * into result;
  return result;
exception when unique_violation then raise exception 'AGENT_JOB_ALREADY_ACTIVE';
end $$;
revoke all on function public.enqueue_price_intelligence_job(text,uuid) from public,anon,authenticated;
grant execute on function public.enqueue_price_intelligence_job(text,uuid) to service_role;
