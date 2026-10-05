-- Sprint 20J: run Brand Connector research through the shared asynchronous worker.

alter table public.agent_jobs
  drop constraint agent_jobs_job_type_check;

alter table public.agent_jobs
  add constraint agent_jobs_job_type_check
  check (job_type in ('MMV_DISCOVERY','BRAND_CONNECTOR'));

drop index if exists public.agent_jobs_one_active_mmv_per_brand_idx;

create unique index agent_jobs_one_active_agent_per_brand_idx
  on public.agent_jobs(job_type, market, lower(btrim(brand)))
  where status in ('QUEUED','RUNNING');

create or replace function public.enqueue_brand_connector_job(
  p_brand text,
  p_mode text,
  p_created_by uuid
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
    or coalesce(length(btrim(p_brand)),0) not between 1 and 100
    or p_mode not in ('discover','health-check')
  then
    raise exception 'AGENT_JOB_INVALID_INPUT';
  end if;

  insert into public.agent_jobs(
    job_type,status,market,brand,input,created_by
  )
  values(
    'BRAND_CONNECTOR',
    'QUEUED',
    'BR',
    btrim(p_brand),
    jsonb_build_object(
      'provider','openai',
      'persistFindings',true,
      'mode',p_mode
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

revoke all on function public.enqueue_brand_connector_job(text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.enqueue_brand_connector_job(text,text,uuid)
  to service_role;
