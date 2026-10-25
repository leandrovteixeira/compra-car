-- Sprint 21: queue Product Year only after successful MMV discovery.

alter table public.agent_jobs
  drop constraint agent_jobs_job_type_check;

alter table public.agent_jobs
  add constraint agent_jobs_job_type_check
  check (job_type in ('MMV_DISCOVERY','BRAND_CONNECTOR','SOURCE_MONITOR','PRODUCT_YEAR'));

create or replace function public.enqueue_product_year_job(
  p_brand text,
  p_created_by uuid,
  p_parent_run_id uuid
)
returns public.agent_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result public.agent_jobs;
begin
  if p_created_by is null
    or p_parent_run_id is null
    or coalesce(length(btrim(p_brand)),0) not between 1 and 100
  then
    raise exception 'AGENT_JOB_INVALID_INPUT';
  end if;

  insert into public.agent_jobs(job_type,status,market,brand,input,created_by)
  values(
    'PRODUCT_YEAR','QUEUED','BR',btrim(p_brand),
    jsonb_build_object(
      'provider','openai',
      'persistFindings',true,
      'reason','MMV_DISCOVERY_COMPLETED',
      'parentRunId',p_parent_run_id
    ),
    p_created_by
  )
  returning * into result;

  return result;
exception
  when unique_violation then
    raise exception 'AGENT_JOB_ALREADY_ACTIVE';
end;
$$;

revoke all on function public.enqueue_product_year_job(text,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.enqueue_product_year_job(text,uuid,uuid)
  to service_role;
